import React, { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { exportTournamentResultPDF } from '../utils/exporters';
import { LOCK, RESET, WARNING_ROUND, PUBLISH, PDF, LIGHTNING, TARGET, TROPHY, CARET_UP, CARET_DOWN, CHECK_MARK, SUCCESS, MEDAL } from './Icons';

const CAT_LABELS = {
  'singles-men': 'Singles — Men',
  'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men',
  'doubles-women': 'Doubles — Women',
  'mixed-doubles': 'Mixed Doubles',
};

const SINGLES = ['singles-men', 'singles-women'];

// CARD_HEIGHT must equal the card's actual rendered height — the position
// algorithm and connector lines both space/center off this value.
// Singles stay compact; doubles keep extra vertical room for wrapped names
// and the completed-match winner status line.
const SINGLE_CARD_HEIGHT = 110;
const DOUBLE_CARD_HEIGHT = 140;
const GAP = 28;
const COLUMN_WIDTH = 260;
const COLUMN_GAP = 70;
const CARD_NAME_FONT = '13px system-ui, -apple-system, Segoe UI, sans-serif';
const CARD_TEXT_MAX_WIDTH = COLUMN_WIDTH - 54;

let nameMeasureCanvas;

function getNameMeasureContext() {
  if (!nameMeasureCanvas && typeof document !== 'undefined') {
    nameMeasureCanvas = document.createElement('canvas');
  }
  return nameMeasureCanvas ? nameMeasureCanvas.getContext('2d') : null;
}

function measureCardNameWidth(text) {
  const context = getNameMeasureContext();
  if (!context) return text.length * 7;
  context.font = CARD_NAME_FONT;
  return context.measureText(text).width;
}

function normalizeCardName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

function compactPersonName(name) {
  const normalized = normalizeCardName(name);
  if (!normalized) return '';

  const parts = normalized.split(' ');
  if (parts.length <= 2) return normalized;

  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.slice(1, -1).map(token => {
    if (/^[A-Za-z]\.$/.test(token)) return token;
    if (token.length <= 3) return token;
    return `${token[0]}.`;
  });

  const compact = [first, ...middle, last].join(' ');
  if (measureCardNameWidth(compact) <= CARD_TEXT_MAX_WIDTH * 1.75) return compact;

  const tighter = [first, ...parts.slice(1, -1).map(token => `${token[0]}.`), last].join(' ');
  return tighter;
}

function getCardDisplayName(player, isDoubles) {
  if (!player) return '';

  const fullName = isDoubles && player.partnerName
    ? `${normalizeCardName(player.playerName)} & ${normalizeCardName(player.partnerName)}`
    : normalizeCardName(player.playerName);

  if (!fullName) return '';

  const width = measureCardNameWidth(fullName);
  if (width <= CARD_TEXT_MAX_WIDTH) return fullName;

  if (isDoubles && player.partnerName) {
    if (width <= CARD_TEXT_MAX_WIDTH * 2) return fullName;

    const playerName = compactPersonName(player.playerName);
    const partnerName = compactPersonName(player.partnerName);
    return `${playerName} & ${partnerName}`;
  }

  if (width <= CARD_TEXT_MAX_WIDTH * 2) return fullName;

  return compactPersonName(player.playerName);
}

function isHiddenByeMatch(m) {
  return m.isCompleted === true && (!m.player1 || !m.player2);
}

function isMatchWinner(match, player) {
  return Boolean(match?.winner?._id && player?._id && match.winner._id === player._id);
}

// ── Match label e.g. "Match 2.1" — uses the match's position within its
// own round's visible list (1st, 2nd, 3rd...) rather than the raw
// matchNumber field, since matchNumber is a global sequence across the
// whole draw and can jump around within a round (e.g. round 1 showing
// matchNumbers 1 and 4). Position-in-round always reads sequentially,
// matching top-to-bottom order in the bracket. No backend change needed.
function getMatchLabel(roundIdx, positionInRound) {
  return `Match ${roundIdx + 1}.${positionInRound + 1}`;
}

export default function BracketsView({ admin, color, initialTournamentId }) {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultModal, setResultModal] = useState(null);
  const [seedingModal, setSeedingModal] = useState(false);
  const [championRegNo, setChampionRegNo] = useState('');
  const [runnerUpRegNo, setRunnerUpRegNo] = useState('');
  const [toast, setToast] = useState('');
  const [positions, setPositions] = useState({});
  const [lines, setLines] = useState([]);
  const [containerHeight, setContainerHeight] = useState(400);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const isSinglesTournament = selectedTournament ? SINGLES.includes(selectedTournament.category) : false;
  const CARD_HEIGHT = isSinglesTournament ? SINGLE_CARD_HEIGHT : DOUBLE_CARD_HEIGHT;
  const cardPaddingY = isSinglesTournament ? 5 : 8;
  const playerRowMinHeight = isSinglesTournament ? 28 : 34;
  const footerMinHeight = isSinglesTournament ? 16 : 18;
  const footerFontSize = isSinglesTournament ? 9 : 11;
  // ── Click-to-reveal player info. Holds { key, rect, expanded } — rect is
  // the trigger's viewport bounding box, captured on click, used to
  // position the popover via a portal so it's never clipped by the card's
  // overflow:hidden or the bracket's horizontal scroll container.
  // `expanded` gates the second, more sensitive tier of fields (NIC,
  // phone, address) behind an explicit "View full details" click — the
  // first tier only shows Reg No / Department / Gender / Email. ──
  const [activePlayerInfo, setActivePlayerInfo] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.custom-select-container')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [dropdownOpen]);

  // ── Close player-info popover on outside click, Escape, or any scroll ──
  // (scroll/resize close it rather than reposition it, since the anchor
  // rect is captured once at click time and the bracket area scrolls
  // horizontally independently of the page).
  useEffect(() => {
    if (!activePlayerInfo) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.player-info-trigger') && !e.target.closest('.player-info-popover')) {
        setActivePlayerInfo(null);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setActivePlayerInfo(null);
    };
    const handleScrollOrResize = () => setActivePlayerInfo(null);
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activePlayerInfo]);

  useEffect(() => { fetchTournaments(); }, []);

  useEffect(() => {
    if (!initialTournamentId || !tournaments.length) return;
    const tournament = tournaments.find(t => String(t._id) === String(initialTournamentId));
    if (tournament && selectedTournament?._id !== tournament._id) handleSelectTournament(tournament);
  }, [initialTournamentId, tournaments]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchTournaments = async () => {
    try {
      const res = await axios.get('/api/tournaments/admin');
      setTournaments(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchMatches = async (tid) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/tournaments/${tid}/matches`);
      setMatches(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSelectTournament = (t) => {
    setSelectedTournament(t);
    setMatches([]);
    setPositions({});
    setLines([]);
    setActivePlayerInfo(null);
    if (t.isLocked) fetchMatches(t._id);
  };

  const roundsMap = {};
  matches.forEach(m => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });
  const roundNums = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

  const visibleByRound = {};
  roundNums.forEach(r => {
    visibleByRound[r] = roundsMap[r]
      .filter(m => !isHiddenByeMatch(m))
      .sort((a, b) => a.matchNumber - b.matchNumber);
  });

  // The final is the single match in the last round. If there's more than
  // one match in the last round, the bracket isn't fully resolved down to
  // one match yet, so we don't show a spotlight (avoids guessing which is
  // "the" final).
  const finalRoundNum = roundNums.length > 0 ? roundNums[roundNums.length - 1] : null;
  const finalRoundMatches = finalRoundNum !== null ? (visibleByRound[finalRoundNum] || []) : [];
  const finalMatch = finalRoundMatches.length === 1 ? finalRoundMatches[0] : null;

  // ── VERIFIED TIGHT-STACKING POSITION ALGORITHM (unchanged) ──
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
  }, [matches, CARD_HEIGHT]);

  // ── Lines derived directly from position data (unchanged) ──
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
  }, [positions, CARD_HEIGHT]);

  const generateDraws = () => {
    const isSingles = SINGLES.includes(selectedTournament.category);
    if (isSingles) {
      setChampionRegNo('');
      setRunnerUpRegNo('');
      setSeedingModal(true);
    } else {
      executeGenerateDraw({});
    }
  };

  const executeGenerateDraw = async (body) => {
    if (!window.confirm('Generate draws? This will lock registrations!')) return;
    setLoading(true);
    try {
      await axios.post(`/api/tournaments/${selectedTournament._id}/generate-draws`, body);
      const updatedT = { ...selectedTournament, isLocked: true };
      setSelectedTournament(updatedT);
      setTournaments(prev => prev.map(t => t._id === updatedT._id ? updatedT : t));
      fetchMatches(updatedT._id);
      showToast('Draw generated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Generation failed.');
    } finally { setLoading(false); }
  };

  const handleSeedingSubmit = async () => {
    setLoading(true);
    setSeedingModal(false);
    try {
      const res = await axios.get(`/api/registrations/tournament/${selectedTournament._id}`);
      const regs = res.data.filter(r => r.status === 'confirmed');
      const champion = regs.find(r => r.rollNumber === championRegNo.trim());
      const runnerUp = regs.find(r => r.rollNumber === runnerUpRegNo.trim());

      if (championRegNo.trim() && !champion) {
        alert(`Champion reg no "${championRegNo}" not found!`);
        setLoading(false);
        return;
      }
      if (runnerUpRegNo.trim() && !runnerUp) {
        alert(`Runner-up reg no "${runnerUpRegNo}" not found!`);
        setLoading(false);
        return;
      }

      await executeGenerateDraw({
        championId: champion?._id || null,
        runnerUpId: runnerUp?._id || null,
      });
    } catch (err) {
      alert('Failed to find players.');
      setLoading(false);
    }
  };

  const handleResetDraw = async () => {
    if (!window.confirm('Reset draw? This will delete all matches!')) return;
    setLoading(true);
    try {
      await axios.delete(`/api/tournaments/${selectedTournament._id}/reset-draw`);
      const updatedT = { ...selectedTournament, isLocked: false, isPublished: false };
      setSelectedTournament(updatedT);
      setTournaments(prev => prev.map(t => t._id === updatedT._id ? updatedT : t));
      setMatches([]);
      setPositions({});
      setLines([]);
      showToast('Draw reset. You can regenerate now.');
    } catch (err) {
      alert(err.response?.data?.message || 'Reset failed.');
    } finally { setLoading(false); }
  };

  const handleForceUnlock = async () => {
    if (!window.confirm('TESTING ONLY: This bypasses the publish-lock safety rule and deletes all matches. Use only for testing, never for real published tournaments. Continue?')) return;
    setLoading(true);
    try {
      await axios.delete(`/api/tournaments/${selectedTournament._id}/force-unlock`);
      const updatedT = { ...selectedTournament, isLocked: false, isPublished: false };
      setSelectedTournament(updatedT);
      setTournaments(prev => prev.map(t => t._id === updatedT._id ? updatedT : t));
      setMatches([]);
      setPositions({});
      setLines([]);
      showToast('Force-unlocked for testing.');
    } catch (err) {
      alert(err.response?.data?.message || 'Force unlock failed.');
    } finally { setLoading(false); }
  };

  const handlePublishDraw = async () => {
    if (!window.confirm('Publish draw? Students will see the bracket. Cannot be undone!')) return;
    setLoading(true);
    try {
      await axios.post(`/api/tournaments/${selectedTournament._id}/publish-draw`);
      const updatedT = { ...selectedTournament, isPublished: true };
      setSelectedTournament(updatedT);
      setTournaments(prev => prev.map(t => t._id === updatedT._id ? updatedT : t));
      showToast('Draw published! Students can now see the bracket.');
    } catch (err) {
      alert(err.response?.data?.message || 'Publish failed.');
    } finally { setLoading(false); }
  };

  // ── Mark Result (W/L only — no scores) ──────────────────
  const handleMarkWinner = async (winnerId) => {
    try {
      await axios.put(`/api/tournaments/matches/${resultModal._id}/score`, { winnerId });
      setResultModal(null);
      fetchMatches(selectedTournament._id);
      showToast('Result confirmed!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update result');
    }
  };

  // ── Display name: full name for popovers / modals; card display is
  // generated separately so the player-info popover always keeps the full
  // original name intact.
  const getDisplayName = (player) => {
    if (!player) return '';
    const isDoubles = selectedTournament && !SINGLES.includes(selectedTournament.category);
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

  // ── Renders a player cell as NAME ONLY on the card — no reg no inline.
  // Singles: one line, the player's name.
  // Doubles: two lines, "Name1  &" then "Name2" (partner), so the pairing
  // reads naturally without cramming registration numbers into the same
  // line. Reg No, Department, Gender, and Email now live exclusively in
  // the click-to-reveal popover (see renderPlayerInfoPortal) — the card
  // itself is purely a scanning surface for "who is this."
  const renderPlayerCell = (m, player, slot) => {
    if (!player) {
      return <i style={{ color: '#555' }}>TBD</i>;
    }

    const key = `${m._id}-${slot}`;
    const isOpen = activePlayerInfo?.key === key;
    const isDoubles = selectedTournament && !SINGLES.includes(selectedTournament.category);
    const displayName = getCardDisplayName(player, isDoubles);

    const isWinner = isMatchWinner(m, player);
    const hasCompletedWinner = m.isCompleted && Boolean(m.winner?._id);
    const isLoser = hasCompletedWinner && !isWinner;
    const textColor = isLoser ? 'var(--text-muted)' : 'var(--text)';

    return (
      <span
        className="player-info-trigger"
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            setActivePlayerInfo(null);
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          setActivePlayerInfo({ key, rect, expanded: false });
        }}
        title={`View details for ${player.playerName}`}
        style={{
          display: 'flex',
          minWidth: 0,
          flex: 1,
          cursor: 'pointer',
        }}
      >
        <span style={{
          fontSize: 13,
          fontWeight: isWinner ? 900 : 400,
          color: textColor,
          whiteSpace: 'normal',
          overflowWrap: 'break-word',
          wordBreak: 'normal',
          lineHeight: 1.15,
          textDecoration: isOpen ? 'underline' : 'none',
          maxWidth: '100%',
          minWidth: 0,
        }}>
          {displayName}
        </span>
      </span>
    );
  };

  // ── The actual popover content, rendered once via portal (see below),
  // positioned from the captured trigger rect rather than CSS relative
  // positioning, so ancestor overflow/scroll can never clip it.
  //
  // Two-tier disclosure:
  //   Tier 1 (always visible): Reg No, Department, Gender, Email — plus
  //   partner's Name/Reg No for doubles. This is what an admin usually
  //   needs during live event operation.
  //   Tier 2 (behind "View full details"): NIC, Phone, Address — shown
  //   only once the admin explicitly asks for it.
  // ──
  const renderPlayerInfoPortal = () => {
    if (!activePlayerInfo) return null;
    const { key, rect, expanded } = activePlayerInfo;
    const [matchId, slot] = [key.slice(0, key.lastIndexOf('-')), key.slice(key.lastIndexOf('-') + 1)];
    const match = matches.find(m => m._id === matchId);
    const player = slot === 'p1' ? match?.player1 : match?.player2;
    if (!match || !player) return null;

    const isDoubles = selectedTournament && !SINGLES.includes(selectedTournament.category);
    const POPOVER_WIDTH = 270;
    const MARGIN = 8;

    // Prefer opening below the trigger; flip above if there's not enough
    // room below the viewport. Prefer left-aligned; flip to right-aligned
    // if it would run off the right edge of the screen.
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < 300 && rect.top > 300;
    const top = openAbove ? rect.top - MARGIN : rect.bottom + MARGIN;
    const overflowsRight = rect.left + POPOVER_WIDTH > window.innerWidth - MARGIN;
    const left = overflowsRight
      ? Math.max(MARGIN, window.innerWidth - POPOVER_WIDTH - MARGIN)
      : rect.left;

    return createPortal(
      <div
        className="player-info-popover"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top,
          left,
          transform: openAbove ? 'translateY(-100%)' : 'none',
          width: POPOVER_WIDTH,
          maxWidth: '90vw',
          maxHeight: '75vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 14,
          zIndex: 2000,
          boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8, color: 'var(--text)' }}>
          {player.playerName}
        </div>

        <PlayerInfoRow label="Reg No" value={player.rollNumber} />
        <PlayerInfoRow label="Department" value={player.department} />
        <PlayerInfoRow label="Gender" value={player.gender} />
        <PlayerInfoRow label="Email" value={player.email} />

        {isDoubles && player.partnerName && (
          <>
            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>
              PARTNER
            </div>
            <PlayerInfoRow label="Name" value={player.partnerName} />
            <PlayerInfoRow label="Reg No" value={player.partnerRollNumber} />
          </>
        )}

        {expanded && (
          <>
            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>
              FULL DETAILS
            </div>
            <PlayerInfoRow label="NIC No" value={player.nicNo} />
            <PlayerInfoRow label="Phone" value={player.phone} />
            <PlayerInfoRow label="Address" value={player.address} />
          </>
        )}

        <button
          onClick={() => setActivePlayerInfo(prev => ({ ...prev, expanded: !prev.expanded }))}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '8px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--primary, #3B82F6)',
            fontWeight: 800,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {expanded ? <>{CARET_UP} Hide full details</> : <>{CARET_DOWN} View full details</>}
        </button>
      </div>,
      document.body
    );
  };

  const totalWidth = roundNums.length * (COLUMN_WIDTH + COLUMN_GAP);

  return (
    <div style={s.container}>
      {toast && <div style={s.toast}>{toast}</div>}

      <header style={{
        ...s.header,
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 16 : 24,
      }}>
        <h2 style={{
          ...s.title,
          fontSize: isMobile ? 22 : 28,
        }}>BRACKET MANAGEMENT</h2>

        <div className="custom-select-container" style={{ ...s.selectWrapper, minWidth: isMobile ? 'auto' : 380, width: isMobile ? '100%' : 'auto', zIndex: isMobile ? 1 : s.selectWrapper.zIndex }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={s.selectTrigger}
            className="custom-select-trigger"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {selectedTournament ? (
                <>
                  <span style={{ fontSize: 11, background: 'var(--border)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)', fontWeight: 800 }}>
                    {selectedTournament.year}
                  </span>
                  <span style={{ fontWeight: 800 }}>
                    {CAT_LABELS[selectedTournament.category]}
                  </span>
                  {selectedTournament.isPublished && (
                    <span style={{
                      ...s.miniBadge,
                      background: '#10B98115',
                      color: '#10B981',
                      border: '1px solid #10B98130'
                    }}>
                      {PUBLISH} PUBLISHED
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>-- SELECT TOURNAMENT --</span>
              )}
            </div>
            <span style={{
              transition: 'transform 0.2s ease',
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
              fontSize: 10,
              color: 'var(--text-muted)'
            }}>{CARET_DOWN}</span>
          </button>

          {dropdownOpen && (
            <div style={s.dropdownList}>
              {tournaments.length === 0 ? (
                <div style={{ padding: '16px', color: 'var(--text-muted)', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                  No tournaments found
                </div>
              ) : (
                tournaments.map(t => (
                  <button
                    key={t._id}
                    onClick={() => {
                      handleSelectTournament(t);
                      setDropdownOpen(false);
                    }}
                    style={{
                      ...s.dropdownItem,
                      background: selectedTournament?._id === t._id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    }}
                    className="dropdown-item-btn"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, background: 'var(--border)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)', fontWeight: 800 }}>{t.year}</span>
                      <span style={{ fontWeight: 800, color: 'var(--text)' }}>{CAT_LABELS[t.category]}</span>
                      {t.isPublished && (
                        <span style={{
                          ...s.miniBadge,
                          background: '#10B98115',
                          color: '#10B981',
                          border: '1px solid #10B98130'
                        }}>
                          PUBLISHED
                        </span>
                      )}
                    </div>
                    {selectedTournament?._id === t._id && (
                      <span style={{ color: 'var(--primary)', fontWeight: 900, fontSize: 16, marginLeft: 8 }}>{CHECK_MARK}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </header>

      {!selectedTournament ? (
        <div style={s.emptyState}>Select a tournament to view or generate brackets.</div>
      ) : (
        <div>
          <div style={{
            ...s.statusBar,
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? 14 : undefined,
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {CAT_LABELS[selectedTournament.category]} — {selectedTournament.year}
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{
                  ...s.badge,
                  background: selectedTournament.isPublished ? '#10B98120' : selectedTournament.isLocked ? '#F59E0B20' : '#3B82F620',
                  color: selectedTournament.isPublished ? '#10B981' : selectedTournament.isLocked ? '#F59E0B' : '#3B82F6',
                  border: `1px solid ${selectedTournament.isPublished ? '#10B981' : selectedTournament.isLocked ? '#F59E0B' : '#3B82F6'}40`,
                }}>
                  {selectedTournament.isPublished ? 'PUBLISHED' : selectedTournament.isLocked ? <>{LOCK} DRAFT — NOT PUBLISHED YET</> : 'OPEN FOR REGISTRATION'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap', width: isMobile ? '100%' : 'auto' }}>
              {!selectedTournament.isLocked && (
                <button onClick={generateDraws} style={{ ...s.btn, ...(isMobile ? s.mobileStatusAction : {}), background: color }}>
                  {LIGHTNING} GENERATE DRAW
                </button>
              )}
              {selectedTournament.isLocked && !selectedTournament.isPublished && (
                <>
                  <button onClick={handleResetDraw} style={{ ...s.btn, ...(isMobile ? s.mobileStatusAction : {}), background: '#EF4444' }}>
                    {RESET} RESET DRAW
                  </button>
                  <button onClick={handlePublishDraw} style={{ ...s.btn, ...(isMobile ? s.mobileStatusAction : {}), background: '#10B981' }}>
                    {PUBLISH} PUBLISH DRAW
                  </button>
                </>
              )}
              {selectedTournament.isPublished && (
                <>
                  <button
                    onClick={() => exportTournamentResultPDF(selectedTournament, matches)}
                    style={{ ...s.btn, ...(isMobile ? s.mobileStatusAction : {}), background: '#3B82F6' }}
                  >
                    {PDF} DOWNLOAD PDF
                  </button>
                  <button
                    onClick={handleForceUnlock}
                    style={{ ...s.btn, ...(isMobile ? s.mobileStatusAction : {}), background: '#6B7280', fontSize: 11 }}
                    title="Testing only — bypasses the publish safety rule"
                  >
                    {WARNING_ROUND} FORCE UNLOCK (TEST)
                  </button>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div style={s.loading}>Loading bracket...</div>
          ) : matches.length === 0 ? (
            <div style={s.emptyBracket}>
              <div style={{ fontSize: 48 }}>{TARGET}</div>
              <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>
                No draw generated yet. Click "GENERATE DRAW" to start.
              </p>
            </div>
          ) : (
            <>
              {/* ── Final spotlight — pulled out above the tree. No dedicated
                  3rd-place match exists in the current data model (only
                  round/matchNumber tree matches), so that box from the
                  reference design isn't shown here — it would need a real
                  backend-generated 3rd-place match to do correctly. ── */}
              {finalMatch && (
                <div style={s.spotlightRow}>
                  <div style={s.spotlightCard}>
                    <div style={s.spotlightLabel}>
                      {getMatchLabel(roundNums.length - 1, 0)} — FINAL
                    </div>
                    <SpotlightMatchBody
                      match={finalMatch}
                      getDisplayName={getDisplayName}
                      color={color}
                    />
                  </div>
                </div>
              )}

              <div style={{ overflowX: 'auto', paddingBottom: 40 }}>
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
                        fontSize: 11,
                        letterSpacing: 2,
                        fontWeight: 950,
                        color,
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
                      <path key={line.id} d={line.path} fill="none" stroke={`${color}70`} strokeWidth="1.5" />
                    ))}
                  </svg>

                  {roundNums.map((r, rIdx) =>
                    (visibleByRound[r] || []).map((m, posInRound) => {
                      const pos = positions[m._id];
                      if (!pos) return null;

                      const p1IsWinner = isMatchWinner(m, m.player1);
                      const p2IsWinner = isMatchWinner(m, m.player2);
                      const p1IsLoser = m.isCompleted && m.winner?._id !== m.player1?._id && m.player1;
                      const p2IsLoser = m.isCompleted && m.winner?._id !== m.player2?._id && m.player2;

                      return (
                        <div
                          key={m._id}
                          style={{
                            position: 'absolute',
                            left: rIdx * (COLUMN_WIDTH + COLUMN_GAP),
                            top: pos.top + 36,
                            width: COLUMN_WIDTH,
                            height: CARD_HEIGHT,
                            ...s.matchCard,
                            padding: `${cardPaddingY}px 14px`,
                            borderColor: m.isCompleted ? '#10B981' : 'var(--border)',
                            borderWidth: m.isCompleted ? 2 : 1,
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            zIndex: 2,
                          }}
                        >
                          <div style={s.matchLabel}>{getMatchLabel(rIdx, posInRound)}</div>

                          <div style={{ ...s.playerRow, minHeight: playerRowMinHeight }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0, flex: 1 }}>
                              {p1IsWinner && <span style={{ ...s.winnerBadge, background: color, marginTop: 1 }}>W</span>}
                              {p1IsLoser && <span style={{ ...s.loserBadge, marginTop: 1 }}>L</span>}
                              {renderPlayerCell(m, m.player1, 'p1')}
                            </div>
                          </div>

                          <div style={s.divider} />

                          <div style={{ ...s.playerRow, minHeight: playerRowMinHeight }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0, flex: 1 }}>
                              {p2IsWinner && <span style={{ ...s.winnerBadge, background: color, marginTop: 1 }}>W</span>}
                              {p2IsLoser && <span style={{ ...s.loserBadge, marginTop: 1 }}>L</span>}
                              {renderPlayerCell(m, m.player2, 'p2')}
                            </div>
                          </div>

                          {/* Footer slot keeps only the action button. Completed
                              matches intentionally leave it empty; W/L badges
                              above are the result indicator. */}
                          <div style={{ ...s.cardFooter, minHeight: footerMinHeight }}>
                            {!m.isCompleted && m.player1 && m.player2 && (
                              <button
                                onClick={() => setResultModal(m)}
                                style={{
                                  ...s.scoreBtn,
                                  borderColor: color,
                                  color,
                                  padding: isSinglesTournament ? '4px 6px' : '6px',
                                  fontSize: isSinglesTournament ? 9 : 10,
                                }}
                              >
                                Mark Result
                              </button>
                            )}
                            {m.isCompleted && (m.winner || p1IsWinner || p2IsWinner) && (
                              <div style={{ ...s.winnerCaption, fontSize: footerFontSize, lineHeight: 1.2, overflowWrap: 'break-word', textAlign: 'left' }}>
                                {CHECK_MARK} RESULT CONFIRMED
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {seedingModal && (
        <div style={modalS.overlay} onClick={(e) => e.target === e.currentTarget && setSeedingModal(false)}>
          <div style={modalS.content}>
            <h3 style={{ marginBottom: 8, fontSize: 20, fontWeight: 900 }}>
              {TROPHY} Seeding — Previous Year Results
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Enter registration numbers of previous year's champion and runner-up.
              Leave blank for fully random draw.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={modalS.label}>{MEDAL} CHAMPION REG NO</label>
              <input
                type="text"
                value={championRegNo}
                onChange={e => setChampionRegNo(e.target.value.toUpperCase())}
                placeholder="e.g. 2022/CSC/001"
                style={modalS.input}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={modalS.label}>{MEDAL} RUNNER-UP REG NO</label>
              <input
                type="text"
                value={runnerUpRegNo}
                onChange={e => setRunnerUpRegNo(e.target.value.toUpperCase())}
                placeholder="e.g. 2022/CSC/005"
                style={modalS.input}
              />
            </div>
            <div style={modalS.actions}>
              <button onClick={() => setSeedingModal(false)} style={modalS.cancel}>CANCEL</button>
              <button onClick={() => { setSeedingModal(false); executeGenerateDraw({}); }} style={modalS.secondary}>
                SKIP — RANDOM
              </button>
              <button onClick={handleSeedingSubmit} style={{ ...modalS.confirm, background: color }}>
                GENERATE WITH SEEDING
              </button>
            </div>
          </div>
        </div>
      )}

      {/* W/L Result Modal — replaces numeric score modal */}
      {resultModal && (
        <div className="modal-overlay" style={modalS.overlay} onClick={(e) => e.target === e.currentTarget && setResultModal(null)}>
          <div className="modal-card" style={modalS.content}>
            <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 900 }}>Mark Match Result</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Select the player who won this match.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => {
                  if (window.confirm(`Confirm ${getDisplayName(resultModal.player1)} as winner? This cannot be undone.`)) {
                    handleMarkWinner(resultModal.player1._id);
                  }
                }}
                style={modalS.winnerOption}
              >
                {TROPHY} {getDisplayName(resultModal.player1)} <span style={{ opacity: 0.7, fontWeight: 600 }}>— WINS</span>
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Confirm ${getDisplayName(resultModal.player2)} as winner? This cannot be undone.`)) {
                    handleMarkWinner(resultModal.player2._id);
                  }
                }}
                style={modalS.winnerOption}
              >
                {TROPHY} {getDisplayName(resultModal.player2)} <span style={{ opacity: 0.7, fontWeight: 600 }}>— WINS</span>
              </button>
            </div>
            <div style={modalS.actions}>
              <button onClick={() => setResultModal(null)} style={modalS.cancel}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {renderPlayerInfoPortal()}
    </div>
  );
}

