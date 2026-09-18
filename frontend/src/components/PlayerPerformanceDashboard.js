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

export default function PlayerPerformanceDashboard({ initialSport = 'badminton', defaultRollNumber = '', onSportChange }) {
  const { isDarkMode } = useTheme();
  const [sport, setSport] = useState(initialSport);
  const [searchQuery, setSearchQuery] = useState(defaultRollNumber);
  const [activeRoll, setActiveRoll] = useState(defaultRollNumber);
  const [playersList, setPlayersList] = useState([]);
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState(null);

  const meta = SPORT_META[sport] || SPORT_META.badminton;

  // Sync sport change from props if controlled externally
  useEffect(() => {
    if (initialSport && initialSport !== sport) {
      setSport(initialSport);
    }
  }, [initialSport]);

  // Fetch quick player list for autocomplete / chips
  useEffect(() => {
    setLoadingPlayers(true);
    axios.get(`/api/analytics/players?sport=${sport}&limit=25`)
      .then((res) => {
        const list = res.data || [];
        setPlayersList(list);
        // Auto-select first player if no active selection
        if (!activeRoll && list.length > 0) {
          setActiveRoll(list[0].rollNumber);
          setSearchQuery(list[0].rollNumber);
        }
      })
      .catch((err) => console.warn('Failed to load players list:', err))
      .finally(() => setLoadingPlayers(false));
  }, [sport]);

  // Fetch performance data when activeRoll or sport changes
  useEffect(() => {
    if (!activeRoll) {
      setPerformanceData(null);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    axios.get(`/api/analytics/player/${encodeURIComponent(activeRoll)}?sport=${sport}`)
      .then((res) => {
        setPerformanceData(res.data);
      })
      .catch((err) => {
        console.error('Performance fetch error:', err);
        const msg = err.response?.data?.message || `No data found for registration number "${activeRoll}".`;
        setErrorMessage(msg);
        setPerformanceData(null);
      })
      .finally(() => setLoading(false));
  }, [activeRoll, sport]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const clean = searchQuery.trim();
    if (clean) {
      setActiveRoll(clean);
    }
  };

  const handleSelectPlayerChip = (roll) => {
    setSearchQuery(roll);
    setActiveRoll(roll);
  };

  const handleSportSelect = (newSport) => {
    setSport(newSport);
    if (onSportChange) onSportChange(newSport);
  };

  const scoreClass = performanceData?.performanceScore?.classification || 'Needs Improvement';
  const scoreColors = SCORE_CLASSIFICATION_COLORS[scoreClass] || SCORE_CLASSIFICATION_COLORS['Needs Improvement'];

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

      {/* ── PLAYER SEARCH & QUICK SELECTION BAR ──────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '22px 24px',
        marginBottom: 28,
        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <span style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 16,
              opacity: 0.5,
            }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Registration No (e.g. 2022/CSC/001)..."
              style={{
                width: '100%',
                padding: '14px 16px 14px 44px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 15,
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: '14px 28px',
              borderRadius: 12,
              background: meta.color,
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: `0 4px 16px ${meta.color}40`,
              transition: 'transform 0.15s ease',
            }}
          >
            <span>Analyze Performance</span>
            <span>→</span>
          </button>
        </form>

        {/* Quick player chips */}
        {playersList.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 0.5 }}>
              QUICK SELECT PLAYER ({playersList.length}):
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 88, overflowY: 'auto', paddingBottom: 4 }}>
              {playersList.map((p) => {
                const isSelected = activeRoll && p.rollNumber.toLowerCase() === activeRoll.toLowerCase();
                return (
                  <button
                    key={`${p.rollNumber}_${p.sport}`}
                    onClick={() => handleSelectPlayerChip(p.rollNumber)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: isSelected ? `${meta.color}25` : 'var(--bg)',
                      color: isSelected ? meta.color : 'var(--text)',
                      border: isSelected ? `1.5px solid ${meta.color}` : '1px solid var(--border)',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{p.playerName}</span>
                    <span style={{ opacity: 0.6, fontSize: 11 }}>({p.rollNumber})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── LOADING & ERROR STATES ────────────────────────────────────────────── */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--bg-card)',
          borderRadius: 18,
          border: '1px solid var(--border)',
        }}>
          <div className="spinner" style={{ width: 44, height: 44, borderTopColor: meta.color, margin: '0 auto 20px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Computing Player Analytics & Performance Metrics...</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>Aggregating real-time match records and generating smart insights.</p>
        </div>
      )}

      {errorMessage && !loading && (
        <div style={{
          padding: '24px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 16,
          color: '#EF4444',
          textAlign: 'center',
          marginBottom: 28,
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{errorMessage}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
            Please verify the Registration Number or select a player from the list above.
          </p>
        </div>
      )}

      {/* ── MAIN DASHBOARD VIEW ──────────────────────────────────────────────── */}
      {!loading && performanceData && (
        <div>
          {/* ── 1. TOP PROFILE SECTION ────────────────────────────────────────── */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '24px 28px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 6,
              height: '100%',
              background: meta.color,
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {/* Profile Avatar / Photo */}
              <div style={{
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${meta.color}40, ${meta.color}90)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                color: '#FFFFFF',
                fontWeight: 900,
                border: `3px solid ${meta.color}`,
                boxShadow: `0 6px 18px ${meta.color}30`,
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                {performanceData.player.photo ? (
                  <img
                    src={performanceData.player.photo}
                    alt={performanceData.player.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  performanceData.player.name ? performanceData.player.name.charAt(0).toUpperCase() : '👤'
                )}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
                    {performanceData.player.name}
                  </h1>
                  {performanceData.player.isUniversityTeam && (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#F59E0B',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 800,
                    }}>
                      🎓 University Team
                    </span>
                  )}
                  {performanceData.player.rank && (
                    <span style={{
                      background: `${meta.color}15`,
                      color: meta.color,
                      border: `1px solid ${meta.color}40`,
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 800,
                    }}>
                      🏆 Rank #{performanceData.player.rank} of {performanceData.player.totalRankedPlayers}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: 8, color: 'var(--text-muted)', fontSize: 13, flexWrap: 'wrap' }}>
                  <span>📋 <strong>Reg No:</strong> {performanceData.player.rollNumber}</span>
                  <span>🏛️ <strong>Dept:</strong> {performanceData.player.department}</span>
                  <span>{meta.icon} <strong>Sport:</strong> {meta.label}</span>
                  {performanceData.statistics.lastMatchDate && (
                    <span>🗓️ <strong>Last Match:</strong> {new Date(performanceData.statistics.lastMatchDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Performance Score Badge */}
            <div style={{
              background: scoreColors.bg,
              border: `1.5px solid ${scoreColors.border}`,
              borderRadius: 16,
              padding: '12px 20px',
              textAlign: 'center',
              minWidth: 140,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1 }}>PERFORMANCE SCORE</div>
              <div style={{ fontSize: 32, fontWeight: 950, color: scoreColors.text, margin: '2px 0' }}>
                {performanceData.performanceScore.totalScore}
                <span style={{ fontSize: 16, opacity: 0.6, fontWeight: 600 }}>/100</span>
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 900,
                color: scoreColors.text,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {scoreClass}
              </div>
            </div>
          </div>

          {/* ── 2. KEY METRICS STATS CARDS ────────────────────────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 28,
          }}>
            {/* Total Matches */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.5 }}>TOTAL MATCHES</div>
              <div style={{ fontSize: 32, fontWeight: 950, marginTop: 6, color: 'var(--text)' }}>
                {performanceData.statistics.totalMatches}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Completed Games</div>
            </div>

            {/* Wins */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#10B981', letterSpacing: 0.5 }}>MATCHES WON</div>
              <div style={{ fontSize: 32, fontWeight: 950, marginTop: 6, color: '#10B981' }}>
                {performanceData.statistics.wins}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Victories</div>
            </div>

            {/* Losses */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#EF4444', letterSpacing: 0.5 }}>MATCHES LOST</div>
              <div style={{ fontSize: 32, fontWeight: 950, marginTop: 6, color: '#EF4444' }}>
                {performanceData.statistics.losses}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Defeats</div>
            </div>

            {/* Win Rate */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: meta.color, letterSpacing: 0.5 }}>WIN RATE</div>
              <div style={{ fontSize: 32, fontWeight: 950, marginTop: 6, color: meta.color }}>
                {performanceData.statistics.winPercentage}%
              </div>
              <div style={{ width: '100%', background: 'var(--border)', height: 5, borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${performanceData.statistics.winPercentage}%`, background: meta.color, height: '100%', borderRadius: 99 }} />
              </div>
            </div>

            {/* Current Streak */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.5 }}>CURRENT STREAK</div>
              <div style={{ fontSize: 32, fontWeight: 950, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                {performanceData.statistics.currentWinningStreak > 0 ? (
                  <span style={{ color: '#10B981' }}>🔥 {performanceData.statistics.currentWinningStreak} W</span>
                ) : performanceData.statistics.currentLosingStreak > 0 ? (
                  <span style={{ color: '#EF4444' }}>❄️ {performanceData.statistics.currentLosingStreak} L</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>— 0</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {performanceData.statistics.currentWinningStreak > 0 ? 'Consecutive Wins' : 'Consecutive Losses'}
              </div>
            </div>

            {/* Recent Form */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.5 }}>RECENT FORM</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {performanceData.statistics.recentResults.length > 0 ? (
                  performanceData.statistics.recentResults.map((res, i) => (
                    <span
                      key={i}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 900,
                        background: res === 'W' ? '#10B981' : '#EF4444',
                        color: '#FFFFFF',
                      }}
                    >
                      {res}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No matches yet</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Last 5 matches</div>
            </div>
          </div>

          {/* ── 3. GRAPHICAL PERFORMANCE ANALYSIS (4 CHARTS) ────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 20,
            marginBottom: 28,
          }}>
            {/* GRAPH 1: Win vs Loss Bar Chart */}
            <div style={graphCardStyle}>
              <div style={graphHeaderStyle}>
                <span style={{ fontSize: 18 }}>📊</span>
                <span style={{ fontWeight: 800 }}>Graph 1: Win vs Loss Distribution</span>
              </div>

              <div style={{ padding: '16px 0', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {performanceData.statistics.totalMatches === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No match data available</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Wins Bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                        <span style={{ color: '#10B981' }}>✅ Wins ({performanceData.statistics.wins})</span>
                        <span>{performanceData.charts.winLossBar[0].percentage}%</span>
                      </div>
                      <div style={{ width: '100%', background: 'var(--border)', height: 26, borderRadius: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${performanceData.charts.winLossBar[0].percentage}%`,
                            background: 'linear-gradient(90deg, #10B981, #34D399)',
                            height: '100%',
                            borderRadius: 8,
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Losses Bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                        <span style={{ color: '#EF4444' }}>❌ Losses ({performanceData.statistics.losses})</span>
                        <span>{performanceData.charts.winLossBar[1].percentage}%</span>
                      </div>
                      <div style={{ width: '100%', background: 'var(--border)', height: 26, borderRadius: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${performanceData.charts.winLossBar[1].percentage}%`,
                            background: 'linear-gradient(90deg, #EF4444, #F87171)',
                            height: '100%',
                            borderRadius: 8,
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* GRAPH 2: Recent Performance Trend Line Chart */}
            <div style={graphCardStyle}>
              <div style={graphHeaderStyle}>
                <span style={{ fontSize: 18 }}>📈</span>
                <span style={{ fontWeight: 800 }}>Graph 2: Recent Performance Trend</span>
              </div>

              <div style={{ padding: '10px 0', minHeight: 200, position: 'relative' }}>
                {performanceData.charts.recentTrend.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, paddingTop: 60 }}>
                    Play matches to visualize your performance trajectory
                  </div>
                ) : (
                  <div>
                    {/* SVG Trend Line / Area */}
                    <svg viewBox="0 0 360 140" style={{ width: '100%', height: 140, overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={meta.color} stopOpacity="0.4" />
                          <stop offset="100%" stopColor={meta.color} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Gridlines */}
                      <line x1="20" y1="20" x2="340" y2="20" stroke="var(--border)" strokeDasharray="3,3" />
                      <line x1="20" y1="70" x2="340" y2="70" stroke="var(--border)" strokeDasharray="3,3" />
                      <line x1="20" y1="120" x2="340" y2="120" stroke="var(--border)" />

                      {/* Line Points */}
                      {(() => {
                        const trend = performanceData.charts.recentTrend;
                        const count = trend.length;
                        const stepX = count > 1 ? (320 / (count - 1)) : 160;
                        const points = trend.map((t, idx) => {
                          const x = 20 + (idx * stepX);
                          const y = 120 - ((t.rollingWinRate / 100) * 100);
                          return { x, y, ...t };
                        });

                        const pathStr = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                        const areaStr = `${pathStr} L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`;

                        return (
                          <>
                            <path d={areaStr} fill="url(#trendGradient)" />
                            <path d={pathStr} fill="none" stroke={meta.color} strokeWidth="3" strokeLinecap="round" />
                            {points.map((p, i) => (
                              <g key={i} onMouseEnter={() => setHoveredTrendIndex(i)} onMouseLeave={() => setHoveredTrendIndex(null)}>
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={hoveredTrendIndex === i ? 7 : 5}
                                  fill={p.result === 'W' ? '#10B981' : '#EF4444'}
                                  stroke="#FFFFFF"
                                  strokeWidth="2"
                                  style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                                />
                                <text x={p.x} y="136" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontWeight="700">
                                  {p.matchName}
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>

                    {/* Interactive Tooltip info */}
                    {hoveredTrendIndex !== null && performanceData.charts.recentTrend[hoveredTrendIndex] && (
                      <div style={{
                        marginTop: 8,
                        padding: '6px 12px',
                        background: 'var(--bg)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}>
                        <span>
                          <strong>{performanceData.charts.recentTrend[hoveredTrendIndex].matchName}</strong> vs {performanceData.charts.recentTrend[hoveredTrendIndex].opponent}
                        </span>
                        <span>
                          Result: <strong style={{ color: performanceData.charts.recentTrend[hoveredTrendIndex].result === 'W' ? '#10B981' : '#EF4444' }}>
                            {performanceData.charts.recentTrend[hoveredTrendIndex].result === 'W' ? 'Won' : 'Lost'} ({performanceData.charts.recentTrend[hoveredTrendIndex].scoreText})
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* GRAPH 3: Win Percentage Donut Chart */}
            <div style={graphCardStyle}>
              <div style={graphHeaderStyle}>
                <span style={{ fontSize: 18 }}>🍩</span>
                <span style={{ fontWeight: 800 }}>Graph 3: Win / Loss Ratio</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', minHeight: 190 }}>
                {performanceData.statistics.totalMatches === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No matches played</div>
                ) : (
                  <>
                    {/* SVG Donut */}
                    <div style={{ position: 'relative', width: 140, height: 140 }}>
                      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--border)" strokeWidth="12" />
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="12"
                          strokeDasharray={`${performanceData.statistics.winPercentage * 2.387} 238.7`}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 0.6s ease' }}
                        />
                      </svg>
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 20, fontWeight: 950, color: '#10B981' }}>
                          {performanceData.statistics.winPercentage}%
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>WIN RATE</span>
                      </div>
                    </div>

                    {/* Donut Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }} />
                        <span>Wins: {performanceData.statistics.wins}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
                        <span>Losses: {performanceData.statistics.losses}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        Total: {performanceData.statistics.totalMatches} Games
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* GRAPH 4: Performance Comparison (Player vs Sport Average vs Top Performer) */}
            <div style={graphCardStyle}>
              <div style={graphHeaderStyle}>
                <span style={{ fontSize: 18 }}>⚔️</span>
                <span style={{ fontWeight: 800 }}>Graph 4: Player vs Sport Benchmarks</span>
              </div>

              <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {performanceData.charts.comparison.metrics.map((m, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      <span>{m.name}</span>
                      <span style={{ color: meta.color }}>You: {m.player} | Avg: {m.sportAverage} | Top: {m.topPerformer}</span>
                    </div>
                    {/* Comparative triple progress bars */}
                    <div style={{ display: 'flex', gap: 4, height: 10, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                      <div
                        title={`Your score: ${m.player}`}
                        style={{
                          width: `${Math.min(100, m.player)}%`,
                          background: meta.color,
                          borderRadius: 6,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}

                {performanceData.charts.comparison.topPlayer && (
                  <div style={{
                    marginTop: 6,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>👑 <strong>Sport Top Performer:</strong> {performanceData.charts.comparison.topPlayer.name}</span>
                    <span style={{ color: '#10B981', fontWeight: 800 }}>Score: {performanceData.charts.comparison.topPlayer.score}/100</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 4. PERSONALIZED SMART SUGGESTIONS SECTION ─────────────────────── */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '24px 28px',
            marginBottom: 28,
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 24 }}>💡</span>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Personalized Smart Suggestions</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Automated rule-based performance feedback generated from match history</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {performanceData.suggestions.map((sug) => {
                const borderColors = {
                  success: '#10B981',
                  warning: '#F59E0B',
                  danger: '#EF4444',
                  info: meta.color,
                };
                const col = borderColors[sug.type] || meta.color;

                return (
                  <div
                    key={sug.id}
                    style={{
                      background: 'var(--bg)',
                      border: `1px solid ${col}40`,
                      borderLeft: `4px solid ${col}`,
                      borderRadius: 14,
                      padding: '16px 18px',
                      display: 'flex',
                      gap: 14,
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{sug.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: col, marginBottom: 4 }}>
                        {sug.title}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
                        {sug.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 5. RECENT MATCH HISTORY TABLE ────────────────────────────────── */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '24px 28px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>📋</span>
                <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Completed Match History</h2>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                Showing {performanceData.recentMatches.length} recorded matches
              </span>
            </div>

            {performanceData.recentMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: 14 }}>
                No completed tournament matches recorded yet for this player.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 14px' }}>Result</th>
                      <th style={{ padding: '10px 14px' }}>Date</th>
                      <th style={{ padding: '10px 14px' }}>Tournament / Event</th>
                      <th style={{ padding: '10px 14px' }}>Opponent</th>
                      <th style={{ padding: '10px 14px' }}>Score</th>
                      <th style={{ padding: '10px 14px' }}>Venue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.recentMatches.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 900,
                            background: m.result === 'W' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: m.result === 'W' ? '#10B981' : '#EF4444',
                            border: `1px solid ${m.result === 'W' ? '#10B98140' : '#EF444440'}`,
                          }}>
                            {m.result === 'W' ? 'VICTORY' : 'DEFEAT'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          {m.date ? new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <strong>{m.tournamentYear}</strong> · {m.tournamentCategory} (Round {m.round})
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div><strong>{m.opponentName}</strong></div>
                          {m.opponentRoll !== 'N/A' && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.opponentRoll}</div>}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                          {m.scoreText}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {m.tournamentVenue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '18px 20px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
};

const graphCardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: '20px 22px',
  boxShadow: '0 6px 20px rgba(0,0,0,0.04)',
};

const graphHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  fontWeight: 800,
  borderBottom: '1px solid var(--border)',
  paddingBottom: 10,
  marginBottom: 12,
};
