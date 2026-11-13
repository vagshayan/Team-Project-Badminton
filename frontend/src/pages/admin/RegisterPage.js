import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { EYE, EYE_OFF, LOCK, CHECK_MARK, CROSS, KEY, SHIELD, TROPHY } from '../../components/Icons';
import axios from 'axios';
import { SPORTS as SPORT_OPTIONS, getSportMeta } from '../../constants/sports';
import { HomeButton, ThemeToggleButton } from '../../components/HeaderControls';

const SparklesIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 3 1.9 4.1L18 9l-4.1 1.9L12 15l-1.9-4.1L6 9l4.1-1.9L12 3Z" />
    <path d="M19 15l.8 1.8L21.6 18l-1.8.8L19 20.6l-.8-1.8L16.4 18l1.8-.8L19 15Z" />
    <path d="M5 15l.8 1.8L7.6 18l-1.8.8L5 20.6l-.8-1.8L2.4 18l1.8-.8L5 15Z" />
  </svg>
);

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', username: '', email: '', password: '', confirmPassword: '', sport: '', accessCode: '', securityQuestion: '', securityAnswer: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const [accessCodeStatus, setAccessCodeStatus] = useState('idle');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const { isDarkMode } = useTheme();
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
  const passwordMatchMessage = !showPasswordMatchMessage ? null : passwordsMatch ? <>{CHECK_MARK} Passwords match</> : <>{CROSS} Passwords do not match</>;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'accessCode') {
      setAccessCodeStatus('idle');
    }
  };
  const handlePasswordFocus = () => setIsPasswordFocused(true);
  const handlePasswordBlur = () => setIsPasswordFocused(false);
  const handleConfirmPasswordFocus = () => setIsConfirmPasswordFocused(true);
  const handleConfirmPasswordBlur = () => setIsConfirmPasswordFocused(false);

  const getSecureRandomInt = (max) => {
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj?.getRandomValues) {
      throw new Error('Secure password generation is not available in this browser.');
    }

    const limit = Math.floor(0x100000000 / max) * max;
    const buffer = new Uint32Array(1);

    while (true) {
      cryptoObj.getRandomValues(buffer);
      if (buffer[0] < limit) return buffer[0] % max;
    }
  };

  const shuffleSecure = (values) => {
    const items = [...values];
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = getSecureRandomInt(index + 1);
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  };

  const generateStrongPassword = () => {
    try {
      const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lower = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const special = '!@#$%^&*';
      const allChars = upper + lower + numbers + special;
      const length = getSecureRandomInt(5) + 12;
      const picks = [
        upper[getSecureRandomInt(upper.length)],
        lower[getSecureRandomInt(lower.length)],
        numbers[getSecureRandomInt(numbers.length)],
        special[getSecureRandomInt(special.length)],
      ];

      let password = [...picks];
      while (password.length < length) {
        password.push(allChars[getSecureRandomInt(allChars.length)]);
      }

      password = shuffleSecure(password).join('');
      setFormData(prev => ({ ...prev, password, confirmPassword: password }));
      setIsPasswordFocused(true);
      setIsConfirmPasswordFocused(false);
    } catch {
      setError('Secure password generation is not available in this browser.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { name, username, email, password, confirmPassword, sport, securityQuestion, securityAnswer } = formData;
    if (!passwordValid) return setError('Password does not meet all requirements');
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (!sport) return setError('Please select your arena domain');
    if (!formData.accessCode || !String(formData.accessCode).trim()) return setError('Admin onboarding code is required');
    if (!securityQuestion || !securityAnswer) return setError('Security question and answer are required');

    setLoading(true);
    try {
      await axios.post('/api/auth/register', { name, username, email, password, sport, accessCode: formData.accessCode, securityQuestion, securityAnswer });
      setAccessCodeStatus('verified');
      setVerificationEmail(email.trim());
      setVerificationSent(true);
    } catch (err) {
      if (err.response?.status === 403) {
        setAccessCodeStatus('invalid');
        setError(err.response?.data?.message || 'Access restricted. Admin onboarding code is required.');
      } else {
        setAccessCodeStatus('idle');
        setError(err.response?.data?.message || 'Initialization failed. Username might be taken.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setError('');
    try {
      const res = await axios.post('/api/auth/resend-verification', { email: verificationEmail });
      setError(res.data?.message || 'If the account is pending verification, a new email will be sent.');
    } catch {
      setError('If the account is pending verification, a new email will be sent.');
    }
  };

  return (
    <div style={sh.container}>
      <div className="auth-background-blob" style={{ ...sh.blob, background: 'var(--primary)', top: '-10%', left: '10%', opacity: 0.08 }} />
      <div className="auth-background-blob" style={{ ...sh.blob, background: 'var(--accent)', bottom: '-10%', right: '10%', opacity: 0.08 }} />

      <style>{`
        input[type="password"]::-ms-reveal { display: none; }
        input[type="password"]::-ms-clear { display: none; }
        input[type="password"]::-webkit-reveal-button { display: none; }
        @media (max-width: 900px) {
          .content-container {
            padding: 20px 16px 40px !important;
            gap: 24px !important;
          }
          .register-top-section {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 28px 20px !important;
            gap: 28px !important;
            border-radius: 24px !important;
          }
          .hero-title {
            font-size: 32px !important;
          }
          .benefit-list {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .domain-side {
            max-width: 100% !important;
            width: 100% !important;
          }
          .form-side {
            width: 100% !important;
            max-width: 100% !important;
          }
          .form-card {
            padding: 24px 20px !important;
            border-radius: 24px !important;
            max-height: 82vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch;
          }
          .field-group {
            grid-template-columns: 1fr !important;
          }
          .nav-container {
            padding: 0 20px !important;
          }
          .register-brand {
            gap: 10px !important;
          }
          .register-brand-mark {
            width: 48px !important;
            height: 48px !important;
          }
          .register-brand-university {
            font-size: 17px !important;
          }
          .register-brand-line {
            font-size: 10px !important;
          }
          .sport-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .sport-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 380px) {
          .register-brand-mark {
            width: 40px !important;
            height: 40px !important;
          }
          .register-brand-university {
            font-size: 15px !important;
          }
          .register-brand-line {
            font-size: 9px !important;
          }
        }
      `}</style>

      <nav className="nav-container" style={sh.nav}>
        <div style={sh.brand} className="register-brand" onClick={() => navigate('/')}>
          <div style={sh.brandMark} className="register-brand-mark">
            <img src="/logo.png" alt="University of Jaffna logo" />
          </div>
          <div style={sh.brandName}>
            <span style={sh.brandUniversity} className="register-brand-university">University of Jaffna</span>
            <span style={sh.brandLine} className="register-brand-line">Sports Tournament Manager</span>
          </div>
        </div>
        <div className="app-header-control-group">
          <HomeButton />
          <ThemeToggleButton />
        </div>
      </nav>

      <div className="content-container" style={sh.content}>
        {/* Top Section: OFFICIAL ACCESS and CHOOSE DOMAIN aligned horizontally */}
        <div className="register-top-section" style={sh.topSection}>
          <div className="hero-side" style={sh.heroSideTop}>
             <div style={sh.badge}>OFFICIAL ACCESS</div>
             <h1 className="hero-title" style={sh.title}>CREATE YOUR <br/><span style={sh.highlight}>ARENA HUB</span></h1>
             <p style={sh.subtitle}>Initialize your dedicated management dashboard for Badminton, Table Tennis, or Carrom tournaments.</p>
             
             <div className="benefit-list" style={sh.benefitList}>
                {['Real-time Player Verification', 'Unified Result Boards', 'Automated Seeding Systems'].map(b => (
                   <div key={b} style={sh.benefit}>
                      <span style={sh.check}>{CHECK_MARK}</span> {b}
                   </div>
                ))}
             </div>
          </div>

          <div className="domain-side" style={sh.domainSideTop}>
            <div style={sh.section}>
              <label style={sh.label}>CHOOSE DOMAIN</label>
              <div className="sport-grid" style={sh.sportGrid}>
                 {SPORT_OPTIONS.map(s => {
                    const sMeta = getSportMeta(s.id, isDarkMode);
                    return (
                      <div 
                         key={s.id} 
                         onClick={() => setFormData({ ...formData, sport: s.id })}
                         style={{ 
                            ...sh.sportCard, 
                            borderColor: formData.sport === s.id ? sMeta.color : 'var(--border)',
                            background: formData.sport === s.id ? `${sMeta.color}08` : 'var(--bg-input)'
                         }}
                      >
                         <div style={{ fontSize: 24, marginBottom: 8 }}>{sMeta.icon}</div>
                         <div style={{ fontSize: 10, fontWeight: 900, color: formData.sport === s.id ? sMeta.color : 'var(--text-muted)' }}>{sMeta.label.toUpperCase()}</div>
                      </div>
                    );
                 })}
              </div>
            </div>
          </div>
        </div>

        {/* Main Form Section below */}
        <div className="form-side" style={sh.formSideFull}>
          <div className="form-card" style={sh.card}>
            {error && <div style={sh.errorBox}>{error}</div>}

            {verificationSent && (
              <div style={sh.verificationBox}>
                <h2 style={sh.title}>Verify your email</h2>
                <p style={sh.subtitle}>Your account is pending. Check your email for a verification link before logging in.</p>
                <button type="button" onClick={resendVerification} style={sh.secondaryBtn}>Resend Verification Email</button>
                <p style={sh.smallText}>The verification link expires after 15 minutes.</p>
              </div>
            )}

            {!verificationSent && <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={sh.section}>
                <label style={sh.label}>CHOOSE DOMAIN</label>
                <div className="sport-grid" style={sh.sportGrid}>
                   {SPORT_OPTIONS.map(s => {
                      const sMeta = getSportMeta(s.id, isDarkMode);
                      return (
                        <div 
                           key={s.id} 
                           onClick={() => setFormData({ ...formData, sport: s.id })}
                           style={{ 
                              ...sh.sportCard, 
                              borderColor: formData.sport === s.id ? sMeta.color : 'var(--border)',
                              background: formData.sport === s.id ? `${sMeta.color}08` : 'var(--bg-input)'
                           }}
                        >
                           <div style={{ fontSize: 24, marginBottom: 8 }}>{sMeta.icon}</div>
                           <div style={{ fontSize: 11, fontWeight: 900, color: formData.sport === s.id ? sMeta.color : 'var(--text)', opacity: formData.sport === s.id ? 1 : 0.85 }}>{sMeta.label.toUpperCase()}</div>
                        </div>
                      );
                   })}
                </div>
              </div>

              <div className="field-group" style={sh.fieldGroup}>
                <div style={sh.field}>
                   <label style={sh.label}>MANAGER NAME</label>
                   <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" style={sh.input} autoComplete="name" required />
                </div>
                <div style={sh.field}>
                   <label style={sh.label}>USERNAME</label>
                   <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="admin_01" style={sh.input} autoComplete="off" required />
                </div>
                 <div style={{ ...sh.field, gridColumn: '1 / -1' }}>
                   <label style={sh.label}>EMAIL ADDRESS</label>
                   <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="admin@example.com" style={sh.input} autoComplete="email" required />
                 </div>
              </div>

              <div className="field-group" style={{ ...sh.fieldGroup, gridTemplateColumns: '1fr' }}>
                <div style={sh.field}>
                   <label style={sh.label}>PASSWORD</label>
                   <div style={sh.passwordInputWrapper}>
                     <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} onFocus={handlePasswordFocus} onBlur={handlePasswordBlur} placeholder="••••••••" style={{ ...sh.input, paddingRight: 72 }} autoComplete="new-password" required />
                     <button type="button" title="Generate strong password" onClick={generateStrongPassword} style={sh.suggestPasswordBtn} aria-label="Generate strong password">
                       <SparklesIcon style={sh.suggestPasswordIcon} />
                     </button>
                     <button type="button" onClick={() => setShowPassword(prev => !prev)} style={sh.passwordToggleBtn} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                       {showPassword ? EYE : EYE_OFF}
                     </button>
                   </div>
                   {showPasswordRequirements && (
                     <div style={sh.passwordReqBox} aria-live="polite">
                       <div style={{ ...sh.requirement, color: passwordChecks.length ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.length ? CHECK_MARK : CROSS}</span>
                         <span>At least 8 characters ({formData.password.length}/8)</span>
                       </div>
                       <div style={{ ...sh.requirement, color: passwordChecks.uppercase ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.uppercase ? CHECK_MARK : CROSS}</span>
                         <span>One uppercase letter (A-Z)</span>
                       </div>
                       <div style={{ ...sh.requirement, color: passwordChecks.lowercase ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.lowercase ? CHECK_MARK : CROSS}</span>
                         <span>One lowercase letter (a-z)</span>
                       </div>
                       <div style={{ ...sh.requirement, color: passwordChecks.number ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.number ? CHECK_MARK : CROSS}</span>
                         <span>One number (0-9)</span>
                       </div>
                       <div style={{ ...sh.requirement, color: passwordChecks.special ? '#10B981' : '#EF4444' }}>
                         <span style={sh.reqIcon}>{passwordChecks.special ? CHECK_MARK : CROSS}</span>
                         <span>One special character (!@#$%^&*)</span>
                       </div>
                     </div>
                   )}
                </div>
                <div style={sh.field}>
                   <label style={sh.label}>CONFIRM PASSWORD</label>
                   <div style={sh.passwordInputWrapper}>
                     <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} onFocus={handleConfirmPasswordFocus} onBlur={handleConfirmPasswordBlur} placeholder="••••••••" style={{ ...sh.input, paddingRight: 44 }} autoComplete="new-password" required />
                     <button type="button" onClick={() => setShowConfirmPassword(prev => !prev)} style={sh.passwordToggleBtn} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                       {showConfirmPassword ? EYE : EYE_OFF}
                     </button>
                   </div>
                   {showPasswordMatchMessage && (
                     <div style={{ ...sh.passwordHint, color: passwordsMatch ? '#10B981' : '#EF4444' }} aria-live="polite">
                       {passwordMatchMessage}
                     </div>
                   )}
                </div>
              </div>

              <div style={sh.securitySection}>
                <div style={sh.sectionTitleRow}>
                  <span style={sh.securityIcon}>{SHIELD}</span>
                  <span style={sh.securityTitle}>SECURITY ACCESS</span>
                </div>

                <div style={{ ...sh.securityAccessField, marginTop: 12 }}>
                  <label style={{ ...sh.label, marginBottom: 10 }}>ACCESS CODE</label>
                  <div style={sh.accessCodeWrap}>
                    <span aria-hidden="true" style={sh.accessCodeIcon}>{KEY}</span>
                    <input
                      type={showAccessCode ? 'text' : 'password'}
                      name="accessCode"
                      value={formData.accessCode}
                      onChange={handleChange}
                      placeholder="XXXX-XXXX-XXXX"
                      autoComplete="off"
                      spellCheck="false"
                      inputMode="text"
                      style={{ ...sh.accessCodeInput, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                      required
                    />
                    {showAccessCode ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowAccessCode(false);
                        }}
                        style={sh.accessCodeToggleBtn}
                        aria-label="Hide access code"
                        aria-pressed={true}
                      >
                        {EYE}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowAccessCode(true);
                        }}
                        style={sh.accessCodeToggleBtn}
                        aria-label="Show access code"
                        aria-pressed={false}
                      >
                        {EYE_OFF}
                      </button>
                    )}
                  </div>
                  <div style={{ ...sh.accessCodeHelp, marginTop: 10 }}>Given to you by the platform owner or the manager handing over this facility</div>
                  {accessCodeStatus !== 'idle' && (
                    <div style={{ ...sh.validationRow, ...(accessCodeStatus === 'verified' ? sh.validationRowConfirmed : accessCodeStatus === 'invalid' ? sh.validationRowInvalid : sh.validationRowNeutral) }} aria-live="polite">
                      <span style={sh.validationIcon}>{accessCodeStatus === 'verified' ? CHECK_MARK : accessCodeStatus === 'invalid' ? CROSS : '•'}</span>
                      <span>
                        {accessCodeStatus === 'verified' && 'Code confirmed'}
                        {accessCodeStatus === 'invalid' && 'Code not recognized'}
                      </span>
                    </div>
                  )}
                </div>

                <div style={sh.securityDivider} />

                <div style={{ ...sh.securityQuestionField, marginTop: 24 }}>
                  <label style={{ ...sh.label, marginBottom: 10 }}>SECURITY QUESTION</label>
                  <input type="text" name="securityQuestion" value={formData.securityQuestion} onChange={handleChange} placeholder="e.g., What is your favorite sport?" style={sh.input} required />
                </div>

                <div style={{ ...sh.securityAnswerField, marginTop: 24 }}>
                  <label style={{ ...sh.label, marginBottom: 10 }}>SECURITY ANSWER</label>
                  <input type="text" name="securityAnswer" value={formData.securityAnswer} onChange={handleChange} placeholder="Your answer" style={sh.input} required />
                </div>
              </div>

              <button type="submit" style={sh.submitBtn} disabled={loading}>
                {loading ? 'INITIALIZING ARENA...' : 'CREATE ACCOUNT'}
              </button>
            </form>}

            <p style={sh.footerLinkWrap}>
              Existing Manager? <Link to="/admin/login" style={sh.footerLink}>Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const sh = {
  container: { position: 'relative', width: '100%', minHeight: '100vh', background: 'transparent', color: 'var(--text)', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' },
  blob: { position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', filter: 'blur(150px)', pointerEvents: 'none' },
  nav: { height: 100, padding: '0 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, position: 'relative' },
  brand: { display: 'flex', alignItems: 'center', gap: 15, cursor: 'pointer' },
  brandMark: { width: 54, height: 54, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  brandName: { display: 'flex', flexDirection: 'column', gap: 2, fontWeight: 950 },
  brandUniversity: { color: '#22B8FF', fontSize: 18, lineHeight: 1.1, letterSpacing: 0.2 },
  brandLine: { color: '#FACC15', fontSize: 11, lineHeight: 1.1, fontWeight: 800 },
  logoCircle: { width: 44, height: 44, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' },
  themeBtn: { background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 18, padding: '8px 12px', borderRadius: '12px', cursor: 'pointer' },
  content: { display: 'flex', flexDirection: 'column', maxWidth: 1200, margin: '0 auto', minHeight: 'calc(100vh - 100px)', padding: '20px 60px 80px', gap: 32, position: 'relative', zIndex: 10 },
  topSection: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, background: 'var(--bg-card)', backdropFilter: 'blur(40px)', border: '1px solid var(--border)', borderRadius: '36px', padding: '36px 44px', boxShadow: 'var(--shadow)' },
  heroSideTop: { flex: 1.2 },
  domainSideTop: { flex: 1, maxWidth: 440, width: '100%' },
  formSideFull: { width: '100%' },
  badge: { fontSize: 11, fontWeight: 950, color: 'var(--primary)', letterSpacing: 2, marginBottom: 12 },
  title: { fontSize: 40, fontWeight: 950, letterSpacing: -1, margin: 0, lineHeight: 1.15 },
  highlight: { background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { fontSize: 15, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 },
  benefitList: { marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: '12px 24px' },
  benefit: { display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 14, color: 'var(--text)' },
  check: { color: '#10B981', fontWeight: 950 },
  card: { background: 'var(--bg-card)', backdropFilter: 'blur(40px)', border: '1px solid var(--border)', borderRadius: '36px', padding: '44px 50px', boxShadow: 'var(--shadow)', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' },
  label: { fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '1.5px', display: 'block', marginBottom: 12 },
  sportGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  sportCard: { padding: '16px', borderRadius: '18px', border: '2px solid transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s cubic-bezier(0.2, 1, 0.3, 1)' },
  fieldGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '14px 18px', borderRadius: '14px', fontSize: '15px', outline: 'none', transition: 'border 0.2s', width: '100%', boxSizing: 'border-box' },
  securitySection: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '20px', padding: '20px 20px 8px', marginTop: '2px', opacity: 1, filter: 'none' },
  sectionTitleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  securityIcon: { color: 'var(--text)', fontSize: '15px' },
  securityTitle: { color: 'var(--text)', fontSize: '10px', fontWeight: 900, letterSpacing: '1.6px' },
  securityAccessField: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, opacity: 1 },
  securityQuestionField: { display: 'flex', flexDirection: 'column', gap: 10 },
  securityAnswerField: { display: 'flex', flexDirection: 'column', gap: 10 },
  securityDivider: { height: '1px', width: '100%', background: 'var(--border)', margin: '0 0 10px' },
  accessCodeWrap: { display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', minHeight: '48px', position: 'relative' },
  accessCodeIcon: { paddingLeft: '14px', color: 'var(--text)', fontSize: '16px', display: 'inline-flex', alignItems: 'center', opacity: 1 },
  accessCodeInput: { background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '13px', fontWeight: 800, outline: 'none', width: '100%', padding: '14px 44px 14px 10px', letterSpacing: '0.12em', boxSizing: 'border-box', opacity: 1, filter: 'none' },
  accessCodeToggleBtn: { position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: 'var(--text)', opacity: 1, filter: 'none' },
  accessCodeHelp: { fontSize: '11px', lineHeight: 1.5, color: 'var(--text)' },
  validationRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', marginTop: '10px', fontWeight: 700 },
  validationIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '16px' },
  validationRowNeutral: { color: 'var(--text-muted)' },
  validationRowConfirmed: { color: '#10B981' },
  validationRowInvalid: { color: '#EF4444' },
  submitBtn: { background: 'var(--primary)', border: 'none', color: '#FFF', padding: '20px', borderRadius: '16px', fontWeight: 900, fontSize: '14px', letterSpacing: '1px', cursor: 'pointer', marginTop: '10px', boxShadow: '0 12px 25px -5px rgba(59, 130, 246, 0.4)' },
  verificationBox: { textAlign: 'center', padding: '24px 0' },
  secondaryBtn: { background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '14px 18px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' },
  smallText: { color: 'var(--text-muted)', fontSize: 12, marginTop: 18 },
  errorBox: { background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '16px', borderRadius: '16px', fontSize: 13, marginBottom: 32, textAlign: 'center' },
  footerLinkWrap: { textAlign: 'center', marginTop: 32, fontSize: 14, color: 'var(--text-muted)' },
  footerLink: { color: 'var(--primary)', fontWeight: 800, textDecoration: 'none', marginLeft: 5 },
  passwordInputWrapper: { position: 'relative' },
  passwordToggleBtn: { position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  suggestPasswordBtn: { position: 'absolute', right: 45, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  suggestPasswordIcon: { width: 14, height: 14 },
  passwordReqBox: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' },
  requirement: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, transition: 'color 0.2s ease' },
  reqIcon: { fontSize: '14px', fontWeight: 900, minWidth: '18px', textAlign: 'center' },
  passwordHint: { marginTop: '8px', fontSize: '13px', fontWeight: 600 }
};
