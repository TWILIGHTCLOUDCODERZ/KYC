import { useState, useEffect } from 'react';
import { Search, ClipboardList, Clock, Filter } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { supabase } from '../../lib/supabase';
import type { AuditLog, AuditAction } from '../../types/database';

const ACTION_COLOR: Record<string, string> = {
  login: 'badge-blue',
  logout: 'badge-gray',
  register: 'badge-success',
  document_upload: 'badge-blue',
  document_verify: 'badge-success',
  document_reject: 'badge-error',
  kyc_submitted: 'badge-warning',
  kyc_approved: 'badge-success',
  kyc_rejected: 'badge-error',
  profile_update: 'badge-blue',
  admin_review: 'badge-warning',
  risk_score_update: 'badge-warning',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      const { data } = await query;
      setLogs(data ?? []);
      setLoading(false);
    };
    load();
  }, [actionFilter]);

  const filtered = logs.filter(l =>
    !search ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
    JSON.stringify(l.details).toLowerCase().includes(search.toLowerCase())
  );

  const ACTIONS: (AuditAction | 'all')[] = ['all', 'login', 'register', 'document_upload', 'kyc_submitted', 'kyc_approved', 'kyc_rejected'];

  return (
    <AppShell title="Audit Logs" subtitle="Complete audit trail of all system activities">
      <div className="w-full space-y-5">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            {ACTIONS.map(a => (
              <button
                key={a}
                onClick={() => setActionFilter(a)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all capitalize ${
                  actionFilter === a ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                }`}
              >
                {a.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <ClipboardList className="w-5 h-5 text-primary-600" />
            <h3 className="section-title">Activity Log</h3>
            <span className="ml-auto text-sm text-gray-400">{filtered.length} entries</span>
          </div>
          {loading ? (
            <div className="p-10 flex justify-center"><LoadingSpinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Timestamp</th>
                    <th className="table-header">Action</th>
                    <th className="table-header hidden md:table-cell">Entity</th>
                    <th className="table-header hidden lg:table-cell">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-400">
                        <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>No audit logs found</p>
                      </td>
                    </tr>
                  ) : filtered.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                          <div>
                            <p className="text-xs text-gray-700">{new Date(log.created_at).toLocaleDateString()}</p>
                            <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`badge capitalize ${ACTION_COLOR[log.action] || 'badge-gray'}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="table-cell hidden md:table-cell">
                        {log.entity_type ? (
                          <div>
                            <p className="text-xs font-medium text-gray-700 capitalize">{log.entity_type.replace('_', ' ')}</p>
                            {log.entity_id && <p className="text-xs text-gray-400 font-mono truncate max-w-xs">{log.entity_id.slice(0, 8)}...</p>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell hidden lg:table-cell">
                        {log.details ? (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{JSON.stringify(log.details)}</p>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
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
