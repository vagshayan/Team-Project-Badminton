import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';

const SPORT_OPTIONS = [
  { id: 'badminton', label: 'Badminton', icon: '🏸', color: '#3B82F6' },
  { id: 'table-tennis', label: 'Table Tennis', icon: '🏓', color: '#8B5CF6' },
  { id: 'carrom', label: 'Carrom', icon: '🎯', color: '#EC4899' },
];

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', username: '', password: '', confirmPassword: '', sport: '', securityQuestion: '', securityAnswer: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginFromData } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { name, username, password, confirmPassword, sport, securityQuestion, securityAnswer } = formData;
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (!sport) return setError('Please select your arena domain');
    if (!securityQuestion || !securityAnswer) return setError('Security question and answer are required');

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/register', { name, username, password, sport, securityQuestion, securityAnswer });
      loginFromData(res.data.token, res.data.admin);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Initialization failed. Username might be taken.');
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
        <div style={sh.heroSide}>
           <div style={sh.badge}>OFFICIAL ACCESS</div>
           <h1 style={sh.title}>CREATE YOUR <br/><span style={sh.highlight}>ARENA HUB</span></h1>
           <p style={sh.subtitle}>Initialize your dedicated management dashboard for Badminton, Table Tennis, or Carrom tournaments.</p>
           
           <div style={sh.benefitList}>
              {['Real-time Player Verification', 'Unified Result Boards', 'Automated Seeding Systems'].map(b => (
                 <div key={b} style={sh.benefit}>
                    <span style={sh.check}>✔</span> {b}
                 </div>
              ))}
           </div>
        </div>

        <div style={sh.formSide}>
          <div style={sh.card}>
            {error && <div style={sh.errorBox}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={sh.section}>
                <label style={sh.label}>CHOOSE DOMAIN</label>
                <div style={sh.sportGrid}>
                   {SPORT_OPTIONS.map(s => (
                      <div 
                         key={s.id} 
                         onClick={() => setFormData({ ...formData, sport: s.id })}
                         style={{ 
                            ...sh.sportCard, 
                            borderColor: formData.sport === s.id ? s.color : 'var(--border)',
                            background: formData.sport === s.id ? `${s.color}08` : 'var(--bg-input)'
                         }}
                      >
                         <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                         <div style={{ fontSize: 10, fontWeight: 900, color: formData.sport === s.id ? s.color : 'var(--text-muted)' }}>{s.label.toUpperCase()}</div>
                      </div>
                   ))}
                </div>
              </div>

              <div style={sh.fieldGroup}>
                <div style={sh.field}>
                   <label style={sh.label}>MANAGER NAME</label>
                   <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" style={sh.input} required />
                </div>
                <div style={sh.field}>
                   <label style={sh.label}>USERNAME</label>
                   <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="admin_01" style={sh.input} required />
                </div>
              </div>

              <div style={sh.fieldGroup}>
                <div style={sh.field}>
                   <label style={sh.label}>PASSWORD</label>
                   <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" style={sh.input} required />
                </div>
                <div style={sh.field}>
                   <label style={sh.label}>CONFIRM</label>
                   <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" style={sh.input} required />
                </div>
              </div>

              <div style={sh.field}>
                <label style={sh.label}>SECURITY QUESTION</label>
                <input type="text" name="securityQuestion" value={formData.securityQuestion} onChange={handleChange} placeholder="e.g., What is your favorite sport?" style={sh.input} required />
              </div>

              <div style={sh.field}>
                <label style={sh.label}>SECURITY ANSWER</label>
                <input type="text" name="securityAnswer" value={formData.securityAnswer} onChange={handleChange} placeholder="Your answer" style={sh.input} required />
              </div>

              <button type="submit" style={sh.submitBtn} disabled={loading}>
                {loading ? 'INITIALIZING ARENA...' : 'CREATE DASHBOARD ACCESS'}
              </button>
            </form>

            <p style={sh.footerLinkWrap}>
              Existing Manager? <Link to="/" style={sh.footerLink}>Login here</Link>
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
  content: { display: 'flex', maxWidth: 1200, margin: '0 auto', minHeight: 'calc(100vh - 100px)', alignItems: 'center', padding: '0 60px' },
  heroSide: { flex: 1, paddingRight: 60 },
  formSide: { flex: 1, maxWidth: 500 },
  badge: { fontSize: 11, fontWeight: 950, color: 'var(--primary)', letterSpacing: 2, marginBottom: 20 },
  title: { fontSize: 64, fontWeight: 950, letterSpacing: -2, margin: 0, lineHeight: 1.1 },
  highlight: { background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { fontSize: 18, color: 'var(--text-muted)', marginTop: 24, lineHeight: 1.6 },
  benefitList: { marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 },
  benefit: { display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 15, color: 'var(--text)' },
  check: { color: '#10B981', fontWeight: 950 },
  card: { background: 'var(--bg-card)', backdropFilter: 'blur(40px)', border: '1px solid var(--border)', borderRadius: '44px', padding: '60px', boxShadow: 'var(--shadow)' },
  label: { fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '1.5px', display: 'block', marginBottom: 12 },
  sportGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  sportCard: { padding: '16px', borderRadius: '18px', border: '2px solid transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s cubic-bezier(0.2, 1, 0.3, 1)' },
  fieldGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '14px 18px', borderRadius: '14px', fontSize: '15px', outline: 'none', transition: 'border 0.2s' },
  submitBtn: { background: 'var(--primary)', border: 'none', color: '#FFF', padding: '20px', borderRadius: '16px', fontWeight: 900, fontSize: '14px', letterSpacing: '1px', cursor: 'pointer', marginTop: '10px', boxShadow: '0 12px 25px -5px rgba(59, 130, 246, 0.4)' },
  errorBox: { background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '16px', borderRadius: '16px', fontSize: 13, marginBottom: 32, textAlign: 'center' },
  footerLinkWrap: { textAlign: 'center', marginTop: 32, fontSize: 14, color: 'var(--text-muted)' },
  footerLink: { color: 'var(--primary)', fontWeight: 800, textDecoration: 'none', marginLeft: 5 }
};
