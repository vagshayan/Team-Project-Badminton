import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, admin } = useAuth();
  const navigate = useNavigate();

  if (admin) { navigate('/admin/dashboard', { replace: true }); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.left}>
        <div style={S.brandWrap}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🏆</div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 52, fontWeight: 700, color: 'var(--primary)', letterSpacing: 10, lineHeight: 1 }}>SPORTS</h1>
          <p style={{ fontFamily: 'var(--font-d)', fontSize: 13, color: 'var(--text-muted)', letterSpacing: 5, marginTop: 8 }}>TOURNAMENT MANAGER</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          {[
            { icon: '🏸', name: 'Badminton', path: '/badminton', color: '#C8A84B' },
            { icon: '🏓', name: 'Table Tennis', path: '/table-tennis', color: '#4B9CC8' },
            { icon: '🎯', name: 'Carrom', path: '/carrom', color: '#C84B8A' },
          ].map((s) => (
            <a key={s.name} href={s.path} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderLeft: `3px solid ${s.color}`, background: 'rgba(255,255,255,0.02)', borderRadius: '0 6px 6px 0', textDecoration: 'none' }}>
              <span style={{ fontSize: 24 }}>{s.icon}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-d)', fontSize: 17, fontWeight: 600, letterSpacing: 2, color: s.color }}>{s.name.toUpperCase()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>View Tournaments →</div>
              </div>
            </a>
          ))}
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', marginTop: 'auto' }}>
          Student? Use the links above to view & register for tournaments.
        </p>
      </div>

      <div style={S.right}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 38, fontWeight: 700, color: 'var(--primary)', letterSpacing: 4, marginBottom: 6 }}>ADMIN LOGIN</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 32 }}>Sign in to manage your sport's tournaments</p>
          {error && <div className="alert alert-error">⚠ {error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter admin username" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
            </div>
            <button type="submit" className="btn btn-primary btn-full" style={{ padding: '13px', fontSize: '15px', marginTop: 8 }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }}></span> SIGNING IN...</> : 'LOGIN HERE'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: 'var(--text-dim)' }}>
            Forgot password? Ask the system admin to reset via Postman.
          </p>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { display: 'flex', minHeight: '100vh', background: 'var(--dark)' },
  left: { width: '44%', background: 'linear-gradient(160deg, #0f0f00 0%, #0A0A0A 60%)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 44px', gap: 40 },
  brandWrap: { textAlign: 'center' },
  right: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' },
};