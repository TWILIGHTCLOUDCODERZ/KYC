/*
  # Add timestamps, status fields, and role metadata to profiles

  ## Changes
  1. New columns on `profiles`:
     - `last_login_at` (timestamptz) — set on every successful login
     - `account_status` (text) — 'active' | 'suspended' | 'pending' | 'closed'
     - `approval_level` (integer) — numeric approval tier; admins default to -1, customers to 0
     - `approved_by` (uuid) — who approved this account
     - `approved_at` (timestamptz) — when the account was approved
     - `role_assigned_at` (timestamptz) — when role was last changed
     - `role_assigned_by` (uuid) — who assigned the role

  2. Default values ensure no data loss for existing rows.

  3. `kyc_officer` added to user_role enum if not already present (handled by earlier migration).
*/

-- Add last_login_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

-- Add account_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN account_status text NOT NULL DEFAULT 'active'
      CHECK (account_status IN ('active', 'suspended', 'pending', 'closed'));
  END IF;
END $$;

-- Add approval_level (admins = -1, customers = 0 by default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approval_level'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approval_level integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add approved_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approved_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add approved_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

-- Add role_assigned_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role_assigned_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role_assigned_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add role_assigned_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role_assigned_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role_assigned_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Backfill approval_level = -1 for all existing admin accounts
UPDATE profiles
SET approval_level = -1
WHERE role IN ('admin', 'compliance_officer', 'kyc_officer', 'relationship_manager')
  AND approval_level = 0;

-- Index for fast login-time lookups
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_level ON profiles(approval_level);
