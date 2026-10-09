-- Storage policies for the new private V1 buckets.
-- Buckets themselves can be created by the backend bootstrap helper, or manually in Supabase Storage.

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'austa_rental_evidence_select_own'
  ) THEN
    CREATE POLICY austa_rental_evidence_select_own
    ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'rental-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'austa_rental_evidence_delete_own'
  ) THEN
    CREATE POLICY austa_rental_evidence_delete_own
    ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'rental-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'austa_kyc_documents_insert_own'
  ) THEN
    CREATE POLICY austa_kyc_documents_insert_own
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'kyc-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'austa_kyc_documents_select_own'
  ) THEN
    CREATE POLICY austa_kyc_documents_select_own
    ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'kyc-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
