import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, Eye, CheckCircle,
  ChevronLeft, ChevronRight, Users, Download, Zap,
  ToggleRight, ToggleLeft, Shield
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { KYCStatusBadge, RiskBadge } from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import type { Profile, KYCStatus } from '../../types/database';

const STATUS_FILTERS: { label: string; value: KYCStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending Review', value: 'pending_review' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Not Started', value: 'not_started' },
];

const REQUIRED_DOCS = 6;
const AUTO_APPROVE_KEY = 'kyc_auto_approve_enabled';
const THRESHOLD_KEY = 'kyc_auto_approve_threshold';

interface DocStats { uploaded: number; avgAiScore: number }
type DocStatsMap = Record<string, DocStats>;

export default function ReviewCustomers() {
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [docStatsMap, setDocStatsMap] = useState<DocStatsMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<KYCStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const PER_PAGE = 12;

  const autoApprove = localStorage.getItem(AUTO_APPROVE_KEY) === 'true';
  const threshold = Math.max(60, parseInt(localStorage.getItem(THRESHOLD_KEY) ?? '80', 10));

  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true);
      let query = supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('kyc_status', statusFilter);
      const [{ data }, { data: docs }] = await Promise.all([
        query,
        supabase.from('kyc_documents').select('user_id, status, ocr_confidence'),
      ]);
      setCustomers(data ?? []);

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
        const map: DocStatsMap = {};
        for (const uid of Object.keys(uploadedCount)) {
          map[uid] = {
            uploaded: uploadedCount[uid],
            avgAiScore: scoreCount[uid] > 0 ? Math.round((scoreSum[uid] / scoreCount[uid]) * 100) : 0,
          };
        }
        setDocStatsMap(map);
      }

      setLoading(false);
    };
    loadCustomers();
  }, [statusFilter]);

  const filtered = customers.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <AppShell title="Review Customers" subtitle="Manage and review customer KYC applications">
      <div className="w-full space-y-5">

        {/* Auto-approve status banner */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm ${
          autoApprove ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
        }`}>
          {autoApprove
            ? <ToggleRight className="w-5 h-5 text-emerald-600 shrink-0" />
            : <ToggleLeft className="w-5 h-5 text-gray-400 shrink-0" />}
          <span className={`font-semibold ${autoApprove ? 'text-emerald-700' : 'text-gray-500'}`}>
            Auto-Approve {autoApprove ? 'Enabled' : 'Disabled'}
          </span>
          {autoApprove && (
            <span className="text-emerald-600 text-xs">
              — approves when AI score ≥ <strong>{threshold}%</strong> across all 6 documents
            </span>
          )}
          <button
            onClick={() => navigate('/admin')}
            className="ml-auto flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Shield className="w-3.5 h-3.5" /> Configure
          </button>
        </div>

        {/* Filters bar */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email..."
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => { setStatusFilter(f.value); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  statusFilter === f.value
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300 hover:text-sky-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button className="btn-secondary text-sm py-2 ml-auto">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4" />
          <span>{filtered.length} customer{filtered.length !== 1 ? 's' : ''} found</span>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 flex justify-center"><LoadingSpinner size="md" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="table-header">Customer</th>
                    <th className="table-header">KYC Status</th>
                    <th className="table-header hidden md:table-cell">Risk Level</th>
                    <th className="table-header hidden lg:table-cell">AI Score</th>
                    <th className="table-header hidden lg:table-cell">Docs Uploaded</th>
                    <th className="table-header hidden xl:table-cell">Registered</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>No customers found</p>
                      </td>
                    </tr>
                  ) : paginated.map(customer => {
                    const stats = docStatsMap[customer.user_id];
                    const aiScore = stats?.avgAiScore ?? null;
                    const uploaded = stats?.uploaded ?? 0;
                    const uploadPct = Math.round((Math.min(uploaded, REQUIRED_DOCS) / REQUIRED_DOCS) * 100);
                    const fraudAlert = (customer as Profile & { fraud_alert?: boolean }).fraud_alert;
                    const aiColor = aiScore === null ? '' : aiScore >= threshold ? 'text-emerald-600' : aiScore >= 60 ? 'text-amber-600' : 'text-red-500';
                    const aiBar = aiScore === null ? '' : aiScore >= threshold ? 'bg-emerald-500' : aiScore >= 60 ? 'bg-amber-400' : 'bg-red-400';

                    return (
                      <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="table-cell">
                          <div className="flex items-center gap-2.5">
                            <div className="relative shrink-0">
                              <div className="w-9 h-9 rounded-full bg-ntt-blue flex items-center justify-center text-sm font-semibold text-white">
                                {customer.full_name.charAt(0)}
                              </div>
                              {fraudAlert && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center">
                                  <Zap className="w-2 h-2 text-white" />
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{customer.full_name}</p>
                              <p className="text-xs text-gray-400">{customer.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell"><KYCStatusBadge status={customer.kyc_status} /></td>
                        <td className="table-cell hidden md:table-cell"><RiskBadge level={customer.risk_level} /></td>

                        {/* AI Score */}
                        <td className="table-cell hidden lg:table-cell">
                          {aiScore === null ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${aiBar}`} style={{ width: `${aiScore}%` }} />
                              </div>
                              <span className={`text-xs font-semibold ${aiColor}`}>{aiScore}%</span>
                            </div>
                          )}
                        </td>

                        {/* Docs uploaded out of 6 */}
                        <td className="table-cell hidden lg:table-cell">
                          {!stats ? (
                            <span className="text-xs text-gray-400">0/{REQUIRED_DOCS}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${uploadPct === 100 ? 'bg-emerald-500' : uploadPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                  style={{ width: `${uploadPct}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold ${uploadPct === 100 ? 'text-emerald-600' : uploadPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                {Math.min(uploaded, REQUIRED_DOCS)}/{REQUIRED_DOCS}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="table-cell hidden xl:table-cell text-gray-400 text-xs">
                          {new Date(customer.created_at).toLocaleDateString()}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/admin/customers/${customer.user_id}`)}
                              className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-semibold bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> Review
                            </button>
                            {customer.kyc_status === 'pending_review' && (
                              <QuickApprove
                                customerId={customer.user_id}
                                onDone={() => setCustomers(prev => prev.map(c => c.user_id === customer.user_id ? { ...c, kyc_status: 'approved' } : c))}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1.5 px-3 text-sm">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary py-1.5 px-3 text-sm">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function QuickApprove({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    await supabase.from('profiles').update({ kyc_status: 'approved' }).eq('user_id', customerId);
    onDone();
    setLoading(false);
  };
  return (
    <button onClick={handleApprove} disabled={loading}
      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors">
      {loading ? <LoadingSpinner size="sm" color="text-emerald-600" /> : <CheckCircle className="w-3.5 h-3.5" />}
      Approve
    </button>
  );
}
