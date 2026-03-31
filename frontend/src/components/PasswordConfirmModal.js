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
    catch (err) { setError(err.response?.data?.message || 'Incorrect password'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-title" style={{ color: danger ? 'var(--danger)' : 'var(--primary)' }}>{title}</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 22, lineHeight: 1.6 }}>{message}</p>
        {error && <div className="alert alert-error">⚠ {error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Enter Your Password to Confirm</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" autoFocus required />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>CANCEL</button>
            <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} style={{ flex: 1 }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> ...</> : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}