import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import RegisterModal from './RegisterModal';

const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};

const SPORT_META = {
  badminton: { label: 'BADMINTON', icon: '🏸', color: '#3B82F6' },
  'table-tennis': { label: 'TABLE TENNIS', icon: '🏓', color: '#8B5CF6' },
  carrom: { label: 'CARROM', icon: '🎯', color: '#EC4899' },
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDeadline = (d, fallback) => {
  const target = d || fallback;
  if (!target) return 'N/A';
  return new Date(target).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const CARD_HEIGHT = 96;
const GAP = 28;
const COLUMN_WIDTH = 260;
const COLUMN_GAP = 70;

function isHiddenByeMatch(m) {
  return m.isCompleted === true && (!m.player1 || !m.player2);
}

function isMatchWinner(match, player) {
  return Boolean(match?.winner?._id && player?._id && match.winner._id === player._id);
}

export default function StudentTournamentPage({ sport }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerFor, setRegisterFor] = useState(null);
  const [viewBracketsFor, setViewBracketsFor] = useState(null);
  const [matches, setMatches] = useState([]);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [positions, setPositions] = useState({});
  const [lines, setLines] = useState([]);
  const [containerHeight, setContainerHeight] = useState(400);
  const [menuOpen, setMenuOpen] = useState(false);
  const pollingRef = useRef(null);
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

  // If URL contains ?view=<tournamentId>, open that bracket automatically after tournaments load
  useEffect(() => {
    if (!tournaments || tournaments.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const viewId = params.get('view');
      if (!viewId) return;
      const found = tournaments.find(t => String(t._id) === String(viewId));
      if (found) {
        // push state to remove the query param to avoid repeated opens
        const url = new URL(window.location.href);
        url.searchParams.delete('view');
        window.history.replaceState({}, '', url.toString());
        loadBrackets(found);
      }
    } catch (err) { /* ignore */ }
  }, [tournaments]);

  const fetchBracketMatches = async (t) => {
    try {
      const res = await axios.get(`/api/tournaments/public/${t._id}/matches?sport=${sport}`);
      setMatches(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        // Silently ignore 404 during polling — bracket may have been unpublished
      } else {
        console.error(err);
      }
    }
  };

  const loadBrackets = async (t) => {
    setViewBracketsFor(t);
    setBracketLoading(true);
    try {
      const res = await axios.get(`/api/tournaments/public/${t._id}/matches?sport=${sport}`);
      setMatches(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        alert('The bracket has not been published yet. Check back later!');
        setViewBracketsFor(null);
      } else {
        console.error(err);
      }
    } finally { setBracketLoading(false); }
  };

  // FR-5.3 — Auto-refresh bracket every 10 seconds while the modal is open
  useEffect(() => {
    if (!viewBracketsFor) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    pollingRef.current = setInterval(() => {
      fetchBracketMatches(viewBracketsFor);
    }, 10000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [viewBracketsFor]);

  // Group raw matches by round
  const roundsMap = {};
  matches.forEach(m => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });
  const roundNums = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

  const visibleByRound = {};
  roundNums.forEach(r => {
    visibleByRound[r] = (roundsMap[r] || [])
      .filter(m => !isHiddenByeMatch(m))
      .sort((a, b) => a.matchNumber - b.matchNumber);
  });

  // ── VERIFIED TIGHT-STACKING POSITION ALGORITHM ─────────
  // Same fix proven on the admin BracketsView — every round (hidden +
  // visible matches) gets an evenly-spaced position, so later rounds
  // always average from valid, non-compressed feeder positions.
  useLayoutEffect(() => {
    if (roundNums.length === 0) return;

    const pos = {};
    const firstRound = roundNums[0];
    const round1All = (roundsMap[firstRound] || []).slice().sort((a, b) => a.matchNumber - b.matchNumber);
    round1All.forEach((m, i) => {
      pos[m._id] = { top: i * (CARD_HEIGHT + GAP), roundIdx: 0 };
    });

    for (let ri = 1; ri < roundNums.length; ri++) {
      const r = roundNums[ri];
      const prevR = roundNums[ri - 1];
      const prevAll = roundsMap[prevR] || [];

      const feedMap = {};
      prevAll.forEach(pm => {
        if (!pm.nextMatchId) return;
        if (!feedMap[pm.nextMatchId]) feedMap[pm.nextMatchId] = [];
        feedMap[pm.nextMatchId].push(pm);
      });

      const thisRoundAll = (roundsMap[r] || []).slice().sort((a, b) => a.matchNumber - b.matchNumber);
      thisRoundAll.forEach(m => {
        const feeders = feedMap[m._id] || [];
        const centers = feeders.map(f => pos[f._id].top + CARD_HEIGHT / 2);
        const avg = centers.length > 0 ? centers.reduce((a, b) => a + b, 0) / centers.length : 0;
        pos[m._id] = { top: avg - CARD_HEIGHT / 2, roundIdx: ri };
      });
    }

    setPositions(pos);
    const allTops = Object.values(pos).map(p => p.top + CARD_HEIGHT);
    setContainerHeight(Math.max(400, ...allTops) + 60);
  }, [matches]);

  // ── Lines derived directly from position data ──────────
  useEffect(() => {
    if (Object.keys(positions).length === 0) return;

    const newLines = [];

    for (let ri = 0; ri < roundNums.length - 1; ri++) {
      const r = roundNums[ri];
      const prevVisible = visibleByRound[r] || [];

      const groups = {};
      prevVisible.forEach(m => {
        if (!m.nextMatchId || !positions[m.nextMatchId]) return;
        if (!groups[m.nextMatchId]) groups[m.nextMatchId] = [];
        groups[m.nextMatchId].push(m);
      });

      Object.entries(groups).forEach(([targetId, sources]) => {
        const targetPos = positions[targetId];
        if (!targetPos) return;

        const targetX = targetPos.roundIdx * (COLUMN_WIDTH + COLUMN_GAP);
        const targetCenterY = targetPos.top + CARD_HEIGHT / 2;

        const validSources = sources.filter(src => positions[src._id]);
        if (validSources.length === 0) return;

        const sourceX = positions[validSources[0]._id].roundIdx * (COLUMN_WIDTH + COLUMN_GAP) + COLUMN_WIDTH;
        const stubs = validSources.map(src => ({
          x1: sourceX,
          y1: positions[src._id].top + CARD_HEIGHT / 2,
        }));

        const midX = (sourceX + targetX) / 2;

        if (stubs.length === 1) {
          const s = stubs[0];
          newLines.push({
            path: `M ${s.x1} ${s.y1} L ${midX} ${s.y1} L ${midX} ${targetCenterY} L ${targetX} ${targetCenterY}`,
            id: `${targetId}-single-${ri}`,
          });
        } else {
          stubs.forEach((s, i) => {
            newLines.push({ path: `M ${s.x1} ${s.y1} L ${midX} ${s.y1}`, id: `${targetId}-stub-${ri}-${i}` });
          });
          const ys = stubs.map(s => s.y1);
          newLines.push({
            path: `M ${midX} ${Math.min(...ys)} L ${midX} ${Math.max(...ys)}`,
            id: `${targetId}-vert-${ri}`,
          });
          newLines.push({
            path: `M ${midX} ${targetCenterY} L ${targetX} ${targetCenterY}`,
            id: `${targetId}-final-${ri}`,
          });
        }
      });
    }

    setLines(newLines);
  }, [positions]);

  const getRoundLabel = (roundIdx, totalRounds) => {
    const remaining = totalRounds - roundIdx;
    if (remaining === 1) return 'FINAL';
    if (remaining === 2) return 'SEMI FINALS';
    if (remaining === 3) return 'QUARTER FINALS';
    return `ROUND ${roundIdx + 1}`;
  };

  const totalWidth = roundNums.length * (COLUMN_WIDTH + COLUMN_GAP);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-main)' }}>

      <nav style={sh.nav} className="mobile-nav">
        <div style={sh.brand} onClick={() => navigate('/')} className="mobile-brand">
          <div style={sh.logoCircle} className="mobile-logo">🏆</div>
          <span style={sh.brandName} className="mobile-title-main">UoJ SPORTS</span>
        </div>

        {/* Desktop inline tabs */}
        <div style={sh.sportSwitcher} className="desktop-sport-switcher">
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

        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }} className="mobile-controls">
          <button onClick={toggleTheme} style={sh.themeToggle} className="mobile-btn">{isDarkMode ? '🌞' : '🌙'}</button>
          <button onClick={() => navigate(`/admin/login?sport=${encodeURIComponent(sport)}`)} style={sh.adminBtn} className="mobile-btn">
            <span className="admin-full-text">ADMIN</span>
            <span className="admin-short-text">ADMIN</span>
          </button>
          {/* Mobile hamburger button — last item, far right */}
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle game menu"
          >
            <span className="hamburger-icon">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-dropdown-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-dropdown-menu" onClick={(e) => e.stopPropagation()}>
            {Object.keys(SPORT_META).map((s) => (
              <button
                key={s}
                className={`mobile-dropdown-item${sport === s ? ' active' : ''}`}
                style={{ '--sport-color': SPORT_META[s].color }}
                onClick={() => { navigate(`/${s}`); setMenuOpen(false); }}
              >
                <span style={{ fontSize: 22 }}>{SPORT_META[s].icon}</span>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{SPORT_META[s].label}</span>
                {sport === s && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={sh.hero}>
        <div style={{ ...sh.heroBlob, background: meta.color }} />
        <h1 style={sh.heroTitle} className="mobile-hero-title">{meta.label} RESULTS</h1>
        <div style={sh.liveIndicator}>
          <span className="live-dot" style={{ background: '#10B981' }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#10B981', letterSpacing: 2 }}>OFFICIAL LIVE TOURNAMENT BOARD</span>
        </div>
      </div>

      <main style={sh.mainContent} className="mobile-padding-x">
        <div style={sh.containerCard} className="mobile-card">
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
            <div className="responsive-grid-auto">
              {tournaments.map(t => {
                const deadlineVal = t.registrationDeadline || t.date;
                const isDeadlinePassed = deadlineVal && new Date() > new Date(deadlineVal);
                return (
                  <div key={t._id} style={sh.card} className="mobile-card">
                    <div style={sh.cardHeader}>
                      <div style={{ fontSize: 44, fontWeight: 950, color: meta.color }}>{t.year}</div>
                      <div style={{ ...sh.catBadge, border: `1px solid ${meta.color}40`, color: meta.color }}>{CAT_LABELS[t.category]}</div>
                    </div>
                    <div style={sh.cardBody}>
                      <div style={sh.infoLine}>🗓️ Event: {fmtDate(t.date)}</div>
                      <div style={sh.infoLine}>⏳ Closing date: {fmtDeadline(t.registrationDeadline, t.date)}</div>
                      <div style={sh.infoLine}>🕐 {t.time}</div>
                      <div style={sh.infoLine}>📍 {t.venue}</div>
                    </div>
                    {t.isPublished ? (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ ...sh.regBtn, background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'not-allowed', flex: 1 }}>CLOSED</button>
                        <button onClick={() => loadBrackets(t)} style={{ ...sh.regBtn, background: meta.color, flex: 2 }}>VIEW BRACKETS</button>
                      </div>
                    ) : t.isLocked ? (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ ...sh.regBtn, background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'not-allowed', flex: 1 }}>CLOSED</button>
                        <button style={{ ...sh.regBtn, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', cursor: 'default', flex: 2 }}>BRACKET PENDING...</button>
                      </div>
                    ) : isDeadlinePassed ? (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ ...sh.regBtn, background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'not-allowed', flex: 1 }}>CLOSED</button>
                        <button style={{ ...sh.regBtn, background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'default', flex: 2 }}>DEADLINE PASSED</button>
                      </div>
                    ) : (
                      <button onClick={() => setRegisterFor(t)} style={{ ...sh.regBtn, background: meta.color }}>REGISTER TO COMPETE</button>
                    )}
                  </div>
                );
              })}
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
        <div className="modal-overlay" style={bh.overlay} onClick={(e) => e.target === e.currentTarget && setViewBracketsFor(null)}>
          <div className="modal-card" style={bh.card}>
            <div style={bh.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>{viewBracketsFor.year} {CAT_LABELS[viewBracketsFor.category]} BRACKET</h2>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#10B981', background: '#10B98115', border: '1px solid #10B98130', padding: '3px 10px', borderRadius: 20 }}>
                  <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  LIVE · updates every 10s
                </span>
              </div>
              <button onClick={() => setViewBracketsFor(null)} style={bh.close}>✕</button>
            </div>
            {bracketLoading ? <div style={{ padding: 100, textAlign: 'center' }}>Loading bracket...</div> : (
              <div style={bh.bracketScroll}>
                <div style={{ position: 'relative', width: totalWidth, height: containerHeight }}>

                  {roundNums.map((r, rIdx) => (
                    <div
                      key={`label-${r}`}
                      style={{
                        position: 'absolute',
                        left: rIdx * (COLUMN_WIDTH + COLUMN_GAP),
                        top: 0,
                        width: COLUMN_WIDTH,
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 900,
                        letterSpacing: 2,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {getRoundLabel(rIdx, roundNums.length)}
                    </div>
                  ))}

                  <svg
                    style={{
                      position: 'absolute',
                      top: 36,
                      left: 0,
                      width: '100%',
                      height: containerHeight,
                      pointerEvents: 'none',
                      overflow: 'visible',
                    }}
                  >
                    {lines.map((line) => (
                      <path key={line.id} d={line.path} fill="none" stroke={`${meta.color}70`} strokeWidth="1.5" />
                    ))}
                  </svg>

                  {roundNums.map((r, rIdx) =>
                    (visibleByRound[r] || []).map(m => {
                      const pos = positions[m._id];
                      if (!pos) return null;
                      return (
                        <div
                          key={m._id}
                          style={{
                            position: 'absolute',
                            left: rIdx * (COLUMN_WIDTH + COLUMN_GAP),
                            top: pos.top + 36,
                            width: COLUMN_WIDTH,
                            height: CARD_HEIGHT,
                            ...bh.matchCard,
                            borderLeft: `4px solid ${m.isCompleted ? '#10B981' : 'var(--border)'}`,
                            boxSizing: 'border-box',
                            zIndex: 2,
                          }}
                        >
                          <div style={bh.pRow}>
                            <span style={{
                              fontWeight: isMatchWinner(m, m.player1) ? 900 : 400,
                              color: m.isCompleted && m.winner?._id !== m.player1?._id ? 'var(--text-muted)' : 'var(--text)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {m.player1?.playerName || 'TBD'}
                            </span>
                            <span style={{ ...bh.score, color: isMatchWinner(m, m.player1) ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: 900 }}>
                              {m.isCompleted && isMatchWinner(m, m.player1) ? '🥇 W' : (m.isCompleted && m.player1 ? 'L' : '')}
                            </span>
                          </div>
                          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                          <div style={bh.pRow}>
                            <span style={{
                              fontWeight: isMatchWinner(m, m.player2) ? 900 : 400,
                              color: m.isCompleted && m.winner?._id !== m.player2?._id ? 'var(--text-muted)' : 'var(--text)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {m.player2?.playerName || 'TBD'}
                            </span>
                            <span style={{ ...bh.score, color: isMatchWinner(m, m.player2) ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: 900 }}>
                              {m.isCompleted && isMatchWinner(m, m.player2) ? '🥇 W' : (m.isCompleted && m.player2 ? 'L' : '')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
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
  card: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 32, padding: '40px', transition: 'transform 0.3s' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  catBadge: { background: 'rgba(255,255,255,0.08)', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 950, letterSpacing: 0.5, border: '1px solid rgba(255,255,255,0.1)' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 },
  infoLine: { fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' },
  regBtn: { width: '100%', border: 'none', color: '#000', padding: '18px', borderRadius: 16, fontWeight: 950, fontSize: 14, cursor: 'pointer', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.3)' }
};
