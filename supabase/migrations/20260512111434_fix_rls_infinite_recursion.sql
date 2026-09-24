/*
  # Fix infinite recursion in profiles RLS policies

  ## Problem
  The admin/kyc-officer SELECT and UPDATE policies on `profiles` do a subquery
  `SELECT 1 FROM profiles WHERE user_id = auth.uid()` — this triggers the same
  SELECT policy, causing infinite recursion (error code 42P17).

  ## Fix
  1. Create a SECURITY DEFINER helper function `get_my_role()` that reads the
     current user's role from `profiles` while bypassing RLS, breaking the loop.
  2. Drop and recreate every policy on `profiles` and `kyc_documents` that
     referenced the self-join pattern to use the new helper instead.
*/

-- ── Helper: fetch current user's role bypassing RLS ──────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ── PROFILES: drop recursive policies ────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all profiles"       ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles"     ON profiles;
DROP POLICY IF EXISTS "KYC officers can read all profiles" ON profiles;
DROP POLICY IF EXISTS "KYC officers can update kyc status" ON profiles;

-- ── PROFILES: recreate using get_my_role() ───────────────────────────────────
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

-- ── KYC_DOCUMENTS: drop recursive policies ───────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all documents"       ON kyc_documents;
DROP POLICY IF EXISTS "Admins can update all documents"     ON kyc_documents;
DROP POLICY IF EXISTS "KYC officers can read all documents" ON kyc_documents;
DROP POLICY IF EXISTS "KYC officers can update all documents" ON kyc_documents;

-- ── KYC_DOCUMENTS: recreate using get_my_role() ──────────────────────────────
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

-- ── AUDIT_LOGS: same fix ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'compliance_officer'));

-- ── AML_RISK_SCORES: same fix ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all AML scores"        ON aml_risk_scores;
DROP POLICY IF EXISTS "Authenticated users can insert AML scores" ON aml_risk_scores;

CREATE POLICY "Admins can read all AML scores"
  ON aml_risk_scores FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'compliance_officer'));

CREATE POLICY "Authenticated users can insert AML scores"
  ON aml_risk_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR get_my_role() IN ('admin', 'compliance_officer'));
