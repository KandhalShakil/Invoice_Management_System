import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download, FileSpreadsheet, Calendar, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import DatePicker from '../components/DatePicker';

const Reports: React.FC = () => {
  const { activeOrg } = useAuth();
  const [reportType, setReportType] = useState('revenue');
  const [format, setFormat] = useState('csv');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setIsLoading(true);
    setDownloadError('');

    try {
      let query = `type=${reportType}&format=${format}`;
      if (startDate) query += `&start_date=${startDate}`;
      if (endDate) query += `&end_date=${endDate}`;

      const res = await api.get(`/invoices/reports/?${query}`, {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], {
        type: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${reportType}_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      setDownloadError('Failed to compile and download report. Verify the date range and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-dark-border pb-6">
        <h2 className="text-2xl font-bold font-display text-white tracking-tight">Reports & Exports</h2>
        <p className="text-slate-400 text-xs mt-1">Compile revenues audit reports and download formatted worksheets</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Parameters Panel */}
        <div className="lg:col-span-2 bg-dark-surface/40 border border-dark-border p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-sm font-display text-white mb-6 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Parameters
          </h3>
          
          <form onSubmit={handleDownload} className="space-y-5 text-xs">
            {downloadError && (
              <div className="p-3.5 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded-xl font-medium">
                {downloadError}
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5">Report Category</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-slate-950 border border-dark-border text-slate-300 py-2.5 px-3 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 text-xs transition-all cursor-pointer font-medium"
                >
                  <option value="revenue" className="bg-dark-surface">Sales & Revenues (Summary & Invoices)</option>
                  <option value="tax" className="bg-dark-surface">Tax & GST ledger (HSN split summaries)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5">File Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-slate-950 border border-dark-border text-slate-300 py-2.5 px-3 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 text-xs transition-all cursor-pointer font-medium"
                >
                  <option value="csv" className="bg-dark-surface">Comma-separated Values (.csv)</option>
                  <option value="xlsx" className="bg-dark-surface">Excel Workbook (.xlsx)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-dark-border/40 pt-4">
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> Start Date
                </label>
                <DatePicker
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  placeholder="Select Start Date"
                />
              </div>
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> End Date
                </label>
                <DatePicker
                  value={endDate}
                  onChange={(val) => setEndDate(val)}
                  placeholder="Select End Date"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-dark-border/40">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 text-xs"
              >
                <Download className="w-4 h-4" /> {isLoading ? 'Compiling file...' : 'Export Spreadsheet'}
              </button>
            </div>
          </form>
        </div>

        {/* Compliance Info */}
        <div className="bg-dark-surface/40 border border-dark-border p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm font-display text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" /> Compliance & Audit
            </h3>
            <div className="space-y-4 text-slate-400 text-xs leading-relaxed">
              <p>Generated files contain signed, immutable ledger items matching corporate tax requirements.</p>
              <p><b>GST CGST/SGST/IGST breakdown</b> is compiled dynamically based on business addresses and standard tax rates.</p>
              <p>For filing support, compile HSN split spreadsheets and export as `.xlsx` to review inputs directly.</p>
            </div>
          </div>
          <div className="mt-8 p-4 bg-slate-950 border border-dark-border rounded-xl">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-bold mb-1">Ledger verification</span>
            <span className="text-xs text-emerald-400 font-bold font-mono">HASH: SHA256 SECURE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
