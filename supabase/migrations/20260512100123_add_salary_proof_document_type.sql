/*
  # Add salary_proof to document_type enum
  Adds salary_proof as a valid KYC document type for payslip / income verification uploads.
*/
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'salary_proof';
