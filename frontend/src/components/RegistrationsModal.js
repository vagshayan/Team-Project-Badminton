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
    let cancelled = false;
    const load = async () => {
      try {
        const [rRes, prRes] = await Promise.all([
          axios.get(`/api/registrations/tournament/${tournament._id}`),
          axios.get(`/api/registrations/partner-requests?tournament=${tournament._id}`)
        ]);
        if (cancelled) return;
        const regs = rRes.data;
        const pairMap = {};
        const singles = [];
        regs.forEach((r) => {
          if (r.pairStatus === 'complete' && r.pairId) {
            pairMap[r.pairId] = pairMap[r.pairId] || [];
            pairMap[r.pairId].push(r);
          } else {
            singles.push(r);
          }
        });
        const pairs = Object.values(pairMap).map(group => ({ type: 'pair', players: group }));
        const waiting = singles.filter(s => s.partnerStatus === 'looking');
        const pendingRequesters = singles.filter(s => s.partnerStatus === 'requested');
        const others = singles.filter(s => s.partnerStatus !== 'looking' && s.partnerStatus !== 'requested');
        setRegistrations({ pairs, waiting, pendingRequesters, others, requests: prRes.data });
      } catch (e) {
        setError('Failed to load registered players');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tournament._id]);

  return (
    <div style={sh.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={sh.card}>
        <div style={sh.header}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                  <div style={sh.badge}>DOMAIN: {tournament.sport.toUpperCase()}</div>
                  <h2 style={sh.title}>REGISTERED PLAYERS</h2>
                  <p style={sh.subtitle}>Full list of participants for {CAT_LABELS[tournament.category]}.</p>
               </div>
               <button onClick={onClose} style={sh.closeBtn}>✕</button>
            </div>
            
            <div style={sh.infoBar}>
               <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div style={{ fontWeight: 950, fontSize: 24, color: 'var(--primary)' }}>{tournament.year}</div>
                  <div style={{ display: 'flex', gap: 15, fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
                     <span>🗓️ {new Date(tournament.date).toLocaleDateString('en-IN')}</span>
                     <span>📍 {tournament.venue}</span>
                  </div>
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
        ) : (Array.isArray(registrations) ? registrations.length === 0 : (registrations.pairs.length + registrations.pendingRequesters.length + registrations.waiting.length + registrations.others.length + registrations.requests.length) === 0) ? (
          <div style={sh.status}>
             <div style={{ fontSize: 50, marginBottom: 15 }}>📋</div>
             <p style={{ fontSize: 16, opacity: 0.6 }}>No registrations recorded for this arena yet.</p>
          </div>
        ) : (
          <div>
            <h3 style={{ marginTop: 6 }}>Confirmed Pairs</h3>
            {registrations.pairs.length === 0 ? (
              <div style={{ ...sh.status, minHeight: 160, background: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>No confirmed pairs yet.</div>
                <div style={{ color: 'var(--text-muted)' }}>Confirmed partner pairs will appear here once approved.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 18, marginTop: 16 }}>
                {registrations.pairs.map((p, i) => {
                  const [player1 = {}, player2 = {}] = p.players;
                  return (
                    <div key={p.players.map(x => x._id).join('-') || i} style={sh.pairCard}>
                      <div style={sh.pairCardHeader}>
                        <div>
                          <div style={sh.pairTitle}>Team {String(i + 1).padStart(3, '0')} - Confirmed Pair</div>
                          <div style={sh.pairSubTitle}>{CAT_LABELS[tournament.category]} · Year: {tournament.year}</div>
                        </div>
                        <div style={sh.confirmedBadge}>Confirmed Pair</div>
                      </div>
                      <div style={sh.pairBody}>
                        <div style={sh.pairColumn}>
                          <div style={sh.playerHeader}>Player 1</div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Name</span><span>{player1.playerName || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Registration number</span><span>{player1.rollNumber || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Faculty</span><span>{player1.department || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Phone</span><span>{player1.phone || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Email</span><span>{player1.email || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>NIC</span><span>{player1.nicNo || '—'}</span></div>
                        </div>
                        <div style={sh.pairColumn}>
                          <div style={sh.playerHeader}>Player 2</div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Name</span><span>{player2.playerName || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Registration number</span><span>{player2.rollNumber || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Faculty</span><span>{player2.department || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Phone</span><span>{player2.phone || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>Email</span><span>{player2.email || '—'}</span></div>
                          <div style={sh.playerField}><span style={sh.fieldLabel}>NIC</span><span>{player2.nicNo || '—'}</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <h3 style={{ marginTop: 24 }}>Looking for Partner</h3>
            {registrations.waiting.length === 0 ? (
              <div style={{ ...sh.status, minHeight: 160, background: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>No players are currently looking for a partner.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 18, marginTop: 16 }}>
                {registrations.waiting.map((r, i) => (
                  <div key={r._id} style={sh.partnerCard}>
                    <div style={sh.partnerCardHeader}>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>Player {String(i + 1).padStart(2, '0')}</div>
                      <div style={sh.lookingBadge}>Looking for Partner</div>
                    </div>
                    <div style={sh.partnerGrid}>
                      <div style={sh.partnerInfo}><strong>Name</strong> {r.playerName}</div>
                      <div style={sh.partnerInfo}><strong>Reg No</strong> {r.rollNumber}</div>
                      <div style={sh.partnerInfo}><strong>Faculty</strong> {r.department}</div>
                      <div style={sh.partnerInfo}><strong>Phone</strong> {r.phone}</div>
                      <div style={sh.partnerInfo}><strong>Email</strong> {r.email}</div>
                      <div style={sh.partnerInfo}><strong>NIC</strong> {r.nicNo || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 style={{ marginTop: 20 }}>Pending Partner Requests</h3>
            {registrations.requests.length === 0 ? (
              <div style={{ ...sh.status, minHeight: 160, background: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>No pending partner requests at the moment.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 20, marginTop: 16 }}>
                {registrations.requests.map((q, i) => (
                  <div key={q._id} style={sh.requestCard}>
                    <div style={sh.pairCardHeader}>
                      <div>
                        <div style={sh.pairTitle}>Request {String(i + 1).padStart(3, '0')} - Pending Request</div>
                        <div style={sh.pairSubTitle}>{CAT_LABELS[tournament.category]} · Year: {tournament.year}</div>
                      </div>
                      <div style={sh.requestBadge}>Pending Request</div>
                    </div>
                    <div style={sh.pairBody}>
                      <div style={sh.pairColumn}>
                        <div style={sh.playerHeader}>Requester</div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Name</span><span>{q.requesterRegistration?.playerName || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Registration number</span><span>{q.requesterRollNumber || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Faculty</span><span>{q.requesterRegistration?.department || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Phone</span><span>{q.requesterRegistration?.phone || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Email</span><span>{q.requesterRegistration?.email || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>NIC</span><span>{q.requesterRegistration?.nicNo || '—'}</span></div>
                      </div>
                      <div style={sh.pairColumn}>
                        <div style={sh.playerHeader}>Requested Partner</div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Name</span><span>{q.targetRegistration?.playerName || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Registration number</span><span>{q.targetRollNumber || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Faculty</span><span>{q.targetRegistration?.department || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Phone</span><span>{q.targetRegistration?.phone || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>Email</span><span>{q.targetRegistration?.email || '—'}</span></div>
                        <div style={sh.playerField}><span style={sh.fieldLabel}>NIC</span><span>{q.targetRegistration?.nicNo || '—'}</span></div>
                      </div>
                    </div>
                    <div style={sh.requestActions}>
                      <button style={{ ...sh.actionSmall, background: '#10B981', color: '#000' }} onClick={async () => { await axios.post(`/api/registrations/partner-requests/${q._id}/accept`); window.location.reload(); }}>Accept</button>
                      <button style={{ ...sh.actionSmall, background: '#EF4444', color: '#FFF' }} onClick={async () => { await axios.post(`/api/registrations/partner-requests/${q._id}/reject`); window.location.reload(); }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

          <div style={sh.footer}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
              TOTAL ENROLLED: <span style={{ color: 'var(--text)', fontWeight: 950 }}>{Array.isArray(registrations) ? registrations.length : (registrations.pairs.length*2 + registrations.waiting.length + registrations.others.length)} PLAYERS</span>
            </div>
           <button onClick={onClose} style={sh.closeBtnAction}>CLOSE VIEW</button>
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
  td: { padding: '24px 30px' },
  pairBadge: { display: 'inline-block', background: 'rgba(16, 185, 129, 0.12)', color: '#047857', fontWeight: 800, padding: '6px 12px', borderRadius: 999, fontSize: 11 },
  completeBadge: { display: 'inline-block', background: 'rgba(59, 130, 246, 0.12)', color: '#1D4ED8', fontWeight: 800, padding: '6px 12px', borderRadius: 999, fontSize: 11 },
  lookingBadge: { display: 'inline-block', background: 'rgba(234, 179, 8, 0.12)', color: '#B45309', fontWeight: 800, padding: '6px 12px', borderRadius: 999, fontSize: 11 },
  pendingBadge: { display: 'inline-block', background: 'rgba(249, 115, 22, 0.12)', color: '#C2410C', fontWeight: 800, padding: '6px 12px', borderRadius: 999, fontSize: 11 },
  pairName: { fontWeight: 800, fontSize: 14, marginBottom: 4 },
  pairMeta: { color: 'var(--text-muted)', fontSize: 12 },
  pairCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 28, padding: 28, boxShadow: 'var(--shadow)' },
  pairCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  pairTitle: { fontSize: 18, fontWeight: 950, letterSpacing: -0.4 },
  pairSubTitle: { fontSize: 13, color: 'var(--text-muted)', marginTop: 6 },
  confirmedBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.12)', color: '#047857', fontWeight: 900, padding: '10px 16px', borderRadius: 999, fontSize: 12 },
  pairBody: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'flex-start' },
  pairColumn: { display: 'grid', gap: 12, minWidth: 0 },
  playerHeader: { fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, color: 'var(--text)' },
  playerField: { display: 'grid', gridTemplateColumns: '180px 1fr', gap: 6, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(148, 163, 184, 0.12)' },
  fieldLabel: { color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 },
  partnerCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 28, padding: 24, boxShadow: 'var(--shadow)' },
  partnerCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' },
  partnerGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  partnerInfo: { background: 'rgba(148, 163, 184, 0.06)', borderRadius: 16, padding: 12, fontSize: 13, color: 'var(--text)' },
  requestCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 28, padding: 28, boxShadow: 'var(--shadow)' },
  requestBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(249, 115, 22, 0.12)', color: '#C2410C', fontWeight: 900, padding: '10px 16px', borderRadius: 999, fontSize: 12 },
  requestActions: { marginTop: 22, display: 'flex', gap: 12, flexWrap: 'wrap' },
  actionSmall: { border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 900, cursor: 'pointer', transition: 'transform 120ms ease' },
  footer: { marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTop: '1px solid var(--border)' },
  closeBtnAction: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '14px 30px', borderRadius: 16, fontWeight: 900, cursor: 'pointer', fontSize: 13 }
};