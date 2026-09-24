import { ENV } from '../config/env';
import type { DocumentType } from '../types/database';

export interface OCRResult {
  confidence: number;
  fields: Record<string, string>;
  raw_text: string;
  verification_scores?: Record<string, unknown>;
  verification_status?: 'pass' | 'fail' | 'pending';
  metadata: {
    file_name: string;
    file_size: number;
    file_size_human: string;
    file_type: string;
    document_type: string;
    upload_timestamp: string;
    gemini_model: string;
  };
}

export interface ExtractOptions {
  /** Profile photo file for face-match (used when documentType = 'passport') */
  refFile?: File;
  /** Previously extracted names keyed by docType for cross-check */
  crossCheckData?: Record<string, string>;
}

export async function extractDocumentData(
  file: File,
  documentType: DocumentType,
  options: ExtractOptions = {},
): Promise<OCRResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('document_type', documentType);

  if (options.refFile) {
    form.append('ref_file', options.refFile);
  }
  if (options.crossCheckData && Object.keys(options.crossCheckData).length > 0) {
    form.append('cross_check_data', JSON.stringify(options.crossCheckData));
  }

  const url = `${ENV.OCR_BACKEND_URL}/ocr`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Client-Info': 'ntt-kyc-platform',
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OCR service error (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error ?? 'OCR extraction failed');
  }

  return {
    confidence: data.confidence ?? 0.85,
    fields: data.fields ?? {},
    raw_text: data.raw_text ?? '',
    verification_scores: data.verification_scores,
    verification_status: data.verification_status ?? 'pending',
    metadata: data.metadata ?? {
      file_name: file.name,
      file_size: file.size,
      file_size_human: formatBytes(file.size),
      file_type: file.type,
      document_type: documentType,
      upload_timestamp: new Date().toISOString(),
      gemini_model: 'gemini-1.5-flash',
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
