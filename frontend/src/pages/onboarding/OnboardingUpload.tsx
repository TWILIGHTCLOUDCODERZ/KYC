import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, CheckCircle, Cpu, AlertCircle, ArrowLeft, ArrowRight, ChevronRight,
  Eye, EyeOff, FileText,
  ShieldCheck, ShieldX, RefreshCw, User, Scan, AlertTriangle, XCircle,
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { useDocuments } from '../../hooks/useDocuments';
import { supabase } from '../../lib/supabase';
import { auth } from '../../lib/firebase';
import { extractDocumentData } from '../../services/ocrService';
import type { OCRResult } from '../../services/ocrService';
import { logAuditAction } from '../../services/auditService';
import { ENV } from '../../config/env';
import type { DocumentType } from '../../types/database';

export interface OnboardingStepConfig {
  stepNumber: number;
  totalSteps: number;
  documentType: DocumentType;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  tips: string[];
  nextPath: string | null;
  prevPath: string | null;
  accepted: string;
  maxSizeMB?: number;
}

type UploadState = 'idle' | 'uploading' | 'extracting' | 'done' | 'error';

// ── Scorecard ─────────────────────────────────────────────────────────────────

function ScoreRow({ label, value, pass }: { label: string; value: string; pass?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-800">{value}</span>
        {pass === true  && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
        {pass === false && <XCircle     className="w-3.5 h-3.5 text-red-500 shrink-0" />}
      </div>
    </div>
  );
}

function ConfidenceMeter({ value, label }: { value: number; label: string }) {
  const pct   = Math.round(value * 100);
  const color = value >= 0.9 ? 'bg-emerald-400' : value >= 0.7 ? 'bg-amber-400' : 'bg-red-400';
  const text  = value >= 0.9 ? 'text-emerald-600' : value >= 0.7 ? 'text-amber-600' : 'text-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</span>
        <span className={`text-xs font-bold ${text}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface ScorecardProps {
  docType: DocumentType;
  scores: Record<string, unknown>;
  status: 'pass' | 'fail' | 'pending';
  confidence: number;
  onReupload: () => void;
}

function Scorecard({ docType, scores, status, confidence, onReupload }: ScorecardProps) {
  const pass = status === 'pass';

  const rows = () => {
    if (docType === 'photo') return (
      <>
        <ScoreRow label="Format Valid" value={scores.format_valid === true ? 'Yes' : 'No'} pass={scores.format_valid === true} />
        <ScoreRow label="File Type"    value={String(scores.file_type ?? '—')}              pass={['image/jpeg','image/png'].includes(String(scores.file_type))} />
      </>
    );
    if (docType === 'passport') {
      const fm = scores.face_match as Record<string, unknown> | null;
      return (
        <>
          <ScoreRow label="Document Valid"          value={String(scores.document_valid ?? '—')}          pass={scores.document_valid === true} />
          <ScoreRow label="Passport Photo Present"  value={String(scores.passport_photo_detected ?? '—')} pass={scores.passport_photo_detected === true} />
          {fm && (
            <>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-2 pb-0.5">Face Match vs Profile Photo</p>
              <ScoreRow label="Faces Match"  value={String(fm.faces_match ?? '—')}                          pass={fm.faces_match === 'Yes'} />
              <ScoreRow label="Match Score"  value={`${Math.round((fm.match_score as number ?? 0) * 100)}%`} pass={(fm.match_score as number ?? 0) >= 0.7} />
              <ScoreRow label="Match Level"  value={String(fm.match_level ?? '—')} />
              <ScoreRow label="Same Person"  value={String(fm.same_person ?? '—')}                          pass={fm.same_person === 'Yes'} />
            </>
          )}
        </>
      );
    }
    if (docType === 'live_face') return (
      <>
        <ScoreRow label="Face Detected"  value={String(scores.face_detected ?? '—')}   pass={scores.face_detected === true} />
        <ScoreRow label="Liveness Check" value={String(scores.liveness_check ?? '—')}  pass={scores.liveness_check === 'Pass'} />
        <ScoreRow label="Real Person"    value={String(scores.is_real_person ?? '—')}  pass={scores.is_real_person === true} />
        <ScoreRow label="Spoof Detected" value={String(scores.spoof_detected ?? '—')}  pass={scores.spoof_detected === false} />
        <ScoreRow label="Spoof Type"     value={String(scores.spoof_type ?? '—')} />
        <ScoreRow label="Eyes Open"      value={String(scores.eyes_open ?? '—')}       pass={scores.eyes_open === true} />
        <ScoreRow label="Head Pose"      value={String(scores.head_pose ?? '—')} />
        <ScoreRow label="Quality Score"  value={`${Math.round((scores.quality_score as number ?? 0) * 100)}%`} pass={(scores.quality_score as number ?? 0) >= 0.6} />
      </>
    );
    // Address / Tax / Salary
    const cc = scores.cross_check as Record<string, unknown> | null;
    return (
      <>
        <ScoreRow label="Extracted Name" value={String(scores.extracted_name ?? '—')} />
        {cc && (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-2 pb-0.5">Name Cross-Check</p>
            {Object.entries(cc.checks as Record<string, unknown> ?? {}).map(([docKey, chk]) => {
              const c = chk as Record<string, unknown>;
              return (
                <ScoreRow
                  key={docKey}
                  label={`vs ${docKey.replace(/_/g, ' ')}`}
                  value={`${Math.round((c.similarity as number ?? 0) * 100)}% match`}
                  pass={c.match === true}
                />
              );
            })}
            <ScoreRow label="All Names Match" value={cc.all_names_match ? 'Yes' : 'No'} pass={cc.all_names_match === true} />
          </>
        )}
      </>
    );
  };

  const fm = docType === 'passport' ? (scores.face_match as Record<string, unknown> | null) : null;

  return (
    <div className={`card overflow-hidden border-2 ${pass ? 'border-emerald-200' : 'border-red-200'}`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${pass ? 'bg-emerald-50' : 'bg-red-50'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${pass ? 'bg-emerald-100' : 'bg-red-100'}`}>
          {pass ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldX className="w-5 h-5 text-red-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${pass ? 'text-emerald-700' : 'text-red-700'}`}>
            {docType === 'photo' ? 'Format Check' : 'AI Verification'} {pass ? 'Passed' : 'Failed'}
          </p>
          <p className={`text-xs ${pass ? 'text-emerald-600/70' : 'text-red-600/70'}`}>
            {docType === 'photo'
              ? (pass ? 'Valid JPG or PNG image accepted' : 'Invalid format — only JPG and PNG are accepted')
              : (pass ? 'Document meets all KYC requirements' : 'Issues found — please re-upload a better image')}
          </p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${pass ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
          {pass ? 'PASS' : 'FAIL'}
        </span>
      </div>

      <div className="px-4 pt-3 pb-2 space-y-2 border-b border-gray-100">
        {docType !== 'photo' && <ConfidenceMeter value={confidence} label="AI Confidence" />}
        {fm && (fm.match_score as number) != null && (
          <ConfidenceMeter value={fm.match_score as number} label="Face Match Score" />
        )}
      </div>

      <div className="px-4 py-2">{rows()}</div>

      {!pass && scores.fail_reasons && (
        <div className="mx-4 mb-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">{String(scores.fail_reasons)}</p>
        </div>
      )}

      {!pass && (
        <div className="px-4 pb-4">
          <button
            onClick={onReupload}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Re-upload Document
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingUpload({ config }: { config: OnboardingStepConfig }) {
  const { user, profile, refreshProfile } = useAuth();
  const { documents, refetch } = useDocuments();
  const navigate = useNavigate();

  const existing = documents.find(d => d.document_type === config.documentType);

  const [file,    setFile]    = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state,   setState]   = useState<UploadState>('idle');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(() => {
    if (existing?.ocr_extracted_data) {
      return {
        confidence: existing.ocr_confidence ?? 0,
        fields: existing.ocr_extracted_data as Record<string, string>,
        raw_text: '',
        verification_scores: existing.verification_scores as Record<string, unknown> | undefined,
        verification_status: existing.verification_status as 'pass' | 'fail' | 'pending' | undefined,
        metadata: (existing.ocr_extracted_data as Record<string, unknown>).__metadata as OCRResult['metadata'] ?? {
          file_name: existing.file_name,
          file_size: 0,
          file_size_human: '—',
          file_type: '—',
          document_type: existing.document_type,
          upload_timestamp: existing.created_at,
          gemini_model: 'gemini-1.5-flash',
        },
      };
    }
    return null;
  });
  const [error,      setError]      = useState<string | null>(null);
  const [ocrVisible, setOcrVisible] = useState(false);
  const [dragging,   setDragging]   = useState(false);

  const maxMB             = config.maxSizeMB ?? ENV.MAX_FILE_SIZE_MB;
  const isAlreadyUploaded = !!existing && state === 'idle';
  const profilePhotoDoc   = documents.find(d => d.document_type === 'photo');

  const getCrossCheckNames = (): Record<string, string> => {
    const names: Record<string, string> = {};
    for (const d of documents) {
      if (!d.ocr_extracted_data) continue;
      const data = d.ocr_extracted_data as Record<string, string>;
      const name = data.account_holder ?? data.employee_name ?? data.taxpayer_name ?? data.full_name ?? '';
      if (name) names[d.document_type] = name;
    }
    return names;
  };

  const processFile = useCallback(async (f: File) => {
    const uid = auth.currentUser?.uid ?? user?.id;
    if (!uid) { setError('Not authenticated. Please sign in again.'); return; }
    setError(null);

    if (f.size > maxMB * 1024 * 1024) { setError(`File too large. Maximum size is ${maxMB} MB.`); return; }
    if (!config.accepted.split(',').includes(f.type)) { setError('Invalid file type. Please use JPG, PNG, or PDF.'); return; }

    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    setState('uploading');

    try {
      const path = `${uid}/${config.documentType}/${Date.now()}_${f.name}`;
      const { error: storageErr } = await supabase.storage.from('kyc-documents').upload(path, f, { upsert: true });
      if (storageErr) throw storageErr;

      const { data: urlData } = supabase.storage.from('kyc-documents').getPublicUrl(path);

      let docRecord: { id: string } | null = null;
      if (existing?.id) {
        const { data, error: dbErr } = await supabase
          .from('kyc_documents')
          .update({
            file_name: f.name,
            file_url: urlData.publicUrl,
            status: 'processing',
            ocr_extracted_data: null,
            ocr_confidence: null,
            rejection_reason: null,
            verification_scores: null,
            verification_status: 'pending',
          })
          .eq('id', existing.id)
          .eq('user_id', uid)
          .select('id')
          .single();
        if (dbErr) throw dbErr;
        docRecord = data;
      } else {
        const { data, error: dbErr } = await supabase
          .from('kyc_documents')
          .insert({
            user_id: uid,
            document_type: config.documentType,
            file_name: f.name,
            file_url: urlData.publicUrl,
            status: 'processing',
          })
          .select('id')
          .single();
        if (dbErr) throw dbErr;
        docRecord = data;
      }
      if (!docRecord) throw new Error('Failed to create document record');


      setState('extracting');

      let ocr: OCRResult;

      if (config.documentType === 'photo') {
        // No AI scan — just validate image format
        const validTypes = ['image/jpeg', 'image/png'];
        const formatOk = validTypes.includes(f.type);
        const now = new Date().toISOString();
        ocr = {
          confidence: formatOk ? 1.0 : 0,
          fields: { format: f.type },
          raw_text: '',
          verification_scores: { format_valid: formatOk, file_type: f.type },
          verification_status: formatOk ? 'pass' : 'fail',
          metadata: {
            file_name: f.name,
            file_size: f.size,
            file_size_human: `${(f.size / 1024).toFixed(1)} KB`,
            file_type: f.type,
            document_type: 'photo',
            upload_timestamp: now,
            gemini_model: 'none',
          },
        };
      } else {
        // Build options: ref photo for passport face-match, cross-check names for OCR docs
        let refFile: File | undefined;
        if (config.documentType === 'passport' && profilePhotoDoc?.file_url) {
          try {
            const res  = await fetch(profilePhotoDoc.file_url);
            const blob = await res.blob();
            refFile = new File([blob], 'profile_photo.jpg', { type: blob.type || 'image/jpeg' });
          } catch { /* face-match optional */ }
        }

        const crossCheckData = ['utility_bill','tax_document','salary_proof'].includes(config.documentType)
          ? getCrossCheckNames()
          : undefined;

        ocr = await extractDocumentData(f, config.documentType, { refFile, crossCheckData });
      }

      await supabase.from('kyc_documents').update({
        ocr_extracted_data: { ...ocr.fields, __metadata: ocr.metadata },
        ocr_confidence: ocr.confidence,
        status: 'uploaded',
        verification_scores: ocr.verification_scores ?? null,
        verification_status: ocr.verification_status ?? 'pending',
        rejection_reason: ocr.verification_status === 'fail' ? buildFailReason(ocr) : null,
      }).eq('id', docRecord.id);

      await logAuditAction({
        action: 'document_upload',
        entity_type: 'kyc_document',
        entity_id: docRecord.id,
        details: { document_type: config.documentType, confidence: ocr.confidence, verification_status: ocr.verification_status },
      });

      if (profile?.kyc_status === 'not_started') {
        await supabase.from('profiles').update({ kyc_status: 'in_progress' }).eq('user_id', uid);
        await refreshProfile();
      }

      setOcrResult(ocr);
      setState('done');
      refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setState('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, config, existing, maxMB, refetch, refreshProfile, profilePhotoDoc]);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); };

  const handleFileInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = config.accepted;
    input.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) processFile(f); };
    input.click();
  };

  const handleReupload = () => {
    setFile(null); setPreview(null); setState('idle'); setOcrResult(null); setError(null);
    setTimeout(handleFileInput, 50);
  };

  const Icon              = config.icon;
  const stepPct           = (config.stepNumber / config.totalSteps) * 100;
  const confidence        = ocrResult?.confidence ?? null;
  const ocrFields         = ocrResult?.fields ?? null;
  const verScores         = ocrResult?.verification_scores ?? (existing?.verification_scores as Record<string, unknown> | undefined);
  const verStatus         = ocrResult?.verification_status ?? (existing?.verification_status as 'pass' | 'fail' | 'pending' | undefined);

  const canProceed = state === 'done'
    ? (confidence != null && confidence >= 0.60)
    : isAlreadyUploaded && existing?.status !== 'rejected' && (existing?.ocr_confidence == null || existing.ocr_confidence >= 0.60);

  const handleFinish = async () => {
    if (!user) { navigate('/dashboard'); return; }
    const REQUIRED_TYPES: DocumentType[] = ['photo', 'passport', 'live_face', 'utility_bill', 'tax_document', 'salary_proof'];
    const { data: docs } = await supabase
      .from('kyc_documents')
      .select('document_type, verification_status, ocr_confidence')
      .eq('user_id', user.id);
    const passed = (type: DocumentType) =>
      docs?.some(d => d.document_type === type && (d.ocr_confidence == null || d.ocr_confidence >= 0.60));
    const allDone = REQUIRED_TYPES.every(passed);
    if (allDone) {
      await supabase.from('profiles').update({ kyc_status: 'pending_review', updated_at: new Date().toISOString() }).eq('user_id', user.id);
      await logAuditAction({ action: 'kyc_submitted', entity_type: 'profile', entity_id: user.id });
    }
    navigate('/dashboard');
  };

  return (
    <AppShell title={config.title} subtitle={`Step ${config.stepNumber} of ${config.totalSteps} — KYC Document Verification`}>
      <div className="w-full space-y-5">

        {/* Step progress bar */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: config.totalSteps }, (_, i) => i + 1).map(n => (
                <div key={n} className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    n < config.stepNumber   ? 'bg-emerald-500 text-white' :
                    n === config.stepNumber ? 'bg-primary-600 text-white ring-4 ring-primary-100' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {n < config.stepNumber ? <CheckCircle className="w-3.5 h-3.5" /> : n}
                  </div>
                  {n < config.totalSteps && <div className={`w-5 h-0.5 ${n < config.stepNumber ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-400 font-medium">{config.stepNumber}/{config.totalSteps}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-500" style={{ width: `${stepPct}%` }} />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {/* Upload area */}
          <div className="md:col-span-2 space-y-4">

            {/* Already-uploaded banner */}
            {isAlreadyUploaded && (
              <div className={`card p-4 flex items-center gap-3 border-l-4 ${
                existing.status === 'verified' || verStatus === 'pass' ? 'border-emerald-500 bg-emerald-50' :
                existing.status === 'rejected' || verStatus === 'fail' ? 'border-red-400 bg-red-50' :
                'border-amber-400 bg-amber-50'
              }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  existing.status === 'verified' || verStatus === 'pass' ? 'bg-emerald-100 text-emerald-600' :
                  existing.status === 'rejected' || verStatus === 'fail' ? 'bg-red-100 text-red-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  {existing.status === 'verified' || verStatus === 'pass'
                    ? <CheckCircle className="w-5 h-5" />
                    : <AlertCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {existing.status === 'verified'  ? 'Document Verified' :
                     verStatus === 'pass'            ? 'AI Verification Passed' :
                     verStatus === 'fail'            ? 'AI Verification Failed — Re-upload required' :
                     existing.status === 'rejected'  ? 'Document Rejected — Re-upload required' :
                     'Document Uploaded — Pending Review'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{existing.file_name}</p>
                  {existing.rejection_reason && <p className="text-xs text-red-600 mt-1">{existing.rejection_reason}</p>}
                </div>
                <button onClick={handleReupload} className="btn-secondary text-xs py-1.5 shrink-0">Re-upload</button>
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={state === 'idle' || state === 'error' ? handleFileInput : undefined}
              className={`relative rounded-2xl border-2 border-dashed transition-all ${
                dragging                                           ? 'border-primary-400 bg-primary-50 scale-[1.01]' :
                state === 'done' && verStatus === 'fail'          ? 'border-red-300 bg-red-50/30' :
                state === 'done'                                  ? 'border-emerald-300 bg-emerald-50/30' :
                state === 'error'                                 ? 'border-red-300 bg-red-50/30' :
                state === 'uploading' || state === 'extracting'   ? 'border-amber-300 bg-amber-50/30' :
                'border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/20 cursor-pointer'
              }`}
              style={{ minHeight: 210 }}
            >
              {preview && (
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <img src={preview} alt="preview" className="w-full h-full object-cover opacity-15" />
                </div>
              )}
              <div className="relative z-10 flex flex-col items-center justify-center p-10 text-center">
                {(state === 'idle' || state === 'error') && (
                  <>
                    <div className={`w-16 h-16 rounded-2xl ${config.iconBg} ${config.iconColor} flex items-center justify-center mb-4 ${dragging ? 'scale-110' : ''} transition-transform`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <p className="text-base font-semibold text-gray-700 mb-1">{dragging ? 'Drop file here' : `Upload ${config.title}`}</p>
                    <p className="text-sm text-gray-400 mb-3">Drag & drop or click to browse</p>
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                      <span className="px-2 py-0.5 bg-gray-100 rounded">JPG</span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded">PNG</span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded">PDF</span>
                      <span>· Max {maxMB} MB</span>
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-xl mt-4">
                        <AlertCircle className="w-4 h-4 shrink-0" />{error}
                      </div>
                    )}
                  </>
                )}
                {state === 'uploading' && (
                  <div className="flex flex-col items-center gap-3">
                    <LoadingSpinner size="lg" />
                    <p className="text-sm font-semibold text-gray-700">Uploading to secure storage…</p>
                    <p className="text-xs text-gray-400 truncate max-w-xs">{file?.name}</p>
                  </div>
                )}
                {state === 'extracting' && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 text-amber-500 flex items-center justify-center">
                      <Scan className="w-7 h-7 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Gemini AI Analysing…</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {config.documentType === 'passport' && profilePhotoDoc
                          ? 'Extracting data + matching face against your profile photo…'
                          : config.documentType === 'live_face'
                          ? 'Running liveness & spoof detection…'
                          : ['utility_bill','tax_document','salary_proof'].includes(config.documentType)
                          ? 'Extracting data + cross-checking name across documents…'
                          : 'Verifying document with Gemini Vision…'}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {[0,1,2,3].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                {state === 'done' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${verStatus === 'fail' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {verStatus === 'fail' ? <ShieldX className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
                    </div>
                    <p className={`text-sm font-semibold ${verStatus === 'fail' ? 'text-red-700' : 'text-emerald-700'}`}>
                      {verStatus === 'fail' ? 'Verification Failed' : 'Upload & Verification Complete'}
                    </p>
                    <p className="text-xs text-gray-400 truncate max-w-xs">{file?.name}</p>
                    {confidence != null && (
                      <span className={`badge ${confidence >= 0.9 ? 'badge-success' : confidence >= 0.75 ? 'badge-warning' : 'badge-error'}`}>
                        AI Confidence: {(confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    <button onClick={handleReupload} className="btn-secondary text-xs py-1.5 mt-1">
                      <Upload className="w-3.5 h-3.5" /> Replace file
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* AI Scorecard */}
            {(state === 'done' || isAlreadyUploaded) && verScores && verStatus && verStatus !== 'pending' && (
              <Scorecard
                docType={config.documentType}
                scores={verScores}
                status={verStatus}
                confidence={confidence ?? 0}
                onReupload={handleReupload}
              />
            )}

            {/* Extracted fields */}
            {(state === 'done' || isAlreadyUploaded) && ocrFields && Object.keys(ocrFields).filter(k => !k.startsWith('__')).length > 0 && (
              <div className="card p-4">
                <button onClick={() => setOcrVisible(v => !v)} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center">
                      <Cpu className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Gemini Extracted Data</span>
                    {confidence != null && (
                      <span className={`badge text-[10px] ${confidence >= 0.9 ? 'badge-success' : confidence >= 0.75 ? 'badge-warning' : 'badge-error'}`}>
                        {(confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                  {ocrVisible ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
                {ocrVisible && (
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {Object.entries(ocrFields).filter(([k]) => !k.startsWith('__')).map(([k, v]) => (
                      <div key={k} className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                        <p className="text-[10px] text-gray-400 capitalize font-medium">{k.replace(/_/g, ' ')}</p>
                        <p className="text-xs font-semibold text-gray-800 mt-0.5 break-words">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tips + AI callout */}
          <div className="space-y-4">
            <div className="card p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Upload Tips</p>
              <ul className="space-y-2.5">
                {config.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-600 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4 bg-gradient-to-br from-primary-50 to-blue-50 border-primary-100">
              <div className="flex items-center gap-2 mb-2">
                {config.documentType === 'photo'     ? <User        className="w-4 h-4 text-primary-600" /> :
                 config.documentType === 'passport'  ? <Scan        className="w-4 h-4 text-primary-600" /> :
                 config.documentType === 'live_face' ? <ShieldCheck className="w-4 h-4 text-primary-600" /> :
                                                       <Cpu         className="w-4 h-4 text-primary-600" />}
                <p className="text-xs font-semibold text-primary-700">
                  {config.documentType === 'photo'     ? 'Face Detection AI' :
                   config.documentType === 'passport'  ? 'OCR + Face Match AI' :
                   config.documentType === 'live_face' ? 'Liveness Detection AI' :
                   'Gemini AI OCR + Name Cross-Check'}
                </p>
              </div>
              <p className="text-xs text-primary-600/80 leading-relaxed">
                {config.documentType === 'photo'
                  ? 'Gemini AI verifies this is a real person photo with a single clearly visible face and good image quality.'
                  : config.documentType === 'passport'
                  ? 'Gemini AI extracts all passport fields and compares the passport photo face against your uploaded profile photo.'
                  : config.documentType === 'live_face'
                  ? 'AI liveness detection checks this is a real person and not a spoofed printed or screen photo.'
                  : 'OCR extracts all fields. The name is cross-checked against your other uploaded documents for consistency.'}
              </p>
            </div>

            <div className="card p-4 border-amber-100 bg-amber-50/50">
              <p className="text-xs font-semibold text-amber-700 mb-1">Why we need this</p>
              <p className="text-xs text-amber-600/80 leading-relaxed">{config.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          {config.prevPath
            ? <button onClick={() => navigate(config.prevPath!)} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Previous</button>
            : <div />}
          <div className="flex items-center gap-3">
            {verStatus === 'fail' && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl">
                <ShieldX className="w-4 h-4 shrink-0" /> Verification failed — re-upload to continue
              </div>
            )}
            {canProceed && config.nextPath && (
              <button onClick={() => navigate(config.nextPath!)} className="btn-primary">
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {!config.nextPath && canProceed && (
              <button onClick={handleFinish} className="btn-primary">
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFailReason(ocr: OCRResult): string {
  const s = ocr.verification_scores;
  if (!s) return 'AI verification failed';
  if (typeof s.fail_reasons === 'string' && s.fail_reasons) return s.fail_reasons;
  const fm = s.face_match as Record<string, unknown> | null;
  if (fm && fm.pass === false) return `Face match failed (score: ${Math.round((fm.match_score as number ?? 0) * 100)}%)`;
  return 'AI verification checks did not pass — please re-upload a clearer image';
}
