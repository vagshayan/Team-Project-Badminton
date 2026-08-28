import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CLOSE, CLOCK_3, ARROW_RIGHT } from '../../components/Icons';
import { SPORTS } from '../../constants/sports';

export default function BracketsPage() {
  const [tournaments, setTournaments] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const filterBrackets = (tournaments = []) =>
      tournaments.filter(t => t.isPublished || t.isLocked);

    Promise.all(
      SPORTS.map(s => axios.get(`/api/tournaments/public/${s.id}`)
        .then(r => ({ sport: s.id, data: filterBrackets(r.data) }))
        .catch(() => ({ sport: s.id, data: [] }))
      )
    )
      .then(results => {
        if (!mounted) return;
        const map = {};
        results.forEach(r => map[r.sport] = (r.data || []));
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
  const closeBtn = { width: 44, height: 44, minWidth: 44, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: 700, fontSize: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'none', transition: 'transform 0.2s ease' };

  return (
    <div className="brackets-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <h1 className="brackets-title">Live Brackets</h1>
          <p className="brackets-subtitle">Select a sport and view the published brackets.</p>
        </div>
        <button onClick={() => navigate('/')} style={{ ...closeBtn, flexShrink: 0 }}>
          {CLOSE}
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
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{CLOCK_3}</div>
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
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                        {t.createdBy?.name || t.venue || ''} · {new Date(t.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                      {t.isPublished ? (
                        <button
                          className="brackets-view-link"
                          onClick={() => navigate(`/${s.id}?view=${t._id}`, { state: { fromBrackets: true } })}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            borderRadius: 0,
                            color: s.color,
                            fontWeight: 700,
                            fontSize: 17,
                            textTransform: 'none',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: 'none',
                            transform: 'none'
                          }}
                        >
                          VIEW BRACKET
                          <span aria-hidden="true">{ARROW_RIGHT}</span>
                        </button>
                      ) : (
                        <span style={{ color: '#EF4444', fontWeight: 700, fontSize: 14, textTransform: 'uppercase' }}>BRACKET PENDING...</span>
                      )}
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
