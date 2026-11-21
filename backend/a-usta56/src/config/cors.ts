const DEFAULT_CORS_ORIGINS = [
  "https://a-usta.github.io",
  "https://a-usta-webside.onrender.com",
] as const;

/**
 * Accept an explicit comma-separated origin allowlist for isolated TEST
 * services. Production keeps the existing fixed origins when unset.
 */
export function parseCorsOrigins(value: string | undefined): string[] {
  if (value === undefined || value.trim() === "") return [...DEFAULT_CORS_ORIGINS];
  const entries = value.split(",").map(entry => entry.trim());
  if (entries.length > 16 || entries.some(entry => entry === "")) {
    throw new Error("CORS_ORIGINS must contain 1–16 comma-separated web origins.");
  }
  const origins = [...new Set(entries)];
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("CORS_ORIGINS entries must be absolute HTTP(S) origins without paths.");
    }
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      parsed.username !== "" ||
      parsed.password !== ""
    ) {
      throw new Error("CORS_ORIGINS entries must be absolute HTTP(S) origins without paths or credentials.");
    }
  }
  return origins;
}
