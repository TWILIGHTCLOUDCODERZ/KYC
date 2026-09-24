/*
  # Add fraud_alert and enhanced rejection fields

  1. Changes
    - `profiles`: add `fraud_alert` boolean (default false) to flag suspicious customers
    - `kyc_documents`: add `admin_comment` text column for admin rejection notes (separate from auto rejection_reason)

  2. Notes
    - Non-destructive: only adds new columns with safe defaults
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'fraud_alert'
  ) THEN
    ALTER TABLE profiles ADD COLUMN fraud_alert boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kyc_documents' AND column_name = 'admin_comment'
  ) THEN
    ALTER TABLE kyc_documents ADD COLUMN admin_comment text;
  END IF;
END $$;
