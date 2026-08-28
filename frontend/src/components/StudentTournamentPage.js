import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { SUN, MOON, TROPHY, CHECK_MARK, MENU_OPEN, MENU_CLOSE, CALENDAR, HOURGLASS, CLOCK, LOCATION, CLOSE, STADIUM} from '../components/Icons';
import RegisterModal from './RegisterModal';
import { SPORT_META, getSportMeta } from '../constants/sports';

const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};

const SINGLES = ['singles-men', 'singles-women'];

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
const NAME_CELL_WIDTH = 180;

function isHiddenByeMatch(m) {
  return m.isCompleted === true && (!m.player1 || !m.player2);
}

function isMatchWinner(match, player) {
  return Boolean(match?.winner?._id && player?._id && match.winner._id === player._id);
}

// ── Length-based font ladder + horizontal compression for very long names ──
// Geometry (CARD_HEIGHT/COLUMN_WIDTH/etc) is untouched — this only affects
// how the name text itself is sized/rendered inside the existing box.
function getNameStyle(name) {
  const len = name ? name.length : 0;
  let fontSize = 14;
  if (len > 34) fontSize = 11;
  else if (len > 26) fontSize = 12;
  else if (len > 20) fontSize = 13;

  const base = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize,
  };

  if (len > 34) {
    // Widen only this absolutely-positioned inner span (see renderPlayerName)
    // so ellipsis calculates against more characters, then compress it back
    // visually with scaleX. Because the outer wrapper is a fixed-width,
    // overflow:hidden box, this 118% never reserves extra flex layout space
    // or pushes the W/L badge next to it.
    return {
      ...base,
      width: '118%',
      transform: 'scaleX(0.85)',
      transformOrigin: 'left',
    };
  }
  return base;
}

