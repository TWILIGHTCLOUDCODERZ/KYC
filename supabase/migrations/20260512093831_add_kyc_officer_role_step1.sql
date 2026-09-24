/*
  # Add KYC Officer Role - Step 1: Enum and column only
  Adds kyc_officer to user_role enum and kyc_stage column.
  Policies are added in step 2 after commit.
*/
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'kyc_officer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'kyc_stage'
  ) THEN
    ALTER TABLE profiles ADD COLUMN kyc_stage integer DEFAULT NULL;
  END IF;
END $$;
