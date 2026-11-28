import { CATEGORIES, type Category, type CategoryKey, type Listing, type ListingSource } from './marketplace';

type OwnedListingError = { key: CategoryKey; title: string; code?: string };
export type OwnedListingResult = { rows: Listing[]; errors: OwnedListingError[] };
export type OwnedListingFilter = 'all'|'active'|'vip'|'premium'|'expired'|'draft'|'inactive';

const OWNED_SELECT: Record<ListingSource, string> = {
  vehicle: 'id,owner_id,status,brand,model,created_at,listing_type,price,daily_price,currency,details,promotion_type,promotion_started_at,promotion_until,last_boosted_at,published_at,first_published_at,expires_at',
  marketplace: 'id,owner_id,status,title,brand,model,created_at,category,details,price,currency,promotion_type,promotion_started_at,promotion_until,last_boosted_at,published_at,first_published_at,expires_at',
  service_provider: 'id,owner_id,status,title,name,specialty,services,experience,working_hours,region,district,created_at,provider_type,details,promotion_type,promotion_started_at,promotion_until,last_boosted_at,published_at,first_published_at,expires_at',
  auto_dealer: 'id,owner_id,status,dealer_name,brands,about,created_at,details,promotion_type,promotion_started_at,promotion_until,last_boosted_at,published_at,first_published_at,expires_at',
};

function queryForCategory(client: any, ownerId: string, category: Category) {
  // Provider listings use the existing security-barrier view: it returns full
  // details only where owner_id = auth.uid(), and redacts owner_id for every
  // other row. The base table has no client SELECT grant, by design.
  let query = client.from(category.table).select(OWNED_SELECT[category.source]).eq('owner_id', ownerId);
  if (category.source === 'vehicle') query = query.eq('listing_type', category.sourceValue);
  else if (category.source === 'marketplace') query = query.eq('category', category.sourceValue);
  else if (category.source === 'service_provider') {
    query = query.eq('provider_type', category.sourceValue === 'usta' ? 'usta' : 'service');
    if (category.key === 'service') query = query.or('details->>service_category.is.null,details->>service_category.not.in.(insurance,leasing,sober_driver)');
    else if (['insurance', 'leasing', 'sober_driver'].includes(category.key)) query = query.contains('details', { service_category: category.key });
  }
  return query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(200);
}

/**
 * Read each owned category independently. A stale or unavailable category
 * query must not hide the account's listings from the other categories.
 * All requests still use the signed-in user's owner_id and the table's RLS.
 */
export async function loadOwnedListings(client: any, ownerId: string): Promise<OwnedListingResult> {
  const outcomes = await Promise.all(CATEGORIES.map(async category => {
    try {
      const result = await queryForCategory(client, ownerId, category);
      return { category, result };
    } catch (error) {
      return { category, result: { data: null, error } };
    }
  }));

  const rows: Listing[] = [];
  const errors: OwnedListingError[] = [];
  for (const { category, result } of outcomes) {
    if (result.error) {
      const code = typeof result.error === 'object' && result.error && 'code' in result.error ? String((result.error as { code?: unknown }).code || '') : '';
      errors.push({ key: category.key, title: category.title, ...(code ? { code } : {}) });
      continue;
    }
    for (const row of (result.data || []) as Record<string, any>[]) {
      // Even if a faulty/mock API returns another owner's row, never render it.
      if (row.owner_id !== ownerId) continue;
      rows.push({ ...row, _category: category.key, _categoryTitle: category.title, _source: category.source } as unknown as Listing);
    }
  }

  const unique = [...new Map(rows.map(row => [`${row._source}:${row.id}`, row])).values()];
  return { rows: unique, errors };
}

/** One stable category/source mapping for the owner renewal RPC. */
export async function renewOwnedListing(client: any, row: Record<string, any>, requestId: string) {
  if (!row?.owner_id || !row.id || !row._source || row.status !== 'expired') {
    throw new Error('Yalnız sahibinə aid vaxtı bitmiş elan yenilənə bilər.');
  }
  const session = await client.auth.getUser();
  if (session.error) throw session.error;
  if (session.data?.user?.id !== row.owner_id) throw new Error('Elanın sahibi təsdiqlənmədi.');
  const result = await client.rpc('austa_renew_listing', {
    p_source: row._source,
    p_listing_id: row.id,
    p_request_id: requestId,
  });
  if (result.error) throw result.error;
  const renewed = Array.isArray(result.data) ? result.data[0] : result.data;
  if (renewed?.listing_id !== row.id || renewed?.status !== 'active' || !renewed?.expires_at) {
    throw new Error('Elan yenilənməsi server tərəfindən təsdiqlənmədi.');
  }
  return renewed as { listing_id: string; status: string; expires_at: string; replayed: boolean };
}

export function filterOwnedListings(rows: Record<string, any>[], filter: OwnedListingFilter, now = Date.now()): Record<string, any>[] {
  return rows.filter(item => {
    const promoActive = Boolean(item.promotion_until && Date.parse(String(item.promotion_until)) > now &&
      (!item.promotion_started_at || Date.parse(String(item.promotion_started_at)) <= now));
    if (filter === 'vip' || filter === 'premium') return item.promotion_type === filter && promoActive;
    if (filter === 'inactive') return ['inactive', 'archived', 'sold', 'rented'].includes(String(item.status));
    return filter === 'all' || item.status === filter;
  });
}

function detailObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
    catch { return {}; }
  }
  return {};
}

/** Real category-specific details used when a listing source has no price column. */
export function ownedListingServiceDetails(row: Record<string, any>): string[] {
  const details = detailObject(row.details);
  const category = row._category as CategoryKey | undefined;
  if (category === 'service') return [row.specialty, row.services || details.services, details.price_policy, row.region || details.city, row.working_hours || details.working_hours].filter(Boolean).map(String);
  if (category === 'usta') return [row.specialty, row.services || details.services, row.experience || details.experience, row.region || details.service_area, row.working_hours || details.working_hours].filter(Boolean).map(String);
  if (category === 'sober_driver') return [details.city, details.service_area, details.minimum_order_price, details.rate_per_km, details.rate_per_hour, details.night_rate, details.waiting_fee].filter(value => value != null && String(value).trim() !== '').map(String);
  if (category === 'leasing') return [details.company_name, details.city, details.vehicle_condition, details.minimum_financing, details.maximum_financing, details.currency].filter(value => value != null && String(value).trim() !== '').map(String);
  if (category === 'insurance') return [details.company_name, details.city, details.insurance_types, details.coverage, details.franchise, details.payment_methods].filter(Boolean).map(String);
  return [];
}

export function ownedListingTitle(row: Record<string, any>): string {
  if (row._category === 'cars' || row._category === 'rent') return [row.brand, row.model].filter(Boolean).join(' ') || 'A-USTA elanı';
  const details = detailObject(row.details);
  return String(row.title || row.dealer_name || details.company_name || row.name || row.specialty || 'A-USTA elanı');
}

export function ownedListingDirectPrice(row: Record<string, any>): { amount: number | string; currency: string; perDay: boolean } | null {
  if (row._source === 'service_provider' || ['service', 'usta', 'insurance', 'leasing', 'sober_driver'].includes(String(row._category))) return null;
  const amount = row._category === 'rent' ? row.daily_price : row.price;
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const code = ['AZN', 'USD', 'EUR'].includes(row.currency) ? row.currency : 'AZN';
  return { amount, currency: code, perDay: row._category === 'rent' };
}
