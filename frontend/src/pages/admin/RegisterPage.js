import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';

const EyeIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
    <path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a14.64 14.64 0 0 1-2.56 3.36" />
    <path d="M6.61 6.61A14.92 14.92 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
  </svg>
);

const SparklesIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 3 1.9 4.1L18 9l-4.1 1.9L12 15l-1.9-4.1L6 9l4.1-1.9L12 3Z" />
    <path d="M19 15l.8 1.8L21.6 18l-1.8.8L19 20.6l-.8-1.8L16.4 18l1.8-.8L19 15Z" />
    <path d="M5 15l.8 1.8L7.6 18l-1.8.8L5 20.6l-.8-1.8L2.4 18l1.8-.8L5 15Z" />
  </svg>
);

const SPORT_OPTIONS = [
  { id: 'badminton', label: 'Badminton', icon: '🏸', color: '#3B82F6' },
  { id: 'table-tennis', label: 'Table Tennis', icon: '🏓', color: '#8B5CF6' },
  { id: 'carrom', label: 'Carrom', icon: '🎯', color: '#EC4899' },
];

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', username: '', password: '', confirmPassword: '', sport: '', securityQuestion: '', securityAnswer: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const { loginFromData } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Password validation - AWS Moderate Policy
  const validatePassword = (pwd) => ({
    length: pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[!@#$%^&*]/.test(pwd),
  });

  const passwordChecks = validatePassword(formData.password);
  const passwordValid = Object.values(passwordChecks).every(check => check);
  const showPasswordRequirements = isPasswordFocused && formData.password.length > 0 && !passwordValid;
  const showPasswordMatchMessage = isConfirmPasswordFocused && formData.confirmPassword.length > 0;
  const passwordsMatch = showPasswordMatchMessage && formData.password === formData.confirmPassword;
  const passwordMatchMessage = !showPasswordMatchMessage ? null : passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  const handlePasswordFocus = () => setIsPasswordFocused(true);
  const handlePasswordBlur = () => setIsPasswordFocused(false);
  const handleConfirmPasswordFocus = () => setIsConfirmPasswordFocused(true);
  const handleConfirmPasswordBlur = () => setIsConfirmPasswordFocused(false);

  const generateStrongPassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = upper + lower + numbers + special;
    const length = Math.floor(Math.random() * 5) + 12;
    const picks = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      special[Math.floor(Math.random() * special.length)],
    ];

    let password = [...picks];
    while (password.length < length) {
      password.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }

    password = password.sort(() => Math.random() - 0.5).join('');
    setFormData(prev => ({ ...prev, password, confirmPassword: password }));
    setIsPasswordFocused(true);
    setIsConfirmPasswordFocused(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { name, username, password, confirmPassword, sport, securityQuestion, securityAnswer } = formData;
    if (!passwordValid) return setError('Password does not meet all requirements');
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
                   <div style={sh.passwordInputWrapper}>
                     <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} onFocus={handlePasswordFocus} onBlur={handlePasswordBlur} placeholder="••••••••" style={{ ...sh.input, paddingRight: 72 }} required />
                     <button type="button" title="Suggest strong password" onClick={generateStrongPassword} style={sh.suggestPasswordBtn} aria-label="Suggest strong password">
                       <SparklesIcon style={sh.suggestPasswordIcon} />
                     </button>
                     <button type="button" onClick={() => setShowPassword(prev => !prev)} style={sh.passwordToggleBtn} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                       {showPassword ? <EyeOffIcon style={sh.passwordIcon} /> : <EyeIcon style={sh.passwordIcon} />}
                     </button>
                   </div>
                   {showPasswordRequirements && (
                     <div style={sh.passwordReqBox} aria-live="polite">
                       <div style={{ ...sh.requirement, color: passwordChecks.length ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.length ? '✓' : '✗'}</span>
                         <span>At least 8 characters ({formData.password.length}/8)</span>
                       </div>
                       <div style={{ ...sh.requirement, color: passwordChecks.uppercase ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.uppercase ? '✓' : '✗'}</span>
                         <span>One uppercase letter (A-Z)</span>
                       </div>
                       <div style={{ ...sh.requirement, color: passwordChecks.lowercase ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.lowercase ? '✓' : '✗'}</span>
                         <span>One lowercase letter (a-z)</span>
                       </div>
                       <div style={{ ...sh.requirement, color: passwordChecks.number ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.number ? '✓' : '✗'}</span>
                         <span>One number (0-9)</span>
                       </div>
                       <div style={{ ...sh.requirement, color: passwordChecks.special ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.special ? '✓' : '✗'}</span>
                         <span>One special character (!@#$%^&*)</span>
                       </div>
                     </div>
                   )}
                </div>
                <div style={sh.field}>
                   <label style={sh.label}>CONFIRM PASSWORD</label>
                   <div style={sh.passwordInputWrapper}>
                     <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} onFocus={handleConfirmPasswordFocus} onBlur={handleConfirmPasswordBlur} placeholder="••••••••" style={{ ...sh.input, paddingRight: 44 }} required />
                     <button type="button" onClick={() => setShowConfirmPassword(prev => !prev)} style={sh.passwordToggleBtn} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                       {showConfirmPassword ? <EyeOffIcon style={sh.passwordIcon} /> : <EyeIcon style={sh.passwordIcon} />}
                     </button>
                   </div>
                   {showPasswordMatchMessage && (
                     <div style={{ ...sh.passwordHint, color: passwordsMatch ? '#10B981' : '#EF4444' }} aria-live="polite">
                       {passwordMatchMessage}
                     </div>
                   )}
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
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '14px 18px', borderRadius: '14px', fontSize: '15px', outline: 'none', transition: 'border 0.2s', width: '100%', boxSizing: 'border-box' },
  submitBtn: { background: 'var(--primary)', border: 'none', color: '#FFF', padding: '20px', borderRadius: '16px', fontWeight: 900, fontSize: '14px', letterSpacing: '1px', cursor: 'pointer', marginTop: '10px', boxShadow: '0 12px 25px -5px rgba(59, 130, 246, 0.4)' },
  errorBox: { background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '16px', borderRadius: '16px', fontSize: 13, marginBottom: 32, textAlign: 'center' },
  footerLinkWrap: { textAlign: 'center', marginTop: 32, fontSize: 14, color: 'var(--text-muted)' },
  footerLink: { color: 'var(--primary)', fontWeight: 800, textDecoration: 'none', marginLeft: 5 },
  passwordInputWrapper: { position: 'relative' },
  passwordToggleBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  suggestPasswordBtn: { position: 'absolute', right: 38, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  suggestPasswordIcon: { width: 14, height: 14 },
  passwordIcon: { width: 18, height: 18 },
  passwordReqBox: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' },
  requirement: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, transition: 'color 0.2s ease' },
  reqIcon: { fontSize: '14px', fontWeight: 900, minWidth: '18px', textAlign: 'center' },
  passwordHint: { marginTop: '8px', fontSize: '13px', fontWeight: 600 }
};
