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
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    year: tournament?.year || currentYear,
    date: tournament?.date ? new Date(tournament.date).toISOString().split('T')[0] : today,
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
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{tournament ? 'EDIT TOURNAMENT' : 'CREATE TOURNAMENT'}</div>
        {error && <div className="alert alert-error">⚠ {error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label>Year</label>
              <select value={form.year} onChange={(e) => set('year', Number(e.target.value))}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} min={today} onChange={(e) => set('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Time</label>
              <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Venue</label>
            <input type="text" value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. Main Sports Hall, Block A" required />
          </div>
          {requirePassword && (
            <div className="form-group">
              <label>Confirm with your Password</label>
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Enter your admin password to save" required />
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>CANCEL</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> SAVING...</> : (tournament ? 'UPDATE' : 'CREATE')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}