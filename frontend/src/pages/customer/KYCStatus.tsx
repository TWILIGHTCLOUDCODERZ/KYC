import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle, Clock, AlertTriangle, XCircle, FileText,
  Camera, Shield, Activity, RefreshCw, ChevronRight
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { KYCStatusBadge, RiskBadge, DocumentStatusBadge } from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { useDocuments } from '../../hooks/useDocuments';
import { runAMLScreening } from '../../services/amlService';
import { supabase } from '../../lib/supabase';
import { logAuditAction } from '../../services/auditService';

const STATUS_STEPS = [
  { key: 'submitted', label: 'Application Submitted', icon: FileText },
  { key: 'document_check', label: 'Document Verification', icon: Shield },
  { key: 'aml_check', label: 'AML / Watchlist Check', icon: Activity },
  { key: 'face_check', label: 'Face Verification', icon: Camera },
  { key: 'final_review', label: 'Final Compliance Review', icon: CheckCircle },
];

export default function KYCStatus() {
  const { profile, user, refreshProfile } = useAuth();
  const { documents } = useDocuments();
  const [runningAML, setRunningAML] = useState(false);
  const [amlResult, setAmlResult] = useState<{ score: number; risk_level: string; flags: string[] } | null>(null);

  const handleRunAML = async () => {
    if (!user || !profile) return;
    setRunningAML(true);
    const result = await runAMLScreening({
      full_name: profile.full_name,
      nationality: profile.nationality ?? undefined,
      date_of_birth: profile.date_of_birth ?? undefined,
      country: profile.country ?? undefined,
    });
    await supabase.from('profiles').update({
      aml_score: result.score,
      risk_level: result.risk_level,
    }).eq('user_id', user.id);

    await supabase.from('aml_risk_scores').insert({
      user_id: user.id,
      score: result.score,
      risk_level: result.risk_level,
      flags: result.flags,
      screened_at: result.screened_at,
    });

    await logAuditAction({
      action: 'risk_score_update',
      entity_type: 'profile',
      entity_id: user.id,
      details: { score: result.score, risk_level: result.risk_level },
    });

    await refreshProfile();
    setAmlResult(result);
    setRunningAML(false);
  };

  const getStepStatus = (stepKey: string) => {
    const ks = profile?.kyc_status;
    if (!ks || ks === 'not_started') return 'pending';
    if (stepKey === 'submitted') return ks !== 'not_started' ? 'done' : 'pending';
    if (stepKey === 'document_check') {
      const hasVerified = documents.some(d => d.status === 'verified');
      return hasVerified ? 'done' : ks !== 'not_started' && ks !== 'in_progress' ? 'in_progress' : 'pending';
    }
    if (stepKey === 'aml_check') return (profile?.aml_score || 0) > 0 ? 'done' : ks === 'pending_review' || ks === 'approved' ? 'in_progress' : 'pending';
    if (stepKey === 'face_check') return profile?.face_verified ? 'done' : ks === 'approved' ? 'done' : 'pending';
    if (stepKey === 'final_review') return ks === 'approved' ? 'done' : ks === 'pending_review' ? 'in_progress' : 'pending';
    return 'pending';
  };

  return (
    <AppShell title="KYC Status" subtitle="Track your identity verification progress">
      <div className="w-full space-y-6">
        {/* Status Banner */}
        <div className={`card p-6 border-l-4 ${
          profile?.kyc_status === 'approved' ? 'border-green-500 bg-green-50' :
          profile?.kyc_status === 'rejected' ? 'border-red-500 bg-red-50' :
          profile?.kyc_status === 'pending_review' ? 'border-orange-400 bg-orange-50' :
          'border-primary-500 bg-primary-50'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
              profile?.kyc_status === 'approved' ? 'bg-green-100 text-green-600' :
              profile?.kyc_status === 'rejected' ? 'bg-red-100 text-red-600' :
              profile?.kyc_status === 'pending_review' ? 'bg-orange-100 text-orange-600' :
              'bg-primary-100 text-primary-600'
            }`}>
              {profile?.kyc_status === 'approved' ? <CheckCircle className="w-6 h-6" /> :
               profile?.kyc_status === 'rejected' ? <XCircle className="w-6 h-6" /> :
               profile?.kyc_status === 'pending_review' ? <Clock className="w-6 h-6" /> :
               <Shield className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="section-title">
                  {profile?.kyc_status === 'approved' ? 'KYC Verified Successfully' :
                   profile?.kyc_status === 'rejected' ? 'KYC Application Rejected' :
                   profile?.kyc_status === 'pending_review' ? 'Under Compliance Review' :
                   'KYC Verification In Progress'}
                </h2>
                {profile?.kyc_status && <KYCStatusBadge status={profile.kyc_status} />}
              </div>
              <p className="text-sm text-gray-600">
                {profile?.kyc_status === 'approved' ? 'Your identity has been fully verified. You have access to all banking services.' :
                 profile?.kyc_status === 'rejected' ? 'Your application was rejected. Please contact support for assistance.' :
                 profile?.kyc_status === 'pending_review' ? 'Our compliance team is reviewing your documents. Expected completion: 2-3 business days.' :
                 'Upload all required documents to begin the verification process.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Verification Pipeline */}
          <div className="lg:col-span-2 card p-6">
            <h3 className="section-title mb-5">Verification Pipeline</h3>
            <div className="space-y-3">
              {STATUS_STEPS.map((step) => {
                const status = getStepStatus(step.key);
                return (
                  <div key={step.key} className={`flex items-center gap-3 p-3.5 rounded-xl border ${
                    status === 'done' ? 'border-green-200 bg-green-50' :
                    status === 'in_progress' ? 'border-primary-200 bg-primary-50' :
                    'border-gray-100 bg-gray-50'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      status === 'done' ? 'bg-green-500 text-white' :
                      status === 'in_progress' ? 'bg-primary-600 text-white' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {status === 'done' ? <CheckCircle className="w-4 h-4" /> :
                       status === 'in_progress' ? <LoadingSpinner size="sm" color="text-white" /> :
                       <step.icon className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        status === 'done' ? 'text-green-700' :
                        status === 'in_progress' ? 'text-primary-700' :
                        'text-gray-400'
                      }`}>{step.label}</p>
                    </div>
                    <span className={`text-xs font-medium capitalize ${
                      status === 'done' ? 'text-green-600' :
                      status === 'in_progress' ? 'text-primary-600' :
                      'text-gray-400'
                    }`}>
                      {status === 'in_progress' ? 'In Progress' : status === 'done' ? 'Complete' : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Risk profile */}
            <div className="card p-5">
              <h3 className="section-title mb-4">Risk Profile</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Risk Level</span>
                  {profile?.risk_level ? <RiskBadge level={profile.risk_level} /> : <span className="badge-gray">N/A</span>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-500">AML Score</span>
                    <span className="text-sm font-semibold text-gray-700">{profile?.aml_score ?? 0} / 100</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (profile?.aml_score || 0) >= 70 ? 'bg-red-500' :
                        (profile?.aml_score || 0) >= 40 ? 'bg-orange-400' : 'bg-green-400'
                      }`}
                      style={{ width: `${profile?.aml_score || 0}%` }}
                    />
                  </div>
                </div>

                {amlResult && amlResult.flags.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {amlResult.flags.map(flag => (
                      <div key={flag} className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 px-2.5 py-1.5 rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{flag.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleRunAML}
                  disabled={runningAML}
                  className="btn-secondary w-full text-sm py-2 mt-1"
                >
                  {runningAML ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {runningAML ? 'Running AML Check...' : 'Run AML Screening'}
                </button>
              </div>
            </div>

            {/* Face verification placeholder */}
            <div className="card p-5 border-2 border-dashed border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-600">Face Verification</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">Biometric identity verification using AI facial recognition</p>
              <div className="bg-gray-100 rounded-xl h-24 flex items-center justify-center">
                <div className="text-center">
                  <Camera className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">Coming Soon</p>
                </div>
              </div>
              <span className="badge badge-gray mt-2">Feature in Development</span>
            </div>
          </div>
        </div>

        {/* Documents table */}
        {documents.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="section-title">Submitted Documents</h3>
              <Link to="/documents/upload" className="btn-secondary text-sm py-1.5">
                <FileText className="w-3.5 h-3.5" />
                Add Documents
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Document Type</th>
                    <th className="table-header">Status</th>
                    <th className="table-header hidden md:table-cell">OCR Confidence</th>
                    <th className="table-header hidden lg:table-cell">Submitted</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {documents.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="font-medium capitalize">{doc.document_type.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <DocumentStatusBadge status={doc.status} />
                      </td>
                      <td className="table-cell hidden md:table-cell">
                        {doc.ocr_confidence != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${doc.ocr_confidence >= 0.9 ? 'bg-green-400' : doc.ocr_confidence >= 0.75 ? 'bg-orange-400' : 'bg-red-400'}`}
                                style={{ width: `${doc.ocr_confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{(doc.ocr_confidence * 100).toFixed(0)}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="table-cell hidden lg:table-cell text-gray-400 text-xs">
                        {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="table-cell">
                        {doc.status === 'rejected' && (
                          <Link to="/documents/upload" className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                            Re-upload <ChevronRight className="w-3 h-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {documents.length === 0 && (
          <div className="card p-10 text-center">
            <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No documents uploaded yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Upload your identity documents to start verification</p>
            <Link to="/documents/upload" className="btn-primary inline-flex">
              <FileText className="w-4 h-4" />
              Upload Documents
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
