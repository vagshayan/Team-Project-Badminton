import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

const SPORT_META = {
  badminton: { label: 'Badminton', icon: '🏸', color: '#3B82F6', lightBg: 'rgba(59, 130, 246, 0.12)' },
  'table-tennis': { label: 'Table Tennis', icon: '🏓', color: '#8B5CF6', lightBg: 'rgba(139, 92, 246, 0.12)' },
  carrom: { label: 'Carrom', icon: '🎯', color: '#EC4899', lightBg: 'rgba(236, 72, 153, 0.12)' },
};

const SCORE_CLASSIFICATION_COLORS = {
  'Outstanding': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: '#10B981' },
  'Excellent': { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: '#3B82F6' },
  'Good': { bg: 'rgba(139, 92, 246, 0.15)', text: '#8B5CF6', border: '#8B5CF6' },
  'Developing': { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: '#F59E0B' },
  'Needs Improvement': { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: '#EF4444' },
};

export default function HeadToHeadComparison({
  initialSport = 'badminton',
  defaultPlayerA = '',
  defaultPlayerB = '',
  onSportChange,
}) {
  const { isDarkMode } = useTheme();
  const [sport, setSport] = useState(initialSport);
  const [playerAInput, setPlayerAInput] = useState(defaultPlayerA);
  const [playerBInput, setPlayerBInput] = useState(defaultPlayerB);
  const [activePlayerA, setActivePlayerA] = useState(defaultPlayerA);
  const [activePlayerB, setActivePlayerB] = useState(defaultPlayerB);

  const [playersList, setPlayersList] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const meta = SPORT_META[sport] || SPORT_META.badminton;

  // Sync sport change from props if controlled externally
  useEffect(() => {
    if (initialSport && initialSport !== sport) {
      setSport(initialSport);
    }
  }, [initialSport]);

  // Sync initial players if passed as props
  useEffect(() => {
    if (defaultPlayerA && !activePlayerA) {
      setPlayerAInput(defaultPlayerA);
      setActivePlayerA(defaultPlayerA);
    }
    if (defaultPlayerB && !activePlayerB) {
      setPlayerBInput(defaultPlayerB);
      setActivePlayerB(defaultPlayerB);
    }
  }, [defaultPlayerA, defaultPlayerB]);

  // Fetch quick player list for autocomplete / chips
  useEffect(() => {
    setLoadingPlayers(true);
    axios.get(`/api/analytics/players?sport=${sport}&limit=30`)
      .then((res) => {
        const list = res.data || [];
        setPlayersList(list);

        // Auto-populate default 2 players if none selected
        if (!activePlayerA && list.length > 0) {
          setActivePlayerA(list[0].rollNumber);
          setPlayerAInput(list[0].rollNumber);
        }
        if (!activePlayerB && list.length > 1) {
          setActivePlayerB(list[1].rollNumber);
          setPlayerBInput(list[1].rollNumber);
        }
      })
      .catch((err) => console.warn('Failed to load players list:', err))
      .finally(() => setLoadingPlayers(false));
  }, [sport]);

  // Fetch comparison data when activePlayerA, activePlayerB, or sport changes
  useEffect(() => {
    if (!activePlayerA || !activePlayerB) {
      setComparisonData(null);
      return;
    }

    if (activePlayerA.trim().toLowerCase() === activePlayerB.trim().toLowerCase()) {
      setErrorMessage('Please select two different players to compare.');
      setComparisonData(null);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    axios.get(`/api/analytics/h2h?playerA=${encodeURIComponent(activePlayerA)}&playerB=${encodeURIComponent(activePlayerB)}&sport=${sport}`)
      .then((res) => {
        setComparisonData(res.data);
      })
      .catch((err) => {
        console.error('H2H fetch error:', err);
        const msg = err.response?.data?.message || 'Failed to calculate Head-to-Head comparison.';
        setErrorMessage(msg);
        setComparisonData(null);
      })
      .finally(() => setLoading(false));
  }, [activePlayerA, activePlayerB, sport]);

  const handleCompareSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanA = playerAInput.trim();
    const cleanB = playerBInput.trim();

    if (!cleanA || !cleanB) {
      setErrorMessage('Please enter registration numbers for both Player A and Player B.');
      return;
    }

    if (cleanA.toLowerCase() === cleanB.toLowerCase()) {
      setErrorMessage('Cannot compare a player with themselves. Please pick two different players.');
      return;
    }

    setActivePlayerA(cleanA);
    setActivePlayerB(cleanB);
  };

  const handleSwapPlayers = () => {
    const tempInput = playerAInput;
    const tempActive = activePlayerA;

    setPlayerAInput(playerBInput);
    setActivePlayerA(activePlayerB);

    setPlayerBInput(tempInput);
    setActivePlayerB(tempActive);
  };

  const handleQuickPairSelect = (rollA, rollB) => {
    setPlayerAInput(rollA);
    setActivePlayerA(rollA);
    setPlayerBInput(rollB);
    setActivePlayerB(rollB);
  };

  const handleSportSelect = (newSport) => {
    setSport(newSport);
    if (onSportChange) onSportChange(newSport);
  };

  // Generate suggested rivalries from players list
  const suggestedPairs = useMemo(() => {
    if (playersList.length < 2) return [];
    const pairs = [];
    for (let i = 0; i < Math.min(playersList.length - 1, 4); i += 2) {
      if (playersList[i] && playersList[i + 1]) {
        pairs.push({
          p1: playersList[i],
          p2: playersList[i + 1],
        });
      }
    }
    return pairs;
  }, [playersList]);

  return (
    <div style={{ width: '100%', maxWidth: 1280, margin: '0 auto', padding: '0 16px 40px' }}>
      
      {/* ── SPORT SELECTOR TABS ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 28,
        flexWrap: 'wrap',
      }}>
        {Object.entries(SPORT_META).map(([key, item]) => {
          const isSelected = sport === key;
          return (
            <button
              key={key}
              onClick={() => handleSportSelect(key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isSelected ? item.color : 'var(--bg-card)',
                color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                border: isSelected ? `2px solid ${item.color}` : '1px solid var(--border)',
                boxShadow: isSelected ? `0 6px 20px ${item.color}40` : 'none',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── DUAL PLAYER SELECTOR BAR ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '24px',
        marginBottom: 28,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
      }}>
        <form onSubmit={handleCompareSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 16,
            alignItems: 'center',
          }} className="h2h-selector-grid">
            
            {/* Player A Input */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#3B82F6', marginBottom: 8, letterSpacing: 0.5 }}>
                PLAYER 1 (BLUE CORNER)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={playerAInput}
                  onChange={(e) => setPlayerAInput(e.target.value)}
                  placeholder="Enter Player A Registration No..."
                  list="players-list-a"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 15,
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                    borderLeft: '4px solid #3B82F6',
                  }}
                />
                <datalist id="players-list-a">
                  {playersList.map((p) => (
                    <option key={`a-${p.rollNumber}`} value={p.rollNumber}>
                      {p.playerName} ({p.department})
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            {/* Swap Button / VS */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 18 }}>
              <button
                type="button"
                onClick={handleSwapPlayers}
                title="Swap Players"
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  background: 'var(--bg-panel)',
                  border: '2px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: 18,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'rotate(180deg) scale(1.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'rotate(0deg) scale(1)')}
              >
                ⇄
              </button>
              <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-muted)', marginTop: 4 }}>
                SWAP
              </span>
            </div>

            {/* Player B Input */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#EC4899', marginBottom: 8, letterSpacing: 0.5 }}>
                PLAYER 2 (RED/PINK CORNER)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={playerBInput}
                  onChange={(e) => setPlayerBInput(e.target.value)}
                  placeholder="Enter Player B Registration No..."
                  list="players-list-b"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 15,
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                    borderLeft: '4px solid #EC4899',
                  }}
                />
                <datalist id="players-list-b">
                  {playersList.map((p) => (
                    <option key={`b-${p.rollNumber}`} value={p.rollNumber}>
                      {p.playerName} ({p.department})
                    </option>
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Compare Action Button */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
            <button
              type="submit"
              style={{
                padding: '14px 36px',
                borderRadius: 12,
                background: `linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%)`,
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 900,
                fontSize: 15,
                letterSpacing: 0.5,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 6px 24px rgba(139, 92, 246, 0.4)',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <span>⚔️ Compare Head-to-Head</span>
              <span>→</span>
            </button>
          </div>
        </form>

        {/* Suggested Rivalries Quick Picks */}
        {suggestedPairs.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10 }}>
              ⚡ SUGGESTED MATCHUPS:
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {suggestedPairs.map((pair, idx) => (
                <button
                  key={`pair-${idx}`}
                  type="button"
                  onClick={() => handleQuickPairSelect(pair.p1.rollNumber, pair.p2.rollNumber)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = meta.color)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <span style={{ color: '#3B82F6' }}>{pair.p1.playerName.split(' ')[0]}</span>
                  <span style={{ opacity: 0.5, fontSize: 10 }}>VS</span>
                  <span style={{ color: '#EC4899' }}>{pair.p2.playerName.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── ERROR STATE ──────────────────────────────────────────────────────── */}
      {errorMessage && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 14,
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#EF4444',
          marginBottom: 28,
          fontSize: 14,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── LOADING STATE ────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: 20,
          border: '1px solid var(--border)',
        }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px', borderColor: meta.color, borderTopColor: 'transparent' }} />
          <div style={{ fontWeight: 800, fontSize: 16 }}>Analyzing Head-to-Head Statistics...</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Evaluating historical match encounters, career metrics, and win probabilities
          </div>
        </div>
      )}

      {/* ── COMPARISON REPORT ────────────────────────────────────────────────── */}
      {!loading && comparisonData && (
        <div>
          {/* 1. HERO BATTLE CARD & TUG-OF-WAR METER */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: '32px 24px',
            marginBottom: 28,
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Background Glows */}
            <div style={{
              position: 'absolute',
              top: -60,
              left: -60,
              width: 250,
              height: 250,
              borderRadius: '50%',
              background: '#3B82F6',
              filter: 'blur(100px)',
              opacity: 0.15,
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              bottom: -60,
              right: -60,
              width: 250,
              height: 250,
              borderRadius: '50%',
              background: '#EC4899',
              filter: 'blur(100px)',
              opacity: 0.15,
              pointerEvents: 'none',
            }} />

            {/* Side-by-Side Player Profiles */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: 20,
              alignItems: 'center',
              marginBottom: 32,
            }} className="h2h-profiles-grid">
              
              {/* Player A Profile */}
              <div style={{
                textAlign: 'center',
                padding: '20px',
                borderRadius: 18,
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}>
                <div style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                  color: '#FFFFFF',
                  fontSize: 28,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 6px 20px rgba(59, 130, 246, 0.35)',
                }}>
                  {comparisonData.playerA.profile.photo ? (
                    <img
                      src={comparisonData.playerA.profile.photo}
                      alt={comparisonData.playerA.profile.name}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    comparisonData.playerA.profile.name.charAt(0)
                  )}
                </div>
                <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>
                  {comparisonData.playerA.profile.name}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6', marginTop: 2 }}>
                  {comparisonData.playerA.profile.rollNumber}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {comparisonData.playerA.profile.department}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {comparisonData.playerA.profile.rank && (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#3B82F6',
                      fontSize: 11,
                      fontWeight: 800,
                    }}>
                      🏆 Rank #{comparisonData.playerA.profile.rank}
                    </span>
                  )}
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: SCORE_CLASSIFICATION_COLORS[comparisonData.playerA.performanceScore?.classification]?.bg || 'rgba(59, 130, 246, 0.1)',
                    color: SCORE_CLASSIFICATION_COLORS[comparisonData.playerA.performanceScore?.classification]?.text || '#3B82F6',
                    fontSize: 11,
                    fontWeight: 800,
                  }}>
                    {comparisonData.playerA.performanceScore?.totalScore || 0} pts ({comparisonData.playerA.performanceScore?.classification})
                  </span>
                </div>
              </div>

              {/* Central VS Divider & Direct Record */}
              <div style={{ textAlign: 'center', minWidth: 120 }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--bg-panel)',
                  border: '2px solid var(--border)',
                  fontSize: 18,
                  fontWeight: 950,
                  color: 'var(--text)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  marginBottom: 10,
                }}>
                  VS
                </div>
                <div style={{ fontSize: 24, fontWeight: 950, letterSpacing: 1 }}>
                  <span style={{ color: '#3B82F6' }}>{comparisonData.headToHead.playerAWins}</span>
                  <span style={{ opacity: 0.3, margin: '0 6px' }}>-</span>
                  <span style={{ color: '#EC4899' }}>{comparisonData.headToHead.playerBWins}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase' }}>
                  {comparisonData.headToHead.totalEncounters} {comparisonData.headToHead.totalEncounters === 1 ? 'Encounter' : 'Encounters'}
                </div>
              </div>

              {/* Player B Profile */}
              <div style={{
                textAlign: 'center',
                padding: '20px',
                borderRadius: 18,
                background: 'rgba(236, 72, 153, 0.05)',
                border: '1px solid rgba(236, 72, 153, 0.2)',
              }}>
                <div style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
                  color: '#FFFFFF',
                  fontSize: 28,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 6px 20px rgba(236, 72, 153, 0.35)',
                }}>
                  {comparisonData.playerB.profile.photo ? (
                    <img
                      src={comparisonData.playerB.profile.photo}
                      alt={comparisonData.playerB.profile.name}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    comparisonData.playerB.profile.name.charAt(0)
                  )}
                </div>
                <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>
                  {comparisonData.playerB.profile.name}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EC4899', marginTop: 2 }}>
                  {comparisonData.playerB.profile.rollNumber}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {comparisonData.playerB.profile.department}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {comparisonData.playerB.profile.rank && (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(236, 72, 153, 0.15)',
                      color: '#EC4899',
                      fontSize: 11,
                      fontWeight: 800,
                    }}>
                      🏆 Rank #{comparisonData.playerB.profile.rank}
                    </span>
                  )}
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: SCORE_CLASSIFICATION_COLORS[comparisonData.playerB.performanceScore?.classification]?.bg || 'rgba(236, 72, 153, 0.1)',
                    color: SCORE_CLASSIFICATION_COLORS[comparisonData.playerB.performanceScore?.classification]?.text || '#EC4899',
                    fontSize: 11,
                    fontWeight: 800,
                  }}>
                    {comparisonData.playerB.performanceScore?.totalScore || 0} pts ({comparisonData.playerB.performanceScore?.classification})
                  </span>
                </div>
              </div>

            </div>

            {/* Tug-of-War Split Bar */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                <span style={{ color: '#3B82F6' }}>
                  {comparisonData.headToHead.playerAWins} Wins ({comparisonData.headToHead.playerAWinRate}%)
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {comparisonData.headToHead.totalEncounters === 0 ? 'No prior meetings' : 'Direct Win Split'}
                </span>
                <span style={{ color: '#EC4899' }}>
                  {comparisonData.headToHead.playerBWins} Wins ({comparisonData.headToHead.playerBWinRate}%)
                </span>
              </div>
              <div style={{
                height: 12,
                borderRadius: 999,
                background: 'var(--bg)',
                overflow: 'hidden',
                display: 'flex',
                border: '1px solid var(--border)',
              }}>
                {comparisonData.headToHead.totalEncounters === 0 ? (
                  <div style={{ width: '100%', background: 'var(--border)', opacity: 0.5 }} />
                ) : (
                  <>
                    <div style={{
                      width: `${Math.max(5, comparisonData.headToHead.playerAWinRate)}%`,
                      background: 'linear-gradient(90deg, #2563EB, #3B82F6)',
                      transition: 'width 0.5s ease',
                    }} />
                    <div style={{
                      width: `${Math.max(5, comparisonData.headToHead.playerBWinRate)}%`,
                      background: 'linear-gradient(90deg, #EC4899, #DB2777)',
                      transition: 'width 0.5s ease',
                    }} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 2. PREDICTIVE MATCH ENGINE & VERDICT BOX */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '24px',
            marginBottom: 28,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>🔮</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>SMART MATCH PREDICTION & ANALYTICS</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Algorithmically weighted on H2H record, performance scores, recent form, and career win rates
                </div>
              </div>
            </div>

            {/* Probability Split Gauge */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6' }} />
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#3B82F6' }}>
                    {comparisonData.playerA.profile.name} ({comparisonData.prediction.winProbA}%)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#EC4899' }}>
                    {comparisonData.playerB.profile.name} ({comparisonData.prediction.winProbB}%)
                  </span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EC4899' }} />
                </div>
              </div>

              <div style={{
                height: 16,
                borderRadius: 999,
                background: 'var(--bg)',
                overflow: 'hidden',
                display: 'flex',
                border: '1px solid var(--border)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
              }}>
                <div style={{
                  width: `${comparisonData.prediction.winProbA}%`,
                  background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
                  transition: 'width 0.6s ease',
                }} />
                <div style={{
                  width: `${comparisonData.prediction.winProbB}%`,
                  background: 'linear-gradient(90deg, #F472B6, #EC4899)',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>

            {/* Prediction Verdict Text */}
            <div style={{
              padding: '16px 18px',
              borderRadius: 14,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.6 }}>
                💡 <strong>Analytical Verdict:</strong> {comparisonData.prediction.verdict}
              </div>
            </div>

            {/* Strategic Battle Factors */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8 }}>
                KEY STRATEGIC ADVANTAGES & FACTORS:
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {comparisonData.prediction.keyFactors.map((factor, idx) => (
                  <span
                    key={`factor-${idx}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      color: isDarkMode ? '#C4B5FD' : '#7C3AED',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    • {factor}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 3. SIDE-BY-SIDE ATTRIBUTE COMPARISON */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '24px',
            marginBottom: 28,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 22 }}>📊</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>HEAD-TO-HEAD ATTRIBUTE COMPARISON</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Direct metrics comparison across 6 statistical pillars
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {comparisonData.attributes.map((attr) => {
                const max = attr.maxVal || 100;
                const pctA = Math.min(100, Math.round((attr.valA / max) * 100));
                const pctB = Math.min(100, Math.round((attr.valB / max) * 100));

                return (
                  <div
                    key={attr.key}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 14,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: attr.leader === 'playerA' ? '#3B82F6' : 'var(--text)',
                      }}>
                        {attr.valA} {attr.unit} {attr.leader === 'playerA' && '👑'}
                      </span>

                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {attr.name}
                      </span>

                      <span style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: attr.leader === 'playerB' ? '#EC4899' : 'var(--text)',
                      }}>
                        {attr.leader === 'playerB' && '👑 '} {attr.valB} {attr.unit}
                      </span>
                    </div>

                    {/* Dual Progress Bars */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: 8 }}>
                      {/* Left bar (A) growing from right to left */}
                      <div style={{ background: 'var(--border)', borderRadius: 999, overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{
                          width: `${pctA}%`,
                          background: attr.leader === 'playerA' ? '#3B82F6' : 'rgba(59, 130, 246, 0.4)',
                          borderRadius: 999,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>

                      {/* Right bar (B) growing from left to right */}
                      <div style={{ background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pctB}%`,
                          background: attr.leader === 'playerB' ? '#EC4899' : 'rgba(236, 72, 153, 0.4)',
                          borderRadius: 999,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. DIRECT MATCH ENCOUNTER TIMELINE / TABLE */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '24px',
            marginBottom: 28,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>⚔️</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>PAST DIRECT ENCOUNTERS</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    Official head-to-head match history between these two players
                  </div>
                </div>
              </div>
              <span style={{
                padding: '4px 12px',
                borderRadius: 999,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                fontSize: 12,
                fontWeight: 800,
                color: 'var(--text-muted)',
              }}>
                {comparisonData.headToHead.matches.length} matches recorded
              </span>
            </div>

            {comparisonData.headToHead.matches.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'var(--bg)',
                borderRadius: 16,
                border: '1px dashed var(--border)',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                  No Prior Competitive Encounters Found
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 460, margin: '6px auto 0' }}>
                  These two players have not yet met in an official recorded match in this sport. Their next encounter will be their rivalry premiere!
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 14px' }}>Date / Event</th>
                      <th style={{ padding: '12px 14px' }}>Category & Round</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Score (P1 - P2)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Match Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.headToHead.matches.map((match, idx) => {
                      const isWinnerA = match.winner === 'playerA';
                      const isWinnerB = match.winner === 'playerB';
                      const matchDate = match.date ? new Date(match.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

                      return (
                        <tr
                          key={match.id || `match-${idx}`}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            fontSize: 14,
                            fontWeight: 600,
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                          }}
                        >
                          <td style={{ padding: '14px' }}>
                            <div style={{ fontWeight: 800, color: 'var(--text)' }}>
                              {match.tournamentYear} {meta.label} Tournament
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              📅 {matchDate} • 📍 {match.tournamentVenue}
                            </div>
                          </td>

                          <td style={{ padding: '14px' }}>
                            <div style={{ color: 'var(--text)' }}>{match.tournamentCategory}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Round {match.round}</div>
                          </td>

                          <td style={{ padding: '14px', textAlign: 'center' }}>
                            <span style={{
                              padding: '6px 14px',
                              borderRadius: 8,
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              fontWeight: 900,
                              fontSize: 15,
                              letterSpacing: 1,
                            }}>
                              <span style={{ color: isWinnerA ? '#3B82F6' : 'var(--text)' }}>{match.scoreA}</span>
                              <span style={{ opacity: 0.3, margin: '0 4px' }}>:</span>
                              <span style={{ color: isWinnerB ? '#EC4899' : 'var(--text)' }}>{match.scoreB}</span>
                            </span>
                          </td>

                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            <span style={{
                              padding: '6px 14px',
                              borderRadius: 999,
                              fontWeight: 800,
                              fontSize: 12,
                              background: isWinnerA ? 'rgba(59, 130, 246, 0.15)' : (isWinnerB ? 'rgba(236, 72, 153, 0.15)' : 'var(--bg)'),
                              color: isWinnerA ? '#3B82F6' : (isWinnerB ? '#EC4899' : 'var(--text-muted)'),
                              border: `1px solid ${isWinnerA ? '#3B82F640' : (isWinnerB ? '#EC489940' : 'var(--border)')}`,
                            }}>
                              🏆 {match.winnerName}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5. COMMON OPPONENTS ANALYSIS */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '24px',
            marginBottom: 28,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>👥</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>MUTUAL OPPONENTS COMPARISON</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  How both players performed against common university opponents
                </div>
              </div>
            </div>

            {comparisonData.commonOpponents.length === 0 ? (
              <div style={{
                padding: '24px 20px',
                textAlign: 'center',
                background: 'var(--bg)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 600,
              }}>
                No shared mutual opponents recorded in match records yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {comparisonData.commonOpponents.map((opp) => (
                  <div
                    key={opp.opponentRoll}
                    style={{
                      padding: '16px',
                      borderRadius: 14,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{opp.opponentName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opp.opponentRoll}</div>
                      </div>
                      {opp.edge !== 'even' && (
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          background: opp.edge === 'playerA' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                          color: opp.edge === 'playerA' ? '#3B82F6' : '#EC4899',
                        }}>
                          Advantage: {opp.edge === 'playerA' ? comparisonData.playerA.profile.name.split(' ')[0] : comparisonData.playerB.profile.name.split(' ')[0]}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                      {/* Player A vs Opponent */}
                      <div style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(59, 130, 246, 0.06)',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                      }}>
                        <div style={{ fontWeight: 800, color: '#3B82F6', fontSize: 11 }}>
                          {comparisonData.playerA.profile.name.split(' ')[0]}
                        </div>
                        <div style={{ fontWeight: 700, marginTop: 2 }}>
                          {opp.playerA.wins}W - {opp.playerA.losses}L ({opp.playerA.winRate}%)
                        </div>
                      </div>

                      {/* Player B vs Opponent */}
                      <div style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(236, 72, 153, 0.06)',
                        border: '1px solid rgba(236, 72, 153, 0.15)',
                      }}>
                        <div style={{ fontWeight: 800, color: '#EC4899', fontSize: 11 }}>
                          {comparisonData.playerB.profile.name.split(' ')[0]}
                        </div>
                        <div style={{ fontWeight: 700, marginTop: 2 }}>
                          {opp.playerB.wins}W - {opp.playerB.losses}L ({opp.playerB.winRate}%)
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
