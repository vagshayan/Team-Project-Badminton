import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401 && error.config.url !== '/api/auth/login') {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          setAdmin(null);
        }
        return Promise.reject(error);
      }
    );

    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get('/api/auth/me')
        .then((res) => {
          if (res.data) {
            setAdmin(res.data);
          } else {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
            setAdmin(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          setAdmin(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = async (username, password) => {
    const res = await axios.post('/api/auth/login', { username, password });
    const { token, admin: adminData } = res.data;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setAdmin(adminData);
    return adminData;
  };

  const loginFromData = (token, adminData) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setAdmin(adminData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, loginFromData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}