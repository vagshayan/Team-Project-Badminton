import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SPORTS = [
  { id: 'badminton', label: 'Badminton', color: '#FFD54D' },
  { id: 'table-tennis', label: 'Table Tennis', color: '#4B9CC8' },
  { id: 'carrom', label: 'Carrom', color: '#F472B6' },
];

export default function BracketsPage() {
  const [tournaments, setTournaments] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all(
      SPORTS.map(s => axios.get(`/api/tournaments/public/${s.id}`)
        .then(r => ({ sport: s.id, data: r.data }))
        .catch(() => ({ sport: s.id, data: [] }))
      )
    )
      .then(results => {
        if (!mounted) return;
        const map = {};
        results.forEach(r => map[r.sport] = (r.data || []).filter(t => t.isPublished));
        setTournaments(map);
      })
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ padding: 40 }}>Loading available brackets...</div>;

  const sportCard = (color) => ({ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 22, minHeight: 420, position: 'relative', overflow: 'hidden', borderRadius: 8 });
  const leftAccent = (color) => ({ position: 'absolute', left: 8, top: 12, bottom: 12, width: 8, background: color, borderRadius: 6 });
  const titleStyle = (color) => ({ margin: 0, marginBottom: 12, fontWeight: 900, color, fontSize: 20 });
  const smallTile = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', padding: 14, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.01)'}
  const emptyBox = { background: 'transparent', border: '1px dashed rgba(255,255,255,0.04)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto' };
  const closeBtn = { justifySelf: 'flex-end', padding: '10px 18px', borderRadius: 18, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: 700, transition: 'background 0.2s' };

  return (
    <div className="brackets-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 className="brackets-title">Live brackets — available</h1>
          <p className="brackets-subtitle">Select a sport and view the published brackets.</p>
        </div>
        <button onClick={() => navigate('/')} style={closeBtn}>
          ✕
        </button>
      </div>

      <div className="brackets-grid">
        {SPORTS.map(s => (
          <div key={s.id} style={sportCard(s.color)} className="brackets-card">
            <div style={leftAccent(s.color)} className="brackets-left-accent" />
            <h3 style={titleStyle(s.color)}>{s.label}</h3>

            {(!tournaments[s.id] || tournaments[s.id].length === 0) ? (
              <div className="brackets-empty-wrapper">
                <div style={emptyBox} className="brackets-empty-box">
                  <div style={{ fontSize: 20, marginBottom: 8 }}>🕒</div>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>No brackets published yet.</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Brackets post once matches are complete or when the draw is published.</div>
                </div>
              </div>
            ) : (
              <div>
                {tournaments[s.id].map(t => (
                  <div key={t._id} style={smallTile} className="brackets-small-tile">
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>{t.year} — {t.category}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{t.createdBy?.name || t.venue || ''} · {new Date(t.date).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <button
                        className="btn brackets-view-btn"
                        onClick={() => navigate(`/${s.id}?view=${t._id}`)}
                        style={{ padding: '10px 18px', borderRadius: 20, background: s.color, color: '#000', fontWeight: 900, boxShadow: '0 6px 18px rgba(0,0,0,0.4)', transform: 'translateX(6px)' }}
                      >
                        VIEW BRACKET
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
