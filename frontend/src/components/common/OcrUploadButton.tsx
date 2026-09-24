import { useRef, useState } from 'react';
import { Upload, Loader, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { extractDocumentData } from '../../services/ocrService';
import type { DocumentType } from '../../types/database';

export interface OcrFields {
  full_name?: string;
  date_of_birth?: string;
  nationality?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export type MissingField = keyof OcrFields;

interface Props {
  documentType: DocumentType;
  label: string;
  hint: string;
  onExtracted: (fields: OcrFields, missing: MissingField[]) => void;
}

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Full Name',
  date_of_birth: 'Date of Birth',
  nationality: 'Nationality',
  phone: 'Phone Number',
  address_line1: 'Address Line 1',
  address_line2: 'Address Line 2',
  city: 'City',
  state: 'State/Province',
  postal_code: 'Postal Code',
  country: 'Country',
};

export default function OcrUploadButton({ documentType, label, hint, onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'partial' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);

  const handleFile = async (file: File) => {
    setStatus('loading');
    setErrorMsg('');
    setMissingFields([]);
    try {
      const result = await extractDocumentData(file, documentType);
      const f = result.fields;
      console.log('[OCR] Raw fields from API:', JSON.stringify(f, null, 2));

      const mapped: OcrFields = {};

      const name = pick(f, 'full_name', 'account_holder', 'employee_name', 'taxpayer_name', 'name', 'holder_name', 'customer_name');
      if (name) mapped.full_name = name;

      const dob = pick(f, 'date_of_birth', 'dob', 'birth_date', 'birthdate');
      if (dob) mapped.date_of_birth = normalizeDate(dob);

      const nat = pick(f, 'nationality', 'citizenship');
      if (nat) mapped.nationality = nat;

      const phone = pick(f, 'phone', 'phone_number', 'mobile', 'mobile_number', 'tel', 'telephone', 'contact_number', 'contact', 'hp');
      if (phone) mapped.phone = phone;

      const addr1 = pick(f, 'address_line1', 'address_line_1', 'service_address', 'address', 'employer_address', 'street_address');
      if (addr1) mapped.address_line1 = addr1.split(/[\n]/)[0].trim();

      const addr2 = pick(f, 'address_line2', 'address_line_2');
      if (addr2) mapped.address_line2 = addr2.split(/[\n]/)[0].trim();

      const city = pick(f, 'city', 'town');
      if (city) mapped.city = city;

      const state = pick(f, 'state', 'issuing_state', 'province', 'region');
      if (state) mapped.state = state;

      const postal = pick(f, 'postal_code', 'postcode', 'post_code', 'zip_code', 'zip');
      if (postal) mapped.postal_code = postal;

      const country = pick(f, 'country', 'issuing_country', 'nation');
      if (country) mapped.country = country;

      console.log('[OCR] Mapped fields:', JSON.stringify(mapped, null, 2));
      const expectedFields: MissingField[] = [
        'full_name', 'date_of_birth', 'nationality', 'phone',
        'address_line1', 'city', 'state', 'postal_code', 'country',
      ];
      const missing = expectedFields.filter(k => !mapped[k]);
      console.log('[OCR] Missing fields:', missing);
      setMissingFields(missing);
      onExtracted(mapped, missing);
      setStatus(missing.length > 0 ? 'partial' : 'done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'OCR failed');
      setStatus('error');
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={onChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === 'loading'}
        className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all ${
          status === 'done'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : status === 'partial'
            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : status === 'error'
            ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
            : status === 'loading'
            ? 'border-blue-200 bg-blue-50 text-blue-500 cursor-wait'
            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'
        }`}
      >
        {status === 'loading' ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            Extracting with AI...
          </>
        ) : status === 'done' ? (
          <>
            <CheckCircle className="w-4 h-4" />
            All fields auto-filled — click to re-scan
          </>
        ) : status === 'partial' ? (
          <>
            <AlertCircle className="w-4 h-4" />
            Some fields extracted — please fill highlighted fields manually
          </>
        ) : status === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4" />
            Failed — click to retry
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            <span>{label}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </>
        )}
      </button>

      {status === 'idle' && (
        <p className="text-xs text-gray-400 mt-1.5 text-center">{hint}</p>
      )}
      {status === 'partial' && missingFields.length > 0 && (
        <p className="text-xs text-amber-600 mt-1.5 text-center font-medium">
          Could not extract: {missingFields.map(f => FIELD_LABELS[f] || f).join(', ')}. Please fill these manually.
        </p>
      )}
      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-500 mt-1.5 text-center">{errorMsg}</p>
      )}
    </div>
  );
}

// Return first non-empty value from the given keys
function pick(fields: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const v = fields[key];
    if (v && v.trim() && v.trim().toLowerCase() !== 'n/a' && v.trim().toLowerCase() !== 'unknown') {
      return v.trim();
    }
  }
  return '';
}

// Normalise various date formats → YYYY-MM-DD
function normalizeDate(raw: string): string {
  const s = raw.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  // DD MMM YYYY  e.g. "15 JAN 1990"
  const dMonY = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (dMonY) {
    const mon = MONTHS[dMonY[2].toUpperCase().slice(0, 3)];
    if (mon) return `${dMonY[3]}-${mon}-${dMonY[1].padStart(2,'0')}`;
  }
  // MMM DD YYYY  e.g. "JAN 15 1990"
  const mDY = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})[,\s]+(\d{4})$/);
  if (mDY) {
    const mon = MONTHS[mDY[1].toUpperCase().slice(0, 3)];
    if (mon) return `${mDY[3]}-${mon}-${mDY[2].padStart(2,'0')}`;
  }
  // Fallback: let Date parse it
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return s;
}

const MONTHS: Record<string, string> = {
  JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06',
  JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12',
};
