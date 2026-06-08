import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { User, Organization } from '../types';

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  activeOrg: Organization | null;
  activeRole: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ twoFactorRequired: boolean; userId?: string }>;
  verify2FA: (userId: string, code: string) => Promise<void>;
  logout: () => void;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Compile user organizations and roles
  const loadUserContext = async (currentUser: User) => {
    try {
      const orgsRes = await api.get('/organizations/');
      const orgList: Organization[] = orgsRes.data.results || orgsRes.data;
      setOrganizations(orgList);
      
      const cachedTenant = localStorage.getItem('tenant_id');
      const matchingOrg = orgList.find((o: Organization) => o.id === cachedTenant) || orgList[0];
      
      if (matchingOrg) {
        localStorage.setItem('tenant_id', matchingOrg.id);
        setActiveOrg(matchingOrg);
        
        // Resolve membership role
        try {
          const membersRes = await api.get(`/organizations/${matchingOrg.id}/members/`);
          const memberList = membersRes.data.results || membersRes.data;
          const currentMember = memberList.find((m: any) => m.user.id === currentUser.id);
          if (currentMember) {
            setActiveRole(currentMember.role);
          }
        } catch {
          // Non-fatal: role will remain null
        }
      }
    } catch (e) {
      console.error("Failed to load user organization contexts", e);
    }
  };

  const refreshProfile = async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        setIsLoading(false);
        return;
      }
      // Validate token and fetch fresh user profile from server
      const res = await api.get('/auth/me/');
      const freshUser: User = res.data;
      setUser(freshUser);
      // Keep localStorage in sync with server data
      localStorage.setItem('user_profile', JSON.stringify(freshUser));
      await loadUserContext(freshUser);
    } catch (e) {
      // Token invalid or expired — clear session
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login/', { email, password });
    if (res.data.two_factor_required) {
      return { twoFactorRequired: true, userId: res.data.user_id };
    }

    const { tokens, user: loggedUser } = res.data;
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    localStorage.setItem('user_profile', JSON.stringify(loggedUser));
    
    setUser(loggedUser);
    await loadUserContext(loggedUser);
    
    return { twoFactorRequired: false };
  };

  const verify2FA = async (userId: string, otp_code: string) => {
    const res = await api.post('/auth/verify-otp/', { user_id: userId, otp_code });
    const { tokens, user: loggedUser } = res.data;
    
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    localStorage.setItem('user_profile', JSON.stringify(loggedUser));
    
    setUser(loggedUser);
    await loadUserContext(loggedUser);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('user_profile');
    setUser(null);
    setOrganizations([]);
    setActiveOrg(null);
    setActiveRole(null);
  };

  const switchOrganization = async (orgId: string) => {
    const selected = organizations.find((o) => o.id === orgId);
    if (selected && user) {
      localStorage.setItem('tenant_id', orgId);
      setActiveOrg(selected);
      
      // Reload Role
      try {
        const membersRes = await api.get(`/organizations/${orgId}/members/`);
        const currentMember = membersRes.data.find((m: any) => m.user.id === user.id);
        if (currentMember) {
          setActiveRole(currentMember.role);
        }
      } catch (e) {
        setActiveRole(null);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeOrg,
        activeRole,
        isLoading,
        login,
        verify2FA,
        logout,
        switchOrganization,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
