import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginTimestamp, setLoginTimestamp] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);

  const clearAuthState = () => {
    localStorage.removeItem('token');
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
        if (error.response && error.response.status === 401 && error.config.url !== '/api/auth/login') {
          localStorage.removeItem('token');
          localStorage.removeItem('loginTimestamp');
          localStorage.removeItem('loginHistory');
          delete axios.defaults.headers.common['Authorization'];
          setAdmin(null);
          setLoginTimestamp(null);
          setLoginHistory([]);
        }
        return Promise.reject(error);
      }
    );

    const token = localStorage.getItem('token');
    const storedLoginTimestamp = localStorage.getItem('loginTimestamp');
    const storedLoginHistory = localStorage.getItem('loginHistory');

    const authUrl = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/auth/me` : '/api/auth/me';

    const loadCurrentAdmin = async (attempt = 1) => {
      if (!token) {
        setLoading(false);
        return;
      }

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
        if (res.data) {
          setAdmin(res.data);
        } else {
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

        if (error?.response?.status === 401 || error?.response?.status === 403) {
          clearAuthState();
        } else {
          setAdmin(null);
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
    setAdmin(adminData);
    setLoginTimestamp(timestamp);
    return adminData;
  };

  const loginFromData = (token, adminData) => {
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
    setAdmin(adminData);
    setLoginTimestamp(timestamp);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('loginTimestamp');
    localStorage.removeItem('lastActivity');
    delete axios.defaults.headers.common['Authorization'];
    setAdmin(null);
    setLoginTimestamp(null);
  };

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