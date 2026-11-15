import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Trophy,
  Award,
  TrendingUp,
  Flame,
  Calendar,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  WinLossPieChart,
  PerformanceTrendLineChart,
  PointsComparisonBarChart,
  MatchHistoryTimelineChart,
  MonthlyPerformanceChart,
  PerformanceProgressChart,
} from './PerformanceCharts';

export default function PlayerPerformanceReportView({
  rollNumber,
  initialSport = null,
  onBack = null,
  embedded = false,
}) {
  const { isDarkMode } = useTheme();
  const { admin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Filters
  const [selectedSport, setSelectedSport] = useState(initialSport || '');
  const [selectedTournament, setSelectedTournament] = useState('');
  const [matchLimit, setMatchLimit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tournamentsList, setTournamentsList] = useState([]);

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchPerformance = useCallback(async () => {
    if (!rollNumber) return;
    setLoading(true);
    setError('');

    try {
      const params = {};
      if (selectedSport && selectedSport !== 'all') params.sport = selectedSport;
      if (selectedTournament) params.tournamentId = selectedTournament;
      if (matchLimit) params.limit = matchLimit;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await axios.get(`/api/performance/player/${encodeURIComponent(rollNumber)}`, { params });
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load player performance analytics.');
    } finally {
      setLoading(false);
    }
  }, [rollNumber, selectedSport, selectedTournament, matchLimit, startDate, endDate]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // Load tournament filter list
  useEffect(() => {
    axios
      .get('/api/performance/tournaments')
      .then((res) => setTournamentsList(res.data || []))
      .catch((err) => console.error(err));
  }, []);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const url = `/api/performance/player/${encodeURIComponent(rollNumber)}/pdf${selectedTournament ? `?tournamentId=${selectedTournament}` : ''}`;
      const response = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const safeRoll = (data?.player?.rollNumber || rollNumber).replace(/[^a-zA-Z0-9]/g, '_');
      link.setAttribute('download', `Performance_Report_${safeRoll}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const p = data?.player || {};
  const s = data?.summary || {};
  const feedback = data?.feedback || {};
  const matchHistory = data?.matchHistory || [];
  const monthlyStats = data?.monthlyStats || [];
  const progressComparison = data?.progressComparison || { hasComparison: false };

  const sportColor =
    p.sport === 'badminton' ? '#10b981' : p.sport === 'table-tennis' ? '#3b82f6' : '#f59e0b';

  const cardBg = isDarkMode ? 'rgba(15, 23, 42, 0.75)' : '#ffffff';
  const cardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';

  if (loading && !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px' }} />
        <div>Compiling player performance analysis & statistics...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: 12, fontWeight: 700 }}>{error}</div>
        {onBack && (
          <button
            onClick={onBack}
            className="btn"
            style={{ background: 'var(--border)', color: 'var(--text)' }}
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', paddingBottom: 40, position: 'relative', zIndex: 10 }}>
      {/* Top Bar / Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                border: `1px solid ${cardBorder}`,
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <ChevronLeft size={16} /> Back to Search
            </button>
          )}
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
            PLAYER PERFORMANCE ANALYTICS
          </span>
        </div>

        <button
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            background: '#10b981',
            color: '#ffffff',
            border: 'none',
            fontSize: 13,
            fontWeight: 700,
            cursor: downloadingPdf ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          }}
        >
          <Download size={16} />
          {downloadingPdf ? 'Generating PDF...' : 'Download Performance Report PDF'}
        </button>
      </div>

      {/* Player Header Banner */}
      <div
        style={{
          background: isDarkMode
            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))'
            : 'linear-gradient(135deg, #ffffff, #f8fafc)',
          border: `1px solid ${cardBorder}`,
          borderRadius: 20,
          padding: '24px 28px',
          marginBottom: 24,
          boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.4)' : '0 10px 20px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 18,
                background: `${sportColor}25`,
                border: `2px solid ${sportColor}`,
                color: sportColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {p.name ? p.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  {p.name}
                </h1>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: `${sportColor}20`,
                    color: sportColor,
                    border: `1px solid ${sportColor}50`,
                  }}
                >
                  {(p.sport || 'Indoor Games').toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  RANK #{s.rank || 1}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span><strong>Reg No:</strong> {p.rollNumber}</span>
                <span><strong>Department:</strong> {p.department || 'N/A'}</span>
                <span><strong>NIC:</strong> {p.nicNo || 'N/A'}</span>
                <span><strong>Email:</strong> {p.email || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Overall Performance Score Badge */}
          <div
            style={{
              padding: '14px 20px',
              borderRadius: 14,
              background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#f1f5f9',
              border: `1px solid ${cardBorder}`,
              textAlign: 'center',
              minWidth: 150,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Overall Score
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#3b82f6' }}>
              {s.overallScore || 0}
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>/100</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Transparent Form Formula
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 14,
          padding: '14px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
            <Filter size={15} /> FILTERS:
          </div>

          {/* Tournament Dropdown */}
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${cardBorder}`,
              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              color: 'var(--text)',
              fontSize: 13,
            }}
          >
            <option value="">All Tournaments</option>
            {tournamentsList.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Match Limit Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: '', label: 'All Matches' },
              { id: '5', label: 'Last 5' },
              { id: '10', label: 'Last 10' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setMatchLimit(btn.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: matchLimit === btn.id ? '1px solid #3b82f6' : `1px solid ${cardBorder}`,
                  background: matchLimit === btn.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: matchLimit === btn.id ? '#3b82f6' : 'var(--text)',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid ${cardBorder}`,
              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              color: 'var(--text)',
              fontSize: 12,
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid ${cardBorder}`,
              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              color: 'var(--text)',
              fontSize: 12,
            }}
          />
          {(startDate || endDate || selectedTournament || matchLimit) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedTournament('');
                setMatchLimit('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
                padding: '6px 8px',
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total Matches */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Total Matches</span>
            <Trophy size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)' }}>
            {s.totalMatches || 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Official Completed Matches
          </div>
        </div>

        {/* Matches Won & Lost */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Wins / Losses</span>
            <Award size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981' }}>
            {s.matchesWon || 0} <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>/</span>{' '}
            <span style={{ color: '#ef4444' }}>{s.matchesLost || 0}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Net Ratio: +{(s.matchesWon || 0) - (s.matchesLost || 0)}
          </div>
        </div>

        {/* Win Percentage */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Win Rate</span>
            <TrendingUp size={18} color={s.winPercentage >= 50 ? '#10b981' : '#ef4444'} />
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: s.winPercentage >= 50 ? '#10b981' : '#ef4444',
            }}
          >
            {s.winPercentage || 0}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {s.winPercentage >= 70 ? 'Superior Conversion' : s.winPercentage >= 50 ? 'Positive Record' : 'Building Form'}
          </div>
        </div>

        {/* Winning Streak */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Current Streak</span>
            <Flame size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>
            {s.currentStreak || 0}{' '}
            <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>Wins</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Peak Streak: {s.maxStreak || 0} matches
          </div>
        </div>

        {/* Recent Results Pills */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Recent Form</span>
            <Calendar size={18} color="#8b5cf6" />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 38 }}>
            {s.recentResults && s.recentResults.length > 0 ? (
              s.recentResults.map((res, i) => (
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
                    fontWeight: 800,
                    backgroundColor: res === 'W' ? '#10b981' : '#ef4444',
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  {res}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No matches yet</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Last {s.recentResults?.length || 0} Matches
          </div>
        </div>
      </div>

      {/* Sport-Specific Metric Cards Banner */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 16,
          padding: '20px 24px',
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {p.sport ? p.sport.toUpperCase() : 'SPORT'} OFFICIAL COMPETITIVE METRICS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {p.sport === 'badminton' && (
            <>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>POINTS SCORED / CONCEDED</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', marginTop: 4 }}>
                  {s.pointsScored || 0} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/</span> {s.pointsConceded || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>SETS WON / CONCEDED</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                  {s.setsWon || 0}W - {s.setsLost || 0}L
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>AVG POINTS / MATCH</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                  {s.averagePointsPerMatch || 0} pts
                </div>
              </div>
            </>
          )}

          {p.sport === 'table-tennis' && (
            <>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>POINTS SCORED / CONCEDED</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', marginTop: 4 }}>
                  {s.pointsScored || 0} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/</span> {s.pointsConceded || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>GAMES WON / LOST</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                  {s.gamesWon || 0}W - {s.gamesLost || 0}L
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>AVG POINTS / MATCH</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                  {s.averagePointsPerMatch || 0} pts
                </div>
              </div>
            </>
          )}

          {p.sport === 'carrom' && (
            <>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>BOARDS WON / CONCEDED</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                  {s.boardsWon || 0}W - {s.boardsLost || 0}L
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>COINS POCKETED</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                  {s.coinsPocketed || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>RECORDED FOULS</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.fouls > 0 ? '#ef4444' : '#10b981', marginTop: 4 }}>
                  {s.fouls || 0}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Visual Analytics Grid (The 6 Graphs) */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
          Interactive Visual Analytics
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: 20,
          }}
        >
          {/* Graph A: Win/Loss Pie Chart */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              A. Win / Loss Distribution
            </div>
            <WinLossPieChart summary={s} />
          </div>

          {/* Graph B: Performance Trend Line Chart */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              B. Performance Trend (Cumulative Win %)
            </div>
            <PerformanceTrendLineChart matchHistory={matchHistory} />
          </div>

          {/* Graph C: Points Comparison Bar Chart */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              C. Points & Scoring Comparison
            </div>
            <PointsComparisonBarChart summary={s} matchHistory={matchHistory} sport={p.sport} />
          </div>

          {/* Graph D: Match History Chart */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              D. Match History Timeline (W / L Patterns)
            </div>
            <MatchHistoryTimelineChart matchHistory={matchHistory} />
          </div>

          {/* Graph E: Monthly Performance Chart */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              E. Monthly Matches, Wins & Losses
            </div>
            <MonthlyPerformanceChart monthlyStats={monthlyStats} />
          </div>

          {/* Graph F: Performance Progress Chart */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              F. Tournament Progress Comparison
            </div>
            <PerformanceProgressChart progressComparison={progressComparison} summary={s} />
          </div>
        </div>
      </div>

      {/* Intelligent Feedback Section */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
          Intelligent Feedback & Performance Coaching
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Strengths */}
          <div
            style={{
              background: isDarkMode ? 'rgba(16, 185, 129, 0.05)' : '#f0fdf4',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 800, fontSize: 14, marginBottom: 14 }}>
              <CheckCircle2 size={18} />
              IDENTIFIED STRENGTHS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {feedback.strengths && feedback.strengths.length > 0 ? (
                feedback.strengths.map((item, idx) => (
                  <div key={idx} style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No strengths identified yet.</div>
              )}
            </div>
          </div>

          {/* Weaknesses */}
          <div
            style={{
              background: isDarkMode ? 'rgba(239, 68, 68, 0.05)' : '#fef2f2',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontWeight: 800, fontSize: 14, marginBottom: 14 }}>
              <AlertCircle size={18} />
              AREAS FOR IMPROVEMENT
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {feedback.weaknesses && feedback.weaknesses.length > 0 ? (
                feedback.weaknesses.map((item, idx) => (
                  <div key={idx} style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No critical weaknesses detected.</div>
              )}
            </div>
          </div>

          {/* Suggestions */}
          <div
            style={{
              background: isDarkMode ? 'rgba(59, 130, 246, 0.05)' : '#f0f9ff',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6', fontWeight: 800, fontSize: 14, marginBottom: 14 }}>
              <Lightbulb size={18} />
              PRACTICAL SUGGESTIONS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {feedback.suggestions && feedback.suggestions.length > 0 ? (
                feedback.suggestions.map((item, idx) => (
                  <div key={idx} style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Participate in more tournament matches for tailored advice.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Match History Table */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 16,
          padding: 24,
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Complete Match History
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing {matchHistory.length} completed fixtures
          </span>
        </div>

        {matchHistory.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No completed matches found matching the current filter criteria.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${cardBorder}`, textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>DATE</th>
                <th style={{ padding: '10px 12px' }}>TOURNAMENT</th>
                <th style={{ padding: '10px 12px' }}>ROUND</th>
                <th style={{ padding: '10px 12px' }}>OPPONENT</th>
                <th style={{ padding: '10px 12px' }}>OUTCOME</th>
                <th style={{ padding: '10px 12px' }}>SCORE / POINTS</th>
              </tr>
            </thead>
            <tbody>
              {matchHistory.map((m, idx) => (
                <tr
                  key={m.matchId || idx}
                  style={{
                    borderBottom: `1px solid ${cardBorder}`,
                    background: idx % 2 === 0 ? 'transparent' : isDarkMode ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
                  }}
                >
                  <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                    {m.date ? new Date(m.date).toLocaleDateString('en-GB') : 'N/A'}
                  </td>
                  <td style={{ padding: '12px 12px', fontWeight: 600 }}>
                    {m.tournamentName || m.category}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    Round {m.round} (M{m.matchNumber})
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{m.opponentName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {m.opponentRollNumber} · {m.opponentDepartment}
                    </div>
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 800,
                        backgroundColor: m.isWinner ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: m.isWinner ? '#10b981' : '#ef4444',
                        border: m.isWinner ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      {m.outcome}
                    </span>
                  </td>
                  <td style={{ padding: '12px 12px', fontWeight: 600 }}>
                    {m.pointsScored > 0 || m.pointsConceded > 0
                      ? `${m.pointsScored} - ${m.pointsConceded}`
                      : `${m.setsWon || m.gamesWon || m.boardsWon || 0} - ${m.setsLost || m.gamesLost || m.boardsLost || 0}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

