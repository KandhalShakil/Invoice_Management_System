import React from 'react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

interface RevenueTrendItem {
  month: string;
  revenue: number;
  count: number;
}

interface TaxSummaryItem {
  rate: number;
  tax_collected: number;
  taxable_amount: number;
}

interface ChartsPanelProps {
  revenueTrend: RevenueTrendItem[];
  taxSummary: TaxSummaryItem[];
}

export const ChartsPanel: React.FC<ChartsPanelProps> = ({ revenueTrend, taxSummary }) => {
  // Custom tooltips to match slate theme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111827] border border-slate-800 p-3 rounded-lg shadow-xl text-xs">
          <p className="font-bold font-display text-slate-300 mb-1">{label}</p>
          {payload.map((p: any) => {
            const nameLower = p.name.toLowerCase();
            const isCurrency = nameLower.includes('revenue') || nameLower.includes('tax') || nameLower.includes('value') || nameLower.includes('₹');
            return (
              <p key={p.name} style={{ color: p.color }} className="font-semibold">
                {p.name}: {isCurrency ? `₹${p.value.toLocaleString()}` : p.value}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const hasTrend = revenueTrend && revenueTrend.length > 0;
  const hasTax = taxSummary && taxSummary.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* 1. Revenue Trends Area Chart */}
      <div className="glass p-6 rounded-2xl border border-slate-800/80">
        <div className="mb-4">
          <h3 className="font-bold text-sm font-display text-slate-200">Revenue & Invoicing Trend</h3>
          <p className="text-[11px] text-slate-500">Chronological analysis of compiled transaction volumes</p>
        </div>
        <div className="h-64 flex flex-col justify-center">
          {hasTrend ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area 
                  name="Revenue (₹)" 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs font-display">
              No revenue trend data available.
            </div>
          )}
        </div>
      </div>

      {/* 2. Tax Distribution Bar Chart */}
      <div className="glass p-6 rounded-2xl border border-slate-800/80">
        <div className="mb-4">
          <h3 className="font-bold text-sm font-display text-slate-200">Tax Collections summary</h3>
          <p className="text-[11px] text-slate-500">Collected taxes distributed by HSL tax margins</p>
        </div>
        <div className="h-64 flex flex-col justify-center">
          {hasTax ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taxSummary} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="rate" stroke="#475569" fontSize={10} tickFormatter={(val: number) => `${val}% Rate`} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar name="Tax Collected (₹)" dataKey="tax_collected" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar name="Taxable Value (₹)" dataKey="taxable_amount" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs font-display">
              No tax collection data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
