import "dotenv/config";
import { parseCorsOrigins } from "./cors.js";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",

  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  // TEST-only Places server key. Optional so existing deployments remain
  // bootable when Places is not configured; the value is never logged.
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY?.trim() || "",
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
};
