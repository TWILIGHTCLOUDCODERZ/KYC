import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FileCheck, AlertTriangle, Clock, CheckCircle,
  XCircle, Shield, Eye, TrendingUp, BarChart2, Activity,
  Zap, ToggleLeft, ToggleRight, GripHorizontal, ChevronDown, Bot, UserCheck
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { KYCStatusBadge, RiskBadge } from '../../components/common/Badge';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';

interface Metrics {
  pending: number;
  approvedToday: number;
  autoApprovedToday: number;
  manualApprovedToday: number;
  rejected: number;
  highRisk: number;
  fraudAlerts: number;
  total: number;
  approved: number;
}

// user_id -> { uploaded: number (out of 6), avgAiScore: number (0-100) }
interface DocStats { uploaded: number; avgAiScore: number }
type DocStatsMap = Record<string, DocStats>;

const REQUIRED_DOCS = 6;
const MIN_THRESHOLD = 85;
const THRESHOLD_KEY = 'kyc_auto_approve_threshold';
const AUTO_APPROVE_KEY = 'kyc_auto_approve_enabled';

/* ─── Draggable threshold bar ───────────────────────────────── */
function ThresholdSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const calcValue = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const { left, width } = track.getBoundingClientRect();
    const raw = Math.round(((clientX - left) / width) * 100);
    return Math.min(100, Math.max(MIN_THRESHOLD, raw));
  }, [value]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const move = (ev: MouseEvent) => { if (dragging.current) onChange(calcValue(ev.clientX)); };
    const up = () => { dragging.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onChange(calcValue(e.clientX));
  };

  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Min locked at {MIN_THRESHOLD}%</span>
        <span className={`font-bold text-sm ${value >= 80 ? 'text-emerald-600' : value >= 60 ? 'text-amber-600' : 'text-red-500'}`}>{value}%</span>
      </div>
      <div
        ref={trackRef}
        onClick={onTrackClick}
        className="relative h-3 bg-gray-100 rounded-full cursor-pointer select-none"
      >
        {/* locked zone */}
        <div
          className="absolute left-0 h-full bg-gray-200 rounded-full pointer-events-none"
          style={{ width: `${MIN_THRESHOLD}%` }}
        />
        {/* fill */}
        <div
          className={`absolute left-0 h-full ${color} rounded-full pointer-events-none transition-colors`}
          style={{ width: `${value}%` }}
        />
        {/* lock marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gray-400 rounded pointer-events-none"
          style={{ left: `${MIN_THRESHOLD}%` }}
        />
        {/* thumb */}
        <div
          onMouseDown={onMouseDown}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 ${color} rounded-full shadow-md border-2 border-white cursor-grab active:cursor-grabbing flex items-center justify-center`}
          style={{ left: `${value}%` }}
        >
          <GripHorizontal className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{MIN_THRESHOLD}% (min)</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics>({ pending: 0, approvedToday: 0, autoApprovedToday: 0, manualApprovedToday: 0, rejected: 0, highRisk: 0, fraudAlerts: 0, total: 0, approved: 0 });
  const [approvedFilter, setApprovedFilter] = useState<'all' | 'auto' | 'manual'>('all');
  const [showApprovedDropdown, setShowApprovedDropdown] = useState(false);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [docStatsMap, setDocStatsMap] = useState<DocStatsMap>({});
  const [loading, setLoading] = useState(true);
  const [autoApprove, setAutoApprove] = useState(() => localStorage.getItem(AUTO_APPROVE_KEY) === 'true');
  const [threshold, setThreshold] = useState(() => {
    const saved = parseInt(localStorage.getItem(THRESHOLD_KEY) ?? '', 10);
    return isNaN(saved) ? 80 : Math.max(MIN_THRESHOLD, saved);
  });

  // Close dropdown on outside click
  useEffect(() => {
    if (!showApprovedDropdown) return;
    const close = () => setShowApprovedDropdown(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showApprovedDropdown]);

  const saveThreshold = (v: number) => {
    setThreshold(v);
    localStorage.setItem(THRESHOLD_KEY, String(v));
  };

  const toggleAutoApprove = () => {
    const next = !autoApprove;
    setAutoApprove(next);
    localStorage.setItem(AUTO_APPROVE_KEY, String(next));
  };

  useEffect(() => {
    const load = async () => {
      const [{ data: profiles }, { data: docs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false }),
        supabase.from('kyc_documents').select('user_id, status, ocr_confidence'),
      ]);

      let docStatsLocal: DocStatsMap = {};

      if (docs) {
        const uploadedCount: Record<string, number> = {};
        const scoreSum: Record<string, number> = {};
        const scoreCount: Record<string, number> = {};
        for (const d of docs) {
          uploadedCount[d.user_id] = (uploadedCount[d.user_id] ?? 0) + 1;
          const conf = typeof d.ocr_confidence === 'number' ? d.ocr_confidence : parseFloat(d.ocr_confidence ?? '0');
          if (!isNaN(conf)) {
            scoreSum[d.user_id] = (scoreSum[d.user_id] ?? 0) + conf;
            scoreCount[d.user_id] = (scoreCount[d.user_id] ?? 0) + 1;
          }
        }
        for (const uid of Object.keys(uploadedCount)) {
          docStatsLocal[uid] = {
            uploaded: uploadedCount[uid],
            avgAiScore: scoreCount[uid] > 0 ? Math.round((scoreSum[uid] / scoreCount[uid]) * 100) : 0,
          };
        }
        setDocStatsMap(docStatsLocal);
      }

      if (profiles) {
        // Auto-approve eligible customers
        if (autoApprove) {
          const eligible = profiles.filter(p => {
            if (p.kyc_status !== 'pending_review') return false;
            if (p.fraud_alert) return false;
            if (p.risk_level === 'high' || p.risk_level === 'critical') return false;
            const stats = docStatsLocal[p.user_id];
            if (!stats) return false;
            if (stats.uploaded < REQUIRED_DOCS) return false;
            if (stats.avgAiScore < threshold) return false;
            return true;
          });

          for (const p of eligible) {
            await supabase.from('profiles').update({
              kyc_status: 'approved',
              approval_method: 'auto',
              approved_at: new Date().toISOString(),
            }).eq('user_id', p.user_id);
            p.kyc_status = 'approved';
            (p as Profile).approval_method = 'auto';
          }
        }

        const todayStr = new Date().toDateString();
        const approvedTodayList = profiles.filter(p => p.kyc_status === 'approved' && new Date(p.updated_at ?? p.created_at).toDateString() === todayStr);
        setMetrics({
          total: profiles.length,
          pending: profiles.filter(p => p.kyc_status === 'pending_review').length,
          approvedToday: approvedTodayList.length,
          autoApprovedToday: approvedTodayList.filter(p => p.approval_method === 'auto').length,
          manualApprovedToday: approvedTodayList.filter(p => p.approval_method !== 'auto').length,
          rejected: profiles.filter(p => p.kyc_status === 'rejected' || p.kyc_status === 'requires_update').length,
          highRisk: profiles.filter(p => p.risk_level === 'high' || p.risk_level === 'critical').length,
          fraudAlerts: profiles.filter(p => p.fraud_alert === true).length,
          approved: profiles.filter(p => p.kyc_status === 'approved').length,
        });
        setCustomers(profiles.slice(0, 20));
      }

      setLoading(false);
    };
    load();
  }, [autoApprove, threshold]);

  const approvalRate = metrics.total > 0 ? Math.round((metrics.approved / metrics.total) * 100) : 0;

  const approvedDisplayValue = approvedFilter === 'auto' ? metrics.autoApprovedToday
    : approvedFilter === 'manual' ? metrics.manualApprovedToday
    : metrics.approvedToday;

  const approvedFilterLabel = approvedFilter === 'auto' ? 'Auto Approved'
    : approvedFilter === 'manual' ? 'Manual'
    : 'Approved Today';

  const STAT_CARDS = [
    { label: 'Pending KYC', value: metrics.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', sub: 'Awaiting review', custom: false },
    { label: approvedFilterLabel, value: approvedDisplayValue, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', sub: `${approvalRate}% overall rate`, custom: true },
    { label: 'Rejected', value: metrics.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', sub: 'Requires follow-up', custom: false },
    { label: 'High Risk Cases', value: metrics.highRisk, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', sub: 'Enhanced due diligence', custom: false },
    { label: 'Fraud Alerts', value: metrics.fraudAlerts, icon: Zap, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', sub: 'Flagged accounts', custom: false },
    { label: 'Total Customers', value: metrics.total, icon: Users, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', sub: 'All registered', custom: false },
  ];

  return (
    <AppShell title="Admin Dashboard" subtitle="KYC onboarding overview — review and manage customers">
      <div className="w-full space-y-6">

        {/* ── Stat Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {STAT_CARDS.map(s => (
            <div key={s.label} className={`card p-4 border ${s.border} flex flex-col gap-3 relative`}>
              <div className="flex items-center justify-between">
                <div className={`${s.bg} ${s.color} w-10 h-10 rounded-xl flex items-center justify-center`}>
                  <s.icon className="w-5 h-5" />
                </div>
                {s.custom && (
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setShowApprovedDropdown(!showApprovedDropdown)}
                      className="flex items-center gap-0.5 text-[10px] font-medium text-gray-500 hover:text-emerald-600 bg-gray-50 hover:bg-emerald-50 px-1.5 py-0.5 rounded-md transition-colors"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showApprovedDropdown && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[160px] overflow-hidden animate-fade-in">
                        {([
                          { key: 'all', label: 'All Approved', icon: CheckCircle, count: metrics.approvedToday },
                          { key: 'auto', label: 'Auto Approved', icon: Bot, count: metrics.autoApprovedToday },
                          { key: 'manual', label: 'Manual', icon: UserCheck, count: metrics.manualApprovedToday },
                        ] as const).map(opt => (
                          <button
                            key={opt.key}
                            onClick={() => { setApprovedFilter(opt.key); setShowApprovedDropdown(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-emerald-50 transition-colors ${approvedFilter === opt.key ? 'bg-emerald-50' : ''}`}
                          >
                            <opt.icon className={`w-3.5 h-3.5 ${approvedFilter === opt.key ? 'text-emerald-600' : 'text-gray-400'}`} />
                            <span className={`text-xs font-medium flex-1 ${approvedFilter === opt.key ? 'text-emerald-700' : 'text-gray-600'}`}>{opt.label}</span>
                            <span className={`text-xs font-bold ${approvedFilter === opt.key ? 'text-emerald-600' : 'text-gray-400'}`}>{opt.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{loading ? '—' : s.value}</p>
                <p className="text-xs font-semibold text-gray-700 mt-0.5">{s.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts + Controls ────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* KYC Funnel */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-gray-700">KYC Funnel</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Total Registrations', value: metrics.total, color: 'bg-sky-500' },
                { label: 'In Progress', value: Math.max(0, metrics.total - metrics.approved - metrics.pending - metrics.rejected), color: 'bg-blue-400' },
                { label: 'Pending Review', value: metrics.pending, color: 'bg-amber-400' },
                { label: 'Approved', value: metrics.approved, color: 'bg-emerald-500' },
                { label: 'Rejected', value: metrics.rejected, color: 'bg-red-400' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-xs font-semibold text-gray-800">{item.value}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-700`}
                      style={{ width: metrics.total > 0 ? `${Math.max(2, (item.value / metrics.total) * 100)}%` : '2%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-gray-700">Risk Distribution</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Low Risk', level: 'low', color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Medium Risk', level: 'medium', color: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
                { label: 'High Risk', level: 'high', color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' },
                { label: 'Critical Risk', level: 'critical', color: 'bg-red-600', text: 'text-red-700', bg: 'bg-red-50' },
              ].map(item => (
                <div key={item.label} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${item.bg}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
                  <span className={`text-sm font-medium flex-1 ${item.text}`}>{item.label}</span>
                  <span className={`text-sm font-bold ${item.text}`}>{customers.filter(p => p.risk_level === item.level).length}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-Approve Controls */}
          <div className="card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-gray-700">Auto-Approve Settings</h3>
            </div>

            {/* Toggle */}
            <div className={`flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${autoApprove ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
              <div>
                <p className={`text-sm font-semibold ${autoApprove ? 'text-emerald-700' : 'text-gray-600'}`}>Auto-Approve</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {autoApprove ? `Approves if AI score ≥ ${threshold}%` : 'Manual review required'}
                </p>
              </div>
              <button onClick={toggleAutoApprove} className="transition-transform active:scale-95">
                {autoApprove
                  ? <ToggleRight className="w-9 h-9 text-emerald-600" />
                  : <ToggleLeft className="w-9 h-9 text-gray-400" />}
              </button>
            </div>

            {/* Threshold slider */}
            <div className={`space-y-2 transition-opacity ${autoApprove ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <p className="text-xs font-semibold text-gray-600">AI Score Threshold</p>
              <ThresholdSlider value={threshold} onChange={saveThreshold} />
              <p className="text-[11px] text-gray-400">
                Customers with avg AI score ≥ <span className="font-semibold text-gray-600">{threshold}%</span> across all 6 documents will be auto-approved.
              </p>
            </div>

            {/* Quick stats */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              {[
                { label: 'Approval Rate', value: `${approvalRate}%`, icon: FileCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Under Review', value: metrics.pending, icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Fraud Flagged', value: metrics.fraudAlerts, icon: Zap, color: 'text-rose-600', bg: 'bg-rose-50' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                    <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                  </div>
                  <span className="text-xs text-gray-600 flex-1">{s.label}</span>
                  <span className={`text-xs font-bold ${s.color}`}>{loading ? '—' : s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Customer Table ────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-gray-700">Recent Customers</h3>
            </div>
            <button
              onClick={() => navigate('/admin/customers')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1"
            >
              View all <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="p-10 flex justify-center">
              <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="table-header">Customer</th>
                    <th className="table-header">KYC Status</th>
                    <th className="table-header hidden md:table-cell">Risk</th>
                    <th className="table-header hidden lg:table-cell">AI Score</th>
                    <th className="table-header hidden lg:table-cell">Docs Upload</th>
                    <th className="table-header hidden xl:table-cell">Submitted</th>
                    <th className="table-header">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No customers yet</p>
                      </td>
                    </tr>
                  ) : customers.map(c => (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      docStats={docStatsMap[c.user_id] ?? null}
                      threshold={threshold}
                      onReview={() => navigate(`/admin/customers/${c.user_id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function CustomerRow({ customer, docStats, threshold, onReview }: {
  customer: Profile;
  docStats: DocStats | null;
  threshold: number;
  onReview: () => void;
}) {
  const fraudAlert = customer.fraud_alert;
  const uploadPct = docStats ? Math.round((Math.min(docStats.uploaded, REQUIRED_DOCS) / REQUIRED_DOCS) * 100) : null;
  const aiScore = docStats?.avgAiScore ?? null;
  const aiColor = aiScore === null ? '' : aiScore >= threshold ? 'text-emerald-600' : aiScore >= 60 ? 'text-amber-600' : 'text-red-500';
  const aiBar = aiScore === null ? '' : aiScore >= threshold ? 'bg-emerald-500' : aiScore >= 60 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="table-cell">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-ntt-blue flex items-center justify-center text-sm font-bold text-white">
              {customer.full_name.charAt(0).toUpperCase()}
            </div>
            {fraudAlert && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center">
                <Zap className="w-2 h-2 text-white" />
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
              {customer.full_name}
              {fraudAlert && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded-full uppercase tracking-wide">Fraud</span>}
            </p>
            <p className="text-xs text-gray-400">{customer.email}</p>
          </div>
        </div>
      </td>
      <td className="table-cell"><KYCStatusBadge status={customer.kyc_status} /></td>
      <td className="table-cell hidden md:table-cell"><RiskBadge level={customer.risk_level} /></td>

      {/* AI Score */}
      <td className="table-cell hidden lg:table-cell">
        {aiScore === null ? <span className="text-xs text-gray-400">—</span> : (
          <div className="flex items-center gap-2">
            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${aiBar}`} style={{ width: `${aiScore}%` }} />
            </div>
            <span className={`text-xs font-semibold ${aiColor}`}>{aiScore}%</span>
          </div>
        )}
      </td>

      {/* Doc Upload % out of 6 */}
      <td className="table-cell hidden lg:table-cell">
        {uploadPct === null ? <span className="text-xs text-gray-400">—</span> : (
          <div className="flex items-center gap-2">
            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${uploadPct === 100 ? 'bg-emerald-500' : uploadPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${uploadPct}%` }} />
            </div>
            <span className={`text-xs font-semibold ${uploadPct === 100 ? 'text-emerald-600' : uploadPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {docStats!.uploaded}/{REQUIRED_DOCS}
            </span>
          </div>
        )}
      </td>

      <td className="table-cell hidden xl:table-cell text-xs text-gray-400">
        {new Date(customer.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      <td className="table-cell">
        <button onClick={onReview}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg transition-colors">
          <Eye className="w-3.5 h-3.5" /> Review
        </button>
      </td>
    </tr>
  );
}
