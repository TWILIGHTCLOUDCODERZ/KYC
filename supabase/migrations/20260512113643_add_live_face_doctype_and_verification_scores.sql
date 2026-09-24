/*
  # Add live_face document type and verification_scores column

  1. Changes
    - Adds 'live_face' to document_type enum
    - Adds 'verification_scores' JSONB column to kyc_documents to store
      AI scorecard results (face_detected, match_score, cross_check, etc.)
    - Adds 'verification_status' column to kyc_documents: pass | fail | pending

  2. Notes
    - live_face is used for the real-time biometric check step
    - verification_scores stores full AI analysis per document
*/

-- Add live_face to document_type enum
DO $$ BEGIN
  ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'live_face';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add verification_scores JSONB column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kyc_documents' AND column_name = 'verification_scores'
  ) THEN
    ALTER TABLE kyc_documents ADD COLUMN verification_scores jsonb;
  END IF;
END $$;

-- Add verification_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kyc_documents' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE kyc_documents ADD COLUMN verification_status text DEFAULT 'pending';
  END IF;
END $$;
