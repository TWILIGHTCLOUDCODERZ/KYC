import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Upload, Shield, CheckCircle, Clock, ArrowRight,
  FileText, User, Camera, BookOpen, MapPin, Receipt, Banknote,
  ChevronRight, TrendingUp, AlertTriangle, RefreshCw, XCircle
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { KYCStatusBadge } from '../../components/common/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { useDocuments } from '../../hooks/useDocuments';
import type { DocumentType, KYCStatus } from '../../types/database';

/* ─── Upload step definitions ─────────────────────────────── */
const UPLOAD_STEPS: {
  id: number;
  key: DocumentType;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  path: string;
  color: string;
  bg: string;
}[] = [
  { id: 1, key: 'photo',        label: 'Profile Photo',      sublabel: 'Clear face photo',             icon: Camera,   path: '/onboarding/photo',      color: 'text-sky-600',     bg: 'bg-sky-50' },
  { id: 2, key: 'passport',     label: 'Passport / ID',      sublabel: 'Govt-issued identity doc',     icon: BookOpen, path: '/onboarding/passport',   color: 'text-primary-600', bg: 'bg-primary-50' },
  { id: 3, key: 'live_face',    label: 'Live Face Check',    sublabel: 'Real-time biometric verify',   icon: Shield,   path: '/onboarding/live-face',  color: 'text-violet-600',  bg: 'bg-violet-50' },
  { id: 4, key: 'utility_bill', label: 'Address Proof',      sublabel: 'Utility bill or bank letter',  icon: MapPin,   path: '/onboarding/address',    color: 'text-amber-600',   bg: 'bg-amber-50' },
  { id: 5, key: 'tax_document', label: 'Tax Document',       sublabel: 'W-2, ITIN, or tax return',     icon: Receipt,  path: '/onboarding/tax',        color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 6, key: 'salary_proof', label: 'Salary Proof',       sublabel: 'Payslip or income certificate', icon: Banknote, path: '/onboarding/salary',    color: 'text-teal-600',    bg: 'bg-teal-50' },
];

/* ─── KYC verification timeline ───────────────────────────── */
const KYC_TIMELINE: {
  label: string;
  icon: React.ElementType;
  doneStatuses: KYCStatus[];
  clickPath?: string;
  clickLabel?: string;
}[] = [
  { label: 'Account Verification', icon: User,   doneStatuses: ['in_progress', 'pending_review', 'approved', 'requires_update'], clickPath: '/onboarding/verify-account', clickLabel: 'Verify Account' },
  { label: 'Document Verification', icon: Upload, doneStatuses: ['pending_review', 'approved', 'requires_update'],                clickPath: '/onboarding/photo',         clickLabel: 'Upload Documents' },
  { label: 'Under Review',    icon: Clock,       doneStatuses: ['approved'] },
  { label: 'KYC Approved',    icon: CheckCircle, doneStatuses: ['approved'] },
];

export default function CustomerDashboard() {
  const { profile } = useAuth();
  const { documents } = useDocuments();
  const navigate = useNavigate();
  const [hour] = useState(new Date().getHours());

  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const docMap = new Map(documents.map(d => [d.document_type, d]));
  const uploadedCount = UPLOAD_STEPS.filter(s => docMap.has(s.key)).length;
  const recentDocs = documents.slice(0, 5);

  const verifiedCount = documents.filter(d => d.status === 'verified').length;
  const pendingCount  = documents.filter(d => ['uploaded', 'processing'].includes(d.status)).length;
  const rejectedCount = documents.filter(d => d.status === 'rejected').length;
  const rejectedDocs  = documents.filter(d => d.status === 'rejected');

  const nextStep = UPLOAD_STEPS.find(s => !docMap.has(s.key));

  return (
    <AppShell title="Dashboard" subtitle={`${greeting}, ${profile?.full_name?.split(' ')[0] || 'Welcome'}`}>
      <div className="w-full space-y-6">

        {/* ── Hero banner ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-ntt-blue via-primary-700 to-primary-500 p-6 text-white">
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute bottom-0 right-24 w-32 h-32 rounded-full bg-white/5" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">
                NTT DATA Bank · KYC Onboarding
              </p>
              <h2 className="text-2xl font-bold mb-1.5">
                {profile?.kyc_status === 'approved'
                  ? 'Identity Verified!'
                  : profile?.kyc_status === 'pending_review'
                  ? 'Documents Under Review'
                  : 'Complete Your KYC Verification'}
              </h2>
              <p className="text-blue-200 text-sm max-w-lg">
                {profile?.kyc_status === 'approved'
                  ? 'Your identity has been successfully verified. You have full access to all NTT DATA Bank services.'
                  : profile?.kyc_status === 'pending_review'
                  ? 'Our compliance team is reviewing your documents. Expected completion in 2–3 business days.'
                  : `${uploadedCount} of ${UPLOAD_STEPS.length} documents uploaded. Use the sidebar to track your KYC progress.`}
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              {profile?.kyc_status && <KYCStatusBadge status={profile.kyc_status} />}
              {profile?.kyc_status !== 'approved' && profile?.kyc_status !== 'pending_review' && nextStep && (
                <button
                  onClick={() => navigate(nextStep.path)}
                  className="flex items-center gap-2 bg-white text-ntt-blue text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  {nextStep.label}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Verification Timeline ────────────────────────────── */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-8">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <h3 className="section-title">Verification Timeline</h3>
          </div>
          <div className="flex items-start pb-2">
            {KYC_TIMELINE.map((stage, idx) => {
              const allDocsUploaded = uploadedCount === UPLOAD_STEPS.length;
              const isDone    = !!profile?.kyc_status && (
                stage.doneStatuses.includes(profile.kyc_status) ||
                (idx === 1 && allDocsUploaded)
              );
              const isRejected = profile?.kyc_status === 'requires_update' && idx === 1;
              const isCurrent = !isDone && !isRejected && (
                idx === 0 ||
                (idx === 1 && profile?.kyc_status === 'in_progress') ||
                (idx === 2 && profile?.kyc_status === 'pending_review')
              );
              const isClickable = isCurrent && !!stage.clickPath;
              const isLast = idx === KYC_TIMELINE.length - 1;

              const iconWrap = (
                <div className="flex flex-col items-center">
                  {/* Glow ring + icon */}
                  <div className="relative">
                    {/* Outer glow pulse */}
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full animate-ping bg-amber-400/40" />
                    )}
                    {isDone && (
                      <span className="absolute inset-0 rounded-full bg-emerald-400/20 scale-125 rounded-full" />
                    )}
                    <div className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md ${
                      isDone     ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-lg ring-4 ring-emerald-100' :
                      isRejected ? 'bg-red-500    text-white shadow-red-200    shadow-lg ring-4 ring-red-100' :
                      isCurrent  ? 'bg-amber-400  text-white shadow-amber-200  shadow-lg ring-4 ring-amber-100' :
                                   'bg-gray-100   text-gray-300'
                    }`}>
                      {isDone
                        ? <CheckCircle style={{ width: 22, height: 22 }} />
                        : isRejected
                        ? <AlertTriangle style={{ width: 20, height: 20 }} />
                        : <stage.icon style={{ width: 20, height: 20 }} />}
                    </div>
                  </div>

                  {/* Label */}
                  <p className={`text-xs font-semibold mt-3 text-center leading-tight px-1 ${
                    isDone     ? 'text-emerald-600' :
                    isRejected ? 'text-red-600' :
                    isCurrent  ? 'text-amber-600' :
                                 'text-gray-400'
                  }`}>
                    {stage.label}
                  </p>

                  {/* Status tag */}
                  <span className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    isDone     ? 'bg-emerald-50 text-emerald-600' :
                    isRejected ? 'bg-red-50     text-red-600' :
                    isCurrent  ? 'bg-amber-50   text-amber-600' :
                                 'bg-gray-50    text-gray-400'
                  }`}>
                    {isCurrent  && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />}
                    {isDone     ? 'Completed' :
                     isRejected ? 'Rejected'  :
                     isCurrent  ? 'In progress' :
                                  'Pending'}
                  </span>

                  {/* Clickable CTA for in-progress stages */}
                  {isClickable && (
                    <button
                      onClick={() => navigate(stage.clickPath!)}
                      className="mt-2 text-[10px] font-semibold text-amber-600 hover:text-amber-700 underline underline-offset-2 transition-colors"
                    >
                      {stage.clickLabel}
                    </button>
                  )}
                </div>
              );

              return (
                <div key={stage.label} className="flex items-start flex-1 min-w-0">
                  {isClickable ? (
                    <button
                      onClick={() => navigate(stage.clickPath!)}
                      className="flex flex-col items-center w-full hover:scale-105 transition-transform"
                    >
                      {iconWrap}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center w-full">{iconWrap}</div>
                  )}

                  {!isLast && (
                    <div className={`flex-1 h-0.5 mx-3 mt-7 rounded-full transition-all ${
                      isDone ? 'bg-emerald-400' : isRejected ? 'bg-red-300' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Rejected Documents Alert ─────────────────────────── */}
        {rejectedDocs.length > 0 && (
          <div className="card overflow-hidden border-2 border-red-200">
            <div className="flex items-center gap-3 px-5 py-3.5 bg-red-50 border-b border-red-100">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Action Required — Documents Rejected</p>
                <p className="text-xs text-red-600">{rejectedDocs.length} document{rejectedDocs.length > 1 ? 's' : ''} need to be re-uploaded</p>
              </div>
            </div>
            <div className="divide-y divide-red-100">
              {rejectedDocs.map(doc => {
                const step = UPLOAD_STEPS.find(s => s.key === doc.document_type);
                const docLabel = step?.label ?? doc.document_type.replace(/_/g, ' ');
                const comment = (doc as typeof doc & { admin_comment?: string }).admin_comment || doc.rejection_reason;
                return (
                  <div key={doc.id} className="flex items-start gap-3 px-5 py-3.5">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 capitalize">{docLabel}</p>
                      {comment && (
                        <p className="text-xs text-red-600 mt-0.5">{comment}</p>
                      )}
                    </div>
                    {step && (
                      <button
                        onClick={() => navigate(step.path)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Re-upload
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Document Upload Cards ────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Document Upload Steps</h3>
            <span className="text-sm text-gray-400">{uploadedCount}/{UPLOAD_STEPS.length} completed</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {UPLOAD_STEPS.map((step, idx) => {
              const doc = docMap.get(step.key);
              const isLocked = idx > 0 && !docMap.has(UPLOAD_STEPS[idx - 1].key);
              return (
                <UploadCard
                  key={step.key}
                  step={step}
                  status={doc?.status ?? null}
                  isLocked={isLocked}
                  onNavigate={() => navigate(step.path)}
                />
              );
            })}
          </div>
        </div>

        {/* ── Recent Activity ──────────────────────────────────── */}
        {recentDocs.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="section-title">Recent Activity</h3>
              <Link to="/onboarding/photo" className="text-sm text-primary-600 hover:underline font-medium flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Document</th>
                    <th className="table-header">Status</th>
                    <th className="table-header hidden md:table-cell">OCR Confidence</th>
                    <th className="table-header hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="capitalize font-medium">{doc.document_type.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${
                          doc.status === 'verified'   ? 'badge-success' :
                          doc.status === 'rejected'   ? 'badge-error' :
                          doc.status === 'processing' ? 'badge-warning' : 'badge-blue'
                        }`}>{doc.status}</span>
                      </td>
                      <td className="table-cell hidden md:table-cell">
                        {doc.ocr_confidence != null
                          ? <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${doc.ocr_confidence >= 0.9 ? 'bg-green-400' : doc.ocr_confidence >= 0.75 ? 'bg-amber-400' : 'bg-red-400'}`}
                                  style={{ width: `${doc.ocr_confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs">{(doc.ocr_confidence * 100).toFixed(0)}%</span>
                            </div>
                          : '—'}
                      </td>
                      <td className="table-cell hidden md:table-cell text-gray-400 text-xs">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ─── Upload card ──────────────────────────────────────────── */
interface UploadCardProps {
  step: typeof UPLOAD_STEPS[number];
  status: string | null;
  isLocked: boolean;
  onNavigate: () => void;
}

function UploadCard({ step, status, isLocked, onNavigate }: UploadCardProps) {
  const isVerified = status === 'verified';
  const isRejected = status === 'rejected';
  const isUploaded = !!status;

  return (
    <div
      onClick={() => !isLocked && onNavigate()}
      className={`relative card p-4 flex flex-col gap-3 transition-all group ${
        isLocked  ? 'opacity-50 cursor-not-allowed' :
        isVerified ? 'border-emerald-200 bg-emerald-50/40 cursor-pointer hover:shadow-card-hover' :
        isRejected ? 'border-red-200 bg-red-50/40 cursor-pointer hover:shadow-card-hover' :
        'cursor-pointer hover:shadow-card-hover hover:border-primary-200'
      }`}
    >
      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">
        {step.id}
      </div>

      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${step.bg} ${step.color}`}>
        <step.icon className="w-5 h-5" />
      </div>

      <div>
        <p className={`font-semibold text-sm leading-tight ${
          isVerified ? 'text-emerald-700' : isRejected ? 'text-red-700' : 'text-gray-800 group-hover:text-primary-600'
        } transition-colors`}>
          {step.label}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{step.sublabel}</p>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <span className={`badge text-[10px] ${
          isVerified ? 'badge-success' :
          isRejected ? 'badge-error' :
          isUploaded ? 'badge-warning' : 'badge-gray'
        }`}>
          {isVerified ? 'Verified' : isRejected ? 'Rejected' : isUploaded ? 'Uploaded' : 'Required'}
        </span>
        {!isLocked && (
          <ArrowRight className={`w-3.5 h-3.5 transition-all ${
            isVerified ? 'text-emerald-400' : 'text-gray-300 group-hover:text-primary-400 group-hover:translate-x-0.5'
          }`} />
        )}
      </div>

      {isRejected && (
        <div className="absolute inset-x-0 bottom-0 bg-red-500 text-white text-[10px] font-semibold text-center py-1 rounded-b-xl">
          Re-upload required
        </div>
      )}
    </div>
  );
}
