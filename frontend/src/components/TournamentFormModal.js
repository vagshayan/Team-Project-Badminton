import React, { useState, useEffect } from 'react';
import { CALENDAR, CLOSE, WARNING, CLOCK, HOURGLASS, LOCATION, KEY, MEDAL, SCHEDULE, EYE, EYE_OFF } from './Icons';

const CATEGORIES = [
  { value: 'singles-men',   label: 'Singles - Men' },
  { value: 'singles-women', label: 'Singles - Women' },
  { value: 'doubles-men',   label: 'Doubles - Men' },
  { value: 'doubles-women', label: 'Doubles - Women' },
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
    registrationDeadline: tournament?.registrationDeadline ? new Date(tournament.registrationDeadline).toISOString().split('T')[0] : todayDate,
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const yearOptions = [];
  for (let y = currentYear; y <= currentYear + 5; y++) yearOptions.push(y);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (new Date(form.registrationDeadline) > new Date(form.date)) {
      setError('Registration deadline cannot be after the tournament date.');
      return;
    }

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
    <div className="modal-overlay" style={sh.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{
        ...sh.card,
        padding: isMobile ? '30px 20px' : 48,
        borderRadius: isMobile ? 24 : 40,
        margin: isMobile ? '10px' : 0,
      }}>
        <div style={{
          ...sh.header,
          marginBottom: isMobile ? 24 : 40,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
        }}>
          <div style={sh.headerContent}>
            <div style={sh.badge}>{tournament ? 'ID: ' + tournament._id.slice(-6) : 'NEW TOURNAMENT'}</div>
            <h2 style={{
              ...sh.title,
              fontSize: isMobile ? 22 : 32,
            }}>{tournament ? 'EDIT TOURNAMENT' : 'CREATE NEW TOURNAMENT'}</h2>
            <p style={sh.subtitle}>Configure the parameters for the upcoming tournament domain.</p>
          </div>
          <button type="button" onClick={onClose} style={sh.closeBtn}>{CLOSE}</button>
        </div>

        {error && <div style={sh.errorBox}>{WARNING_ROUND} {error}</div>}

        <form onSubmit={handleSubmit} style={sh.form}>
           <div style={{
             ...sh.grid,
             gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
             gap: isMobile ? 16 : 24,
           }}>
              <div style={sh.field}>
                 <label style={sh.label}>CHOOSE CATEGORY {MEDAL}</label>
                 <select value={form.category} onChange={(e) => set('category', e.target.value)} style={sh.input}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                 </select>
              </div>
              <div style={sh.field}>
                 <label style={sh.label}>TARGET YEAR {SCHEDULE}</label>
                 <select value={form.year} onChange={(e) => set('year', Number(e.target.value))} style={sh.input}>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
              </div>
           </div>

            <div style={{
              ...sh.grid,
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: isMobile ? 16 : 24,
            }}>
               <div style={sh.field}>
                  <label style={sh.label}>EVENT DATE {CALENDAR}</label>
                  <input type="date" value={form.date} min={todayDate} onChange={(e) => set('date', e.target.value)} style={sh.input} required />
               </div>
               <div style={sh.field}>
                  <label style={sh.label}>START TIME {CLOCK}</label>
                  <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} style={sh.input} required />
               </div>
            </div>

            <div style={{
              ...sh.grid,
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: isMobile ? 16 : 24,
            }}>
               <div style={sh.field}>
                  <label style={sh.label}>REGISTRATION DEADLINE {HOURGLASS}</label>
                  <input type="date" value={form.registrationDeadline} min={todayDate} max={form.date} onChange={(e) => set('registrationDeadline', e.target.value)} style={sh.input} required />
               </div>
            </div>

           <div style={sh.field}>
              <label style={sh.label}>TOURNAMENT VENUE {LOCATION}</label>
              <input type="text" value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. University Main Sports Hall" style={sh.input} required />
           </div>

           {requirePassword && (
              <div style={{ ...sh.field, background: 'rgba(239, 68, 68, 0.05)', padding: 20, borderRadius: 16, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                 <label style={{ ...sh.label, color: '#EF4444' }}>ADMIN PASSWORD {KEY}</label>
                 <div style={{ position: 'relative' }}>
                   <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Confirm with admin password" style={{ ...sh.input, borderColor: 'rgba(239, 68, 68, 0.2)', paddingRight: 48 }} required />
                   <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide admin password' : 'Show admin password'} title={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>
                     {showPassword ? EYE : EYE_OFF}
                   </button>
                 </div>
              </div>
           )}

           <div style={{
             ...sh.footer,
             flexDirection: isMobile ? 'column-reverse' : 'row',
             gap: isMobile ? 12 : 20,
             marginTop: isMobile ? 8 : 12,
           }}>
              <button type="button" onClick={onClose} style={{ ...sh.cancelBtn, padding: isMobile ? '14px' : '18px' }}>CANCEL</button>
              <button type="submit" disabled={loading} style={{ ...sh.submitBtn, padding: isMobile ? '14px' : '18px' }}>
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
  card: { position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 40, padding: 48, width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxShadow: 'var(--shadow)', animation: 'fadeIn 0.3s ease' },
  header: { marginBottom: 40 },
  headerContent: { flex: 1, minWidth: 0 },
  badge: { fontSize: 10, fontWeight: 950, color: 'var(--primary)', background: 'var(--bg-input)', padding: '6px 14px', borderRadius: 8, display: 'inline-block', marginBottom: 12, letterSpacing: 1.5 },
  title: { fontSize: 32, fontWeight: 950, letterSpacing: -1, marginBottom: 8, marginTop: 0 },
  subtitle: { color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, marginTop: 0 },
  errorBox: { background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '16px 24px', borderRadius: 16, marginBottom: 30, fontSize: 14, fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)' },
  form: { display: 'flex', flexDirection: 'column', gap: 24 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 1.5 },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '16px 18px', borderRadius: 14, fontSize: 16, outline: 'none', transition: 'border 0.2s', fontFamily: 'var(--font-main)' },
  footer: { display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' },
  closeBtn: { position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)', borderRadius: 999, color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 8, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 18px rgba(0,0,0,0.08)' },
  cancelBtn: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', padding: '18px', borderRadius: 18, fontWeight: 900, cursor: 'pointer', fontSize: 14 },
  submitBtn: { flex: 2, background: 'var(--primary)', border: 'none', color: '#FFF', padding: '18px', borderRadius: 18, fontWeight: 950, cursor: 'pointer', fontSize: 14, letterSpacing: 0.5, boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.3)' }
};