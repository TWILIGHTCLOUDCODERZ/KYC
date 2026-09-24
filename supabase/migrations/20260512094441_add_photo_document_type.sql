/*
  # Add 'photo' to document_type enum
  Adds photo as a valid document type for profile photo upload step in KYC onboarding.
*/
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'photo';
