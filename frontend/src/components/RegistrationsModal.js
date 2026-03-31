import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};
const DOUBLES = ['doubles-men', 'doubles-women', 'mixed-doubles'];

export default function RegistrationsModal({ tournament, onClose }) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isDoubles = DOUBLES.includes(tournament.category);

  useEffect(() => {
    axios.get(`/api/registrations/tournament/${tournament._id}`)
      .then((res) => setRegistrations(res.data))
      .catch(() => setError('Failed to load registrations'))
      .finally(() => setLoading(false));
  }, [tournament._id]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 900 }}>
        <div className="modal-title">REGISTRATIONS</div>

        {/* Tournament info */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '10px 14px', background: 'var(--dark3)', borderRadius: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, background: 'rgba(200,168,75,0.12)', border: '1px solid rgba(200,168,75,0.25)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 3 }}>
            {CAT_LABELS[tournament.category]}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>📅 {new Date(tournament.date).toLocaleDateString('en-IN')}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>🕐 {tournament.time}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>📍 {tournament.venue}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{tournament.year}</span>
        </div>

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /> Loading...</div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : registrations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--dark3)', borderRadius: 6 }}>
            <div style={{ fontSize: 40 }}>📋</div>
            <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>No registrations yet for this tournament.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Full Name</th>
                  <th>Reg No</th>
                  <th>NIC No</th>
                  <th>Address</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Faculty</th>
                  {isDoubles && <th>Partner Name</th>}
                  {isDoubles && <th>Partner Reg No</th>}
                </tr>
              </thead>
              <tbody>
                {registrations.map((r, i) => (
                  <tr key={r._id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.playerName}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.rollNumber}</td>
                    <td style={{ fontSize: 12 }}>{r.nicNo || '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 150, wordBreak: 'break-word' }}>{r.address || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.email}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.phone}</td>
                    <td style={{ fontSize: 12 }}>{r.department}</td>
                    {isDoubles && <td style={{ whiteSpace: 'nowrap' }}>{r.partnerName || '—'}</td>}
                    {isDoubles && <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.partnerRollNumber || '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Total: <strong style={{ color: 'var(--text)' }}>{registrations.length}</strong> registrations
          </span>
          <button className="btn btn-ghost" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}