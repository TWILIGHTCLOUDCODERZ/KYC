import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, FileText, User, MapPin,
  AlertTriangle, Shield, Camera, Clock, MessageSquare,
  Image, Eye, EyeOff, ChevronDown, ChevronUp, Zap, RefreshCw
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { KYCStatusBadge, RiskBadge, DocumentStatusBadge } from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import { logAuditAction } from '../../services/auditService';
import type { Profile, KYCDocument } from '../../types/database';

/* ─── Document type labels ───────────────────────────────────── */
const DOC_LABELS: Record<string, string> = {
  photo: 'Profile Photo',
  passport: 'Passport / ID',
  live_face: 'Live Face Check',
  utility_bill: 'Address Proof',
  tax_document: 'Tax Document',
  salary_proof: 'Salary Proof',
  national_id: 'National ID',
  drivers_license: "Driver's License",
  bank_statement: 'Bank Statement',
};

/* ─── AI score display ───────────────────────────────────────── */
function AIScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls = pct >= 90 ? 'bg-emerald-100 text-emerald-700' :
              pct >= 70 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      AI {pct}%
    </span>
  );
}

/* ─── Reject modal ───────────────────────────────────────────── */
interface RejectModalProps {
  docLabel: string;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
}

const REJECT_PRESETS = [
  'Image is blurry or unclear',
  'Document is expired',
  'Name does not match profile',
  'Document not fully visible / cropped',
  'Incorrect document type uploaded',
  'Suspected altered or forged document',
  'Low AI confidence score',
];

function RejectModal({ docLabel, onConfirm, onCancel }: RejectModalProps) {
  const [comment, setComment] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border-b border-red-100">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-800">Reject Document</p>
            <p className="text-xs text-red-600">{docLabel}</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Quick reasons</p>
            <div className="flex flex-wrap gap-1.5">
              {REJECT_PRESETS.map(preset => (
                <button
                  key={preset}
                  onClick={() => setComment(prev => prev ? `${prev}. ${preset}` : preset)}
                  className="text-[11px] px-2.5 py-1 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-600 rounded-lg transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Rejection comment (shown to customer)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Describe the issue so the customer knows what to fix..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onCancel} className="flex-1 btn-secondary text-sm py-2.5">Cancel</button>
          <button
            onClick={() => onConfirm(comment.trim() || 'Document rejected by compliance officer')}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Image preview modal ────────────────────────────────────── */
function ImagePreviewModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-white font-semibold text-sm">{label}</p>
          <button onClick={onClose} className="text-white/70 hover:text-white text-sm">Close</button>
        </div>
        <img
          src={url}
          alt={label}
          className="w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
          onError={e => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg?w=800'; }}
        />
      </div>
    </div>
  );
}

/* ─── Document card ──────────────────────────────────────────── */
interface DocCardProps {
  doc: KYCDocument;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  verifying: string | null;
}

function DocCard({ doc, onVerify, onReject, verifying }: DocCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const label = DOC_LABELS[doc.document_type] ?? doc.document_type.replace(/_/g, ' ');
  const isImage = doc.file_url && /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(doc.file_url);
  const scores = doc.verification_scores as Record<string, unknown> | undefined;
  const ocrData = doc.ocr_extracted_data as Record<string, unknown> | undefined;
  const ocrFields = ocrData ? Object.entries(ocrData).filter(([k]) => !k.startsWith('__')) : [];

  return (
    <>
      {previewOpen && isImage && (
        <ImagePreviewModal url={doc.file_url} label={label} onClose={() => setPreviewOpen(false)} />
      )}
      <div className="card overflow-hidden">
        <div className="flex items-start gap-4 p-4">
          {/* Thumbnail */}
          <div
            className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 cursor-pointer group"
            onClick={() => isImage && setPreviewOpen(true)}
          >
            {isImage ? (
              <>
                <img
                  src={doc.file_url}
                  alt={label}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg?w=200'; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                <FileText className="w-8 h-8 text-gray-300" />
                <span className="text-[9px] text-gray-400 uppercase font-medium">PDF</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-800 text-sm">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{doc.file_name}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <DocumentStatusBadge status={doc.status} />
                  {doc.ocr_confidence != null && <AIScoreBadge score={doc.ocr_confidence} />}
                  {doc.verification_status && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      doc.verification_status === 'pass' ? 'bg-emerald-100 text-emerald-700' :
                      doc.verification_status === 'fail' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {doc.verification_status === 'pass' ? 'AI Pass' : doc.verification_status === 'fail' ? 'AI Fail' : 'AI Pending'}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isImage && (
                  <button
                    onClick={() => setPreviewOpen(true)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Image className="w-3.5 h-3.5" />
                    Preview
                  </button>
                )}
                {doc.status !== 'verified' && (
                  <button
                    onClick={() => onVerify(doc.id)}
                    disabled={verifying === doc.id}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    {verifying === doc.id ? <LoadingSpinner size="sm" color="text-emerald-600" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                )}
                {doc.status !== 'rejected' && (
                  <button
                    onClick={() => onReject(doc.id)}
                    disabled={verifying === doc.id}
                    className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                )}
              </div>
            </div>

            {/* Rejection comment */}
            {(doc.rejection_reason || doc.admin_comment) && (
              <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{doc.admin_comment || doc.rejection_reason}</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Scores panel */}
        {scores && Object.keys(scores).length > 0 && (
          <div className="border-t border-gray-100 px-4 py-2">
            <div className="flex flex-wrap gap-2">
              {Object.entries(scores).slice(0, 6).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5 text-[11px] bg-gray-50 px-2.5 py-1 rounded-lg">
                  <span className="text-gray-400 capitalize">{k.replace(/_/g, ' ')}:</span>
                  <span className={`font-semibold ${v === true || v === 'Pass' || v === 'Yes' ? 'text-emerald-600' : v === false || v === 'Fail' || v === 'No' ? 'text-red-600' : 'text-gray-700'}`}>
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OCR Extracted Data toggle */}
        {ocrFields.length > 0 && (
          <div className="border-t border-gray-100">
            <button
              onClick={() => setOcrOpen(v => !v)}
              className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Gemini Extracted Data ({ocrFields.length} fields)
              </span>
              {ocrOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            {ocrOpen && (
              <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ocrFields.map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 capitalize">{k.replace(/_/g, ' ')}</p>
                    <p className="text-xs font-semibold text-gray-700 mt-0.5 break-words">{String(v)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function CustomerDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycLoading, setKycLoading] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'risk'>('documents');
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const [{ data: profile }, { data: docs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('kyc_documents').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      ]);
      setCustomer(profile);
      setDocuments(docs ?? []);
      setLoading(false);
    };
    load();
  }, [userId]);

  const handleKYCAction = async (action: 'approved' | 'rejected') => {
    if (!userId || !customer) return;
    setKycLoading(action);
    await supabase.from('profiles').update({
      kyc_status: action,
      ...(action === 'approved' ? { approved_at: new Date().toISOString(), approval_method: 'manual' } : {}),
    }).eq('user_id', userId);
    await logAuditAction({
      action: action === 'approved' ? 'kyc_approved' : 'kyc_rejected',
      entity_type: 'profile',
      entity_id: userId,
      details: { notes },
    });
    setCustomer(prev => prev ? { ...prev, kyc_status: action } : prev);
    setKycLoading(null);
  };

  const handleVerifyDoc = async (docId: string) => {
    setVerifying(docId);
    await supabase.from('kyc_documents').update({
      status: 'verified',
      rejection_reason: null,
      admin_comment: null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', docId);
    await logAuditAction({ action: 'document_verify', entity_type: 'kyc_document', entity_id: docId });
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'verified', rejection_reason: undefined, admin_comment: null } : d));
    setVerifying(null);
  };

  const handleRejectDoc = async (docId: string, comment: string) => {
    setVerifying(docId);
    setRejectDocId(null);
    await supabase.from('kyc_documents').update({
      status: 'rejected',
      rejection_reason: comment,
      admin_comment: comment,
      reviewed_at: new Date().toISOString(),
    }).eq('id', docId);
    await logAuditAction({
      action: 'document_reject',
      entity_type: 'kyc_document',
      entity_id: docId,
      details: { comment },
    });
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'rejected', rejection_reason: comment, admin_comment: comment } : d));
    setVerifying(null);
  };

  const toggleFraudAlert = async () => {
    if (!customer) return;
    const current = (customer as Profile & { fraud_alert?: boolean }).fraud_alert ?? false;
    await supabase.from('profiles').update({ fraud_alert: !current }).eq('user_id', userId!);
    setCustomer(prev => prev ? { ...prev, fraud_alert: !current } as Profile : prev);
  };

  if (loading) {
    return (
      <AppShell title="Customer Review" subtitle="Loading...">
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      </AppShell>
    );
  }

  if (!customer) {
    return (
      <AppShell title="Customer Review" subtitle="Customer not found">
        <div className="card p-10 text-center">
          <p className="text-gray-500">Customer not found.</p>
          <button onClick={() => navigate('/admin/customers')} className="btn-secondary mt-4">
            <ArrowLeft className="w-4 h-4" /> Back to Customers
          </button>
        </div>
      </AppShell>
    );
  }

  const fraudAlert = (customer as Profile & { fraud_alert?: boolean }).fraud_alert ?? false;
  const rejectDocLabel = rejectDocId ? (DOC_LABELS[documents.find(d => d.id === rejectDocId)?.document_type ?? ''] ?? 'Document') : '';

  const TABS = [
    { id: 'documents', label: `Documents (${documents.length})`, icon: FileText },
    { id: 'overview', label: 'Personal Info', icon: User },
    { id: 'risk', label: 'Risk & AML', icon: Shield },
  ] as const;

  const verifiedDocs = documents.filter(d => d.status === 'verified').length;
  const rejectedDocs = documents.filter(d => d.status === 'rejected').length;

  return (
    <AppShell title="Customer Review" subtitle={`Reviewing ${customer.full_name}`}>
      {rejectDocId && (
        <RejectModal
          docLabel={rejectDocLabel}
          onConfirm={comment => handleRejectDoc(rejectDocId, comment)}
          onCancel={() => setRejectDocId(null)}
        />
      )}

      <div className="w-full space-y-5">
        {/* Header */}
        <div className="card p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => navigate('/admin/customers')} className="btn-secondary py-2 px-3 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full bg-ntt-blue flex items-center justify-center text-lg font-bold text-white">
                {customer.full_name.charAt(0)}
              </div>
              {fraudAlert && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center">
                  <Zap className="w-2.5 h-2.5 text-white" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-900">{customer.full_name}</h2>
                <KYCStatusBadge status={customer.kyc_status} />
                <RiskBadge level={customer.risk_level} />
                {fraudAlert && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">
                    <Zap className="w-3 h-3" /> Fraud Alert
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{customer.email}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" />{verifiedDocs} verified</span>
                <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" />{rejectedDocs} rejected</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-gray-400" />{documents.length} total</span>
              </div>
            </div>

            {/* KYC action buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                onClick={toggleFraudAlert}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
                  fraudAlert
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                {fraudAlert ? 'Clear Fraud Alert' : 'Flag Fraud'}
              </button>
              {customer.kyc_status !== 'approved' && (
                <button
                  onClick={() => handleKYCAction('approved')}
                  disabled={kycLoading !== null}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                >
                  {kycLoading === 'approved' ? <LoadingSpinner size="sm" color="text-white" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Approve KYC
                </button>
              )}
              {customer.kyc_status !== 'rejected' && (
                <button
                  onClick={() => handleKYCAction('rejected')}
                  disabled={kycLoading !== null}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
                >
                  {kycLoading === 'rejected' ? <LoadingSpinner size="sm" color="text-white" /> : <XCircle className="w-3.5 h-3.5" />}
                  Reject KYC
                </button>
              )}
            </div>
          </div>

          {/* Notes toggle */}
          <div className="mt-3 border-t border-gray-100 pt-3">
            <button
              onClick={() => setNotesOpen(v => !v)}
              className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Compliance Notes
              {notesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {notesOpen && (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add compliance notes, review comments, or rejection rationale..."
                rows={2}
                className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
              />
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="card p-10 text-center">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No documents uploaded yet</p>
              </div>
            ) : documents.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                onVerify={handleVerifyDoc}
                onReject={id => setRejectDocId(id)}
                verifying={verifying}
              />
            ))}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-semibold text-gray-700">Personal Information</h3>
              </div>
              {[
                { label: 'Full Name', value: customer.full_name },
                { label: 'Email', value: customer.email },
                { label: 'Phone', value: customer.phone || '—' },
                { label: 'Date of Birth', value: customer.date_of_birth || '—' },
                { label: 'Nationality', value: customer.nationality || '—' },
                { label: 'Member Since', value: new Date(customer.created_at).toLocaleDateString() },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className="text-sm font-medium text-gray-800">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-semibold text-gray-700">Address Information</h3>
              </div>
              {[
                { label: 'Address Line 1', value: customer.address_line1 || '—' },
                { label: 'Address Line 2', value: customer.address_line2 || '—' },
                { label: 'City', value: customer.city || '—' },
                { label: 'State / Province', value: customer.state || '—' },
                { label: 'Postal Code', value: customer.postal_code || '—' },
                { label: 'Country', value: customer.country || '—' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className="text-sm font-medium text-gray-800">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Tab */}
        {activeTab === 'risk' && (() => {
          const totalDocs = documents.length;
          const verifiedDocs2 = documents.filter(d => d.status === 'verified').length;
          const docVerPct = totalDocs > 0 ? Math.round((verifiedDocs2 / totalDocs) * 100) : 0;
          return (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-semibold text-gray-700">AML Risk Profile</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Overall Risk Level', value: <RiskBadge level={customer.risk_level} /> },
                  {
                    label: 'Doc Verification',
                    value: (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${docVerPct === 100 ? 'bg-emerald-500' : docVerPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${docVerPct}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${docVerPct === 100 ? 'text-emerald-600' : docVerPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {docVerPct}%
                        </span>
                        <span className="text-xs text-gray-400">({verifiedDocs2}/{totalDocs})</span>
                      </div>
                    ),
                  },
                  { label: 'Face Verified', value: customer.face_verified ? <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Yes</span> : <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">No</span> },
                  { label: 'Fraud Alert', value: fraudAlert ? <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Zap className="w-3 h-3" />Flagged</span> : <span className="text-xs text-gray-500">None</span> },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-500">{row.label}</span>
                    <div>{row.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Overall Document Verification</p>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${docVerPct === 100 ? 'bg-emerald-500' : docVerPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${docVerPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span className="font-semibold">{docVerPct}% verified</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-semibold text-gray-700">Biometric Status</h3>
              </div>
              <div className={`p-4 rounded-xl flex items-center gap-3 ${customer.face_verified ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                {customer.face_verified ? (
                  <CheckCircle className="w-8 h-8 text-emerald-500 shrink-0" />
                ) : (
                  <Camera className="w-8 h-8 text-gray-300 shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-sm text-gray-800">Face Verification</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {customer.face_verified ? 'Identity confirmed via facial recognition' : 'Biometric check not yet performed'}
                  </p>
                </div>
              </div>
              {!customer.face_verified && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Face verification pending — customer action required</span>
                </div>
              )}
            </div>
          </div>
          );
        })()}
      </div>
    </AppShell>
  );
}
