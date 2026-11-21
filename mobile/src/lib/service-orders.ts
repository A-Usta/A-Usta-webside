import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SERVICE_API = 'https://a-usta-webside.onrender.com';
const TEST_SERVICE_API_HOST = 'austa-v40-m7-test-api.onrender.com';
export function resolveServiceApiBase(raw: string, appEnv: string | undefined) {
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Service API ünvanı təhlükəsiz HTTPS olmalıdır.');
  }
  const isTestRuntime = appEnv?.trim().toLowerCase() === 'test';
  const isAustaTestHost = parsed.hostname === TEST_SERVICE_API_HOST;
  const isAllowedHost = isTestRuntime
    ? isAustaTestHost
    : parsed.hostname === 'a-usta-webside.onrender.com';
  if (!isAllowedHost) {
    throw new Error('Mobil service-orders API yalnız təsdiqlənmiş A-USTA Render hostunda işləyə bilər.');
  }
  return parsed.toString().replace(/\/$/, '');
}

const apiBase = () => resolveServiceApiBase(
  (process.env.EXPO_PUBLIC_SERVICE_API_URL || DEFAULT_SERVICE_API).trim(),
  process.env.EXPO_PUBLIC_APP_ENV,
);

export type OrderAnswer = { question: string; value: string | Record<string, unknown>[] };
export type ServiceOrderInput = {
  service_category: 'mechanic_service' | 'tow_service' | 'cargo_service';
  service_description: string;
  urgency: 'normal' | 'urgent';
  service_mode: 'mobile' | 'shop';
  address: string;
  region: string;
  district?: string;
  latitude: number | null;
  longitude: number | null;
  estimated_price_min?: number | null;
  estimated_price_max?: number | null;
  price_status: 'unknown' | 'estimated';
  customer_note?: string;
  vehicle_id?: string | null;
  client_order_id: string;
  form_version: string;
  answers: OrderAnswer[];
  evidence_files: Record<string, unknown>[];
};

export type ServiceOrder = Record<string, any> & { id: string; status: string; client_order_id?: string };
export class ServiceApiError extends Error {
  status: number;
  definite: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ServiceApiError';
    this.status = status;
    this.definite = [400, 401, 403, 404, 409, 413, 415, 422, 429].includes(status);
  }
}

export function newClientOrderId() {
  const c = globalThis.crypto as Crypto | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const n = Math.floor(Math.random() * 16);
    return (ch === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

export async function serviceRequest<T>(client: SupabaseClient, path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error('Bu əməliyyat üçün A-USTA hesabına daxil olun.');
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('Server cavabı alınmadı. Eyni sifarişi avtomatik təkrar göndərmədik.');
  }
  let body: any = null;
  try { body = await response.json(); } catch { /* malformed error handled below */ }
  if (!response.ok) throw new ServiceApiError(body?.message || body?.error || `Server xətası (${response.status}).`, response.status);
  return body as T;
}

export async function loadCustomerOrders(client: SupabaseClient): Promise<ServiceOrder[]> {
  const result = await serviceRequest<{ orders?: ServiceOrder[] }> (client, '/service-orders');
  return Array.isArray(result.orders) ? result.orders : [];
}

export async function reconcileOrder(client: SupabaseClient, clientOrderId: string) {
  const rows = await loadCustomerOrders(client);
  return rows.find(order => order.client_order_id === clientOrderId) || null;
}

export async function createServiceOrder(client: SupabaseClient, input: ServiceOrderInput) {
  return serviceRequest<{ order: ServiceOrder; message?: string }>(client, '/service-orders', { method: 'POST', body: JSON.stringify(input) });
}

export async function dispatchServiceOrder(client: SupabaseClient, orderId: string) {
  return serviceRequest<{ order_id: string; discovered_count: number; offered_count: number; skipped_count: number; assignments: Record<string, any>[] }>(client, `/service-orders/${encodeURIComponent(orderId)}/dispatch`, { method: 'POST' });
}

export async function loadProviderAssignments(client: SupabaseClient) {
  const result = await serviceRequest<{ assignments?: Record<string, any>[] }>(client, '/service-order-assignments');
  return Array.isArray(result.assignments) ? result.assignments : [];
}

export async function providerAction(client: SupabaseClient, assignmentId: string, action: 'accept' | 'reject' | 'start' | 'complete', values: { final_price?: number; price_status?: string } = {}) {
  return serviceRequest<Record<string, any>>(client, `/service-order-assignments/${encodeURIComponent(assignmentId)}/${action}`, { method: 'PATCH', body: JSON.stringify(values) });
}

export async function customerPriceAction(client: SupabaseClient, orderId: string, action: 'approve' | 'reject') {
  return serviceRequest<Record<string, any>>(client, `/service-orders/${encodeURIComponent(orderId)}/price/${action}`, { method: 'PATCH', body: JSON.stringify({}) });
}

export async function providerPriceOffer(client: SupabaseClient, assignmentId: string, proposedPrice: number) {
  return serviceRequest<Record<string, any>>(client, `/service-order-assignments/${encodeURIComponent(assignmentId)}/price-offer`, { method: 'PATCH', body: JSON.stringify({ proposed_price: proposedPrice }) });
}

export async function uploadProviderEvidence(client: SupabaseClient, assignmentId: string, stage: 'before' | 'after', file: { uri: string; name: string; type: string }) {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
  return serviceRequest<Record<string, any>>(client, `/service-order-assignments/${encodeURIComponent(assignmentId)}/evidence/${stage}`, { method: 'POST', body: form });
}

export const ORDER_STATUSES: Record<string, string> = {
  pending: 'Təkliflər gözlənilir',
  accepted: 'Təminatçı sifarişi qəbul edib',
  in_progress: 'İş davam edir',
  completed: 'Tamamlanıb',
  cancelled: 'Ləğv edilib',
};