// ── Renders a player's name cell: truncated + shrunk to fit, with
// hover title, aria-label, and tap/click/keyboard-to-reveal — but only
// for names long enough to actually risk truncation.
function renderPlayerName(m, player, slot, getDisplayName, expandedName, setExpandedName) {
  if (!player) return <i style={{ color: '#555' }}>TBD</i>;

  const displayName = getDisplayName(player);
  const key = `${m._id}-${slot}`;
  const isExpanded = expandedName === key;
  const isWinnerPlayer = isMatchWinner(m, player);
  const dimmed = m.isCompleted && m.winner?._id !== player._id;
  const needsInteraction = displayName.length > 20;

  const toggle = () => setExpandedName(isExpanded ? null : key);

  const interactiveProps = needsInteraction ? {
    onClick: toggle,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    onFocus: () => setExpandedName(key),
    onBlur: () => setExpandedName(null),
    tabIndex: 0,
    role: 'button',
    'aria-label': displayName,
  } : {};

  return (
    <span
      title={displayName}
      {...interactiveProps}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: NAME_CELL_WIDTH,
        flexShrink: 0,
        verticalAlign: 'middle',
        cursor: needsInteraction ? 'pointer' : 'default',
      }}
    >
      <span style={{ display: 'block', width: '100%', overflow: 'hidden' }}>
        <span style={{
          display: 'block',
          width: '100%',
          fontWeight: isWinnerPlayer ? 900 : 400,
          color: dimmed ? 'var(--text-muted)' : 'var(--text)',
          ...getNameStyle(displayName),
        }}>
          {displayName}
        </span>
      </span>

      {isExpanded && needsInteraction && (
        <span style={{
          position: 'absolute',
          left: 0,
          top: '100%',
          marginTop: 4,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text)',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          maxWidth: 220,
          zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {displayName}
        </span>
      )}
    </span>
  );
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
  const [expandedName, setExpandedName] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const pollingRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();

  const meta = getSportMeta(sport, isDarkMode) || SPORT_META['badminton'];


  useEffect(() => {
    axios.get(`/api/university-team?sport=${sport}`)
      .then((res) => setTeamMembers(res.data || []))
      .catch(console.error);
  }, [sport]);


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

  const getDisplayName = (player) => {
    if (!player) return '';
    const isDoubles = viewBracketsFor && !SINGLES.includes(viewBracketsFor.category);
    if (isDoubles && player.partnerName) {
      return `${player.playerName} & ${player.partnerName}`;
    }
    return player.playerName;
  };

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
          <div style={sh.logoCircle} className="mobile-logo">{TROPHY}</div>
          <span style={sh.brandName} className="mobile-title-main">UoJ SPORTS</span>
        </div>

        {/* Desktop inline tabs */}
        <div style={sh.sportSwitcher} className="desktop-sport-switcher">
          {Object.keys(SPORT_META).map((s) => {
            const sMeta = getSportMeta(s, isDarkMode);
            return (
              <button
                key={s}
                onClick={() => navigate(`/${s}`)}
                style={{ ...sh.sportBtn, color: sport === s ? sMeta.color : 'var(--text-muted)', borderBottom: sport === s ? `3px solid ${sMeta.color}` : 'none' }}
              >
                <span style={{ fontSize: 24 }}>{sMeta.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 900 }}>{sMeta.label}</span>
              </button>
            );
          })}
        </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }} className="mobile-controls">
          <button onClick={toggleTheme} style={sh.themeToggle} className="mobile-btn">{isDarkMode ? SUN : MOON}</button>
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
            <span className="hamburger-icon">{menuOpen ? MENU_CLOSE : MENU_OPEN}</span>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-dropdown-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-dropdown-menu" onClick={(e) => e.stopPropagation()}>
            {Object.keys(SPORT_META).map((s) => {
              const sMeta = getSportMeta(s, isDarkMode);
              return (
                <button
                  key={s}
                  className={`mobile-dropdown-item${sport === s ? ' active' : ''}`}
                  style={{ '--sport-color': sMeta.color }}
                  onClick={() => { navigate(`/${s}`); setMenuOpen(false); }}
                >
                  <span style={{ fontSize: 22 }}>{sMeta.icon}</span>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{sMeta.label}</span>
                  {sport === s && <span style={{ marginLeft: 'auto', fontSize: 14 }}>{CHECK_MARK}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={sh.hero}>
        <div style={{ ...sh.heroBlob, background: meta.color }} />
        <h1 style={sh.heroTitle} className="mobile-hero-title">{meta.label} RESULTS</h1>

        {/* OFFICIAL LIVE TOURNAMENT BOARD Header */}
        <div style={{ ...sh.liveIndicator, flexDirection: 'column', gap: 14, alignItems: 'center', margin: '24px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="live-dot" style={{ background: '#10B981' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#10B981', letterSpacing: 2 }}>OFFICIAL LIVE TOURNAMENT BOARD</span>
          </div>

          {/* Centered UNIVERSITY TEAM MEMBERS Button inside Official Live Tournament Board */}
          <button
            onClick={() => navigate(`/${sport}/team`)}
            style={{
              padding: '10px 22px',
              borderRadius: 999,
              background: `linear-gradient(135deg, ${meta.color}22, rgba(255,255,255,0.06))`,
              border: `1.5px solid ${meta.color}60`,
              color: 'var(--text)',
              fontWeight: 900,
              fontSize: 12,
              letterSpacing: 0.5,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: `0 8px 24px ${meta.color}25`,
              backdropFilter: 'blur(10px)',
              transition: 'all 0.25s ease',
            }}
            className="team-members-live-board-btn"
          >
            <span style={{ fontSize: 16 }}>🎓</span>
            <span>UNIVERSITY TEAM MEMBERS</span>
            <span style={{
              background: meta.color,
              color: '#000',
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 950,
              marginLeft: 4,
            }}>
              {teamMembers.length}
            </span>
            <span style={{ fontSize: 13 }}>→</span>
          </button>
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
              <div style={{ fontSize: 80, marginBottom: 24, opacity: 0.2 }}>{STADIUM}</div>
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
                      <div style={sh.infoLine}>{CALENDAR} Event: {fmtDate(t.date)}</div>
                      <div style={sh.infoLine}>{HOURGLASS} Closing date: {fmtDeadline(t.registrationDeadline, t.date)}</div>
                      <div style={sh.infoLine}>{CLOCK} {t.time}</div>
                      <div style={sh.infoLine}>{LOCATION} {t.venue}</div>
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
        <div className="modal-overlay" style={bh.overlay} onClick={(e) => {
          if (e.target === e.currentTarget) {
            setViewBracketsFor(null);
            if (location.state?.fromBrackets) navigate('/brackets');
          }
        }}>
          <div className="modal-card" style={bh.card}>
            <div style={bh.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>{viewBracketsFor.year} {CAT_LABELS[viewBracketsFor.category]} BRACKET</h2>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#10B981', background: '#10B98115', border: '1px solid #10B98130', padding: '3px 10px', borderRadius: 20 }}>
                  <span className="live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  LIVE · updates every 10s
                </span>
              </div>
              <button onClick={() => {
                setViewBracketsFor(null);
                if (location.state?.fromBrackets) navigate('/brackets');
              }} style={bh.close}>{CLOSE}</button>
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
                            {renderPlayerName(m, m.player1, 'p1', getDisplayName, expandedName, setExpandedName)}
                            <span style={{ ...bh.score, color: isMatchWinner(m, m.player1) ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: 900 }}>
                              {m.isCompleted && isMatchWinner(m, m.player1) ? '🥇 W' : (m.isCompleted && m.player1 ? 'L' : '')}
                            </span>
                          </div>
                          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                          <div style={bh.pRow}>
                            {renderPlayerName(m, m.player2, 'p2', getDisplayName, expandedName, setExpandedName)}
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

      {/* University Team Members Modal */}
      {showTeamModal && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowTeamModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 2100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            width: 860,
            maxWidth: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            borderRadius: 32,
            border: `1px solid ${meta.color}40`,
            padding: 32,
            boxShadow: `0 35px 90px rgba(0,0,0,0.6), 0 0 40px ${meta.color}20`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 999, background: `${meta.color}20`, color: meta.color, fontSize: 11, fontWeight: 900, marginBottom: 8 }}>
                  <span>{meta.icon}</span> {meta.label} TOURNAMENT SQUAD
                </div>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>UNIVERSITY TEAM MEMBERS</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
                  Official university team members registered for {meta.label.toLowerCase()} tournaments.
                </p>
              </div>

              <button
                onClick={() => setShowTeamModal(false)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            {/* Search Box inside Modal */}
            <div style={{ marginBottom: 24 }}>
              <input
                type="text"
                placeholder={`🔍 Search ${meta.label.toLowerCase()} team member name, reg. no, faculty, role...`}
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {teamMembers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>No Team Members Found</h3>
                <p style={{ fontSize: 14, marginTop: 6 }}>No official university team members are currently registered for the {meta.label} tournament.</p>
              </div>
            ) : (() => {
              const filtered = teamMembers.filter((m) => {
                const q = teamSearchQuery.toLowerCase();
                return (
                  (m.fullName || '').toLowerCase().includes(q) ||
                  (m.registrationNumber || '').toLowerCase().includes(q) ||
                  (m.faculty || '').toLowerCase().includes(q) ||
                  (m.position || '').toLowerCase().includes(q)
                );
              });
              const boys = filtered.filter((m) => (m.teamGender || 'Men') === 'Men');
              const girls = filtered.filter((m) => m.teamGender === 'Women');

              const renderCard = (member) => {
                const badge = (pos) => {
                  const p = (pos || '').toLowerCase();
                  if (p.includes('captain') && !p.includes('vice')) return { bg: 'linear-gradient(135deg, #F59E0B, #D97706)', icon: '👑' };
                  if (p.includes('vice captain') || p.includes('vice-captain')) return { bg: 'linear-gradient(135deg, #06B6D4, #0284C7)', icon: '⭐' };
                  if (p.includes('game admin') || p.includes('admin') || p.includes('manager')) return { bg: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', icon: '🛡️' };
                  return { bg: 'rgba(59, 130, 246, 0.2)', icon: '🎽' };
                };
                const b = badge(member.position);
                const avatarSrc = member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName)}&background=random&size=200`;
                const isGirl = member.teamGender === 'Women';

                return (
                  <div
                    key={member._id}
                    style={{
                      background: 'var(--bg-panel)',
                      borderRadius: 20,
                      border: '1px solid var(--border)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    }}
                  >
                    <div style={{ height: 180, position: 'relative', background: 'rgba(0,0,0,0.2)' }}>
                      <img
                        src={avatarSrc}
                        alt={member.fullName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName)}&background=random&size=200`;
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        padding: '4px 12px',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 900,
                        background: b.bg,
                        color: '#FFF',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                      }}>
                        <span>{b.icon}</span> {member.position.toUpperCase()}
                      </div>
                      <div style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 900,
                        background: isGirl ? 'rgba(236, 72, 153, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                        backdropFilter: 'blur(4px)',
                        color: isGirl ? '#EC4899' : '#3B82F6',
                        border: `1px solid ${isGirl ? '#EC4899' : '#3B82F6'}60`,
                      }}>
                        {isGirl ? '👧 Girls' : '👦 Boys'}
                      </div>
                    </div>

                    <div style={{ padding: 18 }}>
                      <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>{member.fullName}</h4>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isGirl ? '#EC4899' : meta.color, marginBottom: 8 }}>
                        🪪 {member.registrationNumber}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-input)' }}>
                        🎓 <strong>Faculty:</strong><br />{member.faculty}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  {/* Boys Team Section */}
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 950, color: '#3B82F6', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid rgba(59, 130, 246, 0.2)', paddingBottom: 8 }}>
                      👦 BOYS TEAM ({boys.length})
                    </h4>
                    {boys.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No Boys Team members listed.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
                        {boys.map(renderCard)}
                      </div>
                    )}
                  </div>

                  {/* Girls Team Section */}
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 950, color: '#EC4899', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid rgba(236, 72, 153, 0.2)', paddingBottom: 8 }}>
                      👧 GIRLS TEAM ({girls.length})
                    </h4>
                    {girls.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No Girls Team members listed.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
                        {girls.map(renderCard)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

const bh = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 40 },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 40, width: '95vw', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { position: 'relative', padding: '30px 50px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  close: { position: 'absolute', top: 15, right: 10, zIndex: 30, width: 44, height: 44, borderRadius: 999, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
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
