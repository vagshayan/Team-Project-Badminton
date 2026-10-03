import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { EYE, EYE_OFF, CHECK_MARK, CROSS, TROPHY } from '../../components/Icons';
import axios from 'axios';
import { HomeButton, ThemeToggleButton } from '../../components/HeaderControls';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: enter email, 2: verify OTP, 3: reset password, 4: success
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [resending, setResending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validatePassword = (password) => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  });
  const passwordChecks = validatePassword(newPassword);
  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const showPasswordRequirements = isPasswordFocused && newPassword.length > 0 && !passwordValid;
  const showPasswordMatchMessage = isConfirmPasswordFocused && confirmPassword.length > 0;
  const passwordsMatch = showPasswordMatchMessage && newPassword === confirmPassword;

  useEffect(() => {
    if (step !== 2 || !otpExpiresAt) return undefined;
    const updateExpiry = () => setOtpSecondsLeft(Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)));
    updateExpiry();
    const timer = window.setInterval(updateExpiry, 1000);
    return () => window.clearInterval(timer);
  }, [step, otpExpiresAt]);

  const markOtpSent = () => {
    const expiresAt = Date.now() + 10 * 60 * 1000;
    setOtpExpiresAt(expiresAt);
    setOtpSecondsLeft(600);
    setOtp('');
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/auth/forgot-password', { email: email.trim() });
      markOtpSent();
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setResending(true);
    try {
      await axios.post('/api/auth/forgot-password/resend', { email: email.trim() });
      markOtpSent();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to resend verification code');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (otpSecondsLeft <= 0) return setError('This verification code has expired. Please request a new code.');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password/verify-otp', { email: email.trim(), otp: otp.trim() });
      setResetToken(res.data.resetToken);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!passwordValid) return setError('Password does not meet all requirements');
    if (newPassword !== confirmPassword) return setError('Passwords do not match');
    setLoading(true);
    try {
      await axios.post('/api/auth/reset-forgot-password', {
        email: email.trim(),
        resetToken,
        newPassword
      });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={sh.container}>
      <div className="auth-background-blob" style={{ ...sh.blob, background: 'var(--primary)', top: '-10%', left: '10%', opacity: 0.08 }} />
      <div className="auth-background-blob" style={{ ...sh.blob, background: 'var(--accent)', bottom: '-10%', right: '10%', opacity: 0.08 }} />

      <nav style={sh.nav} className="mobile-nav">
        <div style={sh.brand} className="mobile-brand" onClick={() => navigate('/')}>
          <div style={sh.logoCircle} className="mobile-logo">{TROPHY}</div>
          <span style={sh.brandName} className="mobile-title-main">UoJ SPORTS</span>
        </div>
        <div className="app-header-control-group">
          <HomeButton />
          <ThemeToggleButton />
        </div>
      </nav>

      <div style={sh.content} className="mobile-main-content">
        <div style={sh.formSide}>
          <div style={sh.card} className="mobile-card">
            {error && <div style={sh.errorBox}>{error}</div>}

            {step === 1 && (
              <form onSubmit={handleRequestOtp}>
                <h2 style={sh.title}>Forgot Password</h2>
                <p style={sh.subtitle}>Enter your registered email to receive a verification code</p>
                <div style={sh.field}>
                  <label style={sh.label}>REGISTERED EMAIL</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trimStart())}
                    placeholder="Enter your registered email"
                    style={sh.input}
                    autoComplete="email"
                    required
                  />
                </div>
                <button type="submit" style={sh.submitBtn} disabled={loading}>
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp}>
                <h2 style={sh.title}>Verify Your Email</h2>
                <p style={sh.subtitle}>Enter the 6-digit code sent to {email}</p>
                <div style={sh.field}>
                  <label style={sh.label}>VERIFICATION CODE</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    style={sh.input}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                </div>
                <div style={sh.otpMeta}>
                  <span>{otpSecondsLeft > 0 ? `Code expires in ${Math.floor(otpSecondsLeft / 60)}:${String(otpSecondsLeft % 60).padStart(2, '0')}` : 'Code expired'}</span>
                  <button type="button" onClick={handleResendOtp} style={sh.resendBtn} disabled={resending}>
                    {resending ? 'Sending...' : 'Resend code'}
                  </button>
                </div>
                <button type="submit" style={sh.submitBtn} disabled={loading || otp.length !== 6 || otpSecondsLeft <= 0}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleResetPassword}>
                <h2 style={sh.title}>Create New Password</h2>
                <p style={sh.subtitle}>Choose a strong password for your admin account</p>
                <div style={sh.field}>
                  <label style={sh.label}>NEW PASSWORD</label>
                  <div style={sh.passwordInputWrapper}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      placeholder="Enter new password"
                      style={{ ...sh.input, paddingRight: 52 }}
                      autoComplete="new-password"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} style={sh.passwordToggleBtn} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? EYE : EYE_OFF}
                    </button>
                  </div>
                  {showPasswordRequirements && (
                    <div style={sh.passwordReqBox} aria-live="polite">
                      <div style={{ ...sh.requirement, color: passwordChecks.length ? '#10B981' : '#EF4444' }}><span style={sh.reqIcon}>{passwordChecks.length ? CHECK_MARK : CROSS}</span><span>At least 8 characters ({newPassword.length}/8)</span></div>
                      <div style={{ ...sh.requirement, color: passwordChecks.uppercase ? '#10B981' : '#EF4444' }}><span style={sh.reqIcon}>{passwordChecks.uppercase ? CHECK_MARK : CROSS}</span><span>One uppercase letter (A-Z)</span></div>
                      <div style={{ ...sh.requirement, color: passwordChecks.lowercase ? '#10B981' : '#EF4444' }}><span style={sh.reqIcon}>{passwordChecks.lowercase ? CHECK_MARK : CROSS}</span><span>One lowercase letter (a-z)</span></div>
                      <div style={{ ...sh.requirement, color: passwordChecks.number ? '#10B981' : '#EF4444' }}><span style={sh.reqIcon}>{passwordChecks.number ? CHECK_MARK : CROSS}</span><span>One number (0-9)</span></div>
                      <div style={{ ...sh.requirement, color: passwordChecks.special ? '#10B981' : '#EF4444' }}><span style={sh.reqIcon}>{passwordChecks.special ? CHECK_MARK : CROSS}</span><span>One special character (!@#$%^&*)</span></div>
                    </div>
                  )}
                </div>
                <div style={sh.field}>
                  <label style={sh.label}>CONFIRM PASSWORD</label>
                  <div style={sh.passwordInputWrapper}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setIsConfirmPasswordFocused(true)}
                      onBlur={() => setIsConfirmPasswordFocused(false)}
                      placeholder="Confirm new password"
                      style={{ ...sh.input, paddingRight: 52, borderColor: showPasswordMatchMessage ? (passwordsMatch ? '#10B981' : '#EF4444') : 'var(--border)' }}
                      autoComplete="new-password"
                      required
                    />
                    <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} style={sh.passwordToggleBtn} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                      {showConfirmPassword ? EYE : EYE_OFF}
                    </button>
                  </div>
                  {showPasswordMatchMessage && <div style={{ ...sh.passwordHint, color: passwordsMatch ? '#10B981' : '#EF4444' }} aria-live="polite">{passwordsMatch ? <>{CHECK_MARK} Passwords match</> : <>{CROSS} Passwords do not match</>}</div>}
                </div>
                <button type="submit" style={sh.submitBtn} disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}

            {step === 4 && (
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
  content: { display: 'flex', maxWidth: 1200, margin: '0 auto', minHeight: 'calc(100vh - 100px)', alignItems: 'center', justifyContent: 'center', padding: '0 60px' },
  formSide: { flex: 1, maxWidth: 500 },
  card: { background: 'var(--bg-card)', backdropFilter: 'blur(40px)', border: '1px solid var(--border)', borderRadius: '44px', padding: '60px', boxShadow: 'var(--shadow)' },
  errorBox: { background: '#FEE2E2', color: '#DC2626', padding: '12px 16px', borderRadius: '12px', marginBottom: 20, fontSize: 14 },
  successBox: { textAlign: 'center' },
  title: { fontSize: 28, fontWeight: 950, margin: 0, marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'var(--text-muted)', marginBottom: 30 },
  field: { marginBottom: 24 },
  label: { display: 'block', fontSize: 12, fontWeight: 900, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 1 },
  input: { width: '100%', padding: '16px 20px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: 16, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' },
  passwordInputWrapper: { position: 'relative' },
  passwordToggleBtn: { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1 },
  passwordReqBox: { marginTop: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(15, 23, 42, 0.06)', display: 'grid', gap: 6 },
  requirement: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 },
  reqIcon: { width: 16, textAlign: 'center', flexShrink: 0 },
  passwordHint: { marginTop: 8, fontSize: 12, fontWeight: 700 },
  otpMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: 'var(--text-muted)', fontSize: 12, marginTop: -8 },
  resendBtn: { border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: 0 },
  submitBtn: { width: '100%', padding: '16px', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: 'white', border: 'none', borderRadius: '12px', fontSize: 16, fontWeight: 900, cursor: 'pointer', marginTop: 20 },
  footerLinkWrap: { textAlign: 'center', marginTop: 30, fontSize: 14 },
  footerLink: { color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }
};