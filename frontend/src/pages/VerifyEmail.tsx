import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Mail, Check, Loader2, Receipt, ArrowRight, ShieldAlert } from 'lucide-react';
import api from '../services/api';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Resend Verification State
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');
  const [emailFieldError, setEmailFieldError] = useState('');

  useEffect(() => {
    const verifyUserEmail = async () => {
      if (!uid || !token) {
        setStatus('error');
        setErrorMessage('Verification parameters are missing. Please request a new link.');
        return;
      }

      try {
        await api.post('/auth/verify-email/', { uid, token });
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(
          err.response?.data?.error || 
          err.response?.data?.detail || 
          'The verification link has expired or is invalid.'
        );
      }
    };

    verifyUserEmail();
  }, [uid, token]);

  const handleResendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailFieldError('');
    setResendSuccess('');
    setResendError('');

    if (!email.trim()) {
      setEmailFieldError('Email address is required.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailFieldError('Please enter a valid email address.');
      return;
    }

    setIsResending(true);
    try {
      const response = await api.post('/auth/resend-verification/', { email: email.trim() });
      setResendSuccess(response.data.message || 'Verification link has been sent to your email.');
      setEmail('');
    } catch (err: any) {
      setResendError(err.response?.data?.error || 'Failed to resend verification link. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-[#030712] relative min-h-screen flex items-center justify-center p-6 text-slate-200 antialiased overflow-hidden font-sans">
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,transparent_20%,#030712_80%)] pointer-events-none"></div>

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-slate-950/60 backdrop-blur-xl border border-slate-900 rounded-2xl p-8 shadow-2xl relative z-10 flex flex-col items-center">
        
        {/* Brand Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/15">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Receipt className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-white">Invoicely</span>
        </div>

        {/* 1. LOADING STATE */}
        {status === 'loading' && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-5" />
            <h2 className="text-xl font-display font-bold text-white mb-2">Verifying your email</h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Connecting with our servers to verify your account credentials. This will only take a moment.
            </p>
          </div>
        )}

        {/* 2. SUCCESS STATE */}
        {status === 'success' && (
          <div className="flex flex-col items-center text-center w-full">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/5 animate-pulse">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            
            <h2 className="text-xl font-display font-bold text-white mb-2">Verification Successful!</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-8 max-w-xs">
              Your email address has been verified. You now have full access to your organization's dashboard.
            </p>
            
            <Link
              to="/login"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all duration-300 group"
            >
              Sign In to Workspace
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        )}

        {/* 3. ERROR STATE */}
        {status === 'error' && (
          <div className="flex flex-col items-center text-center w-full">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 shadow-lg shadow-red-500/5">
              <ShieldAlert className="w-8 h-8 text-red-400" />
            </div>
            
            <h2 className="text-xl font-display font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-sm text-red-400 font-semibold mb-4 bg-red-500/5 border border-red-500/10 px-4 py-2 rounded-lg w-full text-center">
              {errorMessage}
            </p>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              The link might be expired, broken, or already verified. Enter your registered email address below to receive a new activation link.
            </p>

            <form onSubmit={handleResendSubmit} className="w-full space-y-4">
              <div className="text-left">
                <label className="text-[11px] text-slate-400 font-semibold block mb-1.5 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailFieldError('');
                    }}
                    className={`w-full bg-slate-950 border text-slate-200 py-2.5 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono placeholder-slate-600 ${
                      emailFieldError ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500/60'
                    }`}
                    placeholder="name@company.com"
                  />
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                </div>
                {emailFieldError && (
                  <span className="text-red-500 text-[10px] mt-1 block font-semibold">{emailFieldError}</span>
                )}
              </div>

              {resendSuccess && (
                <div className="text-emerald-400 text-xs font-semibold py-1.5 px-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg w-full text-left">
                  ✓ {resendSuccess}
                </div>
              )}

              {resendError && (
                <div className="text-red-400 text-xs font-semibold py-1.5 px-3 bg-red-500/5 border border-red-500/10 rounded-lg w-full text-left">
                  ⚠️ {resendError}
                </div>
              )}

              <button
                type="submit"
                disabled={isResending}
                className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-850 transition-all duration-300 disabled:opacity-50"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    Sending link...
                  </>
                ) : (
                  'Send Verification Link'
                )}
              </button>
            </form>

            <Link
              to="/login"
              className="text-xs text-slate-500 hover:text-slate-350 transition-colors mt-6 font-semibold underline block"
            >
              Return to Login page
            </Link>
          </div>
        )}

      </div>
    </div>
  );
};

export default VerifyEmail;
