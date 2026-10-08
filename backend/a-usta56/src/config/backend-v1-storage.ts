import { supabase } from "./supabase.js";

const PRIVATE_BUCKETS = [
  "rental-evidence",
  "kyc-documents",
] as const;

export async function ensureBackendV1Buckets() {
  for (const name of PRIVATE_BUCKETS) {
    const { data } = await supabase.storage.getBucket(name);

    if (data) continue;

    const { error } = await supabase.storage.createBucket(name, {
      public: false,
      fileSizeLimit: 25 * 1024 * 1024,
    });

    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Storage bucket ${name} could not be created: ${error.message}`);
    }
  }
}
