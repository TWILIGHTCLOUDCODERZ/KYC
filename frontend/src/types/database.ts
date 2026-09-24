export type UserRole = 'customer' | 'admin' | 'compliance_officer' | 'relationship_manager' | 'kyc_officer';
export type KYCStatus = 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'rejected' | 'requires_update';
export type DocumentType = 'passport' | 'national_id' | 'drivers_license' | 'utility_bill' | 'bank_statement' | 'tax_document' | 'photo' | 'salary_proof' | 'live_face' | 'kyc_profile';
export type DocumentStatus = 'uploaded' | 'processing' | 'verified' | 'rejected';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AuditAction =
  | 'login' | 'logout' | 'register'
  | 'document_upload' | 'document_verify' | 'document_reject'
  | 'kyc_submitted' | 'kyc_approved' | 'kyc_rejected'
  | 'profile_update' | 'admin_review' | 'risk_score_update';

export type AccountStatus = 'active' | 'suspended' | 'pending' | 'closed';

export type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  role: UserRole;
  kyc_status: KYCStatus;
  risk_level: RiskLevel;
  aml_score: number;
  face_verified: boolean;
  is_active: boolean;
  kyc_stage?: number | null;
  account_status: AccountStatus;
  approval_level: number;
  approved_by?: string | null;
  approved_at?: string | null;
  role_assigned_at?: string | null;
  role_assigned_by?: string | null;
  last_login_at?: string | null;
  fraud_alert?: boolean;
  approval_method?: 'auto' | 'manual' | null;
  created_at: string;
  updated_at: string;
}

export type KYCDocument = {
  id: string;
  user_id: string;
  document_type: DocumentType;
  file_name: string;
  file_url: string;
  status: DocumentStatus;
  ocr_extracted_data?: Record<string, unknown> | null;
  ocr_confidence?: number | null;
  rejection_reason?: string | null;
  reviewed_by?: string;
  reviewed_at?: string;
  verification_scores?: Record<string, unknown> | null;
  verification_status?: 'pass' | 'fail' | 'pending';
  admin_comment?: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditLog = {
  id: string;
  user_id?: string;
  actor_id?: string;
  action: AuditAction;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export type AMLRiskScore = {
  id: string;
  user_id: string;
  score: number;
  risk_level: RiskLevel;
  flags: string[];
  screened_at: string;
  screened_by?: string;
  notes?: string;
}

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'> & {
          account_status?: string;
          approval_level?: number;
        };
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      kyc_documents: {
        Row: KYCDocument;
        Insert: Omit<KYCDocument, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<KYCDocument, 'id' | 'created_at'>>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'>;
        Update: Record<string, never>;
        Relationships: [];
      };
      aml_risk_scores: {
        Row: AMLRiskScore;
        Insert: Omit<AMLRiskScore, 'id'>;
        Update: Partial<Omit<AMLRiskScore, 'id'>>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
}

// Helper: check if role has admin-level access
export const isAdminRole = (role?: UserRole) =>
  role === 'admin' || role === 'compliance_officer' || role === 'kyc_officer';

// KYC onboarding steps for customer sidebar
export const KYC_ONBOARDING_STEPS = [
  { id: 1, key: 'photo',        label: 'Profile Photo',       description: 'Face photo verification',      path: '/onboarding/photo' },
  { id: 2, key: 'passport',     label: 'Passport / ID',       description: 'Valid government-issued ID',   path: '/onboarding/passport' },
  { id: 3, key: 'live_face',    label: 'Live Face Check',     description: 'Liveness detection',           path: '/onboarding/live-face' },
  { id: 4, key: 'address',      label: 'Address Proof',       description: 'Utility bill or bank letter',  path: '/onboarding/address' },
  { id: 5, key: 'tax',          label: 'Tax Document',        description: 'Tax ID / W-2 / ITIN',          path: '/onboarding/tax' },
  { id: 6, key: 'salary',       label: 'Salary Proof',        description: 'Payslip / income cert',        path: '/onboarding/salary' },
] as const;

export type OnboardingStepKey = typeof KYC_ONBOARDING_STEPS[number]['key'];
