/*
  # Add KYC Officer RLS Policies - Step 2
  Adds policies allowing kyc_officers to read/update profiles, documents, and audit logs.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='KYC officers can read all profiles') THEN
    CREATE POLICY "KYC officers can read all profiles"
      ON profiles FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.user_id = auth.uid()
          AND p.role = 'kyc_officer'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='KYC officers can update kyc status') THEN
    CREATE POLICY "KYC officers can update kyc status"
      ON profiles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.user_id = auth.uid()
          AND p.role = 'kyc_officer'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.user_id = auth.uid()
          AND p.role = 'kyc_officer'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kyc_documents' AND policyname='KYC officers can read all documents') THEN
    CREATE POLICY "KYC officers can read all documents"
      ON kyc_documents FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.user_id = auth.uid()
          AND p.role = 'kyc_officer'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kyc_documents' AND policyname='KYC officers can update all documents') THEN
    CREATE POLICY "KYC officers can update all documents"
      ON kyc_documents FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.user_id = auth.uid()
          AND p.role = 'kyc_officer'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.user_id = auth.uid()
          AND p.role = 'kyc_officer'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='KYC officers can read audit logs') THEN
    CREATE POLICY "KYC officers can read audit logs"
      ON audit_logs FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.user_id = auth.uid()
          AND p.role = 'kyc_officer'
        )
      );
  END IF;
END $$;
