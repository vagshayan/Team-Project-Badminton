import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import RegisterModal from './RegisterModal';

const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};

const SPORT_META = {
  badminton:      { label: 'BADMINTON',    icon: '🏸', color: '#3B82F6' },
  'table-tennis': { label: 'TABLE TENNIS', icon: '🏓', color: '#8B5CF6' },
  carrom:         { label: 'CARROM',       icon: '🎯', color: '#EC4899' },
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export default function StudentTournamentPage({ sport }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerFor, setRegisterFor] = useState(null);
  const [viewBracketsFor, setViewBracketsFor] = useState(null);
  const [matches, setMatches] = useState([]);
  const [bracketLoading, setBracketLoading] = useState(false);
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  
  const meta = SPORT_META[sport] || SPORT_META['badminton'];

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/tournaments/public/${sport}`)
      .then((res) => setTournaments(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sport]);

  const loadBrackets = async (t) => {
    setViewBracketsFor(t);
    setBracketLoading(true);
    try {
      const res = await axios.get(`/api/tournaments/${t._id}/matches`);
      setMatches(res.data);
    } catch (err) { console.error(err); }
    finally { setBracketLoading(false); }
  };

  const rounds = [];
  matches.forEach(m => {
    if (!rounds[m.round - 1]) rounds[m.round - 1] = [];
    rounds[m.round - 1].push(m);
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-main)' }}>
      
      {/* Top Prominent Navigation (Traditional Style) */}
      <nav style={sh.nav}>
        <div style={sh.brand} onClick={() => navigate('/')}>
          <div style={sh.logoCircle}>🏆</div>
          <span style={sh.brandName}>UoJ SPORTS</span>
        </div>

        <div style={sh.sportSwitcher}>
          {Object.keys(SPORT_META).map((s) => (
            <button 
              key={s} 
              onClick={() => navigate(`/${s}`)}
              style={{ ...sh.sportBtn, color: sport === s ? SPORT_META[s].color : 'var(--text-muted)', borderBottom: sport === s ? `3px solid ${SPORT_META[s].color}` : 'none' }}
            >
              <span style={{ fontSize: 24 }}>{SPORT_META[s].icon}</span>
              <span style={{ fontSize: 13, fontWeight: 900 }}>{SPORT_META[s].label}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <button onClick={toggleTheme} style={sh.themeToggle}>{isDarkMode ? '🌞' : '🌙'}</button>
          <button onClick={() => navigate('/admin/login')} style={sh.adminBtn}>ADMIN LOGIN</button>
        </div>
      </nav>

      {/* Main Experience */}
      <div style={sh.hero}>
          <div style={{ ...sh.heroBlob, background: meta.color }} />
          <h1 style={sh.heroTitle}>{meta.label} RESULTS</h1>
          <div style={sh.liveIndicator}>
              <span className="live-dot" style={{ background: '#10B981' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#10B981', letterSpacing: 2 }}>OFFICIAL LIVE TOURNAMENT BOARD</span>
          </div>
      </div>

      <main style={sh.mainContent}>
        <div style={sh.containerCard}>
          {loading ? (
             <div style={sh.statusFill}>
                <div className="spinner" style={{ width: 44, height: 44, borderTopColor: meta.color }} />
                <p style={{ marginTop: 24, fontSize: 18, fontWeight: 700, opacity: 0.6 }}>Synchronizing tournament data...</p>
             </div>
          ) : tournaments.length === 0 ? (
             <div style={sh.statusFill}>
                <div style={{ fontSize: 80, marginBottom: 24, opacity: 0.2 }}>🏟️</div>
                <h3 style={{ fontSize: 24, fontWeight: 950 }}>Arena Empty</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>No tournaments are currently active for registration.</p>
             </div>
          ) : (
            <div style={sh.grid}>
              {tournaments.map(t => (
                <div key={t._id} style={sh.card}>
                  <div style={sh.cardHeader}>
                    <div style={{ fontSize: 44, fontWeight: 950, color: meta.color }}>{t.year}</div>
                    <div style={{ ...sh.catBadge, border: `1px solid ${meta.color}40`, color: meta.color }}>{CAT_LABELS[t.category]}</div>
                  </div>
                  <div style={sh.cardBody}>
                    <div style={sh.infoLine}>🗓️ {fmtDate(t.date)}</div>
                    <div style={sh.infoLine}>🕐 {t.time}</div>
                    <div style={sh.infoLine}>📍 {t.venue}</div>
                  </div>
                  {t.isLocked ? (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ ...sh.regBtn, background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'not-allowed', flex: 1 }}>CLOSED</button>
                        <button onClick={() => loadBrackets(t)} style={{ ...sh.regBtn, background: meta.color, flex: 2 }}>VIEW BRACKETS</button>
                    </div>
                  ) : (
                    <button onClick={() => setRegisterFor(t)} style={{ ...sh.regBtn, background: meta.color }}>REGISTER TO COMPETE</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <style>{`
        .live-dot { width: 10px; height: 10px; border-radius: 50%; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0.4; transform: scale(0.8); } }
        .spinner { border: 4px solid var(--border); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {registerFor && <RegisterModal tournament={registerFor} onClose={() => setRegisterFor(null)} />}

      {viewBracketsFor && (
        <div style={bh.overlay} onClick={(e) => e.target === e.currentTarget && setViewBracketsFor(null)}>
           <div style={bh.card}>
              <div style={bh.header}>
                 <h2 style={{ margin: 0 }}>{viewBracketsFor.year} {CAT_LABELS[viewBracketsFor.category]} BRACKET</h2>
                 <button onClick={() => setViewBracketsFor(null)} style={bh.close}>✕</button>
              </div>
              {bracketLoading ? <div style={{ padding: 100, textAlign: 'center' }}>Loading bracket...</div> : (
                <div style={bh.bracketScroll}>
                   <div style={bh.bracketContainer}>
                      {rounds.map((roundMatches, rIdx) => (
                        <div key={rIdx} style={bh.roundColumn}>
                           <div style={bh.roundTitle}>ROUND {rIdx + 1}</div>
                           <div style={bh.matchList}>
                              {roundMatches.map(m => (
                                <div key={m._id} style={{ ...bh.matchCard, borderLeft: `4px solid ${m.isCompleted ? '#10B981' : 'var(--border)'}` }}>
                                   <div style={bh.pRow}>
                                      <span style={{ fontWeight: m.winner?._id === m.player1?._id ? 900 : 400 }}>{m.player1?.playerName || 'TBD'}</span>
                                      <span style={bh.score}>{m.score1}</span>
                                   </div>
                                   <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                   <div style={bh.pRow}>
                                      <span style={{ fontWeight: m.winner?._id === m.player2?._id ? 900 : 400 }}>{m.player2?.playerName || 'TBD'}</span>
                                      <span style={bh.score}>{m.score2}</span>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}

const bh = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 40 },
    card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 40, width: '95vw', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header: { padding: '30px 50px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    close: { background: 'none', border: 'none', color: 'var(--text)', fontSize: 24, cursor: 'pointer' },
    bracketScroll: { flex: 1, overflowX: 'auto', overflowY: 'auto', padding: 50 },
    bracketContainer: { display: 'flex', gap: 60, minWidth: 'max-content' },
    roundColumn: { width: 260, display: 'flex', flexDirection: 'column', gap: 30 },
    roundTitle: { textAlign: 'center', fontSize: 12, fontWeight: 900, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 20 },
    matchList: { display: 'flex', flexDirection: 'column', gap: 40, justifyContent: 'space-around', flex: 1 },
    matchCard: { background: 'var(--bg-input)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' },
    pRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 14 },
    score: { fontWeight: 900, color: 'var(--primary)' }
};

const sh = {
  nav: { height: 100, background: 'var(--nav-bg)', backdropFilter: 'blur(30px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px', position: 'sticky', top: 0, zIndex: 1000 },
  brand: { display: 'flex', alignItems: 'center', gap: 15, cursor: 'pointer' },
  logoCircle: { width: 44, height: 44, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' },
  brandName: { fontWeight: 950, fontSize: 18, letterSpacing: -0.5 },
  sportSwitcher: { display: 'flex', gap: 10, height: '100%' },
  sportBtn: { background: 'none', border: 'none', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.3s' },
  themeToggle: { background: 'var(--bg-input)', border: '1px solid var(--border)', fontSize: 20, padding: '10px', borderRadius: 14, cursor: 'pointer' },
  adminBtn: { background: 'var(--primary)', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 900, fontSize: 13, cursor: 'pointer' },
  hero: { padding: '100px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' },
  heroBlob: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 400, filter: 'blur(150px)', opacity: 0.1, borderRadius: '50%', pointerEvents: 'none' },
  heroTitle: { fontSize: 80, fontWeight: 950, letterSpacing: -4, marginBottom: 12 },
  liveIndicator: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 },
  mainContent: { maxWidth: 1200, margin: '0 auto', padding: '0 40px 100px' },
  containerCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 40, padding: '60px', boxShadow: 'var(--shadow)' },
  statusFill: { minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 32 },
  card: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 32, padding: '40px', transition: 'transform 0.3s' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  catBadge: { background: 'rgba(255,255,255,0.08)', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 950, letterSpacing: 0.5, border: '1px solid rgba(255,255,255,0.1)' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 },
  infoLine: { fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' },
  regBtn: { width: '100%', border: 'none', color: '#000', padding: '18px', borderRadius: 16, fontWeight: 950, fontSize: 14, cursor: 'pointer', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.3)' }
};