import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { AuditLog } from '../types';

const AuditLogs: React.FC = () => {
  const { activeOrg } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    if (!activeOrg) return;
    try {
      setIsLoading(true);
      let query = '';
      const params: string[] = [];
      if (actionFilter) params.push(`action=${actionFilter}`);
      if (entityFilter) params.push(`entity_name=${entityFilter}`);
      if (search) params.push(`search=${search}`);
      
      if (params.length > 0) {
        query = `?${params.join('&')}`;
      }
      
      const res = await api.get(`/audit-logs/${query}`);
      setLogs(res.data.results || res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeOrg, actionFilter, entityFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full py-20">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-display text-gradient">Audit Trails Ledger</h2>
        <p className="text-slate-500 text-xs mt-1">Immutable record logs documenting all database operations, logins, and configurations</p>
      </div>

      {/* Filters Bar */}
      <div className="glass p-4 rounded-xl border border-slate-800/80 mb-6 flex flex-wrap gap-4 items-center text-xs">
        <div>
          <label className="text-slate-400 font-bold block mb-1">Filter Action</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-[#111827] border border-slate-800 text-slate-300 py-1.5 px-3 rounded-lg focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>
        </div>

        <div>
          <label className="text-slate-400 font-bold block mb-1">Filter Entity</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-[#111827] border border-slate-800 text-slate-300 py-1.5 px-3 rounded-lg focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Entities</option>
            <option value="Invoice">Invoice</option>
            <option value="Customer">Customer</option>
            <option value="Product">Product</option>
            <option value="Organization">Organization</option>
          </select>
        </div>

        <div className="flex-1 max-w-xs ml-auto">
          <label className="text-slate-400 font-bold block mb-1">Search Details</label>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#111827] border border-slate-800 focus:border-emerald-500 text-slate-200 py-1.5 pl-8 pr-4 rounded-lg focus:outline-none"
              placeholder="Query IP, User email..."
            />
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
          </div>
        </div>
        <button
          onClick={fetchLogs}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 px-4 rounded-lg mt-5 font-bold transition-all"
        >
          Query Logs
        </button>
      </div>

      {/* Logs Table */}
      <div className="glass rounded-xl border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/20">
                <th className="p-4 font-semibold">Actor / User</th>
                <th className="p-4 font-semibold">Action</th>
                <th className="p-4 font-semibold">Entity Class</th>
                <th className="p-4 font-semibold">IP Address</th>
                <th className="p-4 font-semibold">Timestamp</th>
                <th className="p-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-800/10 transition-colors">
                      <td className="p-4 font-medium text-slate-200">{log.user_email || 'System Action'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          log.action === 'create' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          log.action === 'delete' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300 font-semibold">{log.entity_name}</td>
                      <td className="p-4 font-mono text-slate-400">{log.ip_address || 'Internal'}</td>
                      <td className="p-4 text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="text-slate-400 hover:text-emerald-400 inline-flex items-center gap-1"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-900/40">
                        <td colSpan={6} className="p-6">
                          <div className="grid grid-cols-2 gap-6 text-xs">
                            <div className="bg-[#111827] border border-slate-800/60 p-4 rounded-xl">
                              <h4 className="font-bold text-slate-400 mb-2 uppercase tracking-wide text-[10px]">Previous State</h4>
                              <pre className="font-mono text-[10px] text-slate-300 overflow-x-auto max-h-40">
                                {Object.keys(log.previous_state).length > 0 
                                  ? JSON.stringify(log.previous_state, null, 2) 
                                  : '// No records'}
                              </pre>
                            </div>
                            <div className="bg-[#111827] border border-slate-800/60 p-4 rounded-xl">
                              <h4 className="font-bold text-slate-400 mb-2 uppercase tracking-wide text-[10px]">New State</h4>
                              <pre className="font-mono text-[10px] text-slate-300 overflow-x-auto max-h-40">
                                {Object.keys(log.new_state).length > 0 
                                  ? JSON.stringify(log.new_state, null, 2) 
                                  : '// Empty'}
                              </pre>
                            </div>
                          </div>
                          {log.user_agent && (
                            <div className="mt-4 text-[10px] text-slate-500 font-mono">
                              User Agent: {log.user_agent}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No matching audit logs compiled.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
