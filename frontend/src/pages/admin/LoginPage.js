import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const SPORTS = [
  { id: 'badminton', label: 'Badminton', icon: '🏸', color: '#3B82F6', desc: 'Unleash your smash on the court.', path: '/badminton' },
  { id: 'table-tennis', label: 'Table Tennis', icon: '🏓', color: '#8B5CF6', desc: 'Precision and speed in every serve.', path: '/table-tennis' },
  { id: 'carrom', label: 'Carrom', icon: '🎯', color: '#EC4899', desc: 'Master the pockets with strategy.', path: '/carrom' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login, admin } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (admin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [admin, navigate]);

  if (admin) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={sh.container}>
      {/* Background blobs for depth */}
      <div style={{ ...sh.blob, background: 'var(--primary)', top: '-10%', left: '10%', opacity: 0.08 }} />
      <div style={{ ...sh.blob, background: 'var(--secondary)', top: '40%', right: '0%', opacity: 0.08 }} />

      {/* Top Navbar */}
      <nav style={sh.nav} className="mobile-nav">
        <div style={sh.brand} className="mobile-brand">
          <div style={sh.logoCircle} className="mobile-logo">🏆</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 900, fontSize: 22, color: 'var(--text)' }} className="mobile-title-main">UoJ SPORTS</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 3, fontWeight: 800 }} className="mobile-title-sub">TOURNAMENT MANAGER</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 15, alignItems: 'center' }} className="mobile-controls">
          <button onClick={toggleTheme} style={sh.themeBtn} className="mobile-btn">{isDarkMode ? '🌞' : '🌙'}</button>
          <button onClick={() => setShowLogin(!showLogin)} style={sh.adminToggleBtn} className="mobile-btn">{showLogin ? '← PUBLIC HUB' : 'ADMIN ACCESS'}</button>
        </div>
      </nav>

      {/* Main Experience */}
      <main style={sh.mainContent}>
        {!showLogin ? (
          <div style={sh.heroWrapper} className="mobile-padding-x">
            <div style={{ textAlign: 'center', marginBottom: 80 }}>
              <h1 style={sh.heroTitle} className="mobile-title">SELECT YOUR <span style={sh.gradientText}>ZONE</span></h1>
              <p style={sh.heroSub}>Choose your sport and explore the latest tournaments and live result updates.</p>
            </div>

            <div className="responsive-grid-3" style={{ marginTop: 60 }}>
              {SPORTS.map((s) => (
                <div key={s.id} onClick={() => navigate(s.path)} className="sport-card mobile-card" style={{ ...sh.card, '--accent': s.color }}>
                  <div style={sh.cardInner}>
                    <div style={sh.cardIcon}>{s.icon}</div>
                    <h3 style={sh.cardTitle}>{s.label}</h3>
                    <p style={sh.cardDesc}>{s.desc}</p>
                    <div style={{ ...sh.cardBtn, color: s.color }}>GO TO BOARD <span>→</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={sh.loginContainer} className="mobile-padding-x">
             <div style={sh.loginPane} className="mobile-card">
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                  <h2 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12, color: 'var(--text)' }}>Log in</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Enter your tournament manager credentials</p>
                </div>
                {error && <div style={sh.errorBox}>⚠ {error}</div>}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                   <div style={sh.fieldGroup}>
                      <label style={sh.fieldLabel}>USERNAME</label>
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" style={sh.fieldInput} required />
                   </div>
                   <div style={sh.fieldGroup}>
                      <label style={sh.fieldLabel}>PASSWORD</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type={showPass ? "text" : "password"} 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          placeholder="••••••••" 
                          style={sh.fieldInput} 
                          required 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPass(!showPass)} 
                          style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                        >
                          {showPass ? '👁️' : '🔒'}
                        </button>
                      </div>
                   </div>
                   <button type="submit" style={sh.submitBtn} disabled={loading}>{loading ? 'Authenticating...' : 'Sign in to Dashboard'}</button>
                </form>
                <div style={sh.loginFooter}>
                  <Link to="/admin/forgot-password" style={sh.footerLink}>Forgot password?</Link>
                  <span style={{ margin: '0 10px' }}>•</span>
                  New admin? <Link to="/admin/register" style={sh.footerLink}>Register now</Link>
                </div>
             </div>
          </div>
        )}
      </main>

      <footer style={sh.footer}>University of Jaffna © 2026 Admin Portal</footer>

      <style>{`
        .sport-card {
           position: relative; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border);
           border-radius: 32px; padding: 40px; cursor: pointer; transition: all 0.4s cubic-bezier(0.2, 1, 0.3, 1); overflow: hidden;
        }
        .sport-card:hover { transform: translateY(-12px); border-color: var(--accent); box-shadow: var(--shadow); }
      `}</style>
    </div>
  );
}

const sh = {
  container: { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' },
  blob: { position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none' },
  nav: { height: 100, padding: '0 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, position: 'relative' },
  brand: { display: 'flex', alignItems: 'center', gap: 20 },
  logoCircle: { width: 44, height: 44, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' },
  themeBtn: { background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 18, padding: '8px 12px', borderRadius: '12px', cursor: 'pointer' },
  adminToggleBtn: { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 24px', borderRadius: '40px', fontSize: 12, fontWeight: 800, letterSpacing: 1.5, cursor: 'pointer' },
  mainContent: { minHeight: 'calc(100vh - 100px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', position: 'relative', zIndex: 10 },
  heroWrapper: { width: '100%', maxWidth: 1200 },
  heroTitle: { fontSize: 80, fontWeight: 900, letterSpacing: -3, margin: 0, color: 'var(--text)' },
  gradientText: { background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  heroSub: { fontSize: 20, color: 'var(--text-muted)', marginTop: 20, maxWidth: 600, marginInline: 'auto' },
  cardInner: { position: 'relative', zIndex: 1 },
  cardIcon: { fontSize: 60, marginBottom: 24 },
  cardTitle: { fontSize: 28, fontWeight: 900, marginBottom: 8 },
  cardDesc: { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 32 },
  cardBtn: { fontSize: 13, fontWeight: 800, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 10 },
  loginContainer: { width: '100%', maxWidth: 460 },
  loginPane: { background: 'var(--bg-card)', backdropFilter: 'blur(40px)', border: '1px solid var(--border)', borderRadius: '40px', padding: '60px', boxShadow: 'var(--shadow)' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 10 },
  fieldLabel: { fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1.5 },
  fieldInput: { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '16px 20px', borderRadius: '14px', fontSize: 15, outline: 'none' },
  submitBtn: { background: 'var(--primary)', border: 'none', color: '#FFF', padding: '18px', borderRadius: '14px', fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.4)' },
  errorBox: { background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '12px 16px', borderRadius: '12px', fontSize: 13, marginBottom: 30, textAlign: 'center' },
  loginFooter: { textAlign: 'center', marginTop: 32, color: 'var(--text-muted)', fontSize: 14 },
  footerLink: { color: 'var(--primary)', fontWeight: 800, textDecoration: 'none', marginLeft: 5 },
  footer: { padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }
};