import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileText, Check, AlertCircle, Loader2, X, Eye,
  Cpu, Shield, ChevronDown, ChevronUp
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import StepIndicator from '../../components/common/StepIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { extractDocumentData } from '../../services/ocrService';
import { logAuditAction } from '../../services/auditService';
import { ENV } from '../../config/env';
import type { DocumentType } from '../../types/database';

interface UploadSlot {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
  category: 'identity' | 'address';
  accepted: string;
}

const UPLOAD_SLOTS: UploadSlot[] = [
  { type: 'passport', label: 'Passport', description: 'Valid international passport (all pages)', required: true, category: 'identity', accepted: 'image/jpeg,image/png,application/pdf' },
  { type: 'national_id', label: 'National ID / Driver\'s License', description: 'Government-issued photo ID', required: false, category: 'identity', accepted: 'image/jpeg,image/png' },
  { type: 'utility_bill', label: 'Utility Bill', description: 'Dated within last 3 months', required: true, category: 'address', accepted: 'image/jpeg,image/png,application/pdf' },
  { type: 'bank_statement', label: 'Bank Statement', description: 'Official bank statement (last 3 months)', required: false, category: 'address', accepted: 'image/jpeg,image/png,application/pdf' },
];

type SlotState = 'idle' | 'uploading' | 'processing_ocr' | 'done' | 'error';

interface SlotData {
  file: File | null;
  state: SlotState;
  ocrData: Record<string, string> | null;
  confidence: number | null;
  error: string | null;
  docId: string | null;
  expanded: boolean;
}

function initSlotData(): SlotData {
  return { file: null, state: 'idle', ocrData: null, confidence: null, error: null, docId: null, expanded: false };
}

export default function UploadDocuments() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<Record<DocumentType, SlotData>>({
    passport: initSlotData(),
    national_id: initSlotData(),
    drivers_license: initSlotData(),
    utility_bill: initSlotData(),
    bank_statement: initSlotData(),
    tax_document: initSlotData(),
  });
  const [submitting, setSubmitting] = useState(false);

  const updateSlot = (type: DocumentType, update: Partial<SlotData>) => {
    setSlots(prev => ({ ...prev, [type]: { ...prev[type], ...update } }));
  };

  const handleFileSelect = useCallback(async (type: DocumentType, file: File) => {
    if (!user) return;

    const maxBytes = ENV.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      updateSlot(type, { error: `File too large. Maximum size is ${ENV.MAX_FILE_SIZE_MB}MB.`, state: 'error' });
      return;
    }
    if (!ENV.ALLOWED_FILE_TYPES.includes(file.type)) {
      updateSlot(type, { error: 'Invalid file type. Please upload JPG, PNG, or PDF.', state: 'error' });
      return;
    }

    updateSlot(type, { file, state: 'uploading', error: null, ocrData: null });

    try {
      // Upload to Supabase storage
      const path = `${user.id}/${type}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from('kyc-documents')
        .upload(path, file, { upsert: true });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from('kyc-documents').getPublicUrl(path);

      // Insert document record
      const { data: docRecord, error: dbError } = await supabase
        .from('kyc_documents')
        .insert({
          user_id: user.id,
          document_type: type,
          file_name: file.name,
          file_url: urlData.publicUrl,
          status: 'processing',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      updateSlot(type, { state: 'processing_ocr', docId: docRecord.id });

      const ocr = await extractDocumentData(file, type);
      await supabase.from('kyc_documents').update({
        ocr_extracted_data: ocr.fields,
        ocr_confidence: ocr.confidence,
        status: 'uploaded',
      }).eq('id', docRecord.id);

      await logAuditAction({
        action: 'document_upload',
        entity_type: 'kyc_document',
        entity_id: docRecord.id,
        details: { document_type: type, confidence: ocr.confidence },
      });

      // Update KYC status to in_progress
      if (profile?.kyc_status === 'not_started') {
        await supabase.from('profiles').update({ kyc_status: 'in_progress' }).eq('user_id', user.id);
        await refreshProfile();
      }

      updateSlot(type, { state: 'done', ocrData: ocr.fields as Record<string, string>, confidence: ocr.confidence });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      updateSlot(type, { state: 'error', error: msg });
    }
  }, [user, profile, refreshProfile]);

  const handleDrop = (type: DocumentType, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(type, file);
  };

  const handleSubmitKYC = async () => {
    if (!user) return;
    setSubmitting(true);
    await supabase.from('profiles').update({ kyc_status: 'pending_review' }).eq('user_id', user.id);
    await logAuditAction({ action: 'kyc_submitted', entity_type: 'profile', entity_id: user.id });
    await refreshProfile();
    setSubmitting(false);
    navigate('/kyc-status');
  };

  const allRequiredDone = UPLOAD_SLOTS
    .filter(s => s.required)
    .every(s => slots[s.type].state === 'done');

  const uploadedCount = Object.values(slots).filter(s => s.state === 'done').length;

  const STEPS = [
    { id: 1, label: 'Identity Documents' },
    { id: 2, label: 'Address Proof' },
    { id: 3, label: 'Submit KYC' },
  ];
  const identityDone = UPLOAD_SLOTS.filter(s => s.category === 'identity' && s.required).every(s => slots[s.type].state === 'done');
  const addressDone = UPLOAD_SLOTS.filter(s => s.category === 'address' && s.required).every(s => slots[s.type].state === 'done');
  const currentStep = !identityDone ? 1 : !addressDone ? 2 : 3;
  const completedSteps = [identityDone ? 1 : null, addressDone ? 2 : null].filter(Boolean) as number[];

  return (
    <AppShell title="Upload Documents" subtitle="Upload your identity and address verification documents">
      <div className="w-full space-y-6">
        {/* Progress indicator */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Document Upload Progress</h3>
            <span className="text-sm text-gray-500">{uploadedCount} / {UPLOAD_SLOTS.length} documents</span>
          </div>
          <StepIndicator steps={STEPS} currentStep={currentStep} completedSteps={completedSteps} />
          <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-500"
              style={{ width: `${(uploadedCount / UPLOAD_SLOTS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Identity Documents */}
        <DocumentSection
          title="Identity Documents"
          subtitle="Upload a valid government-issued photo ID"
          icon={FileText}
          slots={UPLOAD_SLOTS.filter(s => s.category === 'identity')}
          slotData={slots}
          onFileSelect={handleFileSelect}
          onDrop={handleDrop}
          onToggleExpand={(type) => updateSlot(type, { expanded: !slots[type].expanded })}
        />

        {/* Address Proof */}
        <DocumentSection
          title="Address Verification"
          subtitle="Proof of residence from the last 3 months"
          icon={Shield}
          slots={UPLOAD_SLOTS.filter(s => s.category === 'address')}
          slotData={slots}
          onFileSelect={handleFileSelect}
          onDrop={handleDrop}
          onToggleExpand={(type) => updateSlot(type, { expanded: !slots[type].expanded })}
        />

        {/* Submit */}
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${allRequiredDone ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="section-title">Submit for KYC Review</h3>
              <p className="text-sm text-gray-500 mt-1">
                {allRequiredDone
                  ? 'All required documents have been uploaded. Submit your application for compliance review.'
                  : 'Please upload all required documents before submitting.'}
              </p>
              {!allRequiredDone && (
                <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Passport and Utility Bill are required</span>
                </div>
              )}
            </div>
            <button
              onClick={handleSubmitKYC}
              disabled={!allRequiredDone || submitting}
              className="btn-primary shrink-0"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Submit KYC
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

interface DocumentSectionProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  slots: UploadSlot[];
  slotData: Record<DocumentType, SlotData>;
  onFileSelect: (type: DocumentType, file: File) => void;
  onDrop: (type: DocumentType, e: React.DragEvent) => void;
  onToggleExpand: (type: DocumentType) => void;
}

function DocumentSection({ title, subtitle, icon: Icon, slots, slotData, onFileSelect, onDrop, onToggleExpand }: DocumentSectionProps) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <Icon className="w-5 h-5 text-primary-600" />
        <div>
          <h3 className="section-title text-base">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {slots.map(slot => (
          <UploadCard
            key={slot.type}
            slot={slot}
            data={slotData[slot.type]}
            onFileSelect={onFileSelect}
            onDrop={onDrop}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </div>
    </div>
  );
}

interface UploadCardProps {
  slot: UploadSlot;
  data: SlotData;
  onFileSelect: (type: DocumentType, file: File) => void;
  onDrop: (type: DocumentType, e: React.DragEvent) => void;
  onToggleExpand: (type: DocumentType) => void;
}

function UploadCard({ slot, data, onFileSelect, onDrop, onToggleExpand }: UploadCardProps) {
  const [dragging, setDragging] = useState(false);

  const statusConfig = {
    idle: { border: 'border-gray-200 hover:border-primary-300', bg: 'bg-gray-50 hover:bg-primary-50/30' },
    uploading: { border: 'border-primary-300', bg: 'bg-primary-50/30' },
    processing_ocr: { border: 'border-orange-300', bg: 'bg-orange-50/30' },
    done: { border: 'border-green-300', bg: 'bg-green-50/30' },
    error: { border: 'border-red-300', bg: 'bg-red-50/30' },
  };

  const { border, bg } = statusConfig[data.state];

  return (
    <div className={`border rounded-xl transition-all ${border} ${bg} overflow-hidden`}>
      <div
        className={`p-4 ${data.state === 'idle' ? 'cursor-pointer' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { setDragging(false); onDrop(slot.type, e); }}
        onClick={() => {
          if (data.state === 'idle' || data.state === 'error') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = slot.accepted;
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) onFileSelect(slot.type, file);
            };
            input.click();
          }
        }}
      >
        <div className="flex items-center gap-3">
          {/* Status icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            data.state === 'done' ? 'bg-green-100 text-green-600' :
            data.state === 'error' ? 'bg-red-100 text-red-600' :
            data.state === 'uploading' || data.state === 'processing_ocr' ? 'bg-orange-100 text-orange-600' :
            dragging ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {data.state === 'done' ? <Check className="w-5 h-5" /> :
             data.state === 'error' ? <X className="w-5 h-5" /> :
             data.state === 'uploading' ? <Loader2 className="w-5 h-5 animate-spin" /> :
             data.state === 'processing_ocr' ? <Cpu className="w-5 h-5 animate-pulse" /> :
             <Upload className={`w-5 h-5 ${dragging ? 'animate-bounce' : ''}`} />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-800">{slot.label}</p>
              {slot.required && <span className="text-xs text-red-500 font-medium">Required</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {data.state === 'idle' ? slot.description :
               data.state === 'uploading' ? 'Uploading document...' :
               data.state === 'processing_ocr' ? 'Running AI OCR extraction...' :
               data.state === 'done' ? `${data.file?.name} — ${((data.file?.size || 0) / 1024).toFixed(0)} KB` :
               data.error || 'Error occurred'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {data.state === 'done' && data.ocrData && (
              <>
                <span className={`badge ${(data.confidence || 0) >= 0.9 ? 'badge-success' : (data.confidence || 0) >= 0.75 ? 'badge-warning' : 'badge-error'}`}>
                  {((data.confidence || 0) * 100).toFixed(0)}% confidence
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(slot.type); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {data.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </>
            )}
            {(data.state === 'idle' || data.state === 'error') && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Eye className="w-3.5 h-3.5" />
                <span>Click or drag</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OCR Results */}
      {data.state === 'done' && data.expanded && data.ocrData && (
        <div className="border-t border-green-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-3.5 h-3.5 text-primary-600" />
            <p className="text-xs font-semibold text-gray-700">AI Extracted Data</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.ocrData).slice(0, 8).map(([key, value]) => (
              <div key={key}>
                <p className="text-xs text-gray-400 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-xs font-medium text-gray-700 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
