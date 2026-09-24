import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanFace, Camera, CameraOff, RefreshCw, CheckCircle, XCircle, ArrowLeft,
  ArrowRight, ShieldCheck, ShieldX, AlertCircle, Cpu, Clock, HardDrive,
  Tag, FileText, Eye, EyeOff, Scan, RotateCcw, Upload, AlertTriangle,
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

type PageState = 'camera' | 'preview' | 'uploading' | 'extracting' | 'done' | 'error';

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

function MetaChip({ icon: Icon, label, value, valueClass = 'text-gray-800' }: {
  icon: React.ElementType; label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-gray-400" />
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xs font-semibold truncate ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function LiveFaceUpload() {
  const { user, profile, refreshProfile } = useAuth();
  const { documents, refetch } = useDocuments();
  const navigate = useNavigate();

  const existing = documents.find(d => d.document_type === 'live_face');

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  const [pageState,   setPageState]   = useState<PageState>('camera');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const [facingMode,  setFacingMode]  = useState<'user' | 'environment'>('user');
  const [ocrResult,   setOcrResult]   = useState<OCRResult | null>(() => {
    if (existing?.ocr_extracted_data) {
      const data = existing.ocr_extracted_data as Record<string, unknown>;
      return {
        confidence: existing.ocr_confidence ?? 0,
        fields: data as Record<string, string>,
        raw_text: '',
        verification_scores: existing.verification_scores as Record<string, unknown> | undefined,
        verification_status: existing.verification_status as 'pass' | 'fail' | 'pending' | undefined,
        metadata: (data.__metadata as OCRResult['metadata']) ?? {
          file_name: existing.file_name,
          file_size: 0,
          file_size_human: '—',
          file_type: '—',
          document_type: 'live_face',
          upload_timestamp: existing.created_at,
          gemini_model: 'gemini-2.5-flash',
        },
      };
    }
    return null;
  });
  const [error,      setError]      = useState<string | null>(null);
  const [ocrVisible, setOcrVisible] = useState(false);
  const [countdown,  setCountdown]  = useState<number | null>(null);

  const stepNumber = 3;
  const totalSteps = 6;
  const stepPct    = (stepNumber / totalSteps) * 100;

  const verScores  = ocrResult?.verification_scores ?? (existing?.verification_scores as Record<string, unknown> | undefined);
  const verStatus  = ocrResult?.verification_status ?? (existing?.verification_status as 'pass' | 'fail' | 'pending' | undefined);
  const confidence = ocrResult?.confidence ?? null;
  const ocrMeta    = ocrResult?.metadata ?? null;
  const ocrFields  = ocrResult?.fields ?? null;

  const isAlreadyUploaded = !!existing && pageState === 'camera';

  const canProceed = pageState === 'done'
    ? (confidence != null && confidence >= 0.60)
    : isAlreadyUploaded && existing?.status !== 'rejected' && (existing?.ocr_confidence == null || existing.ocr_confidence >= 0.60);

  // Start camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied';
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFoundError')) {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Unable to access camera. Please check permissions.');
      }
    }
  }, [facingMode]);

  useEffect(() => {
    if (pageState === 'camera') {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [pageState, startCamera]);

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const triggerCapture = () => {
    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(interval);
        setCountdown(null);
        doCapture();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const doCapture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror if front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Flash effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    canvas.toBlob(blob => {
      if (!blob) return;
      const url  = URL.createObjectURL(blob);
      const file = new File([blob], `live_face_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setCapturedUrl(url);
      setCapturedFile(file);

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setPageState('preview');
    }, 'image/jpeg', 0.92);
  };

  const retake = () => {
    setCapturedUrl(null);
    setCapturedFile(null);
    setError(null);
    setPageState('camera');
  };

  const handleUploadFromDevice = () => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/jpeg,image/png';
    input.onchange = e => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      setCapturedUrl(url);
      setCapturedFile(f);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setPageState('preview');
    };
    input.click();
  };

  const submitCapture = useCallback(async () => {
    if (!capturedFile) return;
    const uid = auth.currentUser?.uid ?? user?.id;
    if (!uid) { setError('Not authenticated.'); return; }

    setError(null);
    setPageState('uploading');

    try {
      const path = `${uid}/live_face/${Date.now()}_${capturedFile.name}`;
      const { error: storageErr } = await supabase.storage.from('kyc-documents').upload(path, capturedFile, { upsert: true });
      if (storageErr) throw storageErr;

      const { data: urlData } = supabase.storage.from('kyc-documents').getPublicUrl(path);

      let docId: string;
      if (existing?.id) {
        const { data, error: dbErr } = await supabase
          .from('kyc_documents')
          .update({
            file_name: capturedFile.name,
            file_url:  urlData.publicUrl,
            status:    'processing',
            ocr_extracted_data: null,
            ocr_confidence:     null,
            rejection_reason:   null,
            verification_scores: null,
            verification_status: 'pending',
          })
          .eq('id', existing.id)
          .eq('user_id', uid)
          .select('id')
          .single();
        if (dbErr) throw dbErr;
        docId = data.id;
      } else {
        const { data, error: dbErr } = await supabase
          .from('kyc_documents')
          .insert({
            user_id: uid,
            document_type: 'live_face',
            file_name: capturedFile.name,
            file_url:  urlData.publicUrl,
            status:    'processing',
          })
          .select('id')
          .single();
        if (dbErr) throw dbErr;
        docId = data.id;
      }

      setPageState('extracting');

      const ocr = await extractDocumentData(capturedFile, 'live_face');

      const failReason = ocr.verification_status === 'fail'
        ? (ocr.verification_scores as Record<string, unknown>)?.fail_reasons as string ?? 'Liveness check failed'
        : null;

      await supabase.from('kyc_documents').update({
        ocr_extracted_data:  { ...ocr.fields, __metadata: ocr.metadata },
        ocr_confidence:      ocr.confidence,
        status:              'uploaded',
        verification_scores: ocr.verification_scores ?? null,
        verification_status: ocr.verification_status ?? 'pending',
        rejection_reason:    failReason,
      }).eq('id', docId);

      await logAuditAction({
        action: 'document_upload',
        entity_type: 'kyc_document',
        entity_id: docId,
        details: { document_type: 'live_face', confidence: ocr.confidence, verification_status: ocr.verification_status },
      });

      if (profile?.kyc_status === 'not_started') {
        await supabase.from('profiles').update({ kyc_status: 'in_progress' }).eq('user_id', uid);
        await refreshProfile();
      }

      setOcrResult(ocr);
      setPageState('done');
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setPageState('error');
    }
  }, [capturedFile, user, profile, existing, refetch, refreshProfile]);

  const handleReCapture = () => {
    setCapturedUrl(null);
    setCapturedFile(null);
    setOcrResult(null);
    setError(null);
    setPageState('camera');
  };

  return (
    <AppShell title="Live Face Verification" subtitle={`Step ${stepNumber} of ${totalSteps} — KYC Document Verification`}>
      <div className="w-full space-y-5">

        {/* Step progress */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map(n => (
                <div key={n} className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    n < stepNumber   ? 'bg-emerald-500 text-white' :
                    n === stepNumber ? 'bg-primary-600 text-white ring-4 ring-primary-100' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {n < stepNumber ? <CheckCircle className="w-3.5 h-3.5" /> : n}
                  </div>
                  {n < totalSteps && <div className={`w-5 h-0.5 ${n < stepNumber ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-400 font-medium">{stepNumber}/{totalSteps}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-500" style={{ width: `${stepPct}%` }} />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {/* Main area */}
          <div className="md:col-span-2 space-y-4">

            {/* Already-uploaded banner */}
            {isAlreadyUploaded && (
              <div className={`card p-4 flex items-center gap-3 border-l-4 ${
                verStatus === 'pass' ? 'border-emerald-500 bg-emerald-50' :
                verStatus === 'fail' ? 'border-red-400 bg-red-50' :
                'border-amber-400 bg-amber-50'
              }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  verStatus === 'pass' ? 'bg-emerald-100 text-emerald-600' :
                  verStatus === 'fail' ? 'bg-red-100 text-red-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  {verStatus === 'pass' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {verStatus === 'pass' ? 'Liveness Verified' :
                     verStatus === 'fail' ? 'Verification Failed — Re-capture required' :
                     'Live Face Uploaded — Pending Review'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{existing.file_name}</p>
                  {existing.rejection_reason && <p className="text-xs text-red-600 mt-1">{existing.rejection_reason}</p>}
                </div>
                <button onClick={handleReCapture} className="btn-secondary text-xs py-1.5 shrink-0 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" /> Re-capture
                </button>
              </div>
            )}

            {/* Camera / Preview box */}
            <div className="relative rounded-2xl overflow-hidden bg-gray-900" style={{ minHeight: 340 }}>

              {/* Flash overlay */}
              {flashActive && (
                <div className="absolute inset-0 bg-white z-30 pointer-events-none" />
              )}

              {/* CAMERA LIVE VIEW */}
              {(pageState === 'camera') && (
                <>
                  {cameraError ? (
                    <div className="flex flex-col items-center justify-center gap-4 p-10 text-center" style={{ minHeight: 340 }}>
                      <div className="w-16 h-16 rounded-2xl bg-red-900/40 flex items-center justify-center">
                        <CameraOff className="w-8 h-8 text-red-400" />
                      </div>
                      <p className="text-sm text-red-300 font-semibold">{cameraError}</p>
                      <div className="flex gap-3">
                        <button onClick={startCamera} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-colors">
                          <RefreshCw className="w-4 h-4" /> Retry Camera
                        </button>
                        <button onClick={handleUploadFromDevice} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-colors">
                          <Upload className="w-4 h-4" /> Upload Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full object-cover"
                        style={{ minHeight: 340, transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                      />

                      {/* Face guide oval */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-44 h-56 rounded-full border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                      </div>

                      {/* Countdown overlay */}
                      {countdown !== null && (
                        <div className="absolute inset-0 flex items-center justify-center z-20">
                          <div className="w-24 h-24 rounded-full bg-black/60 flex items-center justify-center">
                            <span className="text-5xl font-black text-white animate-ping-once">{countdown}</span>
                          </div>
                        </div>
                      )}

                      {/* Top bar */}
                      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-xs text-white font-medium">LIVE</span>
                        </div>
                        <button onClick={flipCamera} className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors" title="Flip camera">
                          <RotateCcw className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      {/* Instruction */}
                      <div className="absolute left-0 right-0 top-1/2 mt-32 flex justify-center pointer-events-none">
                        <p className="text-xs text-white/80 bg-black/40 px-3 py-1.5 rounded-full">
                          {countdown !== null ? `Hold still…` : 'Centre your face in the oval'}
                        </p>
                      </div>

                      {/* Bottom controls */}
                      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 px-4 pb-6 pt-4 bg-gradient-to-t from-black/70 to-transparent">
                        <button
                          onClick={handleUploadFromDevice}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload
                        </button>

                        {/* Shutter */}
                        <button
                          onClick={triggerCapture}
                          disabled={countdown !== null}
                          className="w-16 h-16 rounded-full bg-white hover:bg-gray-100 active:scale-95 transition-all shadow-lg flex items-center justify-center disabled:opacity-50"
                        >
                          <div className="w-12 h-12 rounded-full border-4 border-gray-300" />
                        </button>

                        <div className="w-24" />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* PREVIEW */}
              {(pageState === 'preview' || pageState === 'error') && capturedUrl && (
                <>
                  <img src={capturedUrl} alt="Captured selfie" className="w-full object-cover" style={{ minHeight: 340 }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {pageState === 'error' && error && (
                    <div className="absolute top-4 left-4 right-4 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />{error}
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 pb-5">
                    <button
                      onClick={retake}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-medium rounded-xl transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" /> Retake
                    </button>
                    <button
                      onClick={submitCapture}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg"
                    >
                      <CheckCircle className="w-4 h-4" /> Use This Photo
                    </button>
                  </div>
                </>
              )}

              {/* UPLOADING */}
              {pageState === 'uploading' && (
                <div className="flex flex-col items-center justify-center gap-4 p-10 text-center" style={{ minHeight: 340 }}>
                  {capturedUrl && <img src={capturedUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <LoadingSpinner size="lg" />
                    <p className="text-sm font-semibold text-white">Uploading to secure storage…</p>
                  </div>
                </div>
              )}

              {/* EXTRACTING */}
              {pageState === 'extracting' && (
                <div className="flex flex-col items-center justify-center gap-4 p-10 text-center" style={{ minHeight: 340 }}>
                  {capturedUrl && <img src={capturedUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
                  <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                      <Scan className="w-7 h-7 text-amber-300 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Gemini AI Analysing…</p>
                      <p className="text-xs text-gray-300 mt-1">Running liveness & spoof detection…</p>
                    </div>
                    <div className="flex gap-1.5">
                      {[0,1,2,3].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* DONE */}
              {pageState === 'done' && (
                <div className="relative" style={{ minHeight: 340 }}>
                  {capturedUrl && <img src={capturedUrl} alt="captured" className="w-full object-cover" style={{ minHeight: 340 }} />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 gap-3">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${verStatus === 'fail' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                      {verStatus === 'fail' ? <ShieldX className="w-7 h-7 text-white" /> : <ShieldCheck className="w-7 h-7 text-white" />}
                    </div>
                    <p className={`text-base font-bold ${verStatus === 'fail' ? 'text-red-300' : 'text-emerald-300'}`}>
                      {verStatus === 'fail' ? 'Liveness Check Failed' : 'Liveness Verified'}
                    </p>
                    {confidence != null && (
                      <span className="text-xs text-white/70 bg-white/15 px-3 py-1 rounded-full">
                        AI Confidence: {Math.round(confidence * 100)}%
                      </span>
                    )}
                    <button onClick={handleReCapture} className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-medium rounded-xl transition-colors">
                      <Camera className="w-4 h-4" /> Re-capture
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* AI Scorecard */}
            {(pageState === 'done' || isAlreadyUploaded) && verScores && verStatus && verStatus !== 'pending' && (
              <div className={`card overflow-hidden border-2 ${verStatus === 'pass' ? 'border-emerald-200' : 'border-red-200'}`}>
                <div className={`flex items-center gap-3 px-4 py-3 ${verStatus === 'pass' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${verStatus === 'pass' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    {verStatus === 'pass' ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldX className="w-5 h-5 text-red-600" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${verStatus === 'pass' ? 'text-emerald-700' : 'text-red-700'}`}>
                      Liveness {verStatus === 'pass' ? 'Passed' : 'Failed'}
                    </p>
                    <p className={`text-xs ${verStatus === 'pass' ? 'text-emerald-600/70' : 'text-red-600/70'}`}>
                      {verStatus === 'pass' ? 'Real person detected — no spoofing detected' : 'Issues found — please re-capture'}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${verStatus === 'pass' ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
                    {verStatus === 'pass' ? 'PASS' : 'FAIL'}
                  </span>
                </div>

                <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                  {confidence != null && <ConfidenceMeter value={confidence} label="AI Confidence" />}
                </div>

                <div className="px-4 py-2">
                  <ScoreRow label="Face Detected"  value={String(verScores.face_detected ?? '—')}   pass={verScores.face_detected === true} />
                  <ScoreRow label="Liveness Check" value={String(verScores.liveness_check ?? '—')}  pass={verScores.liveness_check === 'Pass'} />
                  <ScoreRow label="Real Person"    value={String(verScores.is_real_person ?? '—')}  pass={verScores.is_real_person === true} />
                  <ScoreRow label="Spoof Detected" value={String(verScores.spoof_detected ?? '—')}  pass={verScores.spoof_detected === false} />
                  <ScoreRow label="Spoof Type"     value={String(verScores.spoof_type ?? '—')} />
                  <ScoreRow label="Eyes Open"      value={String(verScores.eyes_open ?? '—')}       pass={verScores.eyes_open === true} />
                  <ScoreRow label="Head Pose"      value={String(verScores.head_pose ?? '—')} />
                  <ScoreRow label="Quality Score"  value={`${Math.round((verScores.quality_score as number ?? 0) * 100)}%`} pass={(verScores.quality_score as number ?? 0) >= 0.6} />
                </div>

                {verStatus !== 'pass' && verScores.fail_reasons && (
                  <div className="mx-4 mb-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{String(verScores.fail_reasons)}</p>
                  </div>
                )}

                {verStatus !== 'pass' && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={handleReCapture}
                      className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      <Camera className="w-4 h-4" /> Re-capture Photo
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* File metadata */}
            {(pageState === 'done' || isAlreadyUploaded) && ocrMeta && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <p className="text-sm font-semibold text-gray-700">File Metadata</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetaChip icon={FileText}    label="File name"      value={ocrMeta.file_name} />
                  <MetaChip icon={HardDrive}   label="File size"      value={ocrMeta.file_size_human} />
                  <MetaChip icon={Tag}         label="Type"           value={ocrMeta.file_type.split('/')[1]?.toUpperCase() ?? ocrMeta.file_type} />
                  <MetaChip icon={Clock}       label="Uploaded"       value={new Date(ocrMeta.upload_timestamp).toLocaleString()} />
                  <MetaChip icon={Cpu}         label="AI Model"       value={ocrMeta.gemini_model} />
                  {confidence != null && (
                    <MetaChip icon={CheckCircle} label="AI Confidence" value={`${Math.round(confidence * 100)}%`}
                      valueClass={confidence >= 0.9 ? 'text-emerald-600' : confidence >= 0.75 ? 'text-amber-600' : 'text-red-500'} />
                  )}
                </div>
              </div>
            )}

            {/* Extracted fields */}
            {(pageState === 'done' || isAlreadyUploaded) && ocrFields && Object.keys(ocrFields).filter(k => !k.startsWith('__')).length > 0 && (
              <div className="card p-4">
                <button onClick={() => setOcrVisible(v => !v)} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center">
                      <Cpu className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Gemini Extracted Data</span>
                  </div>
                  {ocrVisible ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
                {ocrVisible && (
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {Object.entries(ocrFields).filter(([k]) => !k.startsWith('__')).map(([k, v]) => (
                      <div key={k} className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                          {k.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs font-semibold text-gray-800 truncate">{String(v)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Nav */}
            <div className="flex items-center justify-between">
              <button onClick={() => navigate('/onboarding/passport')} className="btn-secondary flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => navigate('/onboarding/address')}
                disabled={!canProceed}
                className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tips sidebar */}
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center">
                  <ScanFace className="w-4 h-4 text-sky-600" />
                </div>
                <p className="text-sm font-semibold text-gray-800">Live Face Verification</p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                A real-time selfie is required to confirm you are physically present and to detect spoofing attempts.
              </p>
              <ul className="space-y-2">
                {[
                  'Take a fresh selfie — not a saved photo',
                  'Face directly at the camera, eyes open',
                  'Good, even lighting — avoid backlighting',
                  'No glasses, hats, or face coverings',
                  'Plain background preferred',
                  'Press the shutter and hold still for 3 seconds',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-sky-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[8px] font-bold text-sky-600">{i + 1}</span>
                    </div>
                    <span className="text-xs text-gray-500">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4 bg-amber-50 border border-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1">Anti-Spoofing Active</p>
                  <p className="text-xs text-amber-600">Our AI detects printed photos, screens, and masks. Use your real face only.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
