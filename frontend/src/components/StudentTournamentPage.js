import React, { useState, useEffect } from 'react';
import axios from 'axios';
import RegisterModal from './RegisterModal';

const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};
const SPORT_META = {
  badminton:      { label: 'BADMINTON',    icon: '🏸', color: '#C8A84B', heroGrad: 'linear-gradient(180deg, #1C1400 0%, #0A0A0A 100%)' },
  'table-tennis': { label: 'TABLE TENNIS', icon: '🏓', color: '#4B9CC8', heroGrad: 'linear-gradient(180deg, #001C2E 0%, #0A0A0A 100%)' },
  carrom:         { label: 'CARROM',       icon: '🎯', color: '#C84B8A', heroGrad: 'linear-gradient(180deg, #1C0012 0%, #0A0A0A 100%)' },
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export default function StudentTournamentPage({ sport }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerFor, setRegisterFor] = useState(null);
  const meta = SPORT_META[sport] || {};

  useEffect(() => {
    axios.get(`/api/tournaments/public/${sport}`)
      .then((res) => setTournaments(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sport]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)' }}>
      {/* Hero */}
      <div style={{ position: 'relative', padding: '90px 40px 70px', textAlign: 'center', background: meta.heroGrad, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(ellipse at 50% 60%, ${meta.color}0F 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>{meta.icon}</div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 64, fontWeight: 700, letterSpacing: 14, lineHeight: 1, color: meta.color }}>{meta.label}</h1>
          <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 18, color: 'var(--text-muted)', letterSpacing: 8, marginTop: 10 }}>OPEN TOURNAMENT</h2>
          <div style={{ width: 80, height: 2, background: meta.color, margin: '20px auto', borderRadius: 1 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 500, margin: '0 auto' }}>
            Register for upcoming tournaments. Compete, win, and represent your department!
          </p>
        </div>
      </div>

      {/* Tournaments */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 40px' }}>
        <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 26, fontWeight: 700, letterSpacing: 4, marginBottom: 32, paddingBottom: 14, borderBottom: `2px solid ${meta.color}` }}>
          UPCOMING TOURNAMENTS
        </h2>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /> Loading...</div>
        ) : tournaments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--dark2)', borderRadius: 10, border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 56 }}>📋</div>
            <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 22, color: 'var(--text-muted)', marginTop: 16 }}>No tournaments scheduled yet</h3>
            <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 24 }}>
            {tournaments.map((t) => (
              <div key={t._id} style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ height: 4, background: meta.color }} />
                <div style={{ padding: '20px 22px' }}>
                  <div className="flex-between" style={{ marginBottom: 16 }}>
                    <span style={{ fontFamily: 'var(--font-d)', fontSize: 34, fontWeight: 700, color: meta.color }}>{t.year}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${meta.color}40`, color: meta.color, padding: '4px 9px', borderRadius: 4, maxWidth: 130, textAlign: 'right' }}>{CAT_LABELS[t.category]}</span>
                  </div>
                  {[['📅', fmtDate(t.date)], ['🕐', t.time], ['📍', t.venue]].map(([icon, text]) => (
                    <div key={icon} style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 14, color: 'var(--text-muted)' }}><span>{icon}</span><span>{text}</span></div>
                  ))}
                  <button className="btn btn-full" style={{ marginTop: 16, background: meta.color, color: '#0A0A0A', fontSize: 14, padding: '12px' }} onClick={() => setRegisterFor(t)}>
                    REGISTER NOW
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Sports Tournament Manager · {meta.label}</span>
      </div>

      {registerFor && <RegisterModal tournament={registerFor} onClose={() => setRegisterFor(null)} />}
    </div>
  );
}