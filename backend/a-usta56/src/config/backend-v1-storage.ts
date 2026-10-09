import { supabase } from "./supabase.js";

const PRIVATE_BUCKETS = [
  "rental-evidence",
  "kyc-documents",
] as const;

export async function ensureBackendV1Buckets(): Promise<void> {
  for (const name of PRIVATE_BUCKETS) {
    const { data, error: getError } =
      await supabase.storage.getBucket(name);

    if (getError) {
      throw new Error(
        `Storage bucket ${name} could not be checked: ${getError.message}`,
      );
    }

    if (data) {
      continue;
    }

    const { error: createError } =
      await supabase.storage.createBucket(
        name,
        {
          public: false,
          fileSizeLimit:
            25 * 1024 * 1024,
        },
      );

    if (
      createError &&
      !/already exists/i.test(
        createError.message,
      )
    ) {
      throw new Error(
        `Storage bucket ${name} could not be created: ${createError.message}`,
      );
    }
  }
}