// ── Small labeled row inside the player-info popover; skips empty fields ──
function PlayerInfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

// ── Body of the Final spotlight card ──
function SpotlightMatchBody({ match, getDisplayName, color }) {
  const p1IsWinner = Boolean(match.winner?._id && match.player1?._id && match.winner._id === match.player1._id);
  const p2IsWinner = Boolean(match.winner?._id && match.player2?._id && match.winner._id === match.player2._id);

  return (
    <>
      <div style={spotlightS.row}>
        <span style={{ fontWeight: p1IsWinner ? 900 : 500 }}>
          {match.player1 ? getDisplayName(match.player1) : 'TBD'}
        </span>
        {match.isCompleted && match.player1 && (
          <span style={{ ...spotlightS.badge, color: p1IsWinner ? '#10B981' : '#EF4444' }}>
            {p1IsWinner ? 'W' : 'L'}
          </span>
        )}
      </div>
      <div style={spotlightS.row}>
        <span style={{ fontWeight: p2IsWinner ? 900 : 500 }}>
          {match.player2 ? getDisplayName(match.player2) : 'TBD'}
        </span>
        {match.isCompleted && match.player2 && (
          <span style={{ ...spotlightS.badge, color: p2IsWinner ? '#10B981' : '#EF4444' }}>
            {p2IsWinner ? 'W' : 'L'}
          </span>
        )}
      </div>
    </>
  );
}

