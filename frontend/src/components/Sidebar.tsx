import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { 
  LayoutDashboard, FileText, Users, ShoppingBag, 
  ShieldAlert, BarChart3, Settings, LogOut, Briefcase, Receipt, ChevronDown, Mail
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { user, organizations, activeOrg, activeRole, switchOrganization, logout } = useAuth();
  const { showModal } = useModal();

  const navigation = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Invoices', to: '/invoices', icon: FileText },
    { name: 'Customers', to: '/customers', icon: Users },
    { name: 'Products & Services', to: '/products', icon: ShoppingBag },
    { name: 'Audit Trails', to: '/audit-logs', icon: ShieldAlert },
    { name: 'Reports & Export', to: '/reports', icon: BarChart3 },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  if (activeRole === 'owner' || activeRole === 'admin') {
    navigation.push({ name: 'Email Control', to: '/email-console', icon: Mail });
  }

  return (
    <div className="w-64 h-screen bg-dark-surface border-r border-dark-border flex flex-col justify-between fixed left-0 top-0 z-30">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-dark-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold font-display text-white tracking-tight leading-none mb-1">Invoicely</h1>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Enterprise</span>
          </div>
        </div>

        {/* Tenant Workspace Switcher */}
        <div className="p-4 border-b border-dark-border bg-slate-950/20">
          <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1.5">Active Workspace</label>
          <div className="relative group">
            <select
              value={activeOrg?.id || ''}
              onChange={(e) => switchOrganization(e.target.value)}
              className="w-full bg-slate-950 border border-dark-border text-slate-300 hover:text-slate-100 py-2.5 pl-9 pr-8 rounded-xl appearance-none focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 text-xs cursor-pointer font-medium transition-all"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="bg-dark-surface text-slate-200">
                  {org.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500 group-hover:text-slate-400 transition-colors">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500 group-hover:text-slate-400 transition-colors">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
          {activeRole && (
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[9px] bg-slate-900 border border-dark-border text-slate-400 py-0.5 px-2 rounded-md font-semibold capitalize font-mono">
                Access: {activeRole}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Routes */}
        <nav className="mt-5 px-3 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all group relative ${
                    isActive
                      ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/10 shadow-[0_0_20px_-8px_rgba(16,185,129,0.15)]'
                      : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active vertical bar indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-emerald-400 rounded-full"></span>
                    )}
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-105 duration-300 ${
                      isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'
                    }`} />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-dark-border bg-slate-950/20">
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950 border border-dark-border">
          <div className="truncate min-w-0">
            <p className="text-[11px] font-bold text-slate-200 truncate leading-snug">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-[9px] text-slate-500 truncate leading-none mt-0.5 font-mono">
              {user?.email}
            </p>
          </div>
          <button
            onClick={() => {
              showModal({
                type: 'warning',
                title: 'Log Out',
                message: 'Are you sure you want to log out of your account?',
                confirmText: 'Log Out',
                onConfirm: logout
              });
            }}
            className="p-2 bg-slate-900 hover:bg-red-950/40 hover:text-red-400 text-slate-400 border border-dark-border hover:border-red-500/20 rounded-xl transition-all flex-shrink-0"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
