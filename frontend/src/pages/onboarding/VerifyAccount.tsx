import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Phone, Calendar, Globe, MapPin, Mail, Save,
  AlertCircle, CheckCircle, Lock, ArrowRight, ShieldCheck,
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logAuditAction } from '../../services/auditService';

const REQUIRED: (keyof typeof EMPTY)[] = [
  'full_name', 'phone', 'date_of_birth', 'nationality',
  'address_line1', 'city', 'state', 'postal_code', 'country',
];

const LABELS: Record<string, string> = {
  full_name:     'Full Name',
  phone:         'Phone Number',
  date_of_birth: 'Date of Birth',
  nationality:   'Nationality',
  address_line1: 'Address Line 1',
  city:          'City',
  state:         'State / Province',
  postal_code:   'Postal Code',
  country:       'Country',
};

const EMPTY = {
  full_name: '', phone: '', date_of_birth: '', nationality: '',
  address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: '',
};

export default function VerifyAccount() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ ...EMPTY });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [topError, setTopError]     = useState('');

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name:     profile.full_name     ?? '',
      phone:         profile.phone         ?? '',
      date_of_birth: profile.date_of_birth ?? '',
      nationality:   profile.nationality   ?? '',
      address_line1: profile.address_line1 ?? '',
      address_line2: profile.address_line2 ?? '',
      city:          profile.city          ?? '',
      state:         profile.state         ?? '',
      postal_code:   profile.postal_code   ?? '',
      country:       profile.country       ?? '',
    });
  }, [profile]);

  const update = (field: keyof typeof EMPTY, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    if (fieldErrors[field]) setFieldErrors(fe => ({ ...fe, [field]: '' }));
    setSaved(false);
  };


  const validate = () => {
    const errs: Partial<Record<keyof typeof EMPTY, string>> = {};
    for (const f of REQUIRED) {
      if (!form[f].trim()) errs[f] = `${LABELS[f]} is required`;
    }
    return errs;
  };

  const saveToDb = async () => {
    if (!profile) return false;
    // Convert empty strings to null for nullable DB columns (e.g. date type rejects '')
    const payload = {
      full_name:     form.full_name.trim(),
      phone:         form.phone.trim()         || null,
      date_of_birth: form.date_of_birth.trim() || null,
      nationality:   form.nationality.trim()   || null,
      address_line1: form.address_line1.trim() || null,
      address_line2: form.address_line2.trim() || null,
      city:          form.city.trim()          || null,
      state:         form.state.trim()         || null,
      postal_code:   form.postal_code.trim()   || null,
      country:       form.country.trim()       || null,
    };
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', profile.user_id);
    if (error) { setTopError(error.message); return false; }
    await logAuditAction({ action: 'profile_update', entity_type: 'profile', entity_id: profile.user_id });
    await refreshProfile();
    return true;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setTopError('Please fill in all required fields.');
      return;
    }
    setTopError('');
    setFieldErrors({});
    setSaving(true);
    const ok = await saveToDb();
    setSaving(false);
    if (ok) {
      setSaved(true);
    }
  };

  const handleProceed = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setTopError('Please fill in all required fields before proceeding.');
      return;
    }
    setTopError('');
    setFieldErrors({});
    setProceeding(true);
    const ok = await saveToDb();
    if (!ok) { setProceeding(false); return; }
    // Advance KYC status to in_progress
    if (profile && (profile.kyc_status === 'not_started' || profile.kyc_status === 'in_progress')) {
      await supabase
        .from('profiles')
        .update({ kyc_status: 'in_progress' })
        .eq('user_id', profile.user_id);
      await refreshProfile();
    }
    setProceeding(false);
    navigate('/dashboard');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <AppShell title="Account Verification" subtitle="Confirm your identity details before proceeding">
      <div className="w-full space-y-5">

        {/* KYC accuracy notice */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <div className="shrink-0">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">
              These details must match your identity proof exactly
            </p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Your full name, date of birth, nationality, and address must exactly match your government-issued
              passport, national ID, or driver's licence. Inaccurate information will cause your KYC application
              to be <strong>rejected</strong>. Fields marked <span className="text-red-500 font-bold">*</span> are mandatory.
            </p>
          </div>
        </div>

        {/* Account summary chip */}
        {profile && (
          <div className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ntt-blue to-primary-500 flex items-center justify-center text-white font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{profile.full_name || 'Not set'}</p>
              <p className="text-sm text-gray-500 truncate">{profile.email}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
              <Lock className="w-3 h-3" /> Email locked
            </div>
          </div>
        )}

        {/* Alerts */}
        {topError && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {topError}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" /> Changes saved successfully.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">

          {/* Personal Information */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <User className="w-4 h-4 text-primary-600" />
              <h3 className="section-title">Personal Information</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Full Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={form.full_name} onChange={e => update('full_name', e.target.value)}
                    placeholder="As it appears on your ID"
                    className={`input-field pl-10 ${fieldErrors.full_name ? 'border-red-400 bg-red-50' : ''}`} />
                </div>
                {fieldErrors.full_name && <FieldError msg={fieldErrors.full_name} />}
              </div>
              <div>
                <label className="label">Date of Birth <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)}
                    className={`input-field pl-10 ${fieldErrors.date_of_birth ? 'border-red-400 bg-red-50' : ''}`} />
                </div>
                {fieldErrors.date_of_birth && <FieldError msg={fieldErrors.date_of_birth} />}
              </div>
              <div>
                <label className="label">Nationality <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={form.nationality} onChange={e => update('nationality', e.target.value)}
                    placeholder="e.g. American, British"
                    className={`input-field pl-10 ${fieldErrors.nationality ? 'border-red-400 bg-red-50' : ''}`} />
                </div>
                {fieldErrors.nationality && <FieldError msg={fieldErrors.nationality} />}
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <Mail className="w-4 h-4 text-primary-600" />
              <h3 className="section-title">Contact Details</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" value={profile?.email ?? ''} disabled
                    className="input-field pl-10 bg-gray-50 text-gray-400 cursor-not-allowed" />
                </div>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Email cannot be changed
                </p>
              </div>
              <div>
                <label className="label">Phone Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className={`input-field pl-10 ${fieldErrors.phone ? 'border-red-400 bg-red-50' : ''}`} />
                </div>
                {fieldErrors.phone && <FieldError msg={fieldErrors.phone} />}
              </div>
            </div>
          </div>

          {/* Residential Address */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <MapPin className="w-4 h-4 text-primary-600" />
              <h3 className="section-title">Residential Address</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Address Line 1 <span className="text-red-500">*</span></label>
                <input type="text" value={form.address_line1} onChange={e => update('address_line1', e.target.value)}
                  placeholder="123 Main Street"
                  className={`input-field ${fieldErrors.address_line1 ? 'border-red-400 bg-red-50' : ''}`} />
                {fieldErrors.address_line1 && <FieldError msg={fieldErrors.address_line1} />}
              </div>
              <div className="md:col-span-2">
                <label className="label">Address Line 2 <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={form.address_line2} onChange={e => update('address_line2', e.target.value)}
                  placeholder="Apartment, suite, unit..." className="input-field" />
              </div>
              <div>
                <label className="label">City <span className="text-red-500">*</span></label>
                <input type="text" value={form.city} onChange={e => update('city', e.target.value)}
                  className={`input-field ${fieldErrors.city ? 'border-red-400 bg-red-50' : ''}`} />
                {fieldErrors.city && <FieldError msg={fieldErrors.city} />}
              </div>
              <div>
                <label className="label">State / Province <span className="text-red-500">*</span></label>
                <input type="text" value={form.state} onChange={e => update('state', e.target.value)}
                  className={`input-field ${fieldErrors.state ? 'border-red-400 bg-red-50' : ''}`} />
                {fieldErrors.state && <FieldError msg={fieldErrors.state} />}
              </div>
              <div>
                <label className="label">Postal Code <span className="text-red-500">*</span></label>
                <input type="text" value={form.postal_code} onChange={e => update('postal_code', e.target.value)}
                  className={`input-field ${fieldErrors.postal_code ? 'border-red-400 bg-red-50' : ''}`} />
                {fieldErrors.postal_code && <FieldError msg={fieldErrors.postal_code} />}
              </div>
              <div>
                <label className="label">Country <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={form.country} onChange={e => update('country', e.target.value)}
                    placeholder="United States"
                    className={`input-field pl-10 ${fieldErrors.country ? 'border-red-400 bg-red-50' : ''}`} />
                </div>
                {fieldErrors.country && <FieldError msg={fieldErrors.country} />}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button type="submit" disabled={saving}
              className="btn-secondary px-7 py-2.5 flex items-center justify-center gap-2">
              {saving
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <button type="button" onClick={handleProceed} disabled={proceeding}
              className="btn-primary px-7 py-2.5 flex items-center justify-center gap-2">
              {proceeding
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                : <ShieldCheck className="w-4 h-4" />}
              {proceeding ? 'Saving...' : 'Confirm & Proceed'}
              {!proceeding && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
      <AlertCircle className="w-3 h-3" />{msg}
    </p>
  );
}
