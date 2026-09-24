/*
  # Add approval_method column to profiles

  1. Modified Tables
    - `profiles`
      - `approval_method` (text, nullable) - Tracks whether approval was 'auto' or 'manual'

  2. Notes
    - Allows filtering approved customers by how they were approved
    - Defaults to NULL for existing records (treated as manual)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approval_method'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approval_method text DEFAULT NULL;
  END IF;
END $$;