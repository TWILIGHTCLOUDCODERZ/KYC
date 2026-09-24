import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Shield, Users, ClipboardList,
  ChevronLeft, ChevronRight, Settings, LogOut,
  UserCheck, BarChart3, AlertTriangle, Activity,
  Camera, BookOpen, MapPin, Receipt, Banknote, ScanFace,
  CheckCircle, Circle, Lock, User, Bell,
  ChevronDown, ShieldCheck, UserCog
} from 'lucide-react';
import NTTLogo from '../common/NTTLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useDocuments } from '../../hooks/useDocuments';
import type { DocumentType } from '../../types/database';

/* ─── Types ────────────────────────────────────────────────── */
interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: string[];
  badge?: string;
  section?: string;
}

/* ─── Navigation items ─────────────────────────────────────── */
const NAV_ITEMS: NavItem[] = [
  // Customer
  { section: 'MAIN',         label: 'Dashboard',        icon: LayoutDashboard, path: '/dashboard',       roles: ['customer', 'admin', 'compliance_officer', 'relationship_manager', 'kyc_officer'] },
  { section: 'CUSTOMER',     label: 'My Documents',     icon: FileText,        path: '/onboarding/photo', roles: ['customer'] },
  { section: 'CUSTOMER',     label: 'Profile',          icon: User,            path: '/settings',         roles: ['customer'] },
  // Admin / Officers
  { section: 'OPERATIONS',   label: 'Admin Dashboard',  icon: BarChart3,       path: '/admin',            roles: ['admin', 'compliance_officer'] },
  { section: 'OPERATIONS',   label: 'Review Customers', icon: UserCheck,       path: '/admin/customers',  roles: ['admin', 'compliance_officer', 'relationship_manager', 'kyc_officer'] },
  { section: 'OPERATIONS',   label: 'AML Screening',    icon: AlertTriangle,   path: '/admin/aml',        roles: ['admin', 'compliance_officer'] },
  { section: 'COMPLIANCE',   label: 'Audit Logs',       icon: ClipboardList,   path: '/admin/audit',      roles: ['admin', 'compliance_officer', 'kyc_officer'] },
  { section: 'COMPLIANCE',   label: 'Reports',          icon: Activity,        path: '/admin/reports',    roles: ['admin', 'compliance_officer'] },
  { section: 'ADMIN',        label: 'User Management',  icon: UserCog,         path: '/admin/users',      roles: ['admin'] },
];

/* ─── KYC onboarding steps ─────────────────────────────────── */
const ONBOARDING_STEPS: {
  id: number;
  key: DocumentType;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  path: string;
}[] = [
  { id: 1, key: 'photo',        label: 'Profile Photo',    sublabel: 'Face photo',             icon: Camera,   path: '/onboarding/photo' },
  { id: 2, key: 'passport',     label: 'Passport / ID',    sublabel: 'Govt-issued ID',         icon: BookOpen, path: '/onboarding/passport' },
  { id: 3, key: 'live_face',    label: 'Live Face Check',  sublabel: 'Liveness detection',     icon: ScanFace, path: '/onboarding/live-face' },
  { id: 4, key: 'utility_bill', label: 'Address Proof',    sublabel: 'Utility bill / letter',  icon: MapPin,   path: '/onboarding/address' },
  { id: 5, key: 'tax_document', label: 'Tax Document',     sublabel: 'W-2 / ITIN / Tax ID',    icon: Receipt,  path: '/onboarding/tax' },
  { id: 6, key: 'salary_proof', label: 'Salary Proof',     sublabel: 'Payslip / income cert',  icon: Banknote, path: '/onboarding/salary' },
];

/* ─── Profile completion fields ───────────────────────────── */
const PROFILE_FIELDS = ['full_name','phone','date_of_birth','nationality','address_line1','city','country'] as const;

const PROFILE_FIELD_LABELS: Record<string, string> = {
  full_name: 'Full Name',
  phone: 'Phone',
  date_of_birth: 'Date of Birth',
  nationality: 'Nationality',
  address_line1: 'Address',
  city: 'City',
  country: 'Country',
};

/* ─── Hook: onboarding progress ───────────────────────────── */
function useOnboardingProgress() {
  const { documents } = useDocuments();
  return ONBOARDING_STEPS.map(step => {
    const doc = documents.find(d => d.document_type === step.key);
    return { ...step, doc, uploaded: !!doc, verified: doc?.status === 'verified' };
  });
}

/* ─── Sidebar component ────────────────────────────────────── */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { profile, user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isCustomer = profile?.role === 'customer';
  const onboarding = useOnboardingProgress();
  const uploadedCount = onboarding.filter(s => s.uploaded).length;
  const completionPct = Math.round((uploadedCount / ONBOARDING_STEPS.length) * 100);

  // Profile completion %
  const filledFields = PROFILE_FIELDS.filter(f => !!profile?.[f as keyof typeof profile]).length;
  const profilePct = Math.round((filledFields / PROFILE_FIELDS.length) * 100);

  const visibleNav = NAV_ITEMS.filter(item => profile?.role && item.roles.includes(profile.role));

  // Group nav items by section
  const sections = [...new Set(visibleNav.map(i => i.section))];

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : '?';

  // Close profile popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    setProfileOpen(false);
    await signOut();
    navigate('/login');
  };

  const SECTION_LABELS: Record<string, string> = {
    MAIN: 'Menu',
    CUSTOMER: 'My Account',
    OPERATIONS: 'Operations',
    COMPLIANCE: 'Compliance',
    ADMIN: 'Administration',
  };

  return (
    <aside
      className={`relative flex flex-col bg-ntt-blue text-white transition-all duration-300 ease-in-out shrink-0 shadow-sidebar z-20 h-screen sticky top-0 ${collapsed ? 'w-16' : 'w-64'}`}
    >
      {/* ── Logo ─────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-4 py-[18px] border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <NTTLogo size={34} className="shrink-0" />
        {!collapsed && (
          <div className="animate-fade-in min-w-0">
            <p className="text-sm font-bold text-white leading-tight tracking-wide">NTT DATA</p>
            <p className="text-[10px] text-blue-300 leading-tight">Bank KYC Platform</p>
          </div>
        )}
      </div>

      {/* ── Scrollable body ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* Navigation sections */}
        <nav className="px-2 pt-3 pb-2 space-y-5">
          {sections.map(section => {
            const items = visibleNav.filter(i => i.section === section);
            return (
              <div key={section}>
                {/* Section label */}
                {!collapsed && (
                  <p className="text-[10px] font-semibold text-blue-400/70 uppercase tracking-[0.12em] px-3 mb-1.5">
                    {SECTION_LABELS[section!] ?? section}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map(item => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/dashboard'}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'
                      }
                    >
                      <item.icon style={{ width: 17, height: 17 }} className="shrink-0" />
                      {!collapsed && (
                        <span className="flex-1 text-sm truncate">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="ml-auto text-[10px] font-bold bg-ntt-red px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── KYC Onboarding Steps (customers only) ─────────── */}
        {isCustomer && !collapsed && (
          <div className="mx-2 mt-1 mb-3 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Shield style={{ width: 13, height: 13 }} className="text-emerald-400" />
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">KYC Steps</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                completionPct === 100 ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/10 text-blue-300'
              }`}>
                {uploadedCount}/{ONBOARDING_STEPS.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="px-3 pt-2.5 pb-1">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-green-300 rounded-full transition-all duration-700"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <p className="text-[10px] text-blue-300/70 mt-1">{completionPct}% complete</p>
            </div>

            {/* Step rows */}
            <div className="px-1.5 pb-2 space-y-0.5">
              {onboarding.map((step, idx) => {
                const isActive = location.pathname === step.path;
                const isLocked = idx > 0 && !onboarding[idx - 1].uploaded;
                const state = step.verified ? 'done' : step.uploaded ? 'progress' : isLocked ? 'locked' : 'pending';

                // Extract metadata from stored ocr_extracted_data
                const storedMeta = step.doc?.ocr_extracted_data as Record<string, unknown> | undefined;
                const fileMeta = storedMeta?.__metadata as Record<string, string> | undefined;
                const fileName = fileMeta?.file_name ?? step.doc?.file_name;
                const fileSize = fileMeta?.file_size_human;
                const conf = step.doc?.ocr_confidence;

                return (
                  <button
                    key={step.id}
                    onClick={() => !isLocked && navigate(step.path)}
                    disabled={isLocked}
                    title={isLocked ? 'Complete previous step first' : step.label}
                    className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                      isActive   ? 'bg-white/15 ring-1 ring-white/20' :
                      isLocked   ? 'opacity-35 cursor-not-allowed' :
                      'hover:bg-white/10 cursor-pointer'
                    }`}
                  >
                    {/* Status bubble */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5 ${
                      state === 'done'     ? 'bg-emerald-400 text-white' :
                      state === 'progress' ? 'bg-amber-400 text-white' :
                      state === 'locked'   ? 'bg-white/10 text-white/30' :
                      'bg-white/15 text-white/60'
                    }`}>
                      {state === 'done'     ? <CheckCircle style={{ width: 12, height: 12 }} /> :
                       state === 'locked'   ? <Lock style={{ width: 10, height: 10 }} /> :
                       state === 'progress' ? <Circle style={{ width: 11, height: 11 }} className="fill-current" /> :
                       step.id}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate leading-tight ${
                        state === 'done'     ? 'text-emerald-300' :
                        state === 'locked'   ? 'text-white/30' :
                        isActive             ? 'text-white' : 'text-white/75'
                      }`}>{step.label}</p>

                      {/* Post-upload metadata */}
                      {(state === 'done' || state === 'progress') && fileName ? (
                        <div className="mt-0.5 space-y-0.5">
                          <p className="text-[9px] text-blue-200/70 truncate leading-tight">{fileName}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {fileSize && (
                              <span className="text-[9px] text-blue-300/50 bg-white/5 px-1 py-0.5 rounded">
                                {fileSize}
                              </span>
                            )}
                            {conf != null && (
                              <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                                conf >= 0.9  ? 'bg-emerald-500/20 text-emerald-300' :
                                conf >= 0.75 ? 'bg-amber-500/20 text-amber-300' :
                                'bg-red-500/20 text-red-300'
                              }`}>
                                {(conf * 100).toFixed(0)}% OCR
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[9px] text-blue-300/60 truncate leading-tight mt-0.5">
                          {state === 'locked' ? 'Locked' : step.sublabel}
                        </p>
                      )}
                    </div>

                    {state === 'progress' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsed: step dots */}
        {isCustomer && collapsed && (
          <div className="px-2 mt-3 space-y-1.5">
            {onboarding.map(step => (
              <button
                key={step.id}
                onClick={() => navigate(step.path)}
                title={step.label}
                className={`w-full flex justify-center py-1.5 rounded-lg transition-all ${
                  location.pathname === step.path ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step.verified ? 'bg-emerald-400 text-white' :
                  step.uploaded ? 'bg-amber-400 text-white' :
                  'bg-white/15 text-white/50'
                }`}>
                  {step.verified ? <CheckCircle style={{ width: 11, height: 11 }} /> :
                   step.uploaded ? <Circle style={{ width: 11, height: 11 }} className="fill-current" /> :
                   step.id}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Profile Completion (hide when 100%) ──────────────── */}
        {isCustomer && !collapsed && profilePct < 100 && (
          <div className="mx-2 mb-2 rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <User style={{ width: 12, height: 12 }} className="text-blue-300 shrink-0" />
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest flex-1">Profile</p>
              <span className={`text-[10px] font-bold ${
                profilePct >= 80 ? 'text-emerald-300' : profilePct >= 50 ? 'text-amber-300' : 'text-red-300'
              }`}>{profilePct}%</span>
            </div>

            {/* Ring + summary */}
            <div className="flex items-center gap-3 mb-2.5">
              <div className="relative w-12 h-12 shrink-0">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                  <circle
                    cx="24" cy="24" r="19" fill="none"
                    stroke={profilePct >= 80 ? '#34d399' : profilePct >= 50 ? '#fbbf24' : '#f87171'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 19}`}
                    strokeDashoffset={`${2 * Math.PI * 19 * (1 - profilePct / 100)}`}
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                  {profilePct}%
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-white/90 leading-tight">
                  {filledFields}/{PROFILE_FIELDS.length} fields filled
                </p>
                <p className="text-[9px] text-blue-300/60 mt-0.5 leading-tight">
                  {PROFILE_FIELDS.length - filledFields} field{PROFILE_FIELDS.length - filledFields !== 1 ? 's' : ''} missing
                </p>
              </div>
            </div>

            {/* Per-field checklist */}
            <div className="space-y-1 mb-2.5">
              {PROFILE_FIELDS.map(f => {
                const filled = !!profile?.[f as keyof typeof profile];
                return (
                  <div key={f} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full flex items-center justify-center shrink-0 ${
                      filled ? 'bg-emerald-400' : 'bg-white/10'
                    }`}>
                      {filled && <CheckCircle style={{ width: 8, height: 8 }} className="text-white" />}
                    </div>
                    <span className={`text-[10px] ${filled ? 'text-white/70' : 'text-white/35'}`}>
                      {PROFILE_FIELD_LABELS[f] ?? f.replace(/_/g, ' ')}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => navigate('/settings')}
              className="w-full text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-white/80 py-1.5 rounded-lg transition-colors"
            >
              Complete Profile
            </button>
          </div>
        )}

        {/* ── KYC Progress (always visible for customers) ──────── */}
        {isCustomer && !collapsed && (
          <div className="mx-2 mb-3 rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield style={{ width: 12, height: 12 }} className="text-emerald-400 shrink-0" />
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest flex-1">KYC Progress</p>
              <span className={`text-[10px] font-bold ${
                completionPct === 100 ? 'text-emerald-300' : completionPct >= 60 ? 'text-amber-300' : 'text-blue-300'
              }`}>{completionPct}%</span>
            </div>

            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  completionPct === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-primary-400 to-primary-300'
                }`}
                style={{ width: `${completionPct}%` }}
              />
            </div>

            <div className="space-y-1.5">
              {onboarding.map(step => {
                const docState = step.verified ? 'verified' : step.uploaded ? 'uploaded' : 'pending';
                return (
                  <button
                    key={step.id}
                    onClick={() => navigate(step.path)}
                    className="w-full flex items-center gap-2 hover:bg-white/5 rounded-lg px-1 py-0.5 transition-colors"
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      docState === 'verified' ? 'bg-emerald-400/25 text-emerald-400' :
                      docState === 'uploaded' ? 'bg-amber-400/25 text-amber-400' :
                      'bg-white/10 text-white/25'
                    }`}>
                      <step.icon style={{ width: 9, height: 9 }} />
                    </div>
                    <span className={`text-[10px] flex-1 truncate text-left ${
                      docState === 'verified' ? 'text-emerald-300' :
                      docState === 'uploaded' ? 'text-amber-200/80' :
                      'text-white/30'
                    }`}>{step.label}</span>
                    <span className={`text-[9px] font-bold shrink-0 ${
                      docState === 'verified' ? 'text-emerald-400' :
                      docState === 'uploaded' ? 'text-amber-400' :
                      'text-white/20'
                    }`}>
                      {docState === 'verified' ? 'Done' : docState === 'uploaded' ? 'Review' : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Settings link */}
        <div className="px-2 pb-2">
          {collapsed && <div className="border-t border-white/10 mb-2" />}
          <NavLink
            to="/settings"
            title={collapsed ? 'Settings' : undefined}
            className={({ isActive }) => isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}
          >
            <Settings style={{ width: 17, height: 17 }} className="shrink-0" />
            {!collapsed && <span className="text-sm">Settings</span>}
          </NavLink>
        </div>
      </div>

      {/* ── User profile strip (bottom) ───────────────────────── */}
      <div className="border-t border-white/10" ref={profileRef}>
        {!collapsed ? (
          <div className="relative">
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors group"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-white/10">
                {initials}
              </div>
              <div className="flex-1 min-w-0 text-left">
                {profile ? (
                  <>
                    <p className="text-xs font-semibold text-white truncate leading-tight">
                      {profile.full_name || profile.email}
                    </p>
                    <p className="text-[10px] text-blue-300 truncate leading-tight capitalize">
                      {profile.role === 'kyc_officer'
                        ? `KYC Officer · Stage ${profile.kyc_stage ?? '—'}`
                        : profile.role.replace(/_/g, ' ')}
                    </p>
                  </>
                ) : user ? (
                  <>
                    <p className="text-xs font-semibold text-white truncate leading-tight">
                      {user.email}
                    </p>
                    <p className="text-[10px] text-blue-300/60 leading-tight">Loading...</p>
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="h-2.5 w-24 bg-white/20 rounded animate-pulse" />
                    <div className="h-2 w-16 bg-white/10 rounded animate-pulse" />
                  </div>
                )}
              </div>
              <ChevronDown
                style={{ width: 14, height: 14 }}
                className={`text-blue-300 transition-transform duration-200 shrink-0 ${profileOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Profile popover — floats upward */}
            {profileOpen && (
              <div className="absolute bottom-full left-2 right-2 mb-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in z-50">
                {/* User info header */}
                <div className="px-4 py-3 bg-gradient-to-r from-ntt-blue to-primary-600">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
                      <p className="text-xs text-blue-200 truncate">{profile?.email}</p>
                      <p className="text-[10px] text-blue-300 mt-0.5 capitalize">
                        {profile?.role === 'kyc_officer'
                          ? `KYC Officer · Stage ${profile.kyc_stage ?? '—'}`
                          : profile?.role?.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profile completion bar (customers) */}
                {isCustomer && (
                  <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500 font-medium">Profile completion</span>
                      <span className={`font-semibold ${profilePct >= 80 ? 'text-green-600' : profilePct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {profilePct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${profilePct >= 80 ? 'bg-green-500' : profilePct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${profilePct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Menu items */}
                <div className="p-1.5">
                  <PopoverItem
                    icon={User}
                    label="Edit Profile"
                    description="Update personal details"
                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                  />
                  {isCustomer && (
                    <PopoverItem
                      icon={ShieldCheck}
                      label="KYC Documents"
                      description="Upload & manage documents"
                      onClick={() => { setProfileOpen(false); navigate('/onboarding/photo'); }}
                    />
                  )}
                  <PopoverItem
                    icon={Bell}
                    label="Notifications"
                    description="Alerts and updates"
                    onClick={() => setProfileOpen(false)}
                  />
                  <PopoverItem
                    icon={Settings}
                    label="Settings"
                    description="Account preferences"
                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                  />
                </div>

                <div className="border-t border-gray-100 p-1.5">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors">
                      <LogOut style={{ width: 14, height: 14 }} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-600 leading-tight">Sign Out</p>
                      <p className="text-[10px] text-gray-400">End session securely</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Collapsed: just the avatar with sign-out on long-press / double click */
          <div className="flex flex-col items-center gap-1 py-3">
            <button
              onClick={() => navigate('/settings')}
              title={profile?.full_name ?? 'Profile'}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/10 hover:ring-white/30 transition-all"
            >
              {initials}
            </button>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-blue-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut style={{ width: 13, height: 13 }} />
            </button>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ───────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-6 h-6 bg-ntt-blue border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-primary-600 transition-colors shadow-md"
        style={{ position: 'fixed', left: collapsed ? 52 : 240, top: 80, zIndex: 50 }}
      >
        {collapsed
          ? <ChevronRight style={{ width: 11, height: 11 }} />
          : <ChevronLeft  style={{ width: 11, height: 11 }} />}
      </button>
    </aside>
  );
}

/* ─── Popover menu item ────────────────────────────────────── */
function PopoverItem({
  icon: Icon, label, description, onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-gray-50 transition-colors group"
    >
      <div className="w-7 h-7 rounded-lg bg-gray-100 group-hover:bg-primary-50 flex items-center justify-center shrink-0 transition-colors">
        <Icon style={{ width: 14, height: 14 }} className="text-gray-500 group-hover:text-primary-600 transition-colors" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 leading-tight">{label}</p>
        <p className="text-[10px] text-gray-400 leading-tight">{description}</p>
      </div>
    </button>
  );
}
