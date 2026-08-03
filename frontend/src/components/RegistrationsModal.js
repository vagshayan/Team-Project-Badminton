import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CAT_LABELS = {
  'singles-men': 'Singles — Men',
  'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men',
  'doubles-women': 'Doubles — Women',
  'mixed-doubles': 'Mixed Doubles',
};
const DOUBLES = ['doubles-men', 'doubles-women', 'mixed-doubles'];

export default function RegistrationsModal({ tournament, onClose }) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const isDoubles = DOUBLES.includes(tournament.category);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    axios.get(`/api/registrations/tournament/${tournament._id}`)
      .then((res) => setRegistrations(res.data))
      .catch(() => setError('Failed to load registered players'))
      .finally(() => setLoading(false));
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await axios.get(`/api/registrations/tournament/${tournament._id}`);
        if (!cancelled) setRegistrations(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) setError('Failed to load registered players');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [tournament._id]);

  return (
    <div className="modal-overlay" style={{ ...sh.overlay, padding: isMobile ? 16 : 40, alignItems: isMobile ? 'flex-start' : 'center' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{
        ...sh.card,
        padding: isMobile ? 24 : 50,
        borderRadius: isMobile ? 28 : 44,
        maxWidth: isMobile ? 420 : 1100,
        maxHeight: isMobile ? '100vh' : '90vh',
        margin: isMobile ? '12px auto' : undefined,
      }}>
        <div style={sh.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={sh.badge}>DOMAIN: {tournament.sport.toUpperCase()}</div>
              <h2 style={sh.title}>REGISTERED PLAYERS</h2>
              <p style={sh.subtitle}>Full list of participants for {CAT_LABELS[tournament.category]}.</p>
            </div>

            <div style={{
              ...sh.infoBar,
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? 14 : 24,
              alignItems: isMobile ? 'flex-start' : 'center',
            }}>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 950, fontSize: isMobile ? 20 : 24, color: 'var(--primary)' }}>{tournament.year}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
                  <span>🗓️ {new Date(tournament.date).toLocaleDateString('en-IN')}</span>
                  <span>📍 {tournament.venue}</span>
                </div>
              </div>

              <button onClick={onClose} style={sh.closeBtn}>✕</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={sh.status}>
            <div className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--primary)' }} />
            <p style={{ marginTop: 20 }}>Syncing player data...</p>
          </div>
        ) : error ? (
          <div style={sh.errorBox}>⚠ {error}</div>
        ) : registrations.length === 0 ? (
          <div style={sh.status}>
            <div style={{ fontSize: 50, marginBottom: 15 }}>📋</div>
            <p style={{ fontSize: 16, opacity: 0.6 }}>No registrations recorded for this arena yet.</p>
          </div>
        ) : (
          <div className="responsive-table-wrap" style={{ ...sh.tableBox, overflowX: 'auto' }}>
            <table className="responsive-table" style={{ ...sh.table, minWidth: isMobile ? 620 : 960 }}>
              <thead style={sh.thead}>
                <tr>
                  <th style={sh.th}>#</th>
                  <th style={sh.th}>PARTICIPANT NAME</th>
                  <th style={sh.th}>REG NUMBER</th>
                  <th style={sh.th}>FACULTY</th>
                  <th style={sh.th}>CONTACT</th>
                  {isDoubles && <th style={sh.th}>PARTNER INFO</th>}
                </tr>
              </thead>
              <tbody>
                {registrations.map((r, i) => (
                  <tr key={r._id} style={sh.tr}>
                    <td style={{ ...sh.td, color: 'var(--text-muted)', fontWeight: 800 }}>{String(i + 1).padStart(2, '0')}</td>
                    <td style={{ ...sh.td, fontWeight: 900, fontSize: 15 }}>{r.playerName}</td>
                    <td style={{ ...sh.td, fontWeight: 800, color: 'var(--primary)', letterSpacing: 0.5 }}>{r.rollNumber}</td>
                    <td style={{ ...sh.td, fontSize: 13, fontWeight: 700 }}>{r.department}</td>
                    <td style={sh.td}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>📞 {r.phone}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.email}</div>
                    </td>
                    {isDoubles && (
                      <td style={sh.td}>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{r.partnerName || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.partnerRollNumber || '—'}</div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ ...sh.footer, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 16 : 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
            TOTAL ENROLLED: <span style={{ color: 'var(--text)', fontWeight: 950 }}>{registrations.length} PLAYERS</span>
          </div>
          <button onClick={onClose} style={{ ...sh.closeBtnAction, width: isMobile ? '100%' : 'auto' }}>CLOSE VIEW</button>
        </div>
      </div>
      <style>{`
        .spinner { border: 4px solid var(--border); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const sh = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 40 },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 44, padding: 50, width: '100%', maxWidth: 1100, boxShadow: 'var(--shadow)', maxHeight: '90vh', overflowY: 'auto' },
  header: { marginBottom: 32 },
  badge: { fontSize: 10, fontWeight: 950, color: 'var(--primary)', background: 'var(--bg-input)', padding: '6px 14px', borderRadius: 8, display: 'inline-block', marginBottom: 12, letterSpacing: 1.5 },
  title: { fontSize: 36, fontWeight: 950, letterSpacing: -1.5, marginBottom: 8 },
  subtitle: { color: 'var(--text-muted)', fontSize: 15, fontWeight: 500 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer', padding: 10 },
  infoBar: { background: 'var(--bg-input)', padding: '20px 30px', borderRadius: 24, border: '1px solid var(--border)', marginTop: 24 },
  status: { minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  errorBox: { background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '16px', borderRadius: 16, textAlign: 'center' },
  tableBox: { borderRadius: 28, border: '1px solid var(--border)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  thead: { background: 'var(--bg-input)', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1.5 },
  th: { padding: '20px 30px' },
  tr: { borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' },
  td: { padding: '24px 30px', verticalAlign: 'top' },
  muted: { color: 'var(--text-muted)', fontSize: 12, marginTop: 4 },
  footer: { marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTop: '1px solid var(--border)' },
  closeBtnAction: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '14px 30px', borderRadius: 16, fontWeight: 900, cursor: 'pointer', fontSize: 13 }
};