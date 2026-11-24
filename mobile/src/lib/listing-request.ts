export type ListingRequestError = Error & { code?: string; status?: number };

export class ListingRequestTimeoutError extends Error {
  readonly code = 'LISTING_TIMEOUT';

  constructor() {
    super('The listing server did not respond before the request deadline.');
    this.name = 'ListingRequestTimeoutError';
  }
}

/** Bounds APIs that do not expose AbortSignal (such as this storage upload SDK version). */
export async function withListingTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  onLateResult?: (result: T) => void | Promise<void>,
): Promise<T> {
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const source = Promise.resolve(operation).then(result => {
    if (timedOut && onLateResult) void Promise.resolve(onLateResult(result)).catch(() => undefined);
    return result;
  });
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new ListingRequestTimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([source, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

type AbortableRequest<T> = PromiseLike<T> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<T>;
};

type RequestResult = { error?: unknown };

function retryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as ListingRequestError;
  const code = String(value.code || '');
  const status = Number(value.status || 0);
  const message = String(value.message || '').toLowerCase();
  return status === 0 || status >= 500 || /^PGRST00[0-3]$/.test(code) ||
    /network|timeout|timed out|connection|fetch failed/.test(message);
}

/** Bounded PostgREST request. Read callers may retry transient failures; writes default to no retry. */
export async function runListingRequest<T extends RequestResult>(
  create: (signal: AbortSignal) => AbortableRequest<T>,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const retries = options.retries ?? 0;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new ListingRequestTimeoutError());
      }, timeoutMs);
    });

    try {
      const request = create(controller.signal);
      const result = await Promise.race([
        Promise.resolve(request.abortSignal ? request.abortSignal(controller.signal) : request),
        timeout,
      ]);
      if (attempt < retries && retryable(result.error)) continue;
      return result;
    } catch (error) {
      if (attempt < retries && (timedOut || retryable(error))) continue;
      if (timedOut) throw new ListingRequestTimeoutError();
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  throw new ListingRequestTimeoutError();
}

/** Converts a timeout/rejected fetch into the same { data, error } shape Supabase returns. */
export async function safeListingRequest<T extends RequestResult & { data?: unknown }>(
  create: (signal: AbortSignal) => AbortableRequest<T>,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  try {
    return await runListingRequest(create, options);
  } catch (error) {
    return { data: null, error } as T;
  }
}
