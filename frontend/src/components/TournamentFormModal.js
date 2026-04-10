import React, { useState } from 'react';

const CATEGORIES = [
  { value: 'singles-men',   label: 'Singles — Men' },
  { value: 'singles-women', label: 'Singles — Women' },
  { value: 'doubles-men',   label: 'Doubles — Men' },
  { value: 'doubles-women', label: 'Doubles — Women' },
  { value: 'mixed-doubles', label: 'Mixed Doubles' },
];

export default function TournamentFormModal({ tournament, onClose, onSubmit, requirePassword }) {
  const currentYear = new Date().getFullYear();
  const todayDate = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    year: tournament?.year || currentYear,
    date: tournament?.date ? new Date(tournament.date).toISOString().split('T')[0] : todayDate,
    time: tournament?.time || '09:00',
    venue: tournament?.venue || '',
    category: tournament?.category || 'singles-men',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const yearOptions = [];
  for (let y = currentYear; y <= currentYear + 5; y++) yearOptions.push(y);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { password, ...rest } = form;
      await onSubmit(requirePassword ? { ...rest, password } : rest);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Check password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={sh.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={sh.card}>
        <div style={sh.header}>
            <div style={sh.badge}>{tournament ? 'ID: ' + tournament._id.slice(-6) : 'NEW TOURNAMENT'}</div>
            <h2 style={sh.title}>{tournament ? 'EDIT TOURNAMENT' : 'CREATE NEW TOURNAMENT'}</h2>
            <p style={sh.subtitle}>Configure the parameters for the upcoming tournament domain.</p>
        </div>

        {error && <div style={sh.errorBox}>⚠ {error}</div>}

        <form onSubmit={handleSubmit} style={sh.form}>
           <div style={sh.grid}>
              <div style={sh.field}>
                 <label style={sh.label}>CHOOSE CATEGORY 🏅</label>
                 <select value={form.category} onChange={(e) => set('category', e.target.value)} style={sh.input}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                 </select>
              </div>
              <div style={sh.field}>
                 <label style={sh.label}>TARGET YEAR 📅</label>
                 <select value={form.year} onChange={(e) => set('year', Number(e.target.value))} style={sh.input}>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
              </div>
           </div>

           <div style={sh.grid}>
              <div style={sh.field}>
                 <label style={sh.label}>EVENT DATE 🗓️</label>
                 <input type="date" value={form.date} min={todayDate} onChange={(e) => set('date', e.target.value)} style={sh.input} required />
              </div>
              <div style={sh.field}>
                 <label style={sh.label}>START TIME 🕐</label>
                 <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} style={sh.input} required />
              </div>
           </div>

           <div style={sh.field}>
              <label style={sh.label}>TOURNAMENT VENUE 📍</label>
              <input type="text" value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. University Main Sports Hall" style={sh.input} required />
           </div>

           {requirePassword && (
              <div style={{ ...sh.field, background: 'rgba(239, 68, 68, 0.05)', padding: 20, borderRadius: 16, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                 <label style={{ ...sh.label, color: '#EF4444' }}>ADMIN PASSWORD 🔑</label>
                 <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Confirm with admin password" style={{ ...sh.input, borderColor: 'rgba(239, 68, 68, 0.2)' }} required />
              </div>
           )}

           <div style={sh.footer}>
              <button type="button" onClick={onClose} style={sh.cancelBtn}>CANCEL</button>
              <button type="submit" disabled={loading} style={sh.submitBtn}>
                {loading ? 'SAVING...' : (tournament ? 'SAVE CHANGES' : 'CREATE TOURNAMENT')}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}

const sh = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 40, padding: 48, width: '100%', maxWidth: 640, boxShadow: 'var(--shadow)', animation: 'fadeIn 0.3s ease' },
  header: { marginBottom: 40 },
  badge: { fontSize: 10, fontWeight: 950, color: 'var(--primary)', background: 'var(--bg-input)', padding: '6px 14px', borderRadius: 8, display: 'inline-block', marginBottom: 12, letterSpacing: 1.5 },
  title: { fontSize: 32, fontWeight: 950, letterSpacing: -1, marginBottom: 8 },
  subtitle: { color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 },
  errorBox: { background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '16px 24px', borderRadius: 16, marginBottom: 30, fontSize: 14, fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)' },
  form: { display: 'flex', flexDirection: 'column', gap: 24 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 1.5 },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '16px 18px', borderRadius: 14, fontSize: 16, outline: 'none', transition: 'border 0.2s', fontFamily: 'var(--font-main)' },
  footer: { display: 'flex', gap: 20, marginTop: 12 },
  cancelBtn: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', padding: '18px', borderRadius: 18, fontWeight: 900, cursor: 'pointer', fontSize: 14 },
  submitBtn: { flex: 2, background: 'var(--primary)', border: 'none', color: '#FFF', padding: '18px', borderRadius: 18, fontWeight: 950, cursor: 'pointer', fontSize: 14, letterSpacing: 0.5, boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.3)' }
};