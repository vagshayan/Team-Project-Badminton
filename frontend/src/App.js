import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/admin/LoginPage';
import Dashboard from './pages/admin/Dashboard';
import BadmintonPage from './pages/student/BadmintonPage';
import TableTennisPage from './pages/student/TableTennisPage';
import CarromPage from './pages/student/CarromPage';

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', color: '#777', fontFamily: 'Inter, sans-serif', gap: 12 }}>
      <div className="spinner" style={{ width: 28, height: 28 }}></div> Loading...
    </div>
  );
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/badminton" element={<BadmintonPage />} />
          <Route path="/table-tennis" element={<TableTennisPage />} />
          <Route path="/carrom" element={<CarromPage />} />
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;