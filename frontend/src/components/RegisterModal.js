import React, { useState } from 'react';
import axios from 'axios';

const DOUBLES = ['doubles-men', 'doubles-women', 'mixed-doubles'];
const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};

const FACULTIES = [
  'Faculty of Arts',
  'Faculty of Agriculture',
  'Faculty of Allied Health Sciences',
  'Faculty of Engineering',
  'Faculty of Hindu Studies',
  'Faculty of Management Studies & Commerce',
  'Faculty of Medicine',
  'Faculty of Science',
  'Faculty of Performing & Visual Arts',
  'Faculty of Technology',
];

// Reg No validation: 20XX/XXX/XXX or 20XX/XX/XXX
// 20 + 2 digits / 2-3 uppercase letters / 3 digits
const validateRegNo = (val) => {
  return /^20\d{2}\/[A-Z]{2,3}\/\d{3}$/.test(val);
};

const validatePhone = (val) => {
  return /^\d{10}$/.test(val);
};

export default function RegisterModal({ tournament, onClose }) {
  const isDoubles = DOUBLES.includes(tournament.category);

  const [form, setForm] = useState({
    playerName: '',
    regNo: '',
    nicNo: '',
    address: '',
    email: '',
    phone: '',
    faculty: '',
    partnerName: '',
    partnerRegNo: '',
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.playerName.trim()) newErrors.playerName = 'Full name is required';

    if (!form.regNo.trim()) {
      newErrors.regNo = 'Registration number is required';
    } else if (!validateRegNo(form.regNo.trim())) {
      newErrors.regNo = 'Format: 20XX/XXX/XXX or 20XX/XX/XXX (e.g. 2023/CSE/001)';
    }

    if (!form.nicNo.trim()) newErrors.nicNo = 'NIC number is required';

    if (!form.address.trim()) newErrors.address = 'Address is required';

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(form.phone.trim())) {
      newErrors.phone = 'Phone must be exactly 10 digits';
    }

    if (!form.faculty) newErrors.faculty = 'Faculty is required';

    if (isDoubles) {
      if (!form.partnerName.trim()) newErrors.partnerName = 'Partner name is required';
      if (!form.partnerRegNo.trim()) {
        newErrors.partnerRegNo = 'Partner reg no is required';
      } else if (!validateRegNo(form.partnerRegNo.trim())) {
        newErrors.partnerRegNo = 'Format: 20XX/XXX/XXX or 20XX/XX/XXX';
      }
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/registrations', {
        tournament: tournament._id,
        playerName: form.playerName.trim(),
        rollNumber: form.regNo.trim(),
        nicNo: form.nicNo.trim(),
        address: form.address.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.faculty,
        year: 'N/A',
        partnerName: form.partnerName.trim(),
        partnerRollNumber: form.partnerRegNo.trim(),
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 26, color: 'var(--success)', letterSpacing: 2, marginBottom: 10 }}>REGISTERED!</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>Successfully registered for:</p>
        <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>{CAT_LABELS[tournament.category]} — {tournament.year}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>📍 {tournament.venue} · 🕐 {tournament.time}</p>
        <button className="btn btn-primary btn-full" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-title">REGISTER FOR TOURNAMENT</div>

        {/* Tournament info */}
        <div style={{ padding: '10px 14px', background: 'var(--dark3)', borderRadius: 6, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{CAT_LABELS[tournament.category]} — {tournament.year}</span>
          <span>📅 {new Date(tournament.date).toLocaleDateString('en-IN')}</span>
          <span>🕐 {tournament.time}</span>
          <span>📍 {tournament.venue}</span>
        </div>

        {submitError && <div className="alert alert-error">⚠ {submitError}</div>}

        <form onSubmit={handleSubmit}>

          {/* Full Name */}
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={form.playerName}
              onChange={(e) => set('playerName', e.target.value)}
              placeholder="Your full name"
            />
            {errors.playerName && <span style={errStyle}>{errors.playerName}</span>}
          </div>

          {/* Reg No + NIC */}
          <div className="grid-2">
            <div className="form-group">
              <label>Registration Number</label>
              <input
                type="text"
                value={form.regNo}
                onChange={(e) => set('regNo', e.target.value.toUpperCase())}
                placeholder="e.g. 2023/CSE/001"
              />
              {errors.regNo && <span style={errStyle}>{errors.regNo}</span>}
            </div>
            <div className="form-group">
              <label>NIC Number</label>
              <input
                type="text"
                value={form.nicNo}
                onChange={(e) => set('nicNo', e.target.value)}
                placeholder="e.g. 200012345678"
              />
              {errors.nicNo && <span style={errStyle}>{errors.nicNo}</span>}
            </div>
          </div>

          {/* Address */}
          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Your home address"
            />
            {errors.address && <span style={errStyle}>{errors.address}</span>}
          </div>

          {/* Email + Phone */}
          <div className="grid-2">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="your@email.com"
              />
              {errors.email && <span style={errStyle}>{errors.email}</span>}
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit number"
                maxLength={10}
              />
              {errors.phone && <span style={errStyle}>{errors.phone}</span>}
            </div>
          </div>

          {/* Faculty */}
          <div className="form-group">
            <label>Faculty</label>
            <select value={form.faculty} onChange={(e) => set('faculty', e.target.value)}>
              <option value="">Select your faculty</option>
              {FACULTIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            {errors.faculty && <span style={errStyle}>{errors.faculty}</span>}
          </div>

          {/* Partner fields for doubles */}
          {isDoubles && (
            <>
              <div style={{ borderTop: '1px dashed var(--border)', margin: '6px 0 18px', paddingTop: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, marginBottom: 14, letterSpacing: 1 }}>
                  PARTNER DETAILS (DOUBLES)
                </p>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Partner Full Name</label>
                  <input
                    type="text"
                    value={form.partnerName}
                    onChange={(e) => set('partnerName', e.target.value)}
                    placeholder="Partner's full name"
                  />
                  {errors.partnerName && <span style={errStyle}>{errors.partnerName}</span>}
                </div>
                <div className="form-group">
                  <label>Partner Reg Number</label>
                  <input
                    type="text"
                    value={form.partnerRegNo}
                    onChange={(e) => set('partnerRegNo', e.target.value.toUpperCase())}
                    placeholder="e.g. 2023/CSE/002"
                  />
                  {errors.partnerRegNo && <span style={errStyle}>{errors.partnerRegNo}</span>}
                </div>
              </div>
            </>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>CANCEL</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> REGISTERING...</> : 'REGISTER NOW'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const errStyle = {
  display: 'block',
  color: '#FC8181',
  fontSize: 11,
  marginTop: 4,
};