/*
  # Migrate to Firebase Auth (Supabase Third-Party Auth bridge)

  ## Why
  Login now goes through Firebase Authentication instead of Supabase Auth.
  Firebase issues its own JWTs whose `sub` claim is an opaque string (not a
  UUID), so every column that used to store a Supabase `auth.users.id`
  (uuid, FK'd to auth.users) is retyped to `text` with the FK dropped —
  Supabase's Third-Party Auth feature (configure Firebase as a provider in
  Authentication > Sign In / Providers) verifies the Firebase JWT and makes
  its claims available to RLS via `auth.jwt()`.

  `auth.uid()` is declared to return `uuid` and would error on a non-UUID
  sub, so every policy below reads `(auth.jwt()->>'sub')` directly instead.

  Run this only after there are no Supabase-Auth users left to preserve
  (fresh project / no production users), since existing `uuid` values are
  cast to text as-is and won't match any future Firebase UID.

  ## Changes
  1. Drop every policy (and `get_my_role()`) that references the columns
     being retyped, plus their FKs to `auth.users`.
  2. Retype `profiles.user_id/approved_by/role_assigned_by`,
     `kyc_documents.user_id/reviewed_by`, `audit_logs.user_id/actor_id`,
     `aml_risk_scores.user_id/screened_by` from `uuid` to `text`.
  3. Recreate `get_my_role()` and every policy against
     `(auth.jwt()->>'sub')` instead of `auth.uid()`.
  4. Recreate the `kyc-documents` storage policies the same way.
*/

-- ── 0. Drop policies/functions that reference the columns being retyped ──────

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "KYC officers can read all profiles" ON profiles;
DROP POLICY IF EXISTS "KYC officers can update kyc status" ON profiles;

DROP POLICY IF EXISTS "Users can read own documents" ON kyc_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON kyc_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON kyc_documents;
DROP POLICY IF EXISTS "Admins can read all documents" ON kyc_documents;
DROP POLICY IF EXISTS "Admins can update all documents" ON kyc_documents;
DROP POLICY IF EXISTS "KYC officers can read all documents" ON kyc_documents;
DROP POLICY IF EXISTS "KYC officers can update all documents" ON kyc_documents;

DROP POLICY IF EXISTS "Users can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "KYC officers can read audit logs" ON audit_logs;

DROP POLICY IF EXISTS "Users can read own AML scores" ON aml_risk_scores;
DROP POLICY IF EXISTS "Authenticated users can insert AML scores" ON aml_risk_scores;
DROP POLICY IF EXISTS "Admins can read all AML scores" ON aml_risk_scores;

DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all kyc documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

DROP FUNCTION IF EXISTS get_my_role();

-- ── 1. Drop FKs to auth.users and retype id columns from uuid to text ────────

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_approved_by_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_assigned_by_fkey;

ALTER TABLE profiles
  ALTER COLUMN user_id TYPE text USING user_id::text,
  ALTER COLUMN approved_by TYPE text USING approved_by::text,
  ALTER COLUMN role_assigned_by TYPE text USING role_assigned_by::text;

ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_user_id_fkey;
ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_reviewed_by_fkey;

ALTER TABLE kyc_documents
  ALTER COLUMN user_id TYPE text USING user_id::text,
  ALTER COLUMN reviewed_by TYPE text USING reviewed_by::text;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

ALTER TABLE audit_logs
  ALTER COLUMN user_id TYPE text USING user_id::text,
  ALTER COLUMN actor_id TYPE text USING actor_id::text;

ALTER TABLE aml_risk_scores DROP CONSTRAINT IF EXISTS aml_risk_scores_user_id_fkey;
ALTER TABLE aml_risk_scores DROP CONSTRAINT IF EXISTS aml_risk_scores_screened_by_fkey;

ALTER TABLE aml_risk_scores
  ALTER COLUMN user_id TYPE text USING user_id::text,
  ALTER COLUMN screened_by TYPE text USING screened_by::text;

ALTER TABLE profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE kyc_documents ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE aml_risk_scores ALTER COLUMN user_id SET NOT NULL;

-- ── 2. Recreate get_my_role() against the Firebase sub claim ─────────────────

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = (auth.jwt()->>'sub') LIMIT 1;
$$;

-- ── 3. Recreate table policies against (auth.jwt()->>'sub') ──────────────────

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'sub') = user_id)
  WITH CHECK ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'compliance_officer', 'relationship_manager'));

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'compliance_officer'))
  WITH CHECK (get_my_role() IN ('admin', 'compliance_officer'));

CREATE POLICY "KYC officers can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (get_my_role() = 'kyc_officer');

CREATE POLICY "KYC officers can update kyc status"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'kyc_officer')
  WITH CHECK (get_my_role() = 'kyc_officer');

CREATE POLICY "Users can read own documents"
  ON kyc_documents FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users can insert own documents"
  ON kyc_documents FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users can update own documents"
  ON kyc_documents FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'sub') = user_id)
  WITH CHECK ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Admins can read all documents"
  ON kyc_documents FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'compliance_officer', 'relationship_manager'));

CREATE POLICY "Admins can update all documents"
  ON kyc_documents FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'compliance_officer'))
  WITH CHECK (get_my_role() IN ('admin', 'compliance_officer'));

CREATE POLICY "KYC officers can read all documents"
  ON kyc_documents FOR SELECT
  TO authenticated
  USING (get_my_role() = 'kyc_officer');

CREATE POLICY "KYC officers can update all documents"
  ON kyc_documents FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'kyc_officer')
  WITH CHECK (get_my_role() = 'kyc_officer');

CREATE POLICY "Users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'sub') = actor_id);

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'compliance_officer'));

CREATE POLICY "KYC officers can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (get_my_role() = 'kyc_officer');

CREATE POLICY "Users can read own AML scores"
  ON aml_risk_scores FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Authenticated users can insert AML scores"
  ON aml_risk_scores FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'sub') = user_id OR get_my_role() IN ('admin', 'compliance_officer'));

CREATE POLICY "Admins can read all AML scores"
  ON aml_risk_scores FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'compliance_officer'));

-- ── 4. Recreate storage policies (kyc-documents bucket, path {uid}/{doctype}/...) ─

CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  );

CREATE POLICY "Users can read own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  );

CREATE POLICY "Admins can read all kyc documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND get_my_role() IN ('admin', 'compliance_officer', 'kyc_officer', 'relationship_manager')
  );

CREATE POLICY "Users can update own documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  )
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  );

CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  );
