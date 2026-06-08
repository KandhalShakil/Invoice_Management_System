import React, { useEffect } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { fetcher } from '../utils/fetcher';
import { useAuth } from '../context/AuthContext';
import { ChartsPanel } from '../components/ChartsPanel';
import NotificationCenter from '../components/NotificationCenter';
import { 
  TrendingUp, Clock, AlertTriangle, FileSpreadsheet, Plus, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Invoice } from '../types';

const Dashboard: React.FC = () => {
  const { activeOrg } = useAuth();
  
  const dashboardCacheKey = activeOrg ? '/invoices/dashboard/' : null;
  const { data: dashboardData, error: dashboardError } = useSWR(dashboardCacheKey, fetcher);

  const invoicesCacheKey = activeOrg ? '/invoices/?limit=5' : null;
  const { data: invoicesData, error: invoicesError } = useSWR(invoicesCacheKey, fetcher);

  const kpis = dashboardData?.kpis || {
    total_revenue: 0,
    monthly_revenue: 0,
    pending_revenue: 0,
    overdue_revenue: 0,
    customer_count: 0
  };
  const revenueTrend = dashboardData?.revenue_trend || [];
  const taxSummary = dashboardData?.tax_summary || [];

  const recentInvoices: Invoice[] = (invoicesData?.results || invoicesData || []).slice(0, 5);

  const isLoading = (!dashboardData && !dashboardError) || (!invoicesData && !invoicesError);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (['invoice', 'customer', 'product', 'organization', 'membership'].includes(detail.model)) {
        globalMutate(key => typeof key === 'string' && (key.startsWith('/invoices/dashboard/') || key.startsWith('/invoices/')));
      }
    };
    window.addEventListener('app:sync', handleSync);
    return () => window.removeEventListener('app:sync', handleSync);
  }, []);

  const cards = [
    { name: 'Total Revenue', value: `₹ ${kpis.total_revenue.toLocaleString('en-IN')}`, desc: 'Lifetime earnings', icon: TrendingUp, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { name: 'Monthly Revenue', value: `₹ ${kpis.monthly_revenue.toLocaleString('en-IN')}`, desc: 'This calendar month', icon: FileSpreadsheet, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    { name: 'Pending Balance', value: `₹ ${kpis.pending_revenue.toLocaleString('en-IN')}`, desc: 'Awaiting payments', icon: Clock, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { name: 'Overdue Amount', value: `₹ ${kpis.overdue_revenue.toLocaleString('en-IN')}`, desc: 'Past due date', icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  ];

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-pulse max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-7 w-64 bg-slate-800 rounded-lg"></div>
            <div className="h-4 w-96 bg-slate-800/60 rounded-lg"></div>
          </div>
          <div className="h-10 w-36 bg-slate-800 rounded-xl"></div>
        </div>

        {/* KPI Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-dark-surface border border-dark-border p-6 rounded-2xl flex justify-between items-start h-32">
              <div className="space-y-3 w-2/3">
                <div className="h-3 w-16 bg-slate-800 rounded"></div>
                <div className="h-5 w-28 bg-slate-800 rounded"></div>
                <div className="h-2 w-20 bg-slate-800/40 rounded"></div>
              </div>
              <div className="w-10 h-10 bg-slate-800 rounded-xl"></div>
            </div>
          ))}
        </div>

        {/* Charts & Tables Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-dark-surface border border-dark-border p-6 h-[320px] rounded-2xl"></div>
          <div className="bg-dark-surface border border-dark-border p-6 h-[320px] rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-dark-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold font-display text-white tracking-tight">{activeOrg?.name}</h2>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">Live Workspace</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">Multi-tenant compliance dashboard, workflow analytics, and audit logging.</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <Link 
            to="/invoices?tab=new"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg hover:shadow-emerald-500/25 font-display"
          >
            <Plus className="w-4 h-4" /> New Invoice
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div 
              key={card.name} 
              className="bg-dark-surface/40 hover:bg-dark-surface/80 border border-dark-border/80 hover:border-slate-700/60 p-6 rounded-2xl flex justify-between items-start transition-all duration-300 shadow-sm hover:shadow-md group"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div>
                <p className="text-xs text-slate-400 font-semibold tracking-wide">{card.name}</p>
                <h3 className="text-xl font-bold font-display mt-2 text-white font-mono">{card.value}</h3>
                <span className="text-[10px] text-slate-500 mt-1 block font-medium">{card.desc}</span>
              </div>
              <div className={`p-2.5 rounded-xl border transition-all duration-300 group-hover:scale-105 ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Render Recharts panels */}
      <div className="bg-dark-surface/20 border border-dark-border p-6 rounded-2xl">
        <ChartsPanel revenueTrend={revenueTrend} taxSummary={taxSummary} />
      </div>

      {/* Recent Invoices list */}
      <div className="bg-dark-surface/40 border border-dark-border p-6 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-sm font-display text-white tracking-tight">Recent Invoices</h3>
            <p className="text-[10px] text-slate-500">Overview of the last five billing cycles</p>
          </div>
          <Link to="/invoices" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 group">
            View all invoices
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="overflow-x-auto border border-dark-border/60 rounded-xl bg-slate-950/20">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-dark-border text-slate-400 bg-slate-950/50">
                <th className="p-4 font-semibold">Invoice No</th>
                <th className="p-4 font-semibold">Client</th>
                <th className="p-4 font-semibold">Issue Date</th>
                <th className="p-4 font-semibold text-right">Amount</th>
                <th className="p-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/40">
              {recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-900/40 transition-all group">
                  <td className="p-4 font-semibold text-white font-mono group-hover:text-emerald-400 transition-colors">
                    {inv.invoice_number}
                  </td>
                  <td className="p-4 font-medium text-slate-300">
                    {inv.customer_detail?.contact_name}
                  </td>
                  <td className="p-4 text-slate-400 font-mono">
                    {inv.issue_date}
                  </td>
                  <td className="p-4 font-bold text-slate-200 text-right font-mono">
                    ₹ {inv.total_amount.toLocaleString()}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' :
                      inv.status === 'overdue' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' :
                      inv.status === 'draft' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                    }`}>
                      {inv.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {recentInvoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                    No invoices generated yet in this workspace.
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

export default Dashboard;
