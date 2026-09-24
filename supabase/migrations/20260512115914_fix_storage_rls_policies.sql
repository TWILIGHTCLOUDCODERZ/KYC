-- Fix Storage RLS Policies for kyc-documents bucket
-- Users can upload/read/update/delete their own files
-- Admins and KYC officers can read all files
-- Storage paths: {user_id}/{document_type}/{timestamp}_{filename}

CREATE POLICY "Users can upload own documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can read all kyc documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.role IN ('admin', 'compliance_officer', 'kyc_officer', 'relationship_manager')
      )
    )
  );

CREATE POLICY "Users can update own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
