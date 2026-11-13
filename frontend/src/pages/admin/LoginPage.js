import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { EYE, EYE_OFF, WARNING_ROUND } from '../../components/Icons';
import axios from 'axios';
import { SPORTS, getSportMeta } from '../../constants/sports';
import { HomeButton, ThemeToggleButton } from '../../components/HeaderControls';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login, admin } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const sportParam = new URLSearchParams(location.search).get('sport');
  const verificationInvalid = new URLSearchParams(location.search).get('verification') === 'invalid';
  const sportMeta = getSportMeta(sportParam, isDarkMode) || null;
  const pageTitle = sportMeta ? `${sportMeta.label} Admin Login` : 'Admin Login';

  React.useEffect(() => {
    if (admin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [admin, navigate]);

  React.useEffect(() => {
    const verification = new URLSearchParams(location.search).get('verification');
    const deleted = new URLSearchParams(location.search).get('deleted');
    if (verification === 'success') setError('Email verified. You can now log in.');
    if (verification === 'invalid') setError('This verification link is invalid or expired. Enter your registration email below to request a new one.');
    if (deleted === 'success') setSuccessMessage('Your account has been deleted successfully.');
  }, [location.search]);

  if (admin) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
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

  const handleResendVerification = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setResendingVerification(true);
    try {
      const response = await axios.post('/api/auth/resend-verification', { email: resendEmail.trim() });
      setSuccessMessage(response.data?.message || 'If the account is pending verification, a new email will be sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to request a new verification email. Please try again later.');
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <div style={sh.container}>
      <div className="auth-background-blob" style={{ ...sh.blob, background: 'var(--primary)', top: '-10%', left: '10%', opacity: 0.08 }} />
      <div className="auth-background-blob" style={{ ...sh.blob, background: 'var(--secondary)', top: '40%', right: '0%', opacity: 0.08 }} />
      <nav style={sh.nav} className="mobile-nav">
        <Link to="/" aria-label="Go to the landing page" style={{ ...sh.brand, color: 'inherit', textDecoration: 'none' }} className="mobile-brand">
          <div style={sh.brandMark} className="mobile-logo">
            <img src="/logo.png" alt="University of Jaffna logo" />
          </div>
          <div style={sh.brandName}>
            <span style={sh.brandUniversity} className="mobile-title-main">University of Jaffna</span>
            <span style={sh.brandLine} className="mobile-title-sub">Sports Tournament Manager</span>
          </div>
        </Link>
        <div className="app-header-control-group mobile-controls">
          <HomeButton />
          <ThemeToggleButton />
        </div>
      </nav>

      <main style={sh.mainContent} className="mobile-main-content">
        <div style={sh.loginContainer} className="mobile-padding-x">
           <div style={sh.loginPane} className="mobile-card">
              <div style={{ textAlign: 'center', marginBottom: 40 }} className="mobile-header-block">
                <h2 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12, color: 'var(--text)' }} className="mobile-card-title">{pageTitle}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 15 }} className="mobile-card-subtitle">
                  {sportMeta ? `Sign in to manage ${sportMeta.label} tournaments.` : 'Enter your tournament manager credentials.'}
                </p>
              </div>
              {successMessage && <div style={sh.successBox}>{successMessage}</div>}
              {error && <div style={sh.errorBox}>{WARNING_ROUND} {error}</div>}
              {verificationInvalid && (
                <form onSubmit={handleResendVerification} style={sh.resendForm}>
                  <label htmlFor="verification-resend-email" style={sh.fieldLabel}>RESEND VERIFICATION EMAIL</label>
                  <input
                    id="verification-resend-email"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Email address used to register"
                    autoComplete="email"
                    required
                    style={sh.fieldInput}
                  />
                  <button type="submit" style={sh.resendBtn} disabled={resendingVerification}>
                    {resendingVerification ? 'Sending...' : 'Resend verification email'}
                  </button>
                </form>
              )}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="mobile-form">
                 <div style={sh.fieldGroup}>
                    <label style={sh.fieldLabel}>USERNAME</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" style={sh.fieldInput} required />
                 </div>
                 <div style={sh.fieldGroup}>
                    <label style={sh.fieldLabel}>PASSWORD</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPass ? 'text' : 'password'} 
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
                        {showPass ? EYE : EYE_OFF}
                      </button>
                    </div>
                 </div>
                 <button type="submit" style={sh.submitBtn} disabled={loading}>{loading ? 'Authenticating...' : 'Sign in to Dashboard'}</button>
              </form>
              <div style={sh.loginFooter} className="mobile-footer">
                <Link to="/admin/forgot-password" style={sh.footerLink}>Forgot password?</Link>
                <span style={{ margin: '0 10px' }}>•</span>
                New admin? <Link to="/admin/register" style={sh.footerLink}>Register now</Link>
              </div>
           </div>
        </div>
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
  container: { minHeight: '100vh', background: 'transparent', color: 'var(--text)', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' },
  container: { minHeight: '100vh', background: 'transparent', color: 'var(--text)', fontFamily: 'Inter, sans-serif', position: 'relative', overflowX: 'hidden' },
  blob: { position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none' },
  nav: { height: 100, padding: '0 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, position: 'relative' },
  brand: { display: 'flex', alignItems: 'center', gap: 20 },
  brandMark: { width: 54, height: 54, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  brandName: { display: 'flex', flexDirection: 'column', gap: 2, fontWeight: 950 },
  brandUniversity: { color: '#22B8FF', fontSize: 18, lineHeight: 1.1, letterSpacing: 0.2 },
  brandLine: { color: '#FACC15', fontSize: 11, lineHeight: 1.1, fontWeight: 800 },
  backLink: { color: 'var(--primary)', fontWeight: 900, textDecoration: 'none', padding: '10px 18px', borderRadius: '999px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.24)' },
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
  successBox: { background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', padding: '12px 20px', borderRadius: 12, marginBottom: 24, fontSize: 14, fontWeight: 700 },
  resendForm: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--bg-input)' },
  resendBtn: { minHeight: 44, padding: '0 16px', border: '1px solid var(--primary)', borderRadius: 12, background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
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