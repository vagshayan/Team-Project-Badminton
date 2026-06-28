import React, { useState, useEffect, useLayoutEffect } from 'react';
import axios from 'axios';
import { exportTournamentResultPDF } from '../utils/exporters';

const CAT_LABELS = {
  'singles-men': 'Singles — Men',
  'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men',
  'doubles-women': 'Doubles — Women',
  'mixed-doubles': 'Mixed Doubles',
};

const SINGLES = ['singles-men', 'singles-women'];

const CARD_HEIGHT = 96;
const GAP = 28;
const COLUMN_WIDTH = 260;
const COLUMN_GAP = 70;

function isHiddenByeMatch(m) {
  return m.isCompleted === true && (!m.player1 || !m.player2);
}

export default function BracketsView({ admin, color }) {
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

  useEffect(() => { fetchTournaments(); }, []);

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
  }, [matches]);

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
  }, [positions]);

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
      showToast('✅ Draw generated successfully!');
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
      showToast('🔄 Draw reset. You can regenerate now.');
    } catch (err) {
      alert(err.response?.data?.message || 'Reset failed.');
    } finally { setLoading(false); }
  };

  const handleForceUnlock = async () => {
    if (!window.confirm('⚠️ TESTING ONLY: This bypasses the publish-lock safety rule and deletes all matches. Use only for testing, never for real published tournaments. Continue?')) return;
    setLoading(true);
    try {
      await axios.delete(`/api/tournaments/${selectedTournament._id}/force-unlock`);
      const updatedT = { ...selectedTournament, isLocked: false, isPublished: false };
      setSelectedTournament(updatedT);
      setTournaments(prev => prev.map(t => t._id === updatedT._id ? updatedT : t));
      setMatches([]);
      setPositions({});
      setLines([]);
      showToast('⚠️ Force-unlocked for testing.');
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
      showToast('🌐 Draw published! Students can now see the bracket.');
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
      showToast('✅ Result confirmed!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update result');
    }
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
    <div style={s.container}>
      {toast && <div style={s.toast}>{toast}</div>}

      <header style={s.header}>
        <h2 style={s.title}>BRACKET MANAGEMENT</h2>
        <select
          value={selectedTournament?._id || ''}
          onChange={(e) => {
            const t = tournaments.find(t => t._id === e.target.value);
            if (t) handleSelectTournament(t);
          }}
          style={s.select}
        >
          <option value="">-- SELECT TOURNAMENT --</option>
          {tournaments.map(t => (
            <option key={t._id} value={t._id}>
              {t.year} - {CAT_LABELS[t.category]}
              {t.isPublished ? ' 🌐' : t.isLocked ? ' 🔒' : ' 📋'}
            </option>
          ))}
        </select>
      </header>

      {!selectedTournament ? (
        <div style={s.emptyState}>Select a tournament to view or generate brackets.</div>
      ) : (
        <div>
          <div style={s.statusBar}>
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
                  {selectedTournament.isPublished ? '🌐 PUBLISHED' : selectedTournament.isLocked ? '🔒 DRAFT — NOT PUBLISHED YET' : '📋 OPEN FOR REGISTRATION'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {!selectedTournament.isLocked && (
                <button onClick={generateDraws} style={{ ...s.btn, background: color }}>
                  ⚡ GENERATE DRAW
                </button>
              )}
              {selectedTournament.isLocked && !selectedTournament.isPublished && (
                <>
                  <button onClick={handleResetDraw} style={{ ...s.btn, background: '#EF4444' }}>
                    🔄 RESET DRAW
                  </button>
                  <button onClick={handlePublishDraw} style={{ ...s.btn, background: '#10B981' }}>
                    🌐 PUBLISH DRAW
                  </button>
                </>
              )}
              {selectedTournament.isPublished && (
                <>
                  <button
                    onClick={() => exportTournamentResultPDF(selectedTournament, matches)}
                    style={{ ...s.btn, background: '#3B82F6' }}
                  >
                    📄 DOWNLOAD PDF
                  </button>
                  <button
                    onClick={handleForceUnlock}
                    style={{ ...s.btn, background: '#6B7280', fontSize: 11 }}
                    title="Testing only — bypasses the publish safety rule"
                  >
                    ⚠️ FORCE UNLOCK (TEST)
                  </button>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div style={s.loading}>Loading bracket...</div>
          ) : matches.length === 0 ? (
            <div style={s.emptyBracket}>
              <div style={{ fontSize: 48 }}>🎯</div>
              <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>
                No draw generated yet. Click "GENERATE DRAW" to start.
              </p>
            </div>
          ) : (
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
                          ...s.matchCard,
                          borderColor: m.isCompleted ? '#10B981' : 'var(--border)',
                          borderWidth: m.isCompleted ? 2 : 1,
                          boxSizing: 'border-box',
                          zIndex: 2,
                        }}
                      >
                        <div style={s.playerRow}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            {m.winner?._id === m.player1?._id && (
                              <span style={{ ...s.winnerBadge, background: color }}>W</span>
                            )}
                            {m.isCompleted && m.winner?._id !== m.player1?._id && m.player1 && (
                              <span style={s.loserBadge}>L</span>
                            )}
                            <span style={{
                              fontSize: 13,
                              fontWeight: m.winner?._id === m.player1?._id ? 900 : 400,
                              color: m.winner?._id === m.player1?._id ? 'var(--text)' : 'var(--text-muted)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {m.player1?.playerName || <i style={{ color: '#555' }}>TBD</i>}
                            </span>
                          </div>
                        </div>

                        <div style={s.divider} />

                        <div style={s.playerRow}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            {m.winner?._id === m.player2?._id && (
                              <span style={{ ...s.winnerBadge, background: color }}>W</span>
                            )}
                            {m.isCompleted && m.winner?._id !== m.player2?._id && m.player2 && (
                              <span style={s.loserBadge}>L</span>
                            )}
                            <span style={{
                              fontSize: 13,
                              fontWeight: m.winner?._id === m.player2?._id ? 900 : 400,
                              color: m.winner?._id === m.player2?._id ? 'var(--text)' : 'var(--text-muted)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {m.player2?.playerName || <i style={{ color: '#555' }}>TBD</i>}
                            </span>
                          </div>
                        </div>

                        {!m.isCompleted && m.player1 && m.player2 && (
                          <button
                            onClick={() => setResultModal(m)}
                            style={{ ...s.scoreBtn, borderColor: color, color }}
                          >
                            Mark Result
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {seedingModal && (
        <div style={modalS.overlay} onClick={(e) => e.target === e.currentTarget && setSeedingModal(false)}>
          <div style={modalS.content}>
            <h3 style={{ marginBottom: 8, fontSize: 20, fontWeight: 900 }}>
              🏆 Seeding — Previous Year Results
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Enter registration numbers of previous year's champion and runner-up.
              Leave blank for fully random draw.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={modalS.label}>🥇 CHAMPION REG NO</label>
              <input
                type="text"
                value={championRegNo}
                onChange={e => setChampionRegNo(e.target.value.toUpperCase())}
                placeholder="e.g. 2022/CSC/001"
                style={modalS.input}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={modalS.label}>🥈 RUNNER-UP REG NO</label>
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
        <div style={modalS.overlay} onClick={(e) => e.target === e.currentTarget && setResultModal(null)}>
          <div style={modalS.content}>
            <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 900 }}>Mark Match Result</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Select the player who won this match.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => {
                  if (window.confirm(`Confirm ${resultModal.player1?.playerName} as winner? This cannot be undone.`)) {
                    handleMarkWinner(resultModal.player1._id);
                  }
                }}
                style={modalS.winnerOption}
              >
                🏆 {resultModal.player1?.playerName} <span style={{ opacity: 0.7, fontWeight: 600 }}>— WINS</span>
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Confirm ${resultModal.player2?.playerName} as winner? This cannot be undone.`)) {
                    handleMarkWinner(resultModal.player2._id);
                  }
                }}
                style={modalS.winnerOption}
              >
                🏆 {resultModal.player2?.playerName} <span style={{ opacity: 0.7, fontWeight: 600 }}>— WINS</span>
              </button>
            </div>
            <div style={modalS.actions}>
              <button onClick={() => setResultModal(null)} style={modalS.cancel}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { padding: '40px 0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 950, margin: 0, letterSpacing: 1 },
  select: { padding: '12px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  emptyState: { padding: 100, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 20, color: 'var(--text-muted)', fontSize: 18, border: '1px dashed var(--border)' },
  emptyBracket: { textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)' },
  statusBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' },
  badge: { display: 'inline-block', padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 800, letterSpacing: 1 },
  btn: { border: 'none', color: '#FFF', padding: '12px 24px', borderRadius: 10, fontWeight: 900, cursor: 'pointer', fontSize: 13 },
  matchCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  playerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' },
  divider: { height: 1, background: 'var(--border)', margin: '4px 0' },
  scoreBtn: { width: '100%', marginTop: 8, padding: '6px', borderRadius: 6, background: 'transparent', border: '1px solid', cursor: 'pointer', fontSize: 10, fontWeight: 800 },
  winnerBadge: { color: '#000', fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, flexShrink: 0 },
  loserBadge: { background: '#EF444430', color: '#EF4444', fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, flexShrink: 0 },
  loading: { textAlign: 'center', padding: 50, color: 'var(--text-muted)' },
  toast: { position: 'fixed', top: 24, right: 24, background: '#10B981', color: '#fff', padding: '14px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
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