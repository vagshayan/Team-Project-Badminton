import React, { useState } from 'react';

export default function PasswordConfirmModal({ title, message, confirmLabel = 'CONFIRM', danger = false, onConfirm, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try { await onConfirm(password); }
    catch (err) { setError(err.response?.data?.message || 'Verification Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" style={sh.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={sh.card}>
        <div style={sh.badge}>{danger ? 'DANGER ZONE 🛡️' : 'VERIFICATION 🔑'}</div>
        <h2 style={{ ...sh.title, color: danger ? '#EF4444' : 'var(--primary)' }}>{title}</h2>
        <p style={sh.subtitle}>{message}</p>
        
        {error && <div style={sh.errorBox}>⚠ {error}</div>}

        <form onSubmit={handleSubmit} style={sh.form}>
           <div style={sh.field}>
              <label style={sh.label}>ADMIN PASSWORD</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Type password here..." style={sh.input} autoFocus required />
           </div>

           <div style={sh.footer}>
              <button type="button" onClick={onClose} style={sh.cancelBtn}>CANCEL</button>
              <button type="submit" disabled={loading} style={{ ...sh.submitBtn, background: danger ? '#EF4444' : 'var(--primary)', color: '#FFF' }}>
                {loading ? 'SYNCING...' : confirmLabel}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}

const sh = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 36, padding: 48, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow)', animation: 'fadeIn 0.2s ease-out' },
  badge: { fontSize: 10, fontWeight: 950, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '6px 14px', borderRadius: 8, display: 'inline-block', marginBottom: 16, letterSpacing: 1.5 },
  title: { fontSize: 32, fontWeight: 950, letterSpacing: -1.5, marginBottom: 12 },
  subtitle: { color: 'var(--text-muted)', fontSize: 15, fontWeight: 500, lineHeight: 1.5, marginBottom: 30 },
  errorBox: { background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '12px 20px', borderRadius: 12, marginBottom: 24, fontSize: 14, fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column', gap: 24 },
  field: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 11, fontWeight: 950, color: 'var(--text-muted)', letterSpacing: 1 },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '16px', borderRadius: 14, fontSize: 16, outline: 'none' },
  footer: { display: 'flex', gap: 16, marginTop: 8 },
  cancelBtn: { flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '16px', borderRadius: 16, fontWeight: 900, cursor: 'pointer' },
  submitBtn: { flex: 2, border: 'none', padding: '16px', borderRadius: 16, fontWeight: 950, cursor: 'pointer', letterSpacing: 1 }
};