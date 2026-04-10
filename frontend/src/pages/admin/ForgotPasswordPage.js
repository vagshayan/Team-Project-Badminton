import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: enter username, 2: answer question, 3: success
  const [username, setUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleGetQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { username: username.trim() });
      setSecurityQuestion(res.data.securityQuestion);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get security question');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('Passwords do not match');
    setLoading(true);
    try {
      await axios.post('/api/auth/reset-forgot-password', {
        username: username.trim(),
        securityAnswer: securityAnswer.trim(),
        newPassword
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={sh.container}>
      <div style={{ ...sh.blob, background: 'var(--primary)', top: '-10%', left: '10%', opacity: 0.08 }} />
      <div style={{ ...sh.blob, background: 'var(--accent)', bottom: '-10%', right: '10%', opacity: 0.08 }} />

      <nav style={sh.nav}>
        <div style={sh.brand} onClick={() => navigate('/')}>
          <div style={sh.logoCircle}>🏆</div>
          <span style={sh.brandName}>UoJ SPORTS</span>
        </div>
        <button onClick={toggleTheme} style={sh.themeBtn}>{isDarkMode ? '🌞' : '🌙'}</button>
      </nav>

      <div style={sh.content}>
        <div style={sh.formSide}>
          <div style={sh.card}>
            {error && <div style={sh.errorBox}>{error}</div>}

            {step === 1 && (
              <form onSubmit={handleGetQuestion}>
                <h2 style={sh.title}>Forgot Password</h2>
                <p style={sh.subtitle}>Enter your username to reset your password</p>
                <div style={sh.field}>
                  <label style={sh.label}>USERNAME</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    style={sh.input}
                    required
                  />
                </div>
                <button type="submit" style={sh.submitBtn} disabled={loading}>
                  {loading ? 'Getting Question...' : 'Continue'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleResetPassword}>
                <h2 style={sh.title}>Security Question</h2>
                <p style={sh.subtitle}>{securityQuestion}</p>
                <div style={sh.field}>
                  <label style={sh.label}>YOUR ANSWER</label>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Enter your answer"
                    style={sh.input}
                    required
                  />
                </div>
                <div style={sh.field}>
                  <label style={sh.label}>NEW PASSWORD</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={sh.input}
                    required
                  />
                </div>
                <div style={sh.field}>
                  <label style={sh.label}>CONFIRM PASSWORD</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    style={sh.input}
                    required
                  />
                </div>
                <button type="submit" style={sh.submitBtn} disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}

            {step === 3 && (
              <div style={sh.successBox}>
                <h2 style={sh.title}>Password Reset Successful!</h2>
                <p style={sh.subtitle}>You can now login with your new password.</p>
                <button onClick={() => navigate('/')} style={sh.submitBtn}>
                  Go to Login
                </button>
              </div>
            )}

            <p style={sh.footerLinkWrap}>
              Remember your password? <Link to="/" style={sh.footerLink}>Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const sh = {
  container: { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' },
  blob: { position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', filter: 'blur(150px)', pointerEvents: 'none' },
  nav: { height: 100, padding: '0 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, position: 'relative' },
  brand: { display: 'flex', alignItems: 'center', gap: 15, cursor: 'pointer' },
  logoCircle: { width: 44, height: 44, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' },
  brandName: { fontWeight: 950, fontSize: 18, letterSpacing: -0.5 },
  themeBtn: { background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 18, padding: '8px 12px', borderRadius: '12px', cursor: 'pointer' },
  content: { display: 'flex', maxWidth: 1200, margin: '0 auto', minHeight: 'calc(100vh - 100px)', alignItems: 'center', justifyContent: 'center', padding: '0 60px' },
  formSide: { flex: 1, maxWidth: 500 },
  card: { background: 'var(--bg-card)', backdropFilter: 'blur(40px)', border: '1px solid var(--border)', borderRadius: '44px', padding: '60px', boxShadow: 'var(--shadow)' },
  errorBox: { background: '#FEE2E2', color: '#DC2626', padding: '12px 16px', borderRadius: '12px', marginBottom: 20, fontSize: 14 },
  successBox: { textAlign: 'center' },
  title: { fontSize: 28, fontWeight: 950, margin: 0, marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'var(--text-muted)', marginBottom: 30 },
  field: { marginBottom: 24 },
  label: { display: 'block', fontSize: 12, fontWeight: 900, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 },
  input: { width: '100%', padding: '16px 20px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: 16, color: 'var(--text)', outline: 'none' },
  submitBtn: { width: '100%', padding: '16px', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: 'white', border: 'none', borderRadius: '12px', fontSize: 16, fontWeight: 900, cursor: 'pointer', marginTop: 20 },
  footerLinkWrap: { textAlign: 'center', marginTop: 30, fontSize: 14 },
  footerLink: { color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }
};