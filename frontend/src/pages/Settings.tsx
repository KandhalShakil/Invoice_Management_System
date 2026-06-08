import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, KeyRound, Save, Lock, Trash2, UserPlus } from 'lucide-react';
import { validatePhone, validateEmail } from '../utils/validation';
import { Member } from '../types';


const Settings: React.FC = () => {
  const { activeOrg, user, activeRole, refreshProfile } = useAuth();
  
  // Organization form states
  const [orgName, setOrgName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('India');
  const [logoUrl, setLogoUrl] = useState('');
  
  const [orgSuccess, setOrgSuccess] = useState('');
  const [orgError, setOrgError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2FA states
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [otpVerifyCode, setOtpVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  
  // Setup modal state
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [tfaError, setTfaError] = useState('');
  
  // Deactivate modal state
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [deactivateCode, setDeactivateCode] = useState('');
  const [deactivateError, setDeactivateError] = useState('');
  const [deactivateSuccess, setDeactivateSuccess] = useState('');

  // Member management states
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'admin' | 'manager' | 'accountant' | 'employee' | 'viewer'>('viewer');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);

  // Pending member management states
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);
  const [, setPendingMembersLoading] = useState(false);
  const [resolvingMemberId, setResolvingMemberId] = useState<string | null>(null);
  const [resolveMessage, setResolveMessage] = useState('');

  const loadOrgDetails = () => {
    if (!activeOrg) return;
    setOrgName(activeOrg.name);
    setTaxNumber(activeOrg.tax_number || '');
    setOrgEmail(activeOrg.email);
    setOrgPhone(activeOrg.phone || '');
    setStreet(activeOrg.billing_address?.street || '');
    setCity(activeOrg.billing_address?.city || '');
    setState(activeOrg.billing_address?.state || '');
    setZip(activeOrg.billing_address?.zip || '');
    setCountry(activeOrg.billing_address?.country || 'India');
    setLogoUrl(activeOrg.logo_url || '');
  };

  const fetchMembers = async () => {
    if (!activeOrg) return;
    try {
      setMembersLoading(true);
      const res = await api.get(`/organizations/${activeOrg.id}/members/`);
      setMembers(res.data.results || res.data);
    } catch (err) {
      console.error('Failed to fetch workspace members', err);
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchPendingMembers = async () => {
    if (!activeOrg || activeRole !== 'owner') return;
    try {
      setPendingMembersLoading(true);
      const res = await api.get(`/organizations/${activeOrg.id}/pending_members/`);
      setPendingMembers(res.data.results || res.data);
    } catch (err) {
      console.error('Failed to fetch pending members', err);
    } finally {
      setPendingMembersLoading(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    
    if (!inviteEmail.trim()) {
      setInviteError('Please enter an email address.');
      return;
    }
    if (!validateEmail(inviteEmail.trim())) {
      setInviteError('Please enter a valid email address.');
      return;
    }

    setIsInviting(true);
    try {
      await api.post(`/organizations/${activeOrg?.id}/members/add/`, {
        email: inviteEmail.trim(),
        role: inviteRole
      });
      setInviteSuccess(`Successfully updated role / invited ${inviteEmail}.`);
      setInviteEmail('');
      setInviteRole('viewer');
      fetchMembers();
    } catch (err: any) {
      setInviteError(
        err.response?.data?.email?.[0] || 
        err.response?.data?.role?.[0] || 
        err.response?.data?.error || 
        'Failed to add member to workspace.'
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string, targetUserEmail: string) => {
    if (!window.confirm(`Are you sure you want to remove ${targetUserEmail} from this workspace?`)) {
      return;
    }
    
    try {
      await api.post(`/organizations/${activeOrg?.id}/members/remove/`, {
        user_id: targetUserId
      });
      setInviteSuccess('Member removed successfully.');
      fetchMembers();
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Failed to remove member.');
    }
  };

  const handleResolveMember = async (targetUserId: string, action: 'approve' | 'reject') => {
    setResolvingMemberId(targetUserId);
    setResolveMessage('');
    try {
      await api.post(`/organizations/${activeOrg?.id}/resolve_member/`, {
        action,
        user_id: targetUserId
      });
      setResolveMessage(action === 'approve' ? 'User approved successfully.' : 'User rejected.');
      fetchMembers();
      fetchPendingMembers();
      setTimeout(() => setResolveMessage(''), 3000);
    } catch (err: any) {
      setResolveMessage(err.response?.data?.error || `Failed to ${action} user.`);
    } finally {
      setResolvingMemberId(null);
    }
  };

  useEffect(() => {
    loadOrgDetails();
    if (user) {
      setIs2FAEnabled(user.two_factor_enabled);
    }
    fetchMembers();
    fetchPendingMembers();
  }, [activeOrg, user]);

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError('');
    setOrgSuccess('');
    setFormErrors({});
    
    // Client-side validations
    const errors: Record<string, string> = {};
    if (!orgName.trim()) {
      errors.name = "Company name is required.";
    }
    if (!orgEmail.trim()) {
      errors.email = "Billing email is required.";
    } else if (!validateEmail(orgEmail.trim())) {
      errors.email = "Billing email is invalid.";
    }
    if (orgPhone && !validatePhone(orgPhone)) {
      errors.phone = "Phone number must contain exactly 10 digits.";
    }
    if (!street.trim()) errors.street = "Street address is required.";
    if (!city.trim()) errors.city = "City is required.";
    if (!state.trim()) errors.state = "State/Region is required.";
    if (!zip.trim()) errors.zip = "ZIP/Postal code is required.";
    if (!country.trim()) errors.country = "Country is required.";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstInvalidKey = Object.keys(errors)[0];
      const el = document.getElementById(`org_${firstInvalidKey}`);
      if (el) el.focus();
      return;
    }
    
    const payload = {
      name: orgName.trim(),
      tax_number: taxNumber.trim(),
      email: orgEmail.trim(),
      phone: orgPhone,
      logo_url: logoUrl.trim(),
      billing_address: { 
        street: street.trim(), 
        city: city.trim(), 
        state: state.trim(), 
        zip: zip.trim(), 
        country: country.trim() 
      }
    };

    setIsSubmitting(true);
    try {
      await api.put(`/organizations/${activeOrg?.id}/`, payload);
      setOrgSuccess('Organization profile updated successfully.');
      if (refreshProfile) {
        refreshProfile();
      }
    } catch (err: any) {
      if (err.response && err.response.status === 400 && typeof err.response.data === 'object') {
        const data = err.response.data;
        const fieldErrors: Record<string, string> = {};
        Object.keys(data).forEach((key) => {
          const val = data[key];
          if (key === 'billing_address' && typeof val === 'object') {
            Object.keys(val).forEach((addressKey) => {
              const addressVal = val[addressKey];
              fieldErrors[addressKey] = Array.isArray(addressVal) ? addressVal[0] : addressVal;
            });
          } else {
            fieldErrors[key] = Array.isArray(val) ? val[0] : val;
          }
        });
        setFormErrors(fieldErrors);

        const firstInvalidKey = Object.keys(fieldErrors)[0];
        const el = document.getElementById(`org_${firstInvalidKey}`);
        if (el) el.focus();
        setOrgError('Please correct the highlighted errors.');
      } else {
        setOrgError(err.response?.data?.error || 'Failed to update organization profile.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2FA Actions
  const init2FASetup = async () => {
    setTfaError('');
    try {
      const res = await api.post('/auth/2fa/setup/');
      setQrCodeData(res.data.qr_code);
      setSecretKey(res.data.secret);
      setIsSetupOpen(true);
    } catch (e) {
      setTfaError('Failed to generate 2FA key.');
    }
  };

  const confirm2FAEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setTfaError('');
    
    try {
      const res = await api.post('/auth/2fa/toggle/', {
        enable: true,
        otp_code: otpVerifyCode
      });
      
      setIs2FAEnabled(true);
      setRecoveryCodes(res.data.recovery_codes || []);
      setIsSetupOpen(false);
      setOtpVerifyCode('');
      refreshProfile();
    } catch (err: any) {
      setTfaError(err.response?.data?.non_field_errors?.[0] || 'Invalid verification code.');
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeactivateError('');
    setDeactivateSuccess('');

    if (!deactivateCode.trim()) {
      setDeactivateError('Please enter your 6-digit TOTP code.');
      return;
    }

    try {
      await api.post('/auth/2fa/toggle/', {
        enable: false,
        otp_code: deactivateCode
      });
      
      setIs2FAEnabled(false);
      setRecoveryCodes([]);
      setDeactivateCode('');
      setDeactivateSuccess('Two-factor authentication successfully deactivated.');
      refreshProfile();
      setTimeout(() => {
        setIsDeactivateOpen(false);
        setDeactivateSuccess('');
      }, 1500);
    } catch (err: any) {
      setDeactivateError('Deactivation failed: Invalid TOTP verification code.');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-dark-border pb-6">
        <h2 className="text-2xl font-bold font-display text-white tracking-tight">Workspace Settings</h2>
        <p className="text-slate-400 text-xs mt-1">Configure company profiles, tax structures, and user security permissions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Company Settings Form */}
        <div className="lg:col-span-2 bg-dark-surface/40 border border-dark-border p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-sm font-display text-white mb-6">
            Company Configuration
          </h3>

          {orgSuccess && (
            <div className="mb-4 p-3.5 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl font-medium">
              {orgSuccess}
            </div>
          )}

          {orgError && (
            <div className="mb-4 p-3.5 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded-xl font-medium">
              {orgError}
            </div>
          )}

          <form onSubmit={handleOrgSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5">Company Name</label>
                <input
                  type="text"
                  id="org_name"
                  required
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setFormErrors(prev => ({ ...prev, name: '' }));
                  }}
                  className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all ${
                    formErrors.name ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                  }`}
                />
                {formErrors.name && (
                  <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.name}</span>
                )}
              </div>
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5">GSTIN / Tax Identification</label>
                <input
                  type="text"
                  id="org_tax_number"
                  value={taxNumber}
                  onChange={(e) => {
                    setTaxNumber(e.target.value);
                    setFormErrors(prev => ({ ...prev, tax_number: '' }));
                  }}
                  className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono ${
                    formErrors.tax_number ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                  }`}
                />
                {formErrors.tax_number && (
                  <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.tax_number}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5">Billing Email</label>
                <input
                  type="email"
                  id="org_email"
                  required
                  value={orgEmail}
                  onChange={(e) => {
                    setOrgEmail(e.target.value);
                    setFormErrors(prev => ({ ...prev, email: '' }));
                  }}
                  className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono ${
                    formErrors.email ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                  }`}
                />
                {formErrors.email && (
                  <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.email}</span>
                )}
              </div>
              <div>
                <label className="text-slate-400 font-semibold block mb-1.5">Billing Phone</label>
                <input
                  type="text"
                  id="org_phone"
                  value={orgPhone}
                  onChange={(e) => {
                    setOrgPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    setFormErrors(prev => ({ ...prev, phone: '' }));
                  }}
                  placeholder="9988776655"
                  className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all ${
                    formErrors.phone ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                  }`}
                />
                {formErrors.phone && (
                  <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.phone}</span>
                )}
              </div>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1.5">Corporate Brand Logo URL</label>
              <input
                type="text"
                id="org_logo_url"
                value={logoUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value);
                  setFormErrors(prev => ({ ...prev, logo_url: '' }));
                }}
                className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all ${
                  formErrors.logo_url ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                }`}
                placeholder="https://..."
              />
              {formErrors.logo_url && (
                <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.logo_url}</span>
              )}
            </div>

            {/* Address */}
            <div className="border-t border-dark-border/40 pt-5">
              <h4 className="font-bold text-slate-200 mb-3.5 font-display text-xs">Corporate Address</h4>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1.5">Street Address</label>
                  <input
                    type="text"
                    id="org_street"
                    required
                    value={street}
                    onChange={(e) => {
                      setStreet(e.target.value);
                      setFormErrors(prev => ({ ...prev, street: '' }));
                    }}
                    className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all ${
                      formErrors.street ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                    }`}
                  />
                  {formErrors.street && (
                    <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.street}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1.5">City</label>
                    <input
                      type="text"
                      id="org_city"
                      required
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setFormErrors(prev => ({ ...prev, city: '' }));
                      }}
                      className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all ${
                        formErrors.city ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                      }`}
                    />
                    {formErrors.city && (
                      <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.city}</span>
                    )}
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1.5">State / Region</label>
                    <input
                      type="text"
                      id="org_state"
                      required
                      value={state}
                      onChange={(e) => {
                        setState(e.target.value);
                        setFormErrors(prev => ({ ...prev, state: '' }));
                      }}
                      className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all ${
                        formErrors.state ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                      }`}
                    />
                    {formErrors.state && (
                      <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.state}</span>
                    )}
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1.5">ZIP / Postal Code</label>
                    <input
                      type="text"
                      id="org_zip"
                      required
                      value={zip}
                      onChange={(e) => {
                        setZip(e.target.value);
                        setFormErrors(prev => ({ ...prev, zip: '' }));
                      }}
                      className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono ${
                        formErrors.zip ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                      }`}
                    />
                    {formErrors.zip && (
                      <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.zip}</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1.5">Country</label>
                  <input
                    type="text"
                    id="org_country"
                    required
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setFormErrors(prev => ({ ...prev, country: '' }));
                    }}
                    className={`w-full bg-slate-950 border text-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all ${
                      formErrors.country ? 'border-red-500/80 focus:border-red-500' : 'border-dark-border'
                    }`}
                  />
                  {formErrors.country && (
                    <span className="text-red-500 text-[10px] mt-1 block font-semibold">{formErrors.country}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-5 border-t border-dark-border/40">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security / 2FA Panel */}
        <div className="bg-dark-surface/40 border border-dark-border p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm font-display text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" /> Multi-Factor Auth (2FA)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Protect your enterprise ledger from credential leaks. Toggling 2FA forces users to input 6-digit TOTP key cycles from Google Authenticator / Duo Mobile on logging in.
            </p>

            {is2FAEnabled ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <KeyRound className="w-4 h-4" /> Two-Factor Auth is Active
                </div>
                <button
                  onClick={() => setIsDeactivateOpen(true)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg hover:shadow-red-500/25"
                >
                  Deactivate 2FA
                </button>
              </div>
            ) : (
              <button
                onClick={init2FASetup}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-dark-border font-bold py-3 rounded-xl text-xs transition-all"
              >
                Configure Authenticator App
              </button>
            )}

            {/* Display recovery codes if newly enabled */}
            {recoveryCodes.length > 0 && (
              <div className="mt-6 border-t border-dark-border/40 pt-4 animate-slide-up">
                <h4 className="font-bold text-white text-xs mb-2">Backup Recovery Keys</h4>
                <div className="bg-slate-950 border border-dark-border p-3.5 rounded-xl font-mono text-[10px] text-emerald-400 space-y-1.5">
                  {recoveryCodes.map((code) => (
                    <p key={code}>{code}</p>
                  ))}
                </div>
                <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                  Store these in a safe password manager. If you lose your phone, these are required to bypass locks.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-dark-border/40 pt-4 text-[10px] text-slate-500 font-mono">
            Security policy enforced by JWT token rotate algorithms.
          </div>
        </div>
      </div>

      {/* Team Management */}
      <div className="bg-dark-surface/40 border border-dark-border p-6 rounded-2xl shadow-sm space-y-6">
        <div>
          <h3 className="font-bold text-sm font-display text-white mb-1">
            Workspace Team & Access Control
          </h3>
          <p className="text-slate-400 text-xs">
            Manage user roles, grant permissions, and configure employee access policies.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
          {/* Members List (2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            {activeRole === 'owner' && pendingMembers.length > 0 && (
              <div className="mb-8">
                <h4 className="font-bold text-xs text-amber-400 font-display mb-4">Pending Approvals ({pendingMembers.length})</h4>
                
                {resolveMessage && (
                  <div className={`mb-3 p-3 text-xs rounded-xl font-medium ${resolveMessage.includes('Failed') ? 'bg-red-950/40 border border-red-500/20 text-red-300' : 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-300'}`}>
                    {resolveMessage}
                  </div>
                )}

                <div className="space-y-2.5">
                  {pendingMembers.map((member) => {
                    const isResolving = resolvingMemberId === member.user.id;
                    return (
                      <div key={member.id} className="flex items-center justify-between p-3.5 bg-amber-950/20 border border-amber-500/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 border border-amber-500/30 flex items-center justify-center font-bold font-display text-xs text-amber-300">
                            {member.user.first_name?.[0] || ''}{member.user.last_name?.[0] || ''}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-200 leading-snug">
                              {member.user.first_name} {member.user.last_name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">{member.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] border border-slate-700 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider mr-2">
                            {member.role}
                          </span>
                          <button
                            onClick={() => handleResolveMember(member.user.id, 'approve')}
                            disabled={isResolving}
                            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            {isResolving ? (
                              <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : '✓'} Approve
                          </button>
                          <button
                            onClick={() => handleResolveMember(member.user.id, 'reject')}
                            disabled={isResolving}
                            className="bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 border border-red-500/30 hover:border-red-500/50 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            {isResolving ? (
                              <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : '✕'} Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <h4 className="font-bold text-xs text-slate-300 font-display">Active Workspace Members ({members.length})</h4>
            
            {membersLoading ? (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div key={n} className="h-16 w-full bg-slate-900/50 border border-dark-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {members.map((member) => {
                  const isOwner = member.role === 'owner';
                  const isAdmin = member.role === 'admin';
                  const isManager = member.role === 'manager';
                  const isAccountant = member.role === 'accountant';
                  const isEmployee = member.role === 'employee';
                  
                  let badgeClass = "bg-slate-500/10 text-slate-400 border-slate-500/20";
                  if (isOwner) badgeClass = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                  else if (isAdmin) badgeClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                  else if (isManager) badgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                  else if (isAccountant) badgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                  else if (isEmployee) badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

                  const canManage = activeRole === 'owner' || activeRole === 'admin';
                  const isSelf = member.user.id === user?.id;
                  const canRemove = canManage && !isOwner && !isSelf;

                  return (
                    <div key={member.id} className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-dark-border/60 rounded-xl hover:border-dark-border transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-dark-border flex items-center justify-center font-bold font-display text-xs text-slate-300">
                          {member.user.first_name?.[0] || ''}{member.user.last_name?.[0] || ''}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-200 leading-snug">
                            {member.user.first_name} {member.user.last_name} {isSelf && <span className="text-[10px] text-emerald-400 font-medium font-mono ml-1">(You)</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">{member.user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] border px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${badgeClass}`}>
                          {member.role}
                        </span>

                        {canRemove && (
                          <button
                            onClick={() => handleRemoveMember(member.user.id, member.user.email)}
                            className="p-1.5 hover:bg-red-950/40 text-slate-500 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/10"
                            title="Remove from Workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invite Form (1 column) */}
          <div className="bg-slate-950/40 border border-dark-border p-5 rounded-2xl h-fit space-y-4">
            <h4 className="font-bold text-xs text-slate-300 font-display flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" /> Assign Role / Add Member
            </h4>
            
            {(activeRole === 'owner' || activeRole === 'admin') ? (
              <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
                {inviteSuccess && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 rounded-xl">
                    {inviteSuccess}
                  </div>
                )}
                {inviteError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-300 rounded-xl">
                    {inviteError}
                  </div>
                )}

                <div>
                  <label className="text-slate-400 font-semibold block mb-1.5">User Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-dark-border text-slate-200 py-2 px-3 rounded-lg focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
                    placeholder="colleague@company.com"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1.5">Workspace Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-dark-border text-slate-300 py-2 px-3 rounded-lg focus:outline-none focus:border-emerald-500/60 transition-all"
                  >
                    <option value="viewer">Viewer (Read-only)</option>
                    <option value="employee">Employee (Create draft invoices)</option>
                    <option value="accountant">Accountant (Manage invoices & view reports)</option>
                    <option value="manager">Manager (Manage catalogs & invoices)</option>
                    <option value="admin">Administrator (Manage settings & users)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isInviting}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2"
                >
                  {isInviting ? 'Assigning...' : 'Add / Update Role'}
                </button>
              </form>
            ) : (
              <p className="text-slate-500 text-xs leading-relaxed">
                Only Workspace Owners and Administrators can invite new members or change team roles. Contact your administrator to invite colleagues.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      {isSetupOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-dark-surface border border-dark-border rounded-2xl shadow-2xl p-6 text-center text-xs animate-scale-in">
            <h3 className="font-bold text-base font-display text-white mb-3">
              Enable Two-Factor Authentication
            </h3>
            
            {tfaError && (
              <div className="mb-3.5 p-2 bg-red-950/40 border border-red-500/20 text-red-300 rounded-xl text-center">
                {tfaError}
              </div>
            )}

            <p className="text-slate-400 mb-4 leading-relaxed">
              Scan the QR Code with your Google Authenticator or Duo app, then input the generated 6-digit verification code below.
            </p>

            {qrCodeData && (
              <img 
                src={qrCodeData} 
                alt="2FA provisioning QR Code" 
                className="w-44 h-44 mx-auto rounded-xl bg-white p-2.5 border border-dark-border mb-4 shadow"
              />
            )}

            {secretKey && (
              <div className="mb-4">
                <span className="text-[9px] text-slate-500 uppercase block font-bold tracking-wider mb-1">Manual Secret Key</span>
                <span className="font-mono text-emerald-400 font-bold bg-slate-950 py-1.5 px-3 rounded-lg select-all text-xs border border-dark-border">
                  {secretKey}
                </span>
              </div>
            )}

            <form onSubmit={confirm2FAEnable} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  value={otpVerifyCode}
                  onChange={(e) => setOtpVerifyCode(e.target.value)}
                  className="w-full bg-slate-950 border border-dark-border focus:border-emerald-500/60 text-slate-200 py-2.5 px-3 rounded-xl text-center font-mono font-bold text-sm tracking-widest focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsSetupOpen(false)}
                  className="w-1/2 bg-transparent border border-dark-border hover:bg-slate-900/60 text-slate-300 py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25"
                >
                  Verify Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA Deactivate Modal */}
      {isDeactivateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-dark-surface border border-dark-border rounded-2xl shadow-2xl p-6 text-center text-xs animate-scale-in">
            <h3 className="font-bold text-base font-display text-white mb-3 flex items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-red-500" /> Deactivate 2FA
            </h3>
            
            {deactivateError && (
              <div className="mb-3.5 p-2 bg-red-950/40 border border-red-500/20 text-red-300 rounded-xl text-center">
                {deactivateError}
              </div>
            )}

            {deactivateSuccess && (
              <div className="mb-3.5 p-2 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 rounded-xl text-center">
                {deactivateSuccess}
              </div>
            )}

            <p className="text-slate-400 mb-4 leading-relaxed">
              To deactivate Two-Factor Authentication, please enter your current 6-digit TOTP code to verify your identity.
            </p>

            <form onSubmit={handleDisable2FA} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  value={deactivateCode}
                  onChange={(e) => setDeactivateCode(e.target.value)}
                  className="w-full bg-slate-950 border border-dark-border focus:border-red-500/60 text-slate-200 py-2.5 px-3 rounded-xl text-center font-mono font-bold text-sm tracking-widest focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsDeactivateOpen(false); setDeactivateCode(''); setDeactivateError(''); }}
                  className="w-1/2 bg-transparent border border-dark-border hover:bg-slate-900/60 text-slate-300 py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-red-500/25"
                >
                  Deactivate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
