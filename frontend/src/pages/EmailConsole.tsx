import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, Settings, Eye, RefreshCw, Check, X, 
  Search, AlertTriangle, ChevronLeft, ChevronRight, Info
} from 'lucide-react';

interface EmailSetting {
  id: string;
  email_type: string;
  email_type_display: string;
  is_enabled: boolean;
}

interface ReminderSchedule {
  id: string;
  days_before_due: number;
  overdue_interval_days: number;
  is_active: boolean;
}

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  template_name: string;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  idempotency_hash: string;
}

const TEMPLATE_CHOICES = [
  { value: 'welcome', label: 'Welcome Email' },
  { value: 'verification', label: 'Email Verification' },
  { value: 'password_reset', label: 'Password Reset' },
  { value: 'password_changed', label: 'Password Changed Alert' },
  { value: 'login_detected', label: 'Login Detected Alert' },
  { value: 'account_locked', label: 'Account Locked Alert' },
  { value: 'organization_invitation', label: 'Workspace Invitation' },
  { value: 'role_changed', label: 'Workspace Role Changed' },
  { value: 'org_removed', label: 'Workspace Access Revoked' },
  { value: 'customer_created', label: 'Customer Onboarding' },
  { value: 'customer_updated', label: 'Customer Profile Updated' },
  { value: 'invoice_created', label: 'Invoice Draft Created' },
  { value: 'invoice_sent', label: 'Invoice Copy Sent to Client' },
  { value: 'payment_received', label: 'Payment Receipt' },
  { value: 'overdue_reminder', label: 'Overdue / Upcoming Reminder' },
  { value: 'product_created', label: 'Product Created Alert' },
  { value: 'product_price_updated', label: 'Product Pricing Updated' },
  { value: 'product_low_stock', label: 'Product Low Stock Alert' },
  { value: 'product_out_of_stock', label: 'Product Out of Stock Alert' },
  { value: 'business_summary', label: 'Business Activity Summary' },
];

const EmailConsole: React.FC = () => {
  const { activeOrg } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'logs' | 'settings' | 'preview'>('logs');
  
  // Settings tab states
  const [settings, setSettings] = useState<EmailSetting[]>([]);
  const [reminder, setReminder] = useState<ReminderSchedule | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [isReminderSaving, setIsReminderSaving] = useState(false);

  // Logs tab states
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Preview tab states
  const [selectedTemplate, setSelectedTemplate] = useState('welcome');
  const [previewHtml, setPreviewHtml] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Global UI alerts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (activeOrg) {
      if (activeTab === 'logs') {
        fetchLogs();
      } else if (activeTab === 'settings') {
        fetchSettingsAndReminders();
      } else if (activeTab === 'preview') {
        fetchPreview();
      }
    }
  }, [activeOrg, activeTab, logPage]);

  // Fetch Delivery Logs
  const fetchLogs = async () => {
    setIsLogsLoading(true);
    try {
      const res = await api.get(`/notifications/logs/?page=${logPage}&search=${searchQuery}`);
      setLogs(res.data.results || res.data);
      setTotalLogs(res.data.count || (res.data.results ? res.data.results.length : res.data.length));
    } catch (err) {
      showToast('Failed to load email delivery logs.', 'error');
    } finally {
      setIsLogsLoading(false);
    }
  };

  // Fetch Settings Toggles & Reminder Schedules
  const fetchSettingsAndReminders = async () => {
    setIsSettingsLoading(true);
    try {
      const [settingsRes, remindersRes] = await Promise.all([
        api.get('/notifications/settings/'),
        api.get('/notifications/reminders/')
      ]);
      setSettings(settingsRes.data.results || settingsRes.data);
      const reminderList = remindersRes.data.results || remindersRes.data;
      setReminder(reminderList[0] || null);
    } catch (err) {
      showToast('Failed to retrieve settings.', 'error');
    } finally {
      setIsSettingsLoading(false);
    }
  };

  // Fetch HTML preview of target template
  const fetchPreview = async () => {
    setIsPreviewLoading(true);
    try {
      const res = await api.post('/notifications/templates/preview/', {
        template_name: selectedTemplate
      });
      setPreviewHtml(res.data.html);
    } catch (err) {
      showToast('Failed to load template preview HTML.', 'error');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Trigger preview fetch when template changes
  useEffect(() => {
    if (activeOrg && activeTab === 'preview') {
      fetchPreview();
    }
  }, [selectedTemplate]);

  // Handle setting check toggle
  const handleToggleSetting = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/notifications/settings/${id}/`, {
        is_enabled: !currentStatus
      });
      setSettings(prev => prev.map(s => s.id === id ? { ...s, is_enabled: !currentStatus } : s));
      showToast('Email setting successfully updated.', 'success');
    } catch (err) {
      showToast('Failed to update email setting.', 'error');
    }
  };

  // Handle saving reminder schedule details
  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminder) return;
    setIsReminderSaving(true);
    try {
      const res = await api.patch(`/notifications/reminders/${reminder.id}/`, {
        days_before_due: reminder.days_before_due,
        overdue_interval_days: reminder.overdue_interval_days,
        is_active: reminder.is_active
      });
      setReminder(res.data);
      showToast('Reminder schedule parameters saved successfully.', 'success');
    } catch (err) {
      showToast('Failed to save reminder parameters.', 'error');
    } finally {
      setIsReminderSaving(false);
    }
  };

  // Trigger manual retry for failed dispatches
  const handleRetryEmail = async (id: string) => {
    try {
      await api.post(`/notifications/logs/${id}/retry/`);
      showToast('Email retry job queued successfully.', 'success');
      fetchLogs(); // Reload logs list
    } catch (err) {
      showToast('Failed to queue retry job.', 'error');
    }
  };

  return (
    <div className="p-6 text-slate-100 bg-[#070a13] min-h-screen">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-2 border ${
          toast.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' 
            : 'bg-rose-950/80 border-rose-500 text-rose-300'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Mail className="w-8 h-8 text-indigo-500" />
            Email Notification Control
          </h1>
          <p className="text-slate-400 mt-2">
            Audit logs, configure scheduler reminders, and preview outgoing transactional email templates.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'logs' 
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/20' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-4 h-4" />
          Delivery Logs
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'settings' 
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/20' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          Notification Settings & Reminders
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-5 py-3 font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'preview' 
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/20' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-4 h-4" />
          Template Previews
        </button>
      </div>

      {/* TAB CONTENTS */}

      {/* 1. Logs Tab */}
      {activeTab === 'logs' && (
        <div>
          {/* Search bar */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-5 h-5" />
              </span>
              <input
                type="text"
                placeholder="Search by recipient or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d1326] border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={fetchLogs}
              className="bg-indigo-600 hover:bg-indigo-500 transition-all text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLogsLoading ? 'animate-spin' : ''}`} />
              Search
            </button>
          </div>

          {/* Logs Table */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-xl overflow-hidden">
            {isLogsLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center p-12 text-slate-500">
                No email delivery records found matching search filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-800 text-slate-400 font-semibold text-sm">
                      <th className="p-4">Recipient</th>
                      <th className="p-4">Subject</th>
                      <th className="p-4">Template</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Sent At / Error</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-900 hover:bg-slate-900/20 text-slate-200 text-sm">
                        <td className="p-4 font-semibold">{log.recipient}</td>
                        <td className="p-4">{log.subject}</td>
                        <td className="p-4 font-mono text-xs text-indigo-400">{log.template_name}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            log.status === 'sent' 
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' 
                              : log.status === 'failed'
                                ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                                : 'bg-blue-950/60 text-blue-400 border border-blue-500/30'
                          }`}>
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 max-w-xs truncate">
                          {log.status === 'sent' && log.sent_at ? (
                            new Date(log.sent_at).toLocaleString()
                          ) : log.error_message ? (
                            <span className="text-rose-400 flex items-center gap-1.5" title={log.error_message}>
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              {log.error_message}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {log.status === 'failed' && (
                            <button
                              onClick={() => handleRetryEmail(log.id)}
                              className="text-xs bg-rose-950 border border-rose-500 hover:bg-rose-900 text-rose-300 font-semibold px-3 py-1.5 rounded transition-all flex items-center gap-1 mx-auto"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            <div className="flex justify-between items-center p-4 border-t border-slate-800 text-slate-400 text-sm bg-slate-900/20">
              <div>
                Total Logs: <span className="text-white font-semibold">{totalLogs}</span>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={logPage === 1}
                  onClick={() => setLogPage(p => Math.max(p - 1, 1))}
                  className="bg-slate-900 hover:bg-slate-800 transition px-3 py-1.5 rounded border border-slate-800 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 bg-[#0d1326] border border-indigo-500/20 text-indigo-400 rounded">
                  Page {logPage}
                </span>
                <button
                  disabled={logPage * 20 >= totalLogs}
                  onClick={() => setLogPage(p => p + 1)}
                  className="bg-slate-900 hover:bg-slate-800 transition px-3 py-1.5 rounded border border-slate-800 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Settings Tab */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Notification toggles list (left cols) */}
          <div className="lg:col-span-2 bg-[#0b0e17] border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-500" />
              Event Notification Settings
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Enable or disable automated email triggers across the organization platform lifecycle events.
            </p>

            {isSettingsLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings.map((set) => (
                  <div 
                    key={set.id} 
                    className="flex justify-between items-center p-4 bg-[#0d1326] border border-slate-800/60 rounded-lg hover:border-slate-800 transition-all"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{set.email_type_display}</div>
                      <div className="text-[10px] font-mono text-indigo-400/80 mt-0.5">{set.email_type}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={set.is_enabled} 
                        onChange={() => handleToggleSetting(set.id, set.is_enabled)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white peer-checked:after:border-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduler configuration (right col) */}
          <div className="bg-[#0b0e17] border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-500" />
              Billing Reminder Schedule
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Configure parameters for periodic cron reminders sent automatically to clients.
            </p>

            {isSettingsLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : reminder ? (
              <form onSubmit={handleSaveReminder} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Days Before Due Date for Reminder
                  </label>
                  <select
                    value={reminder.days_before_due}
                    onChange={(e) => setReminder(prev => prev ? { ...prev, days_before_due: parseInt(e.target.value) } : null)}
                    className="w-full bg-[#0d1326] border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={7}>7 Days (Recommended)</option>
                    <option value={3}>3 Days</option>
                    <option value={1}>1 Day</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1.5 flex gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Emails will also fire on the due date automatically.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Overdue Recurrence Interval (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={reminder.overdue_interval_days}
                    onChange={(e) => setReminder(prev => prev ? { ...prev, overdue_interval_days: parseInt(e.target.value) } : null)}
                    className="w-full bg-[#0d1326] border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Repeat overdue alerts every N days until the invoice is settled.
                  </p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-900/40 border border-slate-800/40 rounded-lg">
                  <input
                    type="checkbox"
                    id="reminder_active"
                    checked={reminder.is_active}
                    onChange={(e) => setReminder(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <label htmlFor="reminder_active" className="text-sm font-semibold text-slate-300 cursor-pointer">
                    Enable Automated Reminders
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isReminderSaving}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 font-bold transition-all flex justify-center items-center gap-2"
                >
                  {isReminderSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Save Reminder Schedule'
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center p-6 text-slate-500">
                Failed loading reminder parameters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Preview Tab */}
      {activeTab === 'preview' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Template Selector list */}
          <div className="lg:col-span-1 bg-[#0b0e17] border border-slate-800 rounded-xl p-5 h-[calc(100vh-250px)] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">Templates</h3>
            <div className="space-y-1">
              {TEMPLATE_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  onClick={() => setSelectedTemplate(choice.value)}
                  className={`w-full text-left p-3 rounded-lg text-sm font-semibold transition-all ${
                    selectedTemplate === choice.value
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'hover:bg-slate-900/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>

          {/* Render container */}
          <div className="lg:col-span-3 bg-[#0b0e17] border border-slate-800 rounded-xl p-6 flex flex-col h-[calc(100vh-250px)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">HTML Dynamic Preview</h3>
              <button
                onClick={fetchPreview}
                className="text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 transition text-slate-300 font-semibold px-4 py-2 rounded flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPreviewLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {isPreviewLoading ? (
              <div className="flex-1 flex items-center justify-center bg-slate-950/20 border border-slate-900 rounded-xl">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : previewHtml ? (
              <div className="flex-1 bg-white border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                <iframe
                  title="Email Template Render Frame"
                  srcDoc={previewHtml}
                  className="w-full h-full border-none"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-950/20 border border-slate-900 rounded-xl">
                No preview HTML generated.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailConsole;
