import React, { useState, useEffect, useRef } from 'react';
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

export default function BracketsView({ admin, color }) {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scoreModal, setScoreModal] = useState(null);
  const [scores, setScores] = useState({ s1: 0, s2: 0 });
  const [seedingModal, setSeedingModal] = useState(false);
  const [championRegNo, setChampionRegNo] = useState('');
  const [runnerUpRegNo, setRunnerUpRegNo] = useState('');
  const [toast, setToast] = useState('');
  const [lines, setLines] = useState([]);
  const bracketRef = useRef(null);
  const matchRefs = useRef({});

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
    setLines([]);
    if (t.isLocked) fetchMatches(t._id);
  };

  // ── Calculate connector lines after render ─────────────
  useEffect(() => {
    if (matches.length === 0 || !bracketRef.current) return;

    // Small delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      calculateLines();
    }, 100);
    return () => clearTimeout(timer);
  }, [matches]);

  const calculateLines = () => {
    if (!bracketRef.current) return;
    const containerRect = bracketRef.current.getBoundingClientRect();
    const newLines = [];

    matches.forEach(match => {
      if (!match.nextMatchId) return;

      const sourceEl = matchRefs.current[match._id];
      const targetEl = matchRefs.current[match.nextMatchId];

      if (!sourceEl || !targetEl) return;

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      // Start point — right middle of source match card
      const x1 = sourceRect.right - containerRect.left;
      const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;

      // End point — left middle of target match card
      // But we need to connect to player1 or player2 slot
      const x2 = targetRect.left - containerRect.left;

      // positionInNextMatch: 1 = top player, 2 = bottom player
      // Target y = top quarter or bottom quarter of target card
      const y2 = match.positionInNextMatch === 1
        ? targetRect.top + targetRect.height * 0.25 - containerRect.top
        : targetRect.top + targetRect.height * 0.75 - containerRect.top;

      newLines.push({ x1, y1, x2, y2, id: match._id });
    });

    setLines(newLines);
  };

  // ── Generate Draw ──────────────────────────────────────
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
      const regs = res.data;
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

  // ── Reset Draw ─────────────────────────────────────────
  const handleResetDraw = async () => {
    if (!window.confirm('Reset draw? This will delete all matches!')) return;
    setLoading(true);
    try {
      await axios.delete(`/api/tournaments/${selectedTournament._id}/reset-draw`);
      const updatedT = { ...selectedTournament, isLocked: false, isPublished: false };
      setSelectedTournament(updatedT);
      setTournaments(prev => prev.map(t => t._id === updatedT._id ? updatedT : t));
      setMatches([]);
      setLines([]);
      showToast('🔄 Draw reset. You can regenerate now.');
    } catch (err) {
      alert(err.response?.data?.message || 'Reset failed.');
    } finally { setLoading(false); }
  };

  // ── Publish Draw ───────────────────────────────────────
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

  // ── Update Score ───────────────────────────────────────
  const handleUpdateScore = async () => {
    if (scores.s1 === scores.s2) {
      alert('Scores cannot be equal!');
      return;
    }
    try {
      await axios.put(`/api/tournaments/matches/${scoreModal._id}/score`, {
        score1: scores.s1,
        score2: scores.s2,
      });
      setScoreModal(null);
      fetchMatches(selectedTournament._id);
      showToast('✅ Score updated!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update score');
    }
  };

  // ── Filter — hide bye matches ──────────────────────────
  const getDisplayMatches = (roundMatches) => {
    return roundMatches.filter(m => {
      const isByeMatch = m.isCompleted && (!m.player1 || !m.player2);
      return !isByeMatch;
    });
  };

  // Group matches by round
  const rounds = [];
  matches.forEach(m => {
    if (!rounds[m.round - 1]) rounds[m.round - 1] = [];
    rounds[m.round - 1].push(m);
  });

  const getRoundLabel = (roundIndex, totalRounds) => {
    const remaining = totalRounds - roundIndex;
    if (remaining === 1) return 'FINAL';
    if (remaining === 2) return 'SEMI FINALS';
    if (remaining === 3) return 'QUARTER FINALS';
    return `ROUND ${roundIndex + 1}`;
  };

  return (
    <div style={s.container}>
      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}

      {/* Header */}
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
          {/* Status Bar */}
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

            {/* Action Buttons */}
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
                <button
                  onClick={() => exportTournamentResultPDF(selectedTournament, matches)}
                  style={{ ...s.btn, background: '#3B82F6' }}
                >
                  📄 DOWNLOAD PDF
                </button>
              )}
            </div>
          </div>

          {/* Bracket */}
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
            <div style={{ position: 'relative' }}>
              {/* SVG connector lines */}
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 1,
                  overflow: 'visible',
                }}
              >
                {lines.map((line, idx) => {
                  // Mid x point for the bend
                  const midX = (line.x1 + line.x2) / 2;
                  return (
                    <path
                      key={idx}
                      d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
                      fill="none"
                      stroke={`${color}60`}
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  );
                })}
              </svg>

              {/* Bracket columns */}
              <div
                ref={bracketRef}
                style={s.bracketScroll}
                onScroll={() => calculateLines()}
              >
                <div style={s.bracketContainer}>
                  {rounds.map((roundMatches, rIdx) => {
                    const displayMatches = getDisplayMatches(roundMatches);
                    if (displayMatches.length === 0) return null;

                    // Calculate spacing between matches based on round
                    // Each round doubles the space between matches
                    const spacingMultiplier = Math.pow(2, rIdx);
                    const baseGap = 20;
                    const matchGap = baseGap * spacingMultiplier;

                    return (
                      <div key={rIdx} style={{ ...s.roundColumn, gap: matchGap }}>
                        <h3 style={{ ...s.roundTitle, color }}>
                          {getRoundLabel(rIdx, rounds.length)}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: matchGap }}>
                          {displayMatches.map(m => (
                            <div
                              key={m._id}
                              ref={el => matchRefs.current[m._id] = el}
                              style={{
                                ...s.matchCard,
                                borderColor: m.isCompleted ? '#10B981' : 'var(--border)',
                                borderWidth: m.isCompleted ? 2 : 1,
                                position: 'relative',
                                zIndex: 2,
                              }}
                            >
                              {/* Player 1 row */}
                              <div style={s.playerRow}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {m.winner?._id === m.player1?._id && (
                                    <span style={{ ...s.winnerBadge, background: color }}>W</span>
                                  )}
                                  <span style={{
                                    fontSize: 13,
                                    fontWeight: m.winner?._id === m.player1?._id ? 900 : 400,
                                    color: m.winner?._id === m.player1?._id ? 'var(--text)' : 'var(--text-muted)',
                                  }}>
                                    {m.player1?.playerName || <i style={{ color: '#555' }}>TBD</i>}
                                  </span>
                                </div>
                                <span style={{
                                  fontWeight: 900,
                                  fontSize: 15,
                                  color: m.winner?._id === m.player1?._id ? color : 'var(--text-muted)',
                                }}>
                                  {m.isCompleted ? m.score1 : ''}
                                </span>
                              </div>

                              <div style={s.divider} />

                              {/* Player 2 row */}
                              <div style={s.playerRow}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {m.winner?._id === m.player2?._id && (
                                    <span style={{ ...s.winnerBadge, background: color }}>W</span>
                                  )}
                                  <span style={{
                                    fontSize: 13,
                                    fontWeight: m.winner?._id === m.player2?._id ? 900 : 400,
                                    color: m.winner?._id === m.player2?._id ? 'var(--text)' : 'var(--text-muted)',
                                  }}>
                                    {m.player2?.playerName || <i style={{ color: '#555' }}>TBD</i>}
                                  </span>
                                </div>
                                <span style={{
                                  fontWeight: 900,
                                  fontSize: 15,
                                  color: m.winner?._id === m.player2?._id ? color : 'var(--text-muted)',
                                }}>
                                  {m.isCompleted ? m.score2 : ''}
                                </span>
                              </div>

                              {/* Enter Score Button */}
                              {!m.isCompleted && m.player1 && m.player2 && (
                                <button
                                  onClick={() => { setScoreModal(m); setScores({ s1: 0, s2: 0 }); }}
                                  style={{ ...s.scoreBtn, borderColor: color, color }}
                                >
                                  Enter Score
                                </button>
                              )}

                              {/* Completed badge */}
                              {m.isCompleted && (
                                <div style={s.completedBadge}>✓ COMPLETED</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seeding Modal */}
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

      {/* Score Modal */}
      {scoreModal && (
        <div style={modalS.overlay} onClick={(e) => e.target === e.currentTarget && setScoreModal(null)}>
          <div style={modalS.content}>
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 900 }}>Enter Match Score</h3>
            <div style={modalS.row}>
              <div style={modalS.playerCol}>
                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 14 }}>
                  {scoreModal.player1?.playerName}
                </div>
                <input
                  type="number"
                  value={scores.s1}
                  onChange={e => setScores({ ...scores, s1: parseInt(e.target.value) || 0 })}
                  style={modalS.input}
                  min={0}
                />
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-muted)' }}>VS</div>
              <div style={modalS.playerCol}>
                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 14 }}>
                  {scoreModal.player2?.playerName}
                </div>
                <input
                  type="number"
                  value={scores.s2}
                  onChange={e => setScores({ ...scores, s2: parseInt(e.target.value) || 0 })}
                  style={modalS.input}
                  min={0}
                />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>
              ⚠️ Scores cannot be equal!
            </p>
            <div style={modalS.actions}>
              <button onClick={() => setScoreModal(null)} style={modalS.cancel}>CANCEL</button>
              <button onClick={handleUpdateScore} style={{ ...modalS.confirm, background: color }}>
                CONFIRM RESULT
              </button>
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
  bracketScroll: { overflowX: 'auto', paddingBottom: 40, position: 'relative' },
  bracketContainer: { display: 'flex', gap: 80, minWidth: 'max-content', padding: '20px 0', alignItems: 'flex-start' },
  roundColumn: { width: 220, display: 'flex', flexDirection: 'column' },
  roundTitle: { textAlign: 'center', fontSize: 11, letterSpacing: 2, fontWeight: 950, marginBottom: 16 },
  matchCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' },
  playerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' },
  divider: { height: 1, background: 'var(--border)', margin: '6px 0' },
  score: { fontWeight: 950, width: 30, textAlign: 'right', fontSize: 16 },
  scoreBtn: { width: '100%', marginTop: 10, padding: '8px', borderRadius: 8, background: 'transparent', border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 800 },
  winnerBadge: { color: '#000', fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3 },
  completedBadge: { marginTop: 6, fontSize: 10, color: '#10B981', fontWeight: 800, textAlign: 'right' },
  loading: { textAlign: 'center', padding: 50, color: 'var(--text-muted)' },
  toast: { position: 'fixed', top: 24, right: 24, background: '#10B981', color: '#fff', padding: '14px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
};

const modalS = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  content: { background: 'var(--bg-card)', padding: 40, borderRadius: 24, width: 520, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--border)' },
  label: { display: 'block', fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8 },
  input: { width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 16, fontWeight: 700, textAlign: 'center', boxSizing: 'border-box' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, margin: '20px 0' },
  playerCol: { flex: 1, textAlign: 'center' },
  actions: { display: 'flex', gap: 10, marginTop: 10 },
  cancel: { flex: 1, padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 800, fontSize: 12 },
  secondary: { flex: 1, padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', cursor: 'pointer', fontWeight: 800, fontSize: 12 },
  confirm: { flex: 2, padding: 14, borderRadius: 10, border: 'none', color: '#FFF', cursor: 'pointer', fontWeight: 900, fontSize: 12 },
};