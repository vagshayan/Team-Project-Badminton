import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { exportTournamentResultPDF } from '../utils/exporters';

const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};

export default function BracketsView({ admin, color }) {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scoreModal, setScoreModal] = useState(null);
  const [scores, setScores] = useState({ s1: 0, s2: 0 });

  useEffect(() => {
    fetchTournaments();
  }, []);

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
    if (t.isLocked) {
      fetchMatches(t._id);
    } else {
      setMatches([]);
    }
  };

  const generateDraws = async () => {
    if (!window.confirm("Generate draws? This will lock registrations!")) return;
    setLoading(true);
    try {
      await axios.post(`/api/tournaments/${selectedTournament._id}/generate-draws`);
      const updatedT = { ...selectedTournament, isLocked: true };
      setSelectedTournament(updatedT);
      setTournaments(prev => prev.map(t => t._id === updatedT._id ? updatedT : t));
      fetchMatches(updatedT._id);
    } catch (err) {
      alert(err.response?.data?.message || "Generation failed. Make sure you have enough confirmed players.");
    } finally { setLoading(false); }
  };

  const handleUpdateScore = async () => {
    try {
      await axios.put(`/api/tournaments/matches/${scoreModal._id}/score`, {
        score1: scores.s1,
        score2: scores.s2
      });
      setScoreModal(null);
      fetchMatches(selectedTournament._id);
    } catch (err) { alert("Failed to update score"); }
  };

  // Group matches by round
  const rounds = [];
  matches.forEach(m => {
    if (!rounds[m.round - 1]) rounds[m.round - 1] = [];
    rounds[m.round - 1].push(m);
  });

  return (
    <div style={s.container}>
      <header style={s.header}>
        <h2 style={s.title}>BRACKET MANAGEMENT</h2>
        <div style={s.selector}>
          <select 
            value={selectedTournament?._id || ''} 
            onChange={(e) => handleSelectTournament(tournaments.find(t => t._id === e.target.value))}
            style={s.select}
          >
            <option value="">-- SELECT TOURNAMENT --</option>
            {tournaments.map(t => (
              <option key={t._id} value={t._id}>{t.year} - {CAT_LABELS[t.category]}</option>
            ))}
          </select>
        </div>
      </header>

      {!selectedTournament ? (
        <div style={s.emptyState}>Select a tournament to view or generate brackets.</div>
      ) : (
        <div style={s.content}>
          <div style={s.toolbar}>
             {selectedTournament.isLocked && (
               <button onClick={() => exportTournamentResultPDF(selectedTournament, matches)} style={{ ...s.btn, background: '#10B981', marginRight: 15 }}>📄 DOWNLOAD RESULTS SUMMARY</button>
             )}
             {selectedTournament.isLocked ? (
               <div style={s.statusBadge}>🔒 REGISTRATIONS LOCKED</div>
             ) : (
               <button onClick={generateDraws} style={{ ...s.btn, background: color }}>GENERATE DRAWS & LOCK</button>
             )}
          </div>

          {loading ? <div style={s.loading}>Generating bracket structure...</div> : (
            <div style={s.bracketScroll}>
               <div style={s.bracketContainer}>
                  {rounds.length === 0 && selectedTournament.isLocked && <div style={{ color: '#666' }}>No matches found.</div>}
                  {rounds.map((roundMatches, rIdx) => (
                    <div key={rIdx} style={s.roundColumn}>
                       <h3 style={s.roundTitle}>ROUND {rIdx + 1}</h3>
                       <div style={s.matchList}>
                          {roundMatches.map(m => (
                            <div key={m._id} style={{ ...s.matchCard, borderColor: m.isCompleted ? '#10B981' : 'var(--border)' }}>
                               <div style={s.playerRow}>
                                  <span style={{ fontWeight: m.winner?._id === m.player1?._id ? 900 : 400 }}>
                                    {m.player1?.playerName || <i style={{ color: '#888' }}>TBD</i>}
                                  </span>
                                  <span style={s.score}>{m.score1}</span>
                               </div>
                               <div style={s.divider} />
                               <div style={s.playerRow}>
                                  <span style={{ fontWeight: m.winner?._id === m.player2?._id ? 900 : 400 }}>
                                    {m.player2?.playerName || <i style={{ color: '#888' }}>TBD</i>}
                                  </span>
                                  <span style={s.score}>{m.score2}</span>
                               </div>
                               {!m.isCompleted && m.player1 && m.player2 && (
                                 <button 
                                   onClick={() => { setScoreModal(m); setScores({ s1: 0, s2: 0 }); }} 
                                   style={s.scoreBtn}
                                 >Enter Score</button>
                               )}
                            </div>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      )}

      {scoreModal && (
        <div style={modalS.overlay}>
           <div style={modalS.content}>
              <h3 style={{ marginBottom: 20 }}>Match Score Update</h3>
              <div style={modalS.row}>
                 <div style={modalS.playerCol}>
                    <div style={{ fontWeight: 800 }}>{scoreModal.player1.playerName}</div>
                    <input type="number" value={scores.s1} onChange={e => setScores({...scores, s1: parseInt(e.target.value) || 0})} style={modalS.input} />
                 </div>
                 <div style={{ fontSize: 24, fontWeight: 900 }}>VS</div>
                 <div style={modalS.playerCol}>
                    <div style={{ fontWeight: 800 }}>{scoreModal.player2.playerName}</div>
                    <input type="number" value={scores.s2} onChange={e => setScores({...scores, s2: parseInt(e.target.value) || 0})} style={modalS.input} />
                 </div>
              </div>
              <div style={modalS.actions}>
                 <button onClick={() => setScoreModal(null)} style={modalS.cancel}>Cancel</button>
                 <button onClick={handleUpdateScore} style={{ ...modalS.confirm, background: color }}>Confirm Result</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { padding: '40px 0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontWeight: 950, margin: 0 },
  select: { padding: '12px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontWeight: 800, cursor: 'pointer' },
  emptyState: { padding: 100, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 40, color: 'var(--text-muted)', fontSize: 18, border: '1px dashed var(--border)' },
  content: { animation: 'fadeIn 0.5s ease' },
  toolbar: { marginBottom: 30, display: 'flex', justifyContent: 'flex-end' },
  btn: { border: 'none', color: '#FFF', padding: '14px 28px', borderRadius: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.2)' },
  statusBadge: { padding: '10px 20px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', fontWeight: 900, fontSize: 12 },
  bracketScroll: { overflowX: 'auto', paddingBottom: 40 },
  bracketContainer: { display: 'flex', gap: 60, minWidth: 'max-content', padding: '20px 0' },
  roundColumn: { width: 280, display: 'flex', flexDirection: 'column', gap: 30 },
  roundTitle: { textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 950, marginBottom: 10 },
  matchList: { display: 'flex', flexDirection: 'column', gap: 40, justifyContent: 'space-around', flex: 1 },
  matchCard: { background: 'var(--bg-card)', border: '2px solid var(--border)', borderRadius: 16, padding: 16, boxShadow: 'var(--shadow)', position: 'relative' },
  playerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, padding: '4px 0' },
  score: { fontWeight: 950, color: 'var(--primary)', width: 30, textAlign: 'right' },
  divider: { height: 1, background: 'var(--border)', margin: '8px 0' },
  scoreBtn: { width: '100%', marginTop: 12, padding: '8px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 11, fontWeight: 800 },
  loading: { textAlign: 'center', padding: 50, color: 'var(--text-muted)' },
};

const modalS = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  content: { background: 'var(--bg-card)', padding: 40, borderRadius: 32, width: 500, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--border)' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, margin: '30px 0' },
  playerCol: { flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 },
  input: { width: '100%', padding: 15, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 24, fontWeight: 900, textAlign: 'center' },
  actions: { display: 'flex', gap: 15, marginTop: 20 },
  cancel: { flex: 1, padding: 15, borderRadius: 12, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 800 },
  confirm: { flex: 2, padding: 15, borderRadius: 12, border: 'none', color: '#FFF', cursor: 'pointer', fontWeight: 900 }
}
