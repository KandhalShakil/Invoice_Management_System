import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Lock, Mail, User, Building, Eye, EyeOff, Sparkles, Receipt, ArrowRight, Shield } from 'lucide-react';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [role, setRole] = useState('owner');
  const [showPassword, setShowPassword] = useState(false);
  const [orgStatus, setOrgStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'found' | 'not_found'>('idle');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orgName.trim()) {
      setOrgStatus('idle');
      return;
    }

    setOrgStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/organizations/check/?name=${encodeURIComponent(orgName.trim())}`);
        const exists = response.data.exists;
        
        if (role === 'owner') {
          setOrgStatus(exists ? 'taken' : 'available');
        } else {
          setOrgStatus(exists ? 'found' : 'not_found');
        }
      } catch (err) {
        setOrgStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [orgName, role]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!firstName.trim()) {
      errors.first_name = "First name is required.";
    }
    if (!lastName.trim()) {
      errors.last_name = "Last name is required.";
    }
    if (!orgName.trim()) {
      errors.organization_name = "Organization name is required.";
    }
    if (!email.trim()) {
      errors.email = "Email address is required.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.email = "Please enter a valid email address.";
      }
    }
    if (!password.trim()) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    }

    if (orgStatus === 'taken' && role === 'owner') {
      errors.organization_name = "Organization already exists.";
    }
    if (orgStatus === 'not_found' && role !== 'owner') {
      errors.organization_name = "Organization not found.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstInvalidKey = Object.keys(errors)[0];
      const el = document.getElementById(`reg_${firstInvalidKey}`);
      if (el) el.focus();
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFormErrors({});
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register/', {
        email: email.trim(),
        password: password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        organization_name: orgName.trim(),
        role: role
      });
      
      setSuccess(res.data?.message || (role === 'owner' ? 'Enterprise workspace created successfully!' : 'Successfully submitted registration request!'));
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      if (err.response && err.response.status === 400 && typeof err.response.data === 'object') {
        const data = err.response.data;
        const fieldErrors: Record<string, string> = {};
        Object.keys(data).forEach((key) => {
          const val = data[key];
          fieldErrors[key] = Array.isArray(val) ? val[0] : val;
        });
        setFormErrors(fieldErrors);

        const firstInvalidKey = Object.keys(fieldErrors)[0];
        const el = document.getElementById(`reg_${firstInvalidKey}`);
        if (el) el.focus();
        setError('Please correct the highlighted errors.');
      } else {
        const _err = err.response?.data?.error || 'Failed to construct organization. Check input fields.';
        setError(typeof _err === 'object' ? _err.message || JSON.stringify(_err) : _err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-dark-base text-slate-200 antialiased overflow-x-hidden font-sans">
      
      {/* LEFT PANE: Premium SaaS Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#030712] border-r border-slate-900 overflow-hidden flex-col justify-between p-12">
        {/* Glow Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[150px] animate-glow-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,transparent_20%,#030712_80%)] pointer-events-none"></div>

        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/15">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">Invoicely</span>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">Enterprise</span>
        </div>

        {/* Middle Visual Section */}
        <div className="relative z-10 my-auto max-w-lg">
          <h1 className="text-4xl font-display font-extrabold tracking-tight text-white mb-4 leading-tight">
            Create your Billing Workspace in seconds.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Access a multi-tenant corporate invoicing engine. Set up your organization profile, configure your regional tax rules, and launch automated recurring customer invoices.
          </p>

          {/* Testimonial Panel */}
          <div className="relative p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-white font-bold font-display">Fast Onboarding</div>
                <div className="text-[10px] text-slate-500 font-medium">Ready in under 2 minutes</div>
              </div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Upon workspace creation, we configure a secure database schema tenant for your company. Invite your team and start billing immediately.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-[10px] text-slate-600 font-mono">
          © 2026 Invoicely. All rights reserved. GDPR Compliant.
        </div>
      </div>

      {/* RIGHT PANE: Modern centered Registration Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 md:px-8 py-12 relative bg-dark-base">
        
        {/* Mobile Background Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none lg:hidden"></div>

        {/* Centered Signup Box */}
        <div className="w-full max-w-md animate-fade-in">
          
          {/* Logo only visible on mobile header */}
          <div className="flex items-center gap-2 mb-8 justify-center lg:hidden">
            <Receipt className="w-6 h-6 text-emerald-400" />
            <span className="font-display font-bold text-lg text-white">Invoicely</span>
          </div>

          <div className="p-8 md:p-10 rounded-2xl bg-dark-surface/40 border border-slate-800/80 backdrop-blur-xl shadow-premium relative">
            
            {/* Header info */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold font-display text-white tracking-tight">
                {role === 'owner' ? 'Create Workspace' : 'Join Workspace'}
              </h2>
              <p className="text-slate-400 text-xs mt-1.5 leading-normal">
                {role === 'owner' ? 'Initialize your multi-tenant invoicing and accounting suite.' : 'Join an existing organization to start collaborating.'}
              </p>
            </div>

            {/* Error display */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded-xl font-medium flex items-start gap-2.5 animate-slide-up">
                <span className="text-red-500 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Success display */}
            {success && (
              <div className="mb-5 p-3.5 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl font-medium flex items-start gap-2.5 animate-slide-up">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* First & Last Name grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1.5">First Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="reg_first_name"
                      required
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setFormErrors(prev => ({ ...prev, first_name: '' }));
                      }}
                      className={`w-full bg-slate-950 border text-slate-200 py-2.5 pl-9 pr-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder-slate-600 ${
                        formErrors.first_name ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500/60'
                      }`}
                      placeholder="John"
                    />
                    <User className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-slate-500" />
                  </div>
                  {formErrors.first_name && (
                    <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.first_name}</span>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1.5">Last Name</label>
                  <input
                    type="text"
                    id="reg_last_name"
                    required
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setFormErrors(prev => ({ ...prev, last_name: '' }));
                    }}
                    className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder-slate-600 ${
                      formErrors.last_name ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500/60'
                    }`}
                    placeholder="Doe"
                  />
                  {formErrors.last_name && (
                    <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.last_name}</span>
                  )}
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Your Role</label>
                <div className="relative">
                  <select
                    id="reg_role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 py-2.5 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all appearance-none"
                  >
                    <option value="owner">Owner (Create Workspace)</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Staff</option>
                    <option value="accountant">Accountant</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Shield className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Company / Organization Input */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Company / Organization</label>
                <div className="relative">
                  <input
                    type="text"
                    id="reg_organization_name"
                    required
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      setFormErrors(prev => ({ ...prev, organization_name: '' }));
                    }}
                    className={`w-full bg-slate-950 border text-slate-200 py-2.5 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder-slate-600 ${
                      formErrors.organization_name ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500/60'
                    }`}
                    placeholder="Acme Billing Co."
                  />
                  <Building className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                </div>
                {orgStatus === 'checking' && <span className="text-slate-400 text-[10px] mt-1 block">Checking availability...</span>}
                {orgStatus === 'available' && <span className="text-emerald-500 text-[10px] mt-1 block font-semibold">✓ Organization name is available</span>}
                {orgStatus === 'taken' && <span className="text-red-500 text-[10px] mt-1 block font-semibold">✗ Organization already exists</span>}
                {orgStatus === 'found' && <span className="text-emerald-500 text-[10px] mt-1 block font-semibold">✓ Organization found</span>}
                {orgStatus === 'not_found' && <span className="text-red-500 text-[10px] mt-1 block font-semibold">✗ Organization not found</span>}
                {formErrors.organization_name && orgStatus !== 'taken' && orgStatus !== 'not_found' && (
                  <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.organization_name}</span>
                )}
              </div>

              {/* Email Input */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    id="reg_email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFormErrors(prev => ({ ...prev, email: '' }));
                    }}
                    className={`w-full bg-slate-950 border text-slate-200 py-2.5 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono placeholder-slate-600 ${
                      formErrors.email ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500/60'
                    }`}
                    placeholder="admin@company.com"
                  />
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                </div>
                {formErrors.email && (
                  <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.email}</span>
                )}
              </div>

              {/* Password Input */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="reg_password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFormErrors(prev => ({ ...prev, password: '' }));
                    }}
                    className={`w-full bg-slate-950 border text-slate-200 py-2.5 pl-10 pr-10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder-slate-600 ${
                      formErrors.password ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500/60'
                    }`}
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formErrors.password ? (
                  <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.password}</span>
                ) : (
                  <span className="text-[10px] text-slate-500 block mt-1.5">Minimum 8 characters. Must contain letter & number.</span>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 text-sm mt-6 flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {role === 'owner' ? 'Creating Workspace...' : 'Joining Workspace...'}
                  </>
                ) : (
                  <>
                    {role === 'owner' ? 'Create Workspace' : 'Join Workspace'}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-500 mt-6">
                Already have an active account?{' '}
                <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline">
                  Log In
                </Link>
              </p>
            </form>
          </div>
          
          <div className="text-center text-[10px] text-slate-600 mt-6 relative z-10">
            Secure multi-tenant workspace setup. By signing up, you agree to our Terms of Service.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
