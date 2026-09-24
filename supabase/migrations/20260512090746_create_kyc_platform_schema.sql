/*
  # NTT DATA Bank KYC Platform — Core Schema

  ## Overview
  Creates the full database schema for the KYC onboarding platform including:

  1. New Tables
     - `profiles` — Extended user profile with KYC status, risk level, AML score, and role
     - `kyc_documents` — Uploaded identity/address documents with OCR extraction data
     - `audit_logs` — Immutable audit trail for all system actions
     - `aml_risk_scores` — AML screening history per customer

  2. Security
     - RLS enabled on all tables
     - Customers can only read/update their own data
     - Admins and compliance officers have broader access
     - Audit logs are append-only (no update/delete)

  3. Storage
     - `kyc-documents` bucket for uploaded files (private, RLS-protected)
*/

-- Enum types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'admin', 'compliance_officer', 'relationship_manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status AS ENUM ('not_started', 'in_progress', 'pending_review', 'approved', 'rejected', 'requires_update');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_type AS ENUM ('passport', 'national_id', 'drivers_license', 'utility_bill', 'bank_statement', 'tax_document');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('uploaded', 'processing', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'login', 'logout', 'register',
    'document_upload', 'document_verify', 'document_reject',
    'kyc_submitted', 'kyc_approved', 'kyc_rejected',
    'profile_update', 'admin_review', 'risk_score_update'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── PROFILES TABLE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  phone         text,
  date_of_birth date,
  nationality   text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  postal_code   text,
  country       text,
  role          user_role NOT NULL DEFAULT 'customer',
  kyc_status    kyc_status NOT NULL DEFAULT 'not_started',
  risk_level    risk_level NOT NULL DEFAULT 'low',
  aml_score     integer NOT NULL DEFAULT 0 CHECK (aml_score >= 0 AND aml_score <= 100),
  face_verified boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'compliance_officer', 'relationship_manager')
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'compliance_officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'compliance_officer')
    )
  );

-- ─── KYC DOCUMENTS TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type       document_type NOT NULL,
  file_name           text NOT NULL DEFAULT '',
  file_url            text NOT NULL DEFAULT '',
  status              document_status NOT NULL DEFAULT 'uploaded',
  ocr_extracted_data  jsonb,
  ocr_confidence      numeric(4,3) CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
  rejection_reason    text,
  reviewed_by         uuid REFERENCES auth.users(id),
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own documents"
  ON kyc_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON kyc_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON kyc_documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all documents"
  ON kyc_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'compliance_officer', 'relationship_manager')
    )
  );

CREATE POLICY "Admins can update all documents"
  ON kyc_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'compliance_officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'compliance_officer')
    )
  );

-- ─── AUDIT LOGS TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      audit_action NOT NULL,
  entity_type text,
  entity_id   uuid,
  details     jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'compliance_officer')
    )
  );

-- ─── AML RISK SCORES TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aml_risk_scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score       integer NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level  risk_level NOT NULL DEFAULT 'low',
  flags       text[] NOT NULL DEFAULT '{}',
  screened_at timestamptz NOT NULL DEFAULT now(),
  screened_by uuid REFERENCES auth.users(id),
  notes       text
);

ALTER TABLE aml_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own AML scores"
  ON aml_risk_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert AML scores"
  ON aml_risk_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'compliance_officer')
  ));

CREATE POLICY "Admins can read all AML scores"
  ON aml_risk_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'compliance_officer')
    )
  );

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON kyc_documents(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aml_risk_scores_user_id ON aml_risk_scores(user_id);

-- ─── AUTO-UPDATE updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER kyc_documents_updated_at BEFORE UPDATE ON kyc_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
