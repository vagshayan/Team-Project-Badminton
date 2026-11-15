import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const TOKEN_STORAGE_KEY = 'token';
const ADMIN_STORAGE_KEY = 'adminData';
const adminDataKeyForToken = (token) => `${ADMIN_STORAGE_KEY}:${token}`;

// Accept partial cached admin objects (at minimum a username or name)
const isValidAdminData = (data) => {
  if (!data || typeof data !== 'object') return false;
  const hasUsername = typeof data.username === 'string' && data.username.trim();
  const hasName = typeof data.name === 'string' && data.name.trim();
  // sport is optional for a cached profile; prefer having at least one identifier
  return hasUsername || hasName;
};

const normalizeAdminData = (data) => {
  if (!data || typeof data !== 'object') return { username: '', name: '', sport: '' };
  return {
    username: typeof data.username === 'string' ? data.username.trim() : (data.username || ''),
    name: typeof data.name === 'string' ? data.name.trim() : (data.name || ''),
    sport: typeof data.sport === 'string' ? data.sport.trim().toLowerCase() : (data.sport || ''),
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl.trim() : (data.avatarUrl || ''),
    // keep any other fields intact
    ...data,
  };
};

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) return null;
      const cachedAdmin = localStorage.getItem(adminDataKeyForToken(token));
      const parsedAdmin = cachedAdmin ? JSON.parse(cachedAdmin) : null;
      return isValidAdminData(parsedAdmin) ? normalizeAdminData(parsedAdmin) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [loginTimestamp, setLoginTimestamp] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);

  const clearAuthState = () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    if (token) {
      localStorage.removeItem(adminDataKeyForToken(token));
    }
    localStorage.removeItem('loginTimestamp');
    localStorage.removeItem('loginHistory');
    localStorage.removeItem('lastActivity');
    delete axios.defaults.headers.common['Authorization'];
    setAdmin(null);
    setLoginTimestamp(null);
    setLoginHistory([]);
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        try {
          const status = error?.response?.status;
          const url = error?.config?.url || '';
          const isLogin = url.includes('/api/auth/login');
          const isAuthMe = url.includes('/api/auth/me');
          // Only clear auth for 401s that are NOT from login or the /me probe.
          if (status === 401 && !isLogin && !isAuthMe) {
            clearAuthState();
          }
        } catch (e) {
          // noop
        }
        return Promise.reject(error);
      }
    );

    const token = localStorage.getItem('token');
    const storedLoginTimestamp = localStorage.getItem('loginTimestamp');
    const storedLoginHistory = localStorage.getItem('loginHistory');

    const apiBaseUrl = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.startsWith('http')
      ? process.env.REACT_APP_API_URL
      : (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
        ? 'http://localhost:5000'
        : '');

    const authUrl = apiBaseUrl
      ? `${apiBaseUrl}/api/auth/me`
      : '/api/auth/me';

    if (apiBaseUrl) {
      axios.defaults.baseURL = apiBaseUrl;
    }

    const loadCurrentAdmin = async (attempt = 1) => {
      if (!token) {
        setLoading(false);
        return;
      }

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      if (apiBaseUrl) {
        axios.defaults.baseURL = apiBaseUrl;
      }
      if (storedLoginTimestamp) setLoginTimestamp(storedLoginTimestamp);
      if (storedLoginHistory) {
        try {
          const parsedHistory = JSON.parse(storedLoginHistory);
          if (Array.isArray(parsedHistory)) {
            setLoginHistory(parsedHistory);
          }
        } catch (err) {
          setLoginHistory([]);
        }
      } else if (storedLoginTimestamp) {
        const initialHistory = [storedLoginTimestamp];
        setLoginHistory(initialHistory);
        localStorage.setItem('loginHistory', JSON.stringify(initialHistory));
      }

      try {
        const res = await axios.get(authUrl, { timeout: 3000 });
        const cachedRaw = localStorage.getItem(adminDataKeyForToken(token));
        const cachedAdmin = cachedRaw ? JSON.parse(cachedRaw) : null;
        if (res && res.data) {
          const serverAdmin = normalizeAdminData(res.data);
          // If server returned an empty name but we have a cached name, preserve it.
          if ((!serverAdmin.name || serverAdmin.name.trim() === '') && cachedAdmin && cachedAdmin.name) {
            serverAdmin.name = String(cachedAdmin.name).trim();
          }
          setAdmin(serverAdmin);
          localStorage.setItem(adminDataKeyForToken(token), JSON.stringify(serverAdmin));
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(serverAdmin));
        } else {
          // If /me returned null, clear state.
          clearAuthState();
        }
      } catch (error) {
        const isTransient = !error?.response || error?.code === 'ECONNREFUSED' || error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error');

        if (isTransient && attempt < 3) {
          window.setTimeout(() => {
            loadCurrentAdmin(attempt + 1);
          }, 500 * attempt);
          return;
        }
        const status = error?.response?.status;
        const url = error?.config?.url || '';
        const isAuthMe = url.includes('/api/auth/me');

        if ((status === 401 || status === 403) && !isAuthMe) {
          clearAuthState();
        } else {
          // For /api/auth/me errors or other non-401 failures, preserve cached admin data
          // only if it belongs to the current token.
          const cachedRaw = localStorage.getItem(adminDataKeyForToken(token));
          const cachedAdmin = cachedRaw ? JSON.parse(cachedRaw) : null;
          if (cachedAdmin && isValidAdminData(cachedAdmin)) {
            setAdmin(normalizeAdminData(cachedAdmin));
          } else if (!admin) {
            setAdmin(null);
          }
          setLoginTimestamp(null);
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadCurrentAdmin();
    } else {
      setLoading(false);
    }

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = async (username, password) => {
    const res = await axios.post('/api/auth/login', { username, password });
    const { token, admin: adminData } = res.data;
    let normalizedAdmin = normalizeAdminData(adminData);
    const timestamp = new Date().toISOString();
    localStorage.setItem('token', token);
    localStorage.setItem('loginTimestamp', timestamp);
    localStorage.setItem('lastActivity', Date.now().toString());
    setLoginHistory((prev) => {
      const next = [timestamp, ...prev];
      localStorage.setItem('loginHistory', JSON.stringify(next));
      return next;
    });
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    if (!normalizedAdmin.email) {
      try {
        const profileResponse = await axios.get('/api/auth/me', { timeout: 3000 });
        if (profileResponse.data) {
          normalizedAdmin = normalizeAdminData({ ...normalizedAdmin, ...profileResponse.data });
        }
      } catch (error) {
        console.error('Unable to load the admin profile after login:', error);
      }
    }

    localStorage.setItem(adminDataKeyForToken(token), JSON.stringify(normalizedAdmin));
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(normalizedAdmin));
    setAdmin(normalizedAdmin);
    setLoginTimestamp(timestamp);
    return normalizedAdmin;
  };

  const loginFromData = (token, adminData) => {
    const normalizedAdmin = normalizeAdminData(adminData);
    const timestamp = new Date().toISOString();
    localStorage.setItem('token', token);
    localStorage.setItem(adminDataKeyForToken(token), JSON.stringify(normalizedAdmin));
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(normalizedAdmin));
    localStorage.setItem('loginTimestamp', timestamp);
    localStorage.setItem('lastActivity', Date.now().toString());
    setLoginHistory((prev) => {
      const next = [timestamp, ...prev];
      localStorage.setItem('loginHistory', JSON.stringify(next));
      return next;
    });
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setAdmin(normalizedAdmin);
    setLoginTimestamp(timestamp);
  };

  const logout = () => {
    clearAuthState();
  };

  useEffect(() => {
    if (admin) {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) {
        localStorage.setItem(adminDataKeyForToken(token), JSON.stringify(normalizeAdminData(admin)));
      }
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(normalizeAdminData(admin)));
    } else {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) {
        localStorage.removeItem(adminDataKeyForToken(token));
      }
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  }, [admin]);

  useEffect(() => {
    if (!admin) return;

    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const CHECK_INTERVAL_MS = 10 * 1000; // 10 seconds

    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    if (!localStorage.getItem('lastActivity')) {
      updateActivity();
    }

    const handleActivity = () => {
      updateActivity();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed >= TIMEOUT_MS) {
          logout();
          alert('Your session has expired due to inactivity. Please login again.');
        }
      }
    };

    const interval = setInterval(checkInactivity, CHECK_INTERVAL_MS);

    // Initial check on mount
    checkInactivity();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(interval);
    };
  }, [admin]);

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, loginFromData, loginTimestamp, loginHistory, setAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}