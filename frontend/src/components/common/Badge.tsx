import type { KYCStatus, RiskLevel, DocumentStatus } from '../../types/database';

export function KYCStatusBadge({ status }: { status: KYCStatus }) {
  const map: Record<KYCStatus, { label: string; cls: string }> = {
    not_started: { label: 'Not Started', cls: 'badge-gray' },
    in_progress: { label: 'In Progress', cls: 'badge-blue' },
    pending_review: { label: 'Pending Review', cls: 'badge-warning' },
    approved: { label: 'Approved', cls: 'badge-success' },
    rejected: { label: 'Rejected', cls: 'badge-error' },
    requires_update: { label: 'Requires Update', cls: 'badge-warning' },
  };
  const { label, cls } = map[status] || map.not_started;
  return <span className={cls}>{label}</span>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, { label: string; cls: string }> = {
    low: { label: 'Low Risk', cls: 'badge-success' },
    medium: { label: 'Medium Risk', cls: 'badge-warning' },
    high: { label: 'High Risk', cls: 'badge-error' },
    critical: { label: 'Critical Risk', cls: 'badge bg-red-100 text-red-800' },
  };
  const { label, cls } = map[level] || map.low;
  return <span className={cls}>{label}</span>;
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const map: Record<DocumentStatus, { label: string; cls: string }> = {
    uploaded: { label: 'Uploaded', cls: 'badge-blue' },
    processing: { label: 'Processing', cls: 'badge-warning' },
    verified: { label: 'Verified', cls: 'badge-success' },
    rejected: { label: 'Rejected', cls: 'badge-error' },
  };
  const { label, cls } = map[status] || map.uploaded;
  return <span className={cls}>{label}</span>;
}
