import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

interface JWTPayload {
  exp: number;
  user_id?: string;
  [key: string]: any;
}

function parseJwt(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  
  // Proactively refresh if the token expires within the next 10 seconds (buffer)
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp - currentTime < 10;
}

// Shared promise for token refresh to avoid concurrent duplicate requests
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    handleLogoutRedirect();
    return null;
  }

  try {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const response = await axios.post(`${baseURL}/auth/token/refresh/`, {
      refresh: refreshToken,
    });
    const newAccessToken = response.data.access;
    const newRefreshToken = response.data.refresh;

    localStorage.setItem('access_token', newAccessToken);
    if (newRefreshToken) {
      localStorage.setItem('refresh_token', newRefreshToken);
    }
    return newAccessToken;
  } catch (error) {
    handleLogoutRedirect();
    return null;
  }
};

// Request Interceptor: Attach Auth and Tenant Headers (Proactive Refresh)
api.interceptors.request.use(
  async (config) => {
    // Skip token refresh check forauth routes to prevent loops
    if (
      config.url?.includes('/auth/token/refresh/') ||
      config.url?.includes('/auth/login/') ||
      config.url?.includes('/auth/register/')
    ) {
      return config;
    }

    let accessToken = localStorage.getItem('access_token');

    if (accessToken && isTokenExpired(accessToken)) {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      
      const newAccessToken = await refreshPromise;
      if (newAccessToken) {
        accessToken = newAccessToken;
      } else {
        return Promise.reject(new axios.Cancel('Token refresh failed. Redirecting...'));
      }
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    const tenantId = localStorage.getItem('tenant_id');
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Fallback Token Rotation for edge cases
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Ignore refresh token errors to prevent infinite loops
    if (originalRequest.url?.includes('/auth/token/refresh/')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        
        const newAccessToken = await refreshPromise;
        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        handleLogoutRedirect();
        return Promise.reject(refreshError);
      }
      
      handleLogoutRedirect();
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

function handleLogoutRedirect() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('tenant_id');
  if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    window.location.href = '/login';
  }
}

export default api;
