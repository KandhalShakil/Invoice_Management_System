import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ShieldCheck, Eye, EyeOff, Check, Sparkles, Receipt, ArrowRight } from 'lucide-react';
import api from '../services/api';

const Login: React.FC = () => {
  const { login, verify2FA } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // 2FA state management
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [userId, setUserId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Resend Verification State
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');

  const handleResendVerification = async () => {
    if (!email.trim()) return;
    setIsResending(true);
    setResendSuccess('');
    setResendError('');
    try {
      const response = await api.post('/auth/resend-verification/', { email: email.trim() });
      setResendSuccess(response.data.message || 'Verification link has been sent to your email.');
    } catch (err: any) {
      setResendError(err.response?.data?.error || 'Failed to resend verification link.');
    } finally {
      setIsResending(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.email = 'Please enter a valid email address.';
      }
    }
    if (!password.trim()) {
      errors.password = 'Password is required.';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstInvalidKey = Object.keys(errors)[0];
      const el = document.getElementById(`login_${firstInvalidKey}`);
      if (el) el.focus();
      return false;
    }
    return true;
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFormErrors({});
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const res = await login(email, password);
      if (res.twoFactorRequired) {
        setTwoFactorRequired(true);
        setUserId(res.userId || '');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      if (err.response && (err.response.status === 400 || err.response.status === 401) && typeof err.response.data === 'object') {
        const data = err.response.data;
        const fieldErrors: Record<string, string> = {};
        
        const genericError = data.non_field_errors?.[0] || data.detail || data.error;
        
        if (genericError) {
          setError(typeof genericError === 'object' ? genericError.message || JSON.stringify(genericError) : genericError);
        } else {
          Object.keys(data).forEach((key) => {
            const val = data[key];
            fieldErrors[key] = Array.isArray(val) ? val[0] : val;
          });
          setFormErrors(fieldErrors);
          const firstInvalidKey = Object.keys(fieldErrors)[0];
          const el = document.getElementById(`login_${firstInvalidKey}`);
          if (el) el.focus();
          setError('Please correct the highlighted errors.');
        }
      } else {
        const _err = err.response?.data?.error || err.response?.data?.non_field_errors?.[0] || 'Invalid email or password.';
        setError(typeof _err === 'object' ? _err.message || JSON.stringify(_err) : _err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFormErrors({});
    
    if (!otpCode.trim()) {
      setFormErrors({ otp_code: 'Verification code is required.' });
      const el = document.getElementById('login_otp_code');
      if (el) el.focus();
      return;
    }
    
    setIsLoading(true);
    try {
      await verify2FA(userId, otpCode);
      navigate('/');
    } catch (err: any) {
      if (err.response && (err.response.status === 400 || err.response.status === 401) && typeof err.response.data === 'object') {
        const data = err.response.data;
        const genericError = data.non_field_errors?.[0] || data.detail || data.error || 'Invalid or expired 2FA code.';
        setFormErrors({ otp_code: genericError });
        const el = document.getElementById('login_otp_code');
        if (el) el.focus();
      } else {
        const _err = err.response?.data?.error || 'Invalid or expired 2FA code.';
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
            Simplify your Global Enterprise Billing.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Manage multi-tenant invoices, track revenue streams, automate recurring billing, and maintain complete compliance with real-time audit logging.
          </p>

          {/* Sleek Floating Visual Mockup */}
          <div className="relative p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-md shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            {/* Mock Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/40">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono tracking-wider">ACME-INV-2026-084</div>
            </div>

            {/* Mock Content */}
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Invoice Total</div>
                  <div className="text-2xl font-bold font-display text-white">₹72,450.00</div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Paid
                </div>
              </div>

              {/* Progress Line */}
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-[80%] bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"></div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Due Date</span>
                  <span className="text-slate-300 font-medium font-mono">June 30, 2026</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Client Tenant</span>
                  <span className="text-slate-300 font-medium">Delhi Tech Consultants</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Testimonial */}
        <div className="relative z-10 border-t border-slate-900 pt-6">
          <div className="flex items-center gap-1.5 text-emerald-400 mb-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold tracking-wide uppercase">Trusted by scale-ups</span>
          </div>
          <p className="text-slate-500 text-xs italic leading-relaxed">
            "Invoicely integrated with our multi-tenant SaaS workspace in minutes. The compliance logs and robust rate throttling gives us the confidence to handle millions of transactions."
          </p>
          <div className="text-[10px] text-slate-400 mt-2 font-semibold font-display">
            — Chief Financial Officer, Acme Corp
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Modern centered Auth Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 md:px-8 relative bg-dark-base">
        
        {/* Mobile Background Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none lg:hidden"></div>

        {/* Centered Auth Box */}
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
                {twoFactorRequired ? 'Two-Factor Verification' : 'Sign in to workspace'}
              </h2>
              <p className="text-slate-400 text-xs mt-1.5 leading-normal">
                {twoFactorRequired 
                  ? 'Verify your credentials with the 2FA code generated by your authenticator app.' 
                  : 'Enter your credentials to access your secure billing platform.'}
              </p>
            </div>

            {/* Error display */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded-xl font-medium flex items-start gap-2.5 animate-slide-up">
                <span className="text-red-500 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {!twoFactorRequired ? (
              /* Credentials Form */
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1.5">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      id="login_email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFormErrors(prev => ({ ...prev, email: '' }));
                      }}
                      className={`w-full bg-slate-950 border text-slate-200 py-2.5 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono placeholder-slate-600 ${
                        formErrors.email ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500/60'
                      }`}
                      placeholder="name@company.com"
                      autoComplete="email"
                    />
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  </div>
                  {formErrors.email && (
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-red-500 text-[10px] block font-semibold">{formErrors.email}</span>
                      {formErrors.email.includes("verified") && (
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={isResending}
                          className="text-emerald-400 hover:text-emerald-300 text-[10px] font-semibold text-left underline focus:outline-none transition-colors w-fit block"
                        >
                          {isResending ? 'Resending verification link...' : 'Resend verification link'}
                        </button>
                      )}
                      {resendSuccess && (
                        <span className="text-emerald-400 text-[10px] block font-semibold">✓ {resendSuccess}</span>
                      )}
                      {resendError && (
                        <span className="text-red-400 text-[10px] block font-semibold">⚠️ {resendError}</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs text-slate-400 font-semibold block">Password</label>
                    <a href="#forgot" onClick={(e) => { e.preventDefault(); setError('Password recovery requires administrator approval.'); }} className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors">
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="login_password"
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
                      autoComplete="current-password"
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
                  {formErrors.password && (
                    <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.password}</span>
                  )}
                </div>

                {/* Remember Me Option */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-4 h-4 rounded border transition-all flex items-center justify-center focus:outline-none ${
                      rememberMe 
                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    {rememberMe && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                  <span className="text-xs text-slate-400 select-none cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                    Remember my device for 30 days
                  </span>
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
                      Signing In...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-slate-500 mt-6">
                  Don't have an enterprise account?{' '}
                  <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline">
                    Create workspace
                  </Link>
                </p>
              </form>
            ) : (
              /* 2FA Verification Form */
              <form onSubmit={handleOTPSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1.5">Verification Code / Recovery Key</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="login_otp_code"
                      required
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.target.value);
                        setFormErrors(prev => ({ ...prev, otp_code: '' }));
                      }}
                      className={`w-full bg-slate-950 border text-slate-200 py-3 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all tracking-widest text-center font-mono font-bold ${
                        formErrors.otp_code ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500/60'
                      }`}
                      placeholder="000000"
                      maxLength={12}
                    />
                    <ShieldCheck className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  </div>
                  {formErrors.otp_code && (
                    <span className="text-red-500 text-[10px] mt-1 block font-semibold text-center">{formErrors.otp_code}</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 text-sm mt-6 flex items-center justify-center"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Continue'}
                </button>

                <button
                  type="button"
                  onClick={() => setTwoFactorRequired(false)}
                  className="w-full bg-transparent border border-slate-850 hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 font-semibold py-2.5 rounded-xl text-xs transition-all"
                >
                  Back to Credentials
                </button>
              </form>
            )}
          </div>
          
          <div className="text-center text-[10px] text-slate-600 mt-6 relative z-10">
            Powered by Invoicely SaaS Group. Secure end-to-end 256-bit encryption.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
