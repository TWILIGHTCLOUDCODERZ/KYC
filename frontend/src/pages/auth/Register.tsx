import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Lock, Mail, User, AlertCircle, CheckCircle,
  Phone, Globe, MapPin, Calendar, ChevronRight, ChevronLeft,
} from 'lucide-react';
import NTTLogo from '../../components/common/NTTLogo';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import OcrUploadButton from '../../components/common/OcrUploadButton';
import type { OcrFields, MissingField } from '../../components/common/OcrUploadButton';
import { useAuth } from '../../contexts/AuthContext';
import type { SignUpFields } from '../../contexts/AuthContext';

const PASSWORD_RULES = [
  { label: 'At least 8 characters',  test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter',   test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter',   test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number',             test: (p: string) => /\d/.test(p) },
  { label: 'One special character',  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const STEPS = ['Account', 'Personal', 'Address'] as const;

export default function Register() {
  const { signUp, refreshProfile } = useAuth();
  const navigate   = useNavigate();
  const [step, setStep] = useState(0);

  // Step 0 — account
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [agreed,          setAgreed]          = useState(false);

  // Step 1 — personal
  const [fullName,     setFullName]     = useState('');
  const [phone,        setPhone]        = useState('');
  const [dob,          setDob]          = useState('');
  const [nationality,  setNationality]  = useState('');

  // Step 2 — address
  const [address1,    setAddress1]    = useState('');
  const [address2,    setAddress2]    = useState('');
  const [city,        setCity]        = useState('');
  const [state,       setState]       = useState('');
  const [postalCode,  setPostalCode]  = useState('');
  const [country,     setCountry]     = useState('');

  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [highlightFields, setHighlightFields] = useState<Set<MissingField>>(new Set());

  const applyOcr = (fields: OcrFields, missing: MissingField[]) => {
    if (fields.full_name)     setFullName(fields.full_name);
    if (fields.date_of_birth) setDob(fields.date_of_birth);
    if (fields.nationality)   setNationality(fields.nationality);
    if (fields.phone)         setPhone(fields.phone);
    if (fields.address_line1) setAddress1(fields.address_line1);
    if (fields.address_line2) setAddress2(fields.address_line2);
    if (fields.city)          setCity(fields.city);
    if (fields.state)         setState(fields.state);
    if (fields.postal_code)   setPostalCode(fields.postal_code);
    if (fields.country)       setCountry(fields.country);
    setHighlightFields(new Set(missing));
  };

  const isHighlighted = (field: MissingField) => highlightFields.has(field);

  const passwordStrength = PASSWORD_RULES.filter(r => r.test(password)).length;
  const strengthColor = ['bg-gray-200','bg-red-400','bg-orange-400','bg-yellow-400','bg-green-400','bg-green-500'][passwordStrength];
  const strengthLabel = ['','Very Weak','Weak','Fair','Good','Strong'][passwordStrength];

  const nextStep = () => {
    setError('');
    if (step === 0) {
      if (!email || !password || !confirmPassword) { setError('Please fill all fields.'); return; }
      if (password !== confirmPassword)            { setError('Passwords do not match.'); return; }
      if (passwordStrength < 4)                   { setError('Please choose a stronger password.'); return; }
      if (!agreed)                                 { setError('You must agree to the Terms of Service.'); return; }
    }
    if (step === 1) {
      if (!fullName || !phone || !dob || !nationality) { setError('Please fill all required fields.'); return; }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!address1 || !city || !state || !postalCode || !country) {
      setError('Please fill all required address fields.');
      return;
    }
    setLoading(true);
    const fields: SignUpFields = {
      fullName, phone, dateOfBirth: dob, nationality,
      addressLine1: address1, addressLine2: address2,
      city, state, postalCode, country,
    };
    const { error: err } = await signUp(email, password, fields);
    if (err) { setLoading(false); setError(err.message || 'Registration failed. Please try again.'); return; }
    await refreshProfile();
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex bg-ntt-lightgray">
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        <div className="w-full max-w-lg mx-auto">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-6 justify-center">
            <NTTLogo size={38} />
            <div>
              <p className="text-lg font-bold text-ntt-blue">NTT DATA</p>
              <p className="text-xs text-gray-500">Bank KYC Platform</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0 mb-6">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step  ? 'bg-emerald-500 text-white' :
                    i === step ? 'bg-ntt-blue text-white ring-4 ring-blue-100' :
                                 'bg-gray-200 text-gray-400'
                  }`}>
                    {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${i === step ? 'text-ntt-blue' : i < step ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-16 h-0.5 mb-4 mx-1 ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="card p-7">
            {/* Heading */}
            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                {step === 0 ? 'Create your account' : step === 1 ? 'Personal information' : 'Residential address'}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {step === 0 ? 'Set up your login credentials' :
                 step === 1 ? 'Must match your government-issued ID exactly' :
                              'Your current residential address'}
              </p>
            </div>

            {/* KYC accuracy notice (steps 1 & 2) */}
            {step > 0 && (
              <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  All details must <strong>exactly match</strong> your identity proof. Inaccurate information will result in KYC rejection.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-5">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {/* ── Step 0: Account ──────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="label">Email Address <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" required className="input-field pl-10" />
                  </div>
                </div>
                <div>
                  <label className="label">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Create a strong password" required className="input-field pl-10 pr-10" />
                    <button type="button" onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-1 h-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className={`flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColor : 'bg-gray-200'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">Strength: <span className="font-medium">{strengthLabel}</span></p>
                      <div className="grid grid-cols-2 gap-1">
                        {PASSWORD_RULES.map(r => (
                          <div key={r.label} className="flex items-center gap-1.5">
                            <CheckCircle className={`w-3 h-3 ${r.test(password) ? 'text-green-500' : 'text-gray-300'}`} />
                            <span className="text-xs text-gray-500">{r.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Confirm Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password" required
                      className={`input-field pl-10 ${confirmPassword && confirmPassword !== password ? 'border-red-300 ring-1 ring-red-300' : ''}`} />
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
                <div className="flex items-start gap-2.5 pt-1">
                  <input type="checkbox" id="terms" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-primary-600" />
                  <label htmlFor="terms" className="text-sm text-gray-600">
                    I agree to the{' '}
                    <button type="button" className="text-primary-600 hover:underline">Terms of Service</button>{' '}
                    and{' '}
                    <button type="button" className="text-primary-600 hover:underline">Privacy Policy</button>
                  </label>
                </div>
                <button type="button" onClick={nextStep} className="btn-primary w-full py-3 mt-1 flex items-center justify-center gap-2">
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── Step 1: Personal ─────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <OcrUploadButton
                  documentType="kyc_profile"
                  label="Upload ID / Document to auto-fill all fields"
                  hint="Passport, ID, utility bill — AI extracts personal + address details"
                  onExtracted={applyOcr}
                />
                <div>
                  <label className="label">Full Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={fullName} onChange={e => { setFullName(e.target.value); setHighlightFields(h => { const n = new Set(h); n.delete('full_name'); return n; }); }}
                      placeholder="As it appears on your ID" required
                      className={`input-field pl-10 ${isHighlighted('full_name') ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`} />
                  </div>
                  {isHighlighted('full_name') && <p className="text-xs text-amber-600 mt-1">Could not extract — please fill manually</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date of Birth <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="date" value={dob} onChange={e => { setDob(e.target.value); setHighlightFields(h => { const n = new Set(h); n.delete('date_of_birth'); return n; }); }}
                        required
                        className={`input-field pl-10 ${isHighlighted('date_of_birth') ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`} />
                    </div>
                    {isHighlighted('date_of_birth') && <p className="text-xs text-amber-600 mt-1">Could not extract — please fill manually</p>}
                  </div>
                  <div>
                    <label className="label">Nationality <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={nationality} onChange={e => { setNationality(e.target.value); setHighlightFields(h => { const n = new Set(h); n.delete('nationality'); return n; }); }}
                        placeholder="e.g. American" required
                        className={`input-field pl-10 ${isHighlighted('nationality') ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`} />
                    </div>
                    {isHighlighted('nationality') && <p className="text-xs text-amber-600 mt-1">Could not extract — please fill manually</p>}
                  </div>
                </div>
                <div>
                  <label className="label">Phone Number <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setHighlightFields(h => { const n = new Set(h); n.delete('phone'); return n; }); }}
                      placeholder="+1 (555) 000-0000" required
                      className={`input-field pl-10 ${isHighlighted('phone') ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`} />
                  </div>
                  {isHighlighted('phone') && <p className="text-xs text-amber-600 mt-1">Could not extract — please fill manually</p>}
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(0)}
                    className="flex-1 btn-secondary py-3 flex items-center justify-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button type="button" onClick={nextStep}
                    className="flex-1 btn-primary py-3 flex items-center justify-center gap-2">
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Address ──────────────────────────────── */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {highlightFields.size > 0 && (
                  <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Some address fields could not be extracted from your document. Please fill the <strong>highlighted fields</strong> below manually.
                    </p>
                  </div>
                )}
                <div>
                  <label className="label">Address Line 1 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={address1} onChange={e => { setAddress1(e.target.value); setHighlightFields(h => { const n = new Set(h); n.delete('address_line1'); return n; }); }}
                      placeholder="123 Main Street" required
                      className={`input-field pl-10 ${isHighlighted('address_line1') ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`} />
                  </div>
                  {isHighlighted('address_line1') && <p className="text-xs text-amber-600 mt-1">Could not extract — please fill manually</p>}
                </div>
                <div>
                  <label className="label">Address Line 2 <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="text" value={address2} onChange={e => setAddress2(e.target.value)}
                    placeholder="Apartment, suite, unit..." className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">City <span className="text-red-500">*</span></label>
                    <input type="text" value={city} onChange={e => { setCity(e.target.value); setHighlightFields(h => { const n = new Set(h); n.delete('city'); return n; }); }}
                      required
                      className={`input-field ${isHighlighted('city') ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`} />
                    {isHighlighted('city') && <p className="text-xs text-amber-600 mt-1">Please fill manually</p>}
                  </div>
                  <div>
                    <label className="label">State / Province <span className="text-red-500">*</span></label>
                    <input type="text" value={state} onChange={e => { setState(e.target.value); setHighlightFields(h => { const n = new Set(h); n.delete('state'); return n; }); }}
                      required
                      className={`input-field ${isHighlighted('state') ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`} />
                    {isHighlighted('state') && <p className="text-xs text-amber-600 mt-1">Please fill manually</p>}
                  </div>
                  <div>
                    <label className="label">Postal Code <span className="text-red-500">*</span></label>
                    <input type="text" value={postalCode} onChange={e => { setPostalCode(e.target.value); setHighlightFields(h => { const n = new Set(h); n.delete('postal_code'); return n; }); }}
                      required
                      className={`input-field ${isHighlighted('postal_code') ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`} />
                    {isHighlighted('postal_code') && <p className="text-xs text-amber-600 mt-1">Please fill manually</p>}
                  </div>
                  <div>
                    <label className="label">Country <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={country} onChange={e => { setCountry(e.target.value); setHighlightFields(h => { const n = new Set(h); n.delete('country'); return n; }); }}
                        placeholder="United States" required
                        className={`input-field pl-10 ${isHighlighted('country') ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`} />
                    </div>
                    {isHighlighted('country') && <p className="text-xs text-amber-600 mt-1">Please fill manually</p>}
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 btn-secondary py-3 flex items-center justify-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 btn-primary py-3 flex items-center justify-center gap-2">
                    {loading ? <LoadingSpinner size="sm" color="text-white" /> : null}
                    {loading ? 'Creating account...' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}

            <p className="text-center text-sm text-gray-500 mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
