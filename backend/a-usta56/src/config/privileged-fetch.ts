/** New Supabase secrets are API keys, never caller JWTs. Legacy keys stay unchanged. */
export function privilegedFetch(key: string, transport: typeof fetch = fetch): typeof fetch {
  if (!key.startsWith("sb_secret_")) return transport;
  return (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    return transport(input, { ...init, headers });
  };
}