const spotlightS = {
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 14 },
  badge: { fontWeight: 900, fontSize: 12 },
  winnerLine: { fontSize: 12, fontWeight: 800, marginTop: 8 },
};

const s = {
  container: { padding: '40px 0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 950, margin: 0, letterSpacing: 1 },
  selectWrapper: { position: 'relative', minWidth: 380, zIndex: 999 },
  selectTrigger: { width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, outline: 'none', boxSizing: 'border-box' },
  dropdownList: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: 'var(--bg-card)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 12px 30px rgba(0,0,0,0.3)', maxHeight: 280, overflowY: 'auto', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: 6, gap: 2 },
  dropdownItem: { width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', outline: 'none' },
  miniBadge: { fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 4, letterSpacing: 0.5, textTransform: 'uppercase', display: 'inline-block' },
  select: { padding: '12px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  emptyState: { padding: 100, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 20, color: 'var(--text-muted)', fontSize: 18, border: '1px dashed var(--border)' },
  emptyBracket: { textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)' },
  statusBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' },
  badge: { display: 'inline-block', padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 800, letterSpacing: 1 },
  btn: { border: 'none', color: '#FFF', padding: '12px 24px', borderRadius: 10, fontWeight: 900, cursor: 'pointer', fontSize: 13 },
  mobileStatusAction: { flex: '1 1 120px', minWidth: 0, boxSizing: 'border-box', padding: '12px 8px', lineHeight: 1.2, textAlign: 'center' },
  matchCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column' },
  matchLabel: { flex: '0 0 auto', fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.5, marginBottom: 4, lineHeight: '12px' },
  playerRow: { flex: '0 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  divider: { flex: '0 0 auto', height: 1, background: 'var(--border)', margin: '3px 0' },
  // Flex-grow so this area always fills whatever space is left in the fixed
  // CARD_HEIGHT box — whether it holds a caption, a button, or nothing.
  cardFooter: { flex: '1 1 auto', display: 'flex', alignItems: 'center', minHeight: 0 },
  winnerCaption: { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' },
  scoreBtn: { width: '100%', padding: '6px', borderRadius: 6, background: 'transparent', border: '1px solid', cursor: 'pointer', fontSize: 10, fontWeight: 800 },
  winnerBadge: { color: '#000', fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, flexShrink: 0 },
  loserBadge: { background: '#EF444430', color: '#EF4444', fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, flexShrink: 0 },
  loading: { textAlign: 'center', padding: 50, color: 'var(--text-muted)' },
  toast: { position: 'fixed', top: 24, right: 24, background: '#10B981', color: '#fff', padding: '14px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
  spotlightRow: { marginBottom: 28, display: 'flex', justifyContent: 'center' },
  spotlightCard: { background: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: 16, padding: '20px 28px', minWidth: 320, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
  spotlightLabel: { fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' },
};

const modalS = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  content: { background: 'var(--bg-card)', padding: 40, borderRadius: 24, width: 520, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--border)' },
  label: { display: 'block', fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8 },
  input: { width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 16, fontWeight: 700, textAlign: 'center', boxSizing: 'border-box' },
  winnerOption: { width: '100%', padding: '16px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 15, fontWeight: 800, textAlign: 'left', cursor: 'pointer' },
  actions: { display: 'flex', gap: 10, marginTop: 20 },
  cancel: { flex: 1, padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 800, fontSize: 12 },
  secondary: { flex: 1, padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', cursor: 'pointer', fontWeight: 800, fontSize: 12 },
  confirm: { flex: 2, padding: 14, borderRadius: 10, border: 'none', color: '#FFF', cursor: 'pointer', fontWeight: 900, fontSize: 12 },
};