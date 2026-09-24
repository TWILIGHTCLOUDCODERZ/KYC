import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, MapPin, Globe, Save, AlertCircle, CheckCircle,
  Shield, Clock, Calendar, BadgeCheck, Activity, Lock
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logAuditAction } from '../services/auditService';

const ROLE_LABELS: Record<string, string> = {
  customer:             'Customer',
  admin:                'Administrator',
  compliance_officer:   'Compliance Officer',
  relationship_manager: 'Relationship Manager',
  kyc_officer:          'KYC Officer',
};

const ROLE_COLORS: Record<string, string> = {
  customer:             'bg-blue-50 text-blue-700 border-blue-200',
  admin:                'bg-red-50 text-red-700 border-red-200',
  compliance_officer:   'bg-amber-50 text-amber-700 border-amber-200',
  relationship_manager: 'bg-teal-50 text-teal-700 border-teal-200',
  kyc_officer:          'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  closed:    'bg-gray-50 text-gray-600 border-gray-200',
};

function fmt(ts?: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(ts?: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const REQUIRED_FIELDS: (keyof typeof EMPTY_FORM)[] = [
  'full_name', 'phone', 'date_of_birth', 'nationality',
  'address_line1', 'city', 'state', 'postal_code', 'country',
];

const FIELD_LABELS: Record<string, string> = {
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

const EMPTY_FORM = {
  full_name:     '',
  phone:         '',
  date_of_birth: '',
  nationality:   '',
  address_line1: '',
  address_line2: '',
  city:          '',
  state:         '',
  postal_code:   '',
  country:       '',
};

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof EMPTY_FORM, string>>>({});

  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Sync form whenever profile loads or refreshes
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

  const update = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    if (fieldErrors[field]) setFieldErrors(fe => ({ ...fe, [field]: '' }));
  };

  const validate = () => {
    const errs: Partial<Record<keyof typeof EMPTY_FORM, string>> = {};
    for (const f of REQUIRED_FIELDS) {
      if (!form[f].trim()) errs[f] = `${FIELD_LABELS[f]} is required`;
    }
    return errs;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please fill in all required fields before saving.');
      return;
    }

    setSaving(true);
    setError('');
    setFieldErrors({});

    const { error: err } = await supabase
      .from('profiles')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('user_id', profile.user_id);

    if (err) {
      setError(err.message);
    } else {
      await logAuditAction({ action: 'profile_update', entity_type: 'profile', entity_id: profile.user_id });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => navigate('/dashboard'), 1200);
    }
    setSaving(false);
  };

  const isAdmin = profile?.role !== 'customer';
  const approvalLevel = profile?.approval_level ?? 0;
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <AppShell title="Account Settings" subtitle="Manage your profile and preferences">
      <div className="w-full space-y-6">

        {/* ── Account Overview ─────────────────────────────────── */}
        {profile && (
          <div className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              {/* Avatar + identity */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-ntt-blue to-primary-500 flex items-center justify-center text-xl font-bold text-white shrink-0 shadow-sm">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{profile.full_name}</h2>
                  <p className="text-sm text-gray-500 truncate">{profile.email}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Role */}
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${ROLE_COLORS[profile.role] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      <Shield className="w-3 h-3" />
                      {ROLE_LABELS[profile.role] ?? profile.role}
                    </span>
                    {/* Approver level — shown for admin roles */}
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-800 text-white border-slate-700">
                        <BadgeCheck className="w-3 h-3" />
                        Approver {approvalLevel}
                      </span>
                    )}
                    {/* Account status */}
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[profile.account_status] ?? 'bg-gray-50 text-gray-600'}`}>
                      <Activity className="w-3 h-3" />
                      {profile.account_status ?? 'active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 shrink-0">
                <TimestampChip icon={Calendar} label="Member since"  value={fmtDate(profile.created_at)} />
                <TimestampChip icon={Clock}    label="Last login"    value={fmt(profile.last_login_at)} />
                <TimestampChip icon={Clock}    label="Profile updated" value={fmt(profile.updated_at)} />
                <TimestampChip icon={Shield}   label="Role assigned"  value={fmtDate(profile.role_assigned_at)} />
              </div>
            </div>
          </div>
        )}

        {/* ── KYC Notice ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <div className="shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">Accurate details required for KYC verification</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              All personal information must <strong>exactly match</strong> your government-issued identity proof (passport, national ID, or driver's licence).
              Incorrect or mismatched details will cause your KYC application to be rejected.
              Fields marked <span className="text-red-500 font-bold">*</span> are mandatory.
            </p>
          </div>
        </div>

        {/* ── Form ─────────────────────────────────────────────── */}
        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" /> Profile saved successfully — your details have been updated.
            </div>
          )}

          {/* Personal Information */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <User className="w-4 h-4 text-primary-600" />
              <h3 className="section-title">Personal Information</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text" value={form.full_name}
                  onChange={e => update('full_name', e.target.value)}
                  placeholder="As it appears on your ID"
                  className={`input-field ${fieldErrors.full_name ? 'border-red-400 bg-red-50 focus:ring-red-200' : ''}`}
                />
                {fieldErrors.full_name && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.full_name}</p>}
              </div>
              <div>
                <label className="label">Date of Birth <span className="text-red-500">*</span></label>
                <input
                  type="date" value={form.date_of_birth}
                  onChange={e => update('date_of_birth', e.target.value)}
                  className={`input-field ${fieldErrors.date_of_birth ? 'border-red-400 bg-red-50 focus:ring-red-200' : ''}`}
                />
                {fieldErrors.date_of_birth && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.date_of_birth}</p>}
              </div>
              <div>
                <label className="label">Nationality <span className="text-red-500">*</span></label>
                <input
                  type="text" value={form.nationality}
                  onChange={e => update('nationality', e.target.value)}
                  placeholder="e.g. American, British, Japanese"
                  className={`input-field ${fieldErrors.nationality ? 'border-red-400 bg-red-50 focus:ring-red-200' : ''}`}
                />
                {fieldErrors.nationality && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.nationality}</p>}
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
                  <Lock className="w-3 h-3" /> Email cannot be changed here
                </p>
              </div>
              <div>
                <label className="label">Phone Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel" value={form.phone}
                    onChange={e => update('phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className={`input-field pl-10 ${fieldErrors.phone ? 'border-red-400 bg-red-50 focus:ring-red-200' : ''}`}
                  />
                </div>
                {fieldErrors.phone && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.phone}</p>}
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
                <input
                  type="text" value={form.address_line1}
                  onChange={e => update('address_line1', e.target.value)}
                  placeholder="123 Main Street"
                  className={`input-field ${fieldErrors.address_line1 ? 'border-red-400 bg-red-50 focus:ring-red-200' : ''}`}
                />
                {fieldErrors.address_line1 && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.address_line1}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="label">Address Line 2 <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={form.address_line2} onChange={e => update('address_line2', e.target.value)}
                  placeholder="Apartment, suite, unit..." className="input-field" />
              </div>
              <div>
                <label className="label">City <span className="text-red-500">*</span></label>
                <input
                  type="text" value={form.city}
                  onChange={e => update('city', e.target.value)}
                  className={`input-field ${fieldErrors.city ? 'border-red-400 bg-red-50 focus:ring-red-200' : ''}`}
                />
                {fieldErrors.city && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.city}</p>}
              </div>
              <div>
                <label className="label">State / Province <span className="text-red-500">*</span></label>
                <input
                  type="text" value={form.state}
                  onChange={e => update('state', e.target.value)}
                  className={`input-field ${fieldErrors.state ? 'border-red-400 bg-red-50 focus:ring-red-200' : ''}`}
                />
                {fieldErrors.state && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.state}</p>}
              </div>
              <div>
                <label className="label">Postal Code <span className="text-red-500">*</span></label>
                <input
                  type="text" value={form.postal_code}
                  onChange={e => update('postal_code', e.target.value)}
                  className={`input-field ${fieldErrors.postal_code ? 'border-red-400 bg-red-50 focus:ring-red-200' : ''}`}
                />
                {fieldErrors.postal_code && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.postal_code}</p>}
              </div>
              <div>
                <label className="label">Country <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text" value={form.country}
                    onChange={e => update('country', e.target.value)}
                    placeholder="United States"
                    className={`input-field pl-10 ${fieldErrors.country ? 'border-red-400 bg-red-50 focus:ring-red-200' : ''}`}
                  />
                </div>
                {fieldErrors.country && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.country}</p>}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary px-8 gap-2">
              {saving
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function TimestampChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-2.5 border border-gray-100">
      <div className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center shrink-0">
        <Icon className="w-3 h-3 text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-[11px] font-semibold text-gray-700 mt-0.5 leading-tight break-words">{value}</p>
      </div>
    </div>
  );
}
