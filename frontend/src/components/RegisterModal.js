import React, { useState } from 'react';
import axios from 'axios';

const DOUBLES = ['doubles-men', 'doubles-women', 'mixed-doubles'];
const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};

const FACULTIES = [
  'Faculty of Arts', 'Faculty of Agriculture', 'Faculty of Allied Health Sciences',
  'Faculty of Engineering', 'Faculty of Hindu Studies', 'Faculty of Management Studies & Commerce',
  'Faculty of Medicine', 'Faculty of Science', 'Faculty of Performing & Visual Arts', 'Faculty of Technology',
];

const validateRegNo = (val) => /^20\d{2}\/[A-Z]{2,3}\/\d{3}$/.test(val);
const validatePhone = (val) => /^\d{10}$/.test(val);

export default function RegisterModal({ tournament, onClose }) {
  const isDoubles = DOUBLES.includes(tournament.category);
  const sportColor = tournament.sport === 'badminton' ? '#C8A84B' : (tournament.sport === 'table-tennis' ? '#8B5CF6' : '#EC4899');

  const [form, setForm] = useState({ playerName: '', regNo: '', nicNo: '', address: '', email: '', phone: '', faculty: '', partnerName: '', partnerRegNo: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: '' })); };

  const validate = () => {
    const newErrors = {};
    if (!form.playerName.trim()) newErrors.playerName = 'Full name is required';
    if (!form.regNo.trim()) newErrors.regNo = 'Required'; else if (!validateRegNo(form.regNo.trim())) newErrors.regNo = 'Invalid format';
    if (!form.nicNo.trim()) newErrors.nicNo = 'Required';
    if (!form.address.trim()) newErrors.address = 'Required';
    if (!form.email.trim()) newErrors.email = 'Required'; else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Invalid';
    if (!form.phone.trim()) newErrors.phone = 'Required'; else if (!validatePhone(form.phone.trim())) newErrors.phone = '10 digits';
    if (!form.faculty) newErrors.faculty = 'Required';
    if (isDoubles) {
      if (!form.partnerName.trim()) newErrors.partnerName = 'Required';
      if (!form.partnerRegNo.trim()) newErrors.partnerRegNo = 'Required'; else if (!validateRegNo(form.partnerRegNo.trim())) newErrors.partnerRegNo = 'Invalid';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }
    setLoading(true);
    try {
      await axios.post('/api/registrations', {
        tournament: tournament._id, playerName: form.playerName.trim(), rollNumber: form.regNo.trim(),
        nicNo: form.nicNo.trim(), address: form.address.trim(), email: form.email.trim(), phone: form.phone.trim(),
        department: form.faculty, partnerName: form.partnerName.trim(), partnerRollNumber: form.partnerRegNo.trim(),
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div style={sh.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...sh.card, maxWidth: 450, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 72, marginBottom: 24, animation: 'pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>✅</div>
          <h2 style={{ fontSize: 28, fontWeight: 950, color: '#10B981', letterSpacing: -1, marginBottom: 12 }}>VERIFIED!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
             You have successfully registered for:<br/>
             <strong style={{ color: 'var(--text)' }}>{CAT_LABELS[tournament.category]}</strong>
          </p>
          <button onClick={onClose} style={{ ...sh.submitBtn, background: '#10B981', color: '#FFF', width: '100%', borderRadius: 16 }}>DONE</button>
      </div>
      <style>{`
        @keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );

  return (
    <div style={sh.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...sh.card, maxWidth: 650 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 24, fontWeight: 950, color: sportColor, letterSpacing: -0.5 }}>REGISTER FOR TOURNAMENT</h2>
          <button onClick={onClose} style={sh.closeBtn}>✕</button>
        </div>

        <div style={sh.infoBar}>
           <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{CAT_LABELS[tournament.category]} — {tournament.year}</span>
              <span style={{ fontSize: 13, color: 'var(--border)' }}>|</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>📍 {tournament.venue} · 🕐 {tournament.time}</span>
           </div>
        </div>

        {submitError && <div style={sh.errorBox}>⚠ {submitError}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={sh.field}>
            <label style={sh.label}>FULL NAME</label>
            <input type="text" value={form.playerName} onChange={(e) => set('playerName', e.target.value)} placeholder="Full Name" style={sh.input} />
            {errors.playerName && <span style={sh.errMsg}>{errors.playerName}</span>}
          </div>

          <div style={sh.grid}>
            <div style={sh.field}>
              <label style={sh.label}>REGISTRATION NUMBER</label>
              <input type="text" value={form.regNo} onChange={(e) => set('regNo', e.target.value.toUpperCase())} placeholder="2023/CSE/001" style={sh.input} />
              {errors.regNo && <span style={sh.errMsg}>{errors.regNo}</span>}
            </div>
            <div style={sh.field}>
              <label style={sh.label}>NIC NUMBER</label>
              <input type="text" value={form.nicNo} onChange={(e) => set('nicNo', e.target.value)} placeholder="Identity No" style={sh.input} />
              {errors.nicNo && <span style={sh.errMsg}>{errors.nicNo}</span>}
            </div>
          </div>

          <div style={sh.grid}>
            <div style={sh.field}>
              <label style={sh.label}>EMAIL ADDRESS</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" style={sh.input} />
              {errors.email && <span style={sh.errMsg}>{errors.email}</span>}
            </div>
            <div style={sh.field}>
              <label style={sh.label}>PHONE</label>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} placeholder="07XXXXXXXX" style={sh.input} maxLength={10} />
              {errors.phone && <span style={sh.errMsg}>{errors.phone}</span>}
            </div>
          </div>

          <div style={sh.field}>
            <label style={sh.label}>FACULTY / DEPARTMENT</label>
            <select value={form.faculty} onChange={(e) => set('faculty', e.target.value)} style={sh.input}>
              <option value="">Select your faculty</option>
              {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {errors.faculty && <span style={sh.errMsg}>{errors.faculty}</span>}
          </div>

          <div style={sh.field}>
            <label style={sh.label}>HOME ADDRESS</label>
            <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Residential Address" style={sh.input} />
            {errors.address && <span style={sh.errMsg}>{errors.address}</span>}
          </div>

          {isDoubles && (
            <div style={sh.doublesSection}>
              <div style={{ fontSize: 11, fontWeight: 900, color: sportColor, letterSpacing: 2, marginBottom: 16 }}>PARTNER DETAILS (DOUBLES)</div>
              <div style={sh.grid}>
                <div style={sh.field}>
                  <label style={sh.label}>PARTNER NAME</label>
                  <input type="text" value={form.partnerName} onChange={(e) => set('partnerName', e.target.value)} placeholder="Partner full name" style={sh.input} />
                  {errors.partnerName && <span style={sh.errMsg}>{errors.partnerName}</span>}
                </div>
                <div style={sh.field}>
                  <label style={sh.label}>PARTNER REG NO</label>
                  <input type="text" value={form.partnerRegNo} onChange={(e) => set('partnerRegNo', e.target.value.toUpperCase())} placeholder="2023/CSE/002" style={sh.input} />
                  {errors.partnerRegNo && <span style={sh.errMsg}>{errors.partnerRegNo}</span>}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <button type="button" onClick={onClose} style={sh.cancelBtn}>CANCEL</button>
            <button type="submit" disabled={loading} style={{ ...sh.submitBtn, background: sportColor }}>
              {loading ? 'SYNCING...' : 'REGISTER NOW'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const sh = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 32, padding: 50, width: '100%', position: 'relative', boxShadow: 'var(--shadow)', maxHeight: '95vh', overflowY: 'auto' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' },
  infoBar: { background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '16px 20px', borderRadius: 16, marginBottom: 32 },
  errorBox: { background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', color: '#FCA5A5', padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 13, textAlign: 'center' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '16px', borderRadius: 14, fontSize: '14px', outline: 'none' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  doublesSection: { borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 12 },
  errMsg: { fontSize: 10, color: '#EF4444', fontWeight: 700, marginTop: 4 },
  cancelBtn: { flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '16px', borderRadius: 14, fontWeight: 900, cursor: 'pointer' },
  submitBtn: { flex: 2, border: 'none', color: '#000', padding: '16px', borderRadius: 14, fontWeight: 950, fontSize: 14, cursor: 'pointer', letterSpacing: 0.5 }
};