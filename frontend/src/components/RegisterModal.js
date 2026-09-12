import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { SPORT_META, getSportMeta } from '../constants/sports';
import { CLOSE, LOCATION, CLOCK, WARNING, SUCCESS } from './Icons';

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

const NAME_REGEX = /^(?!.* {2})[A-Za-z.]+(?: [A-Za-z.]+)*$/;
const ADDRESS_REGEX = /^(?!.* {2})[A-Za-z0-9.,/ \-]+$/;
const REG_NO_REGEX = /^20\d{2}\/[A-Z]{2,3}\/\d{3}$/;
const OLD_NIC_REGEX = /^9\d{8}v$/;
const NEW_NIC_REGEX = /^20\d{10}$/;
const PHONE_REGEX = /^07\d{8}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const formatNameInput = (value) => {
  const cleaned = value.replace(/[^A-Za-z. ]+/g, '').replace(/ {2,}/g, ' ');
  return cleaned
    .split(' ')
    .map((segment) =>
      segment
        .split('.')
        .map((part) => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '')
        .join('.')
    )
    .join(' ');
};

const formatAddressInput = (value) => {
  const cleaned = value.replace(/[^A-Za-z0-9.,/ \-]+/g, '').replace(/ {2,}/g, ' ');
  return cleaned
    .split('')
    .map((char, index, arr) => {
      if (index === 0) return char.toUpperCase();
      const prev = arr[index - 1];
      if (/[ .,/\-]/.test(prev) && /[a-zA-Z]/.test(char)) return char.toUpperCase();
      return char;
    })
    .join('');
};

const sanitizeRegNo = (value) => value.toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-Z\/]/g, '');
const sanitizeNIC = (value) => value.replace(/\s+/g, '').replace(/[^0-9vV]/g, '').replace(/V/g, 'v');
const sanitizePhone = (value) => value.replace(/\D/g, '').slice(0, 10);

const validateRegNo = (val) => REG_NO_REGEX.test(val);
const validatePhone = (val) => PHONE_REGEX.test(val);
const validateName = (val) => NAME_REGEX.test(val);
const validateAddress = (val) => ADDRESS_REGEX.test(val);
const validateNIC = (val) => OLD_NIC_REGEX.test(val) || NEW_NIC_REGEX.test(val);
const validateEmail = (val) => EMAIL_REGEX.test(val);

const isCategoryCompatible = (category, playerGender, partnerGender) => {
  const player = String(playerGender || '').trim();
  const partner = String(partnerGender || '').trim();

  if (category === 'mixed-doubles') {
    return (player === 'Male' && partner === 'Female') || (player === 'Female' && partner === 'Male');
  }
  if (category === 'doubles-men') {
    return (!player || player === 'Male') && (!partner || partner === 'Male');
  }
  if (category === 'doubles-women') {
    return (!player || player === 'Female') && (!partner || partner === 'Female');
  }
  return false;
};

const validateField = (field, value) => {
  const val = String(value).trim();
  if (!val) return '';

  switch (field) {
    case 'playerName':
    case 'partnerName':
      return validateName(val) ? '' : 'Use letters, dots and single spaces only';
    case 'regNo':
    case 'partnerRegNo':
      return validateRegNo(val) ? '' : 'Use 20XX/XX/XXX or 20XX/XXX/XXX';
    case 'nicNo':
      return validateNIC(val) ? '' : 'Enter valid old NIC (991234567v) or new NIC (200012345678)';
    case 'address':
      return validateAddress(val) ? '' : 'Invalid characters in address';
    case 'email':
      return validateEmail(val) ? '' : 'Enter a valid email address';
    case 'phone':
      return validatePhone(val) ? '' : 'Phone must start with 07 and be 10 digits';
    default:
      return '';
  }
};

export default function RegisterModal({ tournament, onClose, initialData = null }) {
  const { isDarkMode } = useTheme();
  const isDoubles = DOUBLES.includes(tournament.category);
  const isMixedDoubles = tournament.category === 'mixed-doubles';
  const sport = getSportMeta(tournament.sport, isDarkMode) || { label: tournament.sport, icon: '', tint: '#2563EB' };
  const sportColor = sport.color || SPORT_META[tournament.sport]?.color || '#000';

  const [form, setForm] = useState({
    playerName: initialData ? initialData.playerName : '',
    regNo: initialData ? initialData.rollNumber : '',
    nicNo: initialData ? initialData.nicNo : '',
    address: initialData ? initialData.address : '',
    email: initialData ? initialData.email : '',
    phone: initialData ? initialData.phone : '',
    faculty: initialData ? (initialData.department || '') : '',
    gender: initialData ? (initialData.gender || '') : '',
    partnerName: initialData ? (initialData.partnerName || '') : '',
    partnerRegNo: initialData ? (initialData.partnerRollNumber || '') : ''
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [partnerLookup, setPartnerLookup] = useState(null);
  const [partnerLookupError, setPartnerLookupError] = useState('');
  const [partnerLookupLoading, setPartnerLookupLoading] = useState(false);

  const getRequiredMessage = (k) => {
    switch (k) {
      case 'playerName': return 'Full name is required';
      case 'regNo': return 'Registration number is required';
      case 'nicNo': return 'NIC number is required';
      case 'address': return 'Address is required';
      case 'email': return 'Email is required';
      case 'phone': return 'Phone number is required';
      case 'faculty': return 'Faculty is required';
      case 'partnerName': return 'Partner name is required';
    case 'gender': return 'Gender is required';
    case 'partnerRegNo': return 'Partner registration number is required';
      default: return 'Required';
    }
  };

  const setField = (k, v) => {
    if (k === 'partnerRegNo' || k === 'regNo') {
      setPartnerLookup(null);
      setPartnerLookupError('');
    }
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  const handleBlur = (k) => {
    const value = String(form[k]).trim();
    if (!value) {
      if (k === 'partnerName' || k === 'partnerRegNo') {
        if (!form.partnerName.trim() && !form.partnerRegNo.trim()) {
          setErrors((p) => ({ ...p, [k]: '' }));
          return;
        }
      }
      setErrors((p) => ({ ...p, [k]: getRequiredMessage(k) }));
      return;
    }

    const error = validateField(k, value);
    setErrors((p) => ({ ...p, [k]: error }));

    if (k === 'partnerRegNo' && validateRegNo(value) && value !== form.regNo.trim()) {
      fetchPartnerDetails(value);
    }
  };

  const validate = () => {
    const newErrors = {};
    const playerName = form.playerName.trim();
    const regNo = form.regNo.trim();
    const nicNo = form.nicNo.trim();
    const address = form.address.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const partnerName = form.partnerName.trim();
    const partnerRegNo = form.partnerRegNo.trim();

    if (!playerName) newErrors.playerName = 'Full name is required';
    else if (!validateName(playerName)) newErrors.playerName = 'Use letters, dots and single spaces only';

    if (!regNo) newErrors.regNo = 'Registration number is required';
    else if (!validateRegNo(regNo)) newErrors.regNo = 'Use 20XX/XX/XXX or 20XX/XXX/XXX';

    if (!nicNo) newErrors.nicNo = 'NIC number is required';
    else if (!validateNIC(nicNo)) newErrors.nicNo = 'Enter valid old NIC (991234567v) or new NIC (200012345678)';

    if (!address) newErrors.address = 'Address is required';
    else if (!validateAddress(address)) newErrors.address = 'Invalid characters in address';

    if (!email) newErrors.email = 'Email is required';
    else if (!validateEmail(email)) newErrors.email = 'Enter a valid email address';

    if (!phone) newErrors.phone = 'Phone number is required';
    else if (!validatePhone(phone)) newErrors.phone = 'Phone must start with 07 and be 10 digits';

    if (isMixedDoubles && !form.gender) newErrors.gender = 'Gender is required';
    if (!form.faculty) newErrors.faculty = 'Faculty is required';

    if (isDoubles && partnerRegNo) {
      if (!validateRegNo(partnerRegNo)) newErrors.partnerRegNo = 'Use 20XX/XX/XXX or 20XX/XXX/XXX';
      else if (partnerRegNo === regNo) newErrors.partnerRegNo = 'Partner registration number must differ from yours';
      else if (partnerLookupError) newErrors.partnerRegNo = partnerLookupError;
      else if (partnerLookup && partnerLookup.partnerRollNumber?.trim() && partnerLookup.partnerRollNumber.trim().toUpperCase() !== regNo.toUpperCase()) {
        newErrors.partnerRegNo = 'This player already has a partner assigned.';
      } else if (partnerLookup && partnerLookup.gender && form.gender) {
        const category = tournament.category;
        const partnerGender = partnerLookup.gender;
        const playerGender = form.gender;
        if (category === 'mixed-doubles') {
          if (!isCategoryCompatible(category, playerGender, partnerGender)) {
            newErrors.partnerRegNo = 'Mixed Doubles requires one male and one female player. This partner cannot be paired for Mixed Doubles.';
          }
        } else if (category === 'doubles-men' && !isCategoryCompatible(category, playerGender, partnerGender)) {
          newErrors.partnerRegNo = 'Doubles Men requires two male players. This partner cannot be paired for Doubles Men.';
        } else if (category === 'doubles-women' && !isCategoryCompatible(category, playerGender, partnerGender)) {
          newErrors.partnerRegNo = 'Doubles Women requires two female players. This partner cannot be paired for Doubles Women.';
        }
      }
    }

    return newErrors;
  };

  const fetchPartnerDetails = async (lookupRegNo) => {
    if (!lookupRegNo) return null;
    setPartnerLookupLoading(true);
    setPartnerLookupError('');
    try {
      const res = await axios.get(`/api/registrations/lookup/${encodeURIComponent(lookupRegNo)}`, {
        params: { tournament: tournament._id }
      });
      const lookup = res.data.registration;
      setPartnerLookup(lookup);
      setForm((prev) => ({ ...prev, partnerName: lookup.playerName }));
      return lookup;
    } catch (err) {
      const message = err.response?.data?.message || 'No registration found with this number.';
      setPartnerLookup(null);
      setPartnerLookupError(message);
      setForm((prev) => ({ ...prev, partnerName: '' }));
      return null;
    } finally {
      setPartnerLookupLoading(false);
    }
  };

  useEffect(() => {
    if (!isDoubles) return;
    const lookupValue = form.partnerRegNo.trim();
    if (!lookupValue || !validateRegNo(lookupValue) || lookupValue === form.regNo.trim()) {
      setPartnerLookup(null);
      setPartnerLookupError('');
      setForm((prev) => ({ ...prev, partnerName: '' }));
      return;
    }

    const timer = setTimeout(() => {
      fetchPartnerDetails(lookupValue);
    }, 500);

    return () => clearTimeout(timer);
  }, [form.partnerRegNo, form.regNo, isDoubles, tournament._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }

    if (isDoubles && form.partnerRegNo.trim()) {
      const lookupValue = form.partnerRegNo.trim();
      if (!partnerLookup || partnerLookup.rollNumber?.trim().toUpperCase() !== lookupValue.toUpperCase()) {
        await fetchPartnerDetails(lookupValue);
      }
      if (partnerLookupError) {
        setErrors((prev) => ({ ...prev, partnerRegNo: partnerLookupError }));
        return;
      }
      if (partnerLookup && partnerLookup.partnerRollNumber?.trim() && partnerLookup.partnerRollNumber.trim().toUpperCase() !== form.regNo.trim().toUpperCase()) {
        setErrors((prev) => ({ ...prev, partnerRegNo: 'This player already has a partner assigned.' }));
        return;
      }
    }

    setLoading(true);
    try {
      const requestPayload = {
        playerName: form.playerName.trim(),
        rollNumber: form.regNo.trim(),
        nicNo: form.nicNo.trim(),
        address: form.address.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.faculty,
        partnerName: form.partnerName.trim(),
        partnerRollNumber: form.partnerRegNo.trim(),
      };
      if (isMixedDoubles) requestPayload.gender = form.gender;

      if (initialData) {
        await axios.put(`/api/registrations/${initialData._id}`, requestPayload);
      } else {
        await axios.post('/api/registrations', {
          tournament: tournament._id,
          ...requestPayload,
        });
      }
      setSuccess(true);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="modal-overlay" style={{ ...sh.overlay, background: isDarkMode ? 'linear-gradient(180deg, rgba(3, 37, 86, 0.96) 0%, rgba(15, 23, 42, 0.90) 45%, rgba(15, 23, 42, 0.98) 100%)' : 'rgba(15, 23, 42, 0.45)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ ...sh.card, maxWidth: 450, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 72, marginBottom: 24, animation: 'pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>{SUCCESS}</div>
          <h2 style={{ fontSize: 28, fontWeight: 950, color: '#10B981', letterSpacing: -1, marginBottom: 12 }}>{initialData ? 'UPDATED!' : 'VERIFIED!'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
             {initialData ? 'Player details have been updated successfully.' : (
               <>
                 You have successfully registered for:<br/>
                 <strong style={{ color: 'var(--text)' }}>{CAT_LABELS[tournament.category]}</strong>
               </>
             )}
          </p>
          <button onClick={onClose} style={{ ...sh.submitBtn, background: '#10B981', color: '#FFF', width: '100%', borderRadius: 16 }}>DONE</button>
      </div>
      <style>{`
        @keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @media (max-width: 600px) {
          .modal-overlay {
            padding: 12px !important;
          }
          .modal-card {
            padding: 22px 18px !important;
            border-radius: 22px !important;
            margin: 12px 0 !important;
            width: 100% !important;
          }
          .modal-header {
            flex-direction: column !important;
            align-items: stretch !important;
            padding-bottom: 0 !important;
          }
          .modal-title {
            font-size: 20px !important;
          }
          .modal-close-btn {
            align-self: flex-end !important;
          }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{ ...sh.overlay, background: isDarkMode ? 'linear-gradient(180deg, rgba(3, 37, 86, 0.96) 0%, rgba(15, 23, 42, 0.90) 45%, rgba(15, 23, 42, 0.98) 100%)' : 'rgba(15, 23, 42, 0.45)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ ...sh.card, maxWidth: 650 }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, position: 'relative' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, width: 120, height: 120, opacity: 0.08, pointerEvents: 'none', transform: 'translate(18px, -18px)' }}>
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <circle cx="60" cy="60" r="60" fill={sportColor} />
              <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize="48" fill="#fff" opacity="0.24">{sport.icon}</text>
            </svg>
          </div>
          <div style={{ display: 'grid', gap: 8, lineHeight: 1.2, zIndex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FBBF24', letterSpacing: '0.2em', textTransform: 'uppercase' }}>University of Jaffna</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 14, background: `${sportColor}15`, color: sportColor, fontSize: 18, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }}>
                {sport.icon}
              </span>
              <div>
                <div className="modal-title" style={{ fontSize: 24, fontWeight: 950, color: 'var(--text)', letterSpacing: -0.5 }}>{initialData ? 'EDIT PLAYER DETAILS' : 'REGISTER FOR TOURNAMENT'}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{sport.label} Registration — {tournament.year}</div>
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={sh.closeBtn}>{CLOSE}</button>
        </div>
        <div className="modal-info-bar" style={{ ...sh.infoBar, position: 'relative' }}>
          <div className="info-bar-content" style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
            <span className="info-bar-category" style={{ flex: '0 0 auto', fontSize: 13, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>
              {CAT_LABELS[tournament.category]} — {tournament.year}
            </span>
            <span className="info-bar-divider" style={{ flex: '0 0 auto', marginLeft: 16, marginRight: 16, fontSize: 13, color: 'var(--border)' }}>|</span>
            <div className="info-bar-venue" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              <span>{LOCATION}</span>
              <strong>Venue:</strong>
              <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tournament.venue || tournament.location || 'Not specified'}
              </span>
            </div>
            <div className="info-bar-time" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto', fontSize: 12, color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              <span>{CLOCK}</span>
              <strong>Time:</strong>
              <span>{tournament.time || tournament.startTime || 'Not specified'}</span>
            </div>
          </div>
        </div>

        {submitError && <div style={sh.errorBox}>{WARNING_ROUND} {submitError}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-form-content" style={{ flex: 1, overflowY: 'auto', paddingRight: 8, paddingLeft: 2, paddingTop: 16, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 20, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <div style={sh.field}>
              <label style={sh.label}>FULL NAME</label>
              <input
                type="text"
                value={form.playerName}
                onChange={(e) => setField('playerName', formatNameInput(e.target.value))}
                onBlur={() => handleBlur('playerName')}
                placeholder="Full Name"
                style={sh.input}
              />
              {errors.playerName && <span style={sh.errMsg}>{errors.playerName}</span>}
            </div>

            <div className="modal-grid" style={sh.grid}>
              <div style={sh.field}>
                <label style={sh.label}>REGISTRATION NUMBER</label>
                <input
                  type="text"
                  value={form.regNo}
                  onChange={(e) => setField('regNo', sanitizeRegNo(e.target.value))}
                  onBlur={() => handleBlur('regNo')}
                  placeholder="2023/CSE/001"
                  style={sh.input}
                />
                {errors.regNo && <span style={sh.errMsg}>{errors.regNo}</span>}
              </div>
              <div style={sh.field}>
                <label style={sh.label}>NIC NUMBER</label>
                <input
                  type="text"
                  value={form.nicNo}
                  onChange={(e) => setField('nicNo', sanitizeNIC(e.target.value))}
                  onBlur={() => handleBlur('nicNo')}
                  placeholder="Identity No"
                  style={sh.input}
                />
                {errors.nicNo && <span style={sh.errMsg}>{errors.nicNo}</span>}
              </div>
            </div>

            <div className="modal-grid" style={sh.grid}>
              <div style={sh.field}>
                <label style={sh.label}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  placeholder="Email"
                  style={sh.input}
                />
                {errors.email && <span style={sh.errMsg}>{errors.email}</span>}
              </div>
              <div style={sh.field}>
                <label style={sh.label}>PHONE</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', sanitizePhone(e.target.value))}
                  onBlur={() => handleBlur('phone')}
                  placeholder="07XXXXXXXX"
                  style={sh.input}
                  maxLength={10}
                />
                {errors.phone && <span style={sh.errMsg}>{errors.phone}</span>}
              </div>
            </div>

            {isMixedDoubles ? (
              <div className="modal-grid" style={sh.grid}>
                <div style={sh.field}>
                  <label style={sh.label}>GENDER</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setField('gender', e.target.value)}
                    onBlur={() => handleBlur('gender')}
                    style={sh.input}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {errors.gender && <span style={sh.errMsg}>{errors.gender}</span>}
                </div>
                <div style={sh.field}>
                  <label style={sh.label}>FACULTY / DEPARTMENT</label>
                  <select
                    value={form.faculty}
                    onChange={(e) => setField('faculty', e.target.value)}
                    onBlur={() => handleBlur('faculty')}
                    style={sh.input}
                  >
                    <option value="">Select your faculty</option>
                    {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  {errors.faculty && <span style={sh.errMsg}>{errors.faculty}</span>}
                </div>
              </div>
            ) : (
              <div style={sh.field}>
                <label style={sh.label}>FACULTY / DEPARTMENT</label>
                <select
                  value={form.faculty}
                  onChange={(e) => setField('faculty', e.target.value)}
                  onBlur={() => handleBlur('faculty')}
                  style={sh.input}
                >
                  <option value="">Select your faculty</option>
                  {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {errors.faculty && <span style={sh.errMsg}>{errors.faculty}</span>}
              </div>
            )}

            <div style={sh.field}>
              <label style={sh.label}>HOME ADDRESS</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setField('address', formatAddressInput(e.target.value))}
                onBlur={() => handleBlur('address')}
                placeholder="Residential Address"
                style={sh.input}
              />
              {errors.address && <span style={sh.errMsg}>{errors.address}</span>}
            </div>

            {isDoubles && (
              <div style={sh.doublesSection}>
                <div style={{ fontSize: 11, fontWeight: 900, color: sportColor, letterSpacing: 2, marginBottom: 16 }}>PARTNER DETAILS (DOUBLES)</div>
                <div className="modal-grid" style={sh.grid}>
                  <div style={sh.field}>
                    <label style={sh.label}>PARTNER NAME (AUTO-FILLED)</label>
                    <input
                      type="text"
                      value={form.partnerName}
                      readOnly
                      placeholder="Auto-filled from registration number"
                      style={{ ...sh.input, opacity: form.partnerName ? 1 : 0.6, cursor: 'not-allowed' }}
                    />
                    {errors.partnerName && <span style={sh.errMsg}>{errors.partnerName}</span>}
                  </div>
                  <div style={sh.field}>
                    <label style={sh.label}>PARTNER REG NO</label>
                    <input
                      type="text"
                      value={form.partnerRegNo}
                      onChange={(e) => setField('partnerRegNo', sanitizeRegNo(e.target.value))}
                      onBlur={() => handleBlur('partnerRegNo')}
                      placeholder="2023/CSE/002"
                      style={sh.input}
                    />
                    {errors.partnerRegNo && <span style={sh.errMsg}>{errors.partnerRegNo}</span>}
                    {partnerLookupLoading && !errors.partnerRegNo && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Checking partner registration...</span>}
                    {partnerLookupError && !errors.partnerRegNo && <span style={sh.errMsg}>{partnerLookupError}</span>}
                  </div>
                </div>
                {partnerLookup && (
                  <div className="partner-lookup-card" style={sh.partnerLookupCard}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--primary)', marginBottom: 8 }}>PARTNER LOOKUP</div>
                    <div className="partner-lookup-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                      <div style={{ wordBreak: 'break-word' }}><strong>Name:</strong> {partnerLookup.playerName}</div>
                      <div style={{ wordBreak: 'break-word' }}><strong>Reg No:</strong> {partnerLookup.rollNumber}</div>
                      <div style={{ wordBreak: 'break-word' }}><strong>Faculty:</strong> {partnerLookup.department || 'N/A'}</div>
                      <div style={{ wordBreak: 'break-word' }}><strong>Status:</strong> {partnerLookup.status ? partnerLookup.status.toUpperCase() : 'N/A'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <button className="modal-cancel-btn" type="button" onClick={onClose} style={sh.cancelBtn}>CANCEL</button>
            <button className="modal-submit-btn" type="submit" disabled={loading} style={{ ...sh.submitBtn, background: sportColor, color: '#FFF' }}>
              {loading ? 'SYNCING...' : (initialData ? 'SAVE CHANGES' : 'REGISTER NOW')}
            </button>
          </div>
        </form>
        <style>{`
          @media (max-width: 600px) {
            .modal-overlay {
              padding: 16px !important;
            }
            .modal-card {
              padding: 20px 16px 16px 16px !important;
              border-radius: 20px !important;
              max-height: 90vh !important;
              margin: 0 !important;
              width: 100% !important;
              display: flex !important;
              flex-direction: column !important;
            }
            .modal-header {
              margin-bottom: 16px !important;
            }
            .modal-title {
              font-size: 18px !important;
              line-height: 1.2 !important;
              max-width: calc(100% - 48px) !important;
            }
            .modal-close-btn {
              width: 40px !important;
              height: 40px !important;
              min-width: 40px !important;
              min-height: 40px !important;
              font-size: 20px !important;
              margin-top: -6px !important;
              margin-right: -6px !important;
            }
            .modal-info-bar {
              position: relative !important;
              width: 100% !important;
              padding: 14px 16px !important;
              min-height: 86px !important;
              margin-bottom: 16px !important;
            }
            .info-bar-content {
              display: flex !important;
              flex-wrap: wrap !important;
              align-items: center !important;
              width: 100% !important;
              gap: 0 !important;
            }
            .info-bar-category {
              width: 100% !important;
              flex: 0 0 100% !important;
              font-size: 12px !important;
              line-height: 20px !important;
              margin-bottom: 12px !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
            .info-bar-divider {
              display: none !important;
            }
            .info-bar-venue {
              position: static !important;
              left: auto !important;
              transform: none !important;
              display: flex !important;
              align-items: center !important;
              flex: 1 1 auto !important;
              min-width: 0 !important;
              gap: 5px !important;
              font-size: 11px !important;
              white-space: nowrap !important;
              overflow: hidden !important;
            }
            .info-bar-venue > span:last-child {
              max-width: 90px !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
            .info-bar-time {
              margin-left: auto !important;
              display: flex !important;
              align-items: center !important;
              flex: 0 0 auto !important;
              gap: 5px !important;
              font-size: 11px !important;
              white-space: nowrap !important;
            }
            .modal-form-content {
              gap: 16px !important;
              padding-top: 12px !important;
              padding-bottom: 12px !important;
              padding-right: 6px !important;
            }
            .modal-grid {
              grid-template-columns: 1fr !important;
              gap: 16px !important;
            }
            .partner-lookup-card {
              padding: 12px !important;
              margin-top: 16px !important;
            }
            .partner-lookup-grid {
              grid-template-columns: 1fr !important;
              gap: 8px !important;
            }
            .modal-actions {
              flex-direction: column-reverse !important;
              gap: 8px !important;
              padding-top: 12px !important;
            }
            .modal-cancel-btn, .modal-submit-btn {
              width: 100% !important;
              flex: none !important;
              min-height: 44px !important;
              padding: 12px !important;
              font-size: 13px !important;
              border-radius: 10px !important;
              margin: 0 !important;
            }
          }
          @media (max-width: 400px) {
            .modal-info-bar {
              padding: 12px 14px !important;
              min-height: 82px !important;
            }
            .info-bar-category {
              font-size: 11px !important;
              margin-bottom: 10px !important;
            }
            .info-bar-venue,
            .info-bar-time {
              font-size: 10px !important;
              gap: 4px !important;
            }
            .info-bar-venue > span:last-child {
              max-width: 70px !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

const sh = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'var(--bg)',
    backdropFilter: 'blur(18px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: 30,
    padding: '28px 30px 24px 30px',
    width: '100%',
    maxWidth: 700,
    position: 'relative',
    boxShadow: 'var(--shadow)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' },
  infoBar: { background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '16px 20px', borderRadius: 18, marginBottom: 20 },
  errorBox: { background: 'rgba(254, 226, 226, 0.95)', border: '1px solid rgba(239, 68, 68, 0.16)', color: '#B91C1C', padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 13, textAlign: 'center' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '16px', borderRadius: 14, fontSize: '14px', outline: 'none' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  doublesSection: { borderTop: '1px solid rgba(148, 163, 184, 0.18)', paddingTop: 24, marginTop: 24 },
  partnerLookupCard: { marginTop: 16, padding: 18, borderRadius: 16, background: 'var(--bg-input)', border: '1px solid var(--border)' },
  errMsg: { fontSize: 10, color: '#DC2626', fontWeight: 700, marginTop: 4 },
  cancelBtn: { flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '16px', borderRadius: 14, fontWeight: 900, cursor: 'pointer' },
  submitBtn: { flex: 2, border: 'none', color: '#FFF', padding: '16px', borderRadius: 14, fontWeight: 950, fontSize: 14, cursor: 'pointer', letterSpacing: 0.5 }
};