import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDown, LogOut, ShieldCheck, User, Home,
  CircleUser as UserCircle, Settings, BadgeCheck, Shield
} from 'lucide-react';
import NTTLogo from '../common/NTTLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useDocuments } from '../../hooks/useDocuments';
import type { DocumentType } from '../../types/database';

/* ─── progress config ─────────────────────────────────────── */
const PROFILE_FIELDS = ['full_name','phone','date_of_birth','nationality','address_line1','city','country'] as const;
const DOC_STEPS: DocumentType[] = ['photo','passport','utility_bill','tax_document','salary_proof'];

const ROLE_LABELS: Record<string, string> = {
  customer:             'Customer',
  admin:                'Administrator',
  compliance_officer:   'Compliance Officer',
  relationship_manager: 'Relationship Manager',
  kyc_officer:          'KYC Officer',
};

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { profile, user, signOut } = useAuth();
  const { documents } = useDocuments();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isHome = location.pathname === '/dashboard';
  const isCustomer = profile?.role === 'customer';

  // Profile completion
  const filledFields = PROFILE_FIELDS.filter(f => !!profile?.[f as keyof typeof profile]).length;
  const profilePct = Math.round((filledFields / PROFILE_FIELDS.length) * 100);

  // KYC doc progress
  const uploadedCount = DOC_STEPS.filter(k => documents.some(d => d.document_type === k)).length;
  const kycPct = Math.round((uploadedCount / DOC_STEPS.length) * 100);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
    navigate('/login');
  };

  const displayName = profile?.full_name || user?.email || '';
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email ? user.email[0].toUpperCase() : '?';

  const roleLabel = ROLE_LABELS[profile?.role ?? ''] ?? (profile?.role ?? '');
  const isAdmin = profile?.role !== 'customer';
  const approvalLevel = profile?.approval_level ?? 0;

  return (
    <header className="bg-ntt-blue text-white shadow-lg shrink-0 z-30">
      <div className="flex items-center justify-between px-5 py-3 gap-4">

        {/* ── Left: logo + page title ───────────────────── */}
        <div className="flex items-center gap-3 min-w-0 w-64 shrink-0">
          <button onClick={() => navigate('/dashboard')} className="shrink-0">
            <NTTLogo className="h-8 w-auto" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {!isHome && (
                <button
                  onClick={() => navigate('/dashboard')}
                  title="Back to Home"
                  className="w-6 h-6 rounded-md flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                >
                  <Home style={{ width: 13, height: 13 }} />
                </button>
              )}
              <p className="text-sm font-bold text-white truncate leading-tight">{title}</p>
            </div>
            {subtitle && <p className="text-[11px] text-blue-300 truncate leading-tight">{subtitle}</p>}
          </div>
        </div>

        {/* ── Center: progress widgets (customer only) ─── */}
        {isCustomer && (
          <div className="flex items-center gap-5 flex-1 justify-center">
            <ProgressWidget
              label="Profile Completion"
              pct={profilePct}
              color="bg-sky-400"
              onClick={() => navigate('/settings')}
            />
            <div className="w-px h-8 bg-white/10" />
            <ProgressWidget
              label="KYC Progress"
              pct={kycPct}
              color="bg-emerald-400"
              onClick={() => navigate('/onboarding/photo')}
            />
          </div>
        )}

        {/* Spacer for non-customer to keep user right-aligned */}
        {!isCustomer && <div className="flex-1" />}

        {/* ── Right: user name + dropdown ──────────────── */}
        <div className="relative flex items-center gap-3 shrink-0" ref={dropdownRef}>
          {/* Name display */}
          <div className="hidden sm:block text-right">
            {displayName ? (
              <>
                <p className="text-sm font-semibold text-white leading-tight">
                  {profile?.full_name || user?.email}
                </p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="text-[10px] text-blue-300">{roleLabel}</span>
                  {isAdmin && (
                    <span className="text-[9px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                      Approver {approvalLevel}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <div className="h-3 w-24 bg-white/20 rounded animate-pulse" />
                <div className="h-2 w-16 bg-white/10 rounded animate-pulse" />
              </div>
            )}
          </div>

          {/* Avatar button */}
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-1.5 rounded-xl hover:bg-white/10 transition-colors p-1"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-sm font-bold text-white ring-2 ring-white/20 shrink-0">
              {initials}
            </div>
            <ChevronDown
              style={{ width: 14, height: 14 }}
              className={`text-blue-300 transition-transform duration-200 hidden sm:block ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in z-50">
              {/* User strip */}
              <div className="px-4 py-3.5 bg-gradient-to-r from-ntt-blue to-primary-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {profile?.full_name || user?.email || '—'}
                    </p>
                    <p className="text-xs text-blue-200 truncate">{profile?.email || user?.email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-blue-300">{roleLabel}</span>
                      {isAdmin && (
                        <span className="text-[9px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                          Approver {approvalLevel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="p-1.5 space-y-0.5">
                <DropdownItem
                  icon={User}
                  label="Edit Profile"
                  description="Update your personal details"
                  onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
                />
                {isCustomer && (
                  <DropdownItem
                    icon={ShieldCheck}
                    label="KYC Documents"
                    description="Upload & manage documents"
                    onClick={() => { setDropdownOpen(false); navigate('/onboarding/photo'); }}
                  />
                )}
                <DropdownItem
                  icon={Settings}
                  label="Account Settings"
                  description="Preferences and security"
                  onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
                />
              </div>

              <div className="border-t border-gray-100 p-1.5">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-red-50 group transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors">
                    <LogOut className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-600">Sign Out</p>
                    <p className="text-[10px] text-gray-400">End your session securely</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─── Progress widget ─────────────────────────────────────── */
function ProgressWidget({
  label, pct, color, onClick,
}: {
  label: string;
  pct: number;
  color: string;
  onClick: () => void;
}) {
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const dash = circ * (pct / 100);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 group hover:bg-white/5 rounded-xl px-3 py-1.5 transition-colors"
    >
      {/* Circular progress */}
      <div className="relative shrink-0">
        <svg width="44" height="44" className="-rotate-90">
          <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
          <circle
            cx="22" cy="22" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className={`${color.replace('bg-', 'text-')} transition-all duration-500`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
          {pct}%
        </span>
      </div>
      {/* Label */}
      <div className="text-left">
        <p className="text-xs font-semibold text-white leading-tight group-hover:text-blue-200 transition-colors">
          {label}
        </p>
        <p className="text-[10px] text-blue-300 mt-0.5">
          {pct === 100 ? 'Complete' : pct === 0 ? 'Not started' : 'In progress'}
        </p>
      </div>
    </button>
  );
}

/* ─── Dropdown item ───────────────────────────────────────── */
function DropdownItem({
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
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 group transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-primary-50 flex items-center justify-center shrink-0 transition-colors">
        <Icon className="w-4 h-4 text-gray-500 group-hover:text-primary-600 transition-colors" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-[10px] text-gray-400">{description}</p>
      </div>
    </button>
  );
}
