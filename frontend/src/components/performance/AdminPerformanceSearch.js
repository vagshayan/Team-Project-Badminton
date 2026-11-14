import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Search,
  Filter,
  User,
  Trophy,
  TrendingUp,
  Download,
  Eye,
  BarChart2,
  History,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import PlayerPerformanceReportView from './PlayerPerformanceReportView';

export default function AdminPerformanceSearch() {
  const { isDarkMode } = useTheme();
  const { admin } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [sport, setSport] = useState(admin?.sport && admin.sport !== 'all' ? admin.sport : 'all');
  const [tournamentId, setTournamentId] = useState('');
  const [matchStatus, setMatchStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Data & loading state
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tournamentsList, setTournamentsList] = useState([]);

  // Selected player for viewing full report
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [pdfLoadingRoll, setPdfLoadingRoll] = useState(null);

  // Debounce ref
  const debounceRef = useRef(null);

  // Fetch tournaments for filter dropdown
  useEffect(() => {
    axios
      .get('/api/performance/tournaments')
      .then((res) => setTournamentsList(res.data || []))
      .catch((err) => console.error(err));
  }, []);

  // Main search function
  const fetchSearchResults = useCallback(async (queryVal, pageVal) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        q: queryVal !== undefined ? queryVal : searchTerm,
        sport,
        tournamentId,
        matchStatus,
        category,
        period,
        page: pageVal || page,
        limit,
      };

      const res = await axios.get('/api/performance/search', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setPlayers(res.data?.players || []);
      setTotal(res.data?.total || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch (err) {
      console.error('Error searching players performance:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, sport, tournamentId, matchStatus, category, period, page]);

  // Debounced search when searchTerm changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchSearchResults(searchTerm, 1);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, sport, tournamentId, matchStatus, category, period]);

  // Page change handler
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchSearchResults(searchTerm, newPage);
    }
  };

  // Download PDF directly from search table
  const handleDownloadPDF = async (p) => {
    setPdfLoadingRoll(p.rollNumber);
    try {
      const response = await axios.get(
        `/api/performance/player/${encodeURIComponent(p.rollNumber)}/pdf`,
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const safeRoll = p.rollNumber.replace(/[^a-zA-Z0-9]/g, '_');
      link.setAttribute('download', `Performance_Report_${safeRoll}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoadingRoll(null);
    }
  };

  const cardBg = isDarkMode ? 'rgba(15, 23, 42, 0.75)' : '#ffffff';
  const cardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
  const inputBg = isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc';
  const inputBorder = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1';

  // If a player is selected, render their complete individual performance report!
  if (selectedPlayer) {
    return (
      <div style={{ padding: '10px 0' }}>
        <PlayerPerformanceReportView
          rollNumber={selectedPlayer.rollNumber}
          initialSport={selectedPlayer.sport}
          onBack={() => {
            setSelectedPlayer(null);
            fetchSearchResults();
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 1280, margin: '0 auto' }}>
      {/* Title & Description Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: '0 0 6px 0', letterSpacing: 0.5 }}>
          PLAYER PERFORMANCE ANALYSIS & SEARCH
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Search past and present participants across Badminton, Table Tennis, and Carrom to inspect comprehensive match statistics, visual charts, and intelligent feedback reports.
        </p>
      </div>

      {/* Main Search Bar & Multi-filter Container */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          boxShadow: isDarkMode ? '0 10px 25px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.04)',
        }}
      >
        {/* Real-time Search Input with Debounce */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Player Name, Reg No (20XX/XX/XXX), NIC, Email, or Phone..."
            style={{
              width: '100%',
              padding: '12px 14px 12px 42px',
              borderRadius: 12,
              border: `1px solid ${inputBorder}`,
              background: inputBg,
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {/* Sport Filter */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              SPORT DOMAIN
            </label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              disabled={admin?.role !== 'super_admin' && admin?.sport && admin.sport !== 'all'}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: 'var(--text)',
                fontSize: 13,
              }}
            >
              <option value="all">All Sports</option>
              <option value="badminton">Badminton</option>
              <option value="table-tennis">Table Tennis</option>
              <option value="carrom">Carrom</option>
            </select>
          </div>

          {/* Tournament Filter */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              TOURNAMENT
            </label>
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
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
          </div>

          {/* Match Status Filter */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              MATCH STATUS
            </label>
            <select
              value={matchStatus}
              onChange={(e) => setMatchStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: 'var(--text)',
                fontSize: 13,
              }}
            >
              <option value="all">All Participants</option>
              <option value="played">Has Completed Matches</option>
              <option value="winners">Has Winning Matches</option>
              <option value="unplayed">Pending / Unplayed</option>
            </select>
          </div>

          {/* Player Category Filter */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              CATEGORY
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: 'var(--text)',
                fontSize: 13,
              }}
            >
              <option value="all">All Categories</option>
              <option value="singles-men">Singles Men</option>
              <option value="singles-women">Singles Women</option>
              <option value="doubles-men">Doubles Men</option>
              <option value="doubles-women">Doubles Women</option>
              <option value="mixed-doubles">Mixed Doubles</option>
            </select>
          </div>

          {/* Performance Period Filter */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              TIME PERIOD
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: 'var(--text)',
                fontSize: 13,
              }}
            >
              <option value="all">All Time History</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="year">Current Year (2026)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count & Refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
          {loading ? 'Searching player records...' : `Found ${total} Player${total === 1 ? '' : 's'}`}
        </span>
        <button
          onClick={() => fetchSearchResults()}
          title="Refresh results"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: `1px solid ${cardBorder}`,
            color: 'var(--text-muted)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} className={loading ? 'spinner' : ''} /> Refresh
        </button>
      </div>

      {/* Players Results Table */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.04)',
          marginBottom: 20,
        }}
      >
        {loading && players.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
            <div>Loading verified player performance data...</div>
          </div>
        ) : players.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              No Players Found
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
              No player records match your search criteria. Try modifying your search term or resetting the sport and tournament filters.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr
                  style={{
                    borderBottom: `2px solid ${cardBorder}`,
                    background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                    textAlign: 'left',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  <th style={{ padding: '14px 16px' }}>PLAYER NAME & ID</th>
                  <th style={{ padding: '14px 16px' }}>SPORT</th>
                  <th style={{ padding: '14px 16px' }}>DEPARTMENT</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>MATCHES</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>W / L</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>WIN %</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>LATEST</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, idx) => {
                  const sColor =
                    p.sport === 'badminton'
                      ? '#10b981'
                      : p.sport === 'table-tennis'
                        ? '#3b82f6'
                        : '#f59e0b';

                  return (
                    <tr
                      key={p.rollNumber + idx}
                      style={{
                        borderBottom: `1px solid ${cardBorder}`,
                        background:
                          idx % 2 === 0
                            ? 'transparent'
                            : isDarkMode
                              ? 'rgba(255,255,255,0.015)'
                              : 'rgba(0,0,0,0.015)',
                      }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {p.rollNumber} {p.nicNo && p.nicNo !== 'N/A' ? `· NIC: ${p.nicNo}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 12,
                            background: `${sColor}20`,
                            color: sColor,
                            border: `1px solid ${sColor}40`,
                            textTransform: 'uppercase',
                          }}
                        >
                          {p.sport}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                        {p.department || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700 }}>
                        {p.totalMatches}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>{p.wins}</span>
                        {' / '}
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>{p.losses}</span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 10,
                            fontWeight: 800,
                            fontSize: 11,
                            backgroundColor:
                              p.winPercentage >= 50
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color: p.winPercentage >= 50 ? '#10b981' : '#ef4444',
                          }}
                        >
                          {p.winPercentage}%
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {p.latestResult === 'W' ? (
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#10b981',
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            W
                          </span>
                        ) : p.latestResult === 'L' ? (
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#ef4444',
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            L
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {/* 1. View Dashboard */}
                          <button
                            onClick={() => setSelectedPlayer(p)}
                            title="Open Full Performance Dashboard & Report"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#3b82f6',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Eye size={13} /> View
                          </button>

                          {/* 5. Download Report PDF */}
                          <button
                            onClick={() => handleDownloadPDF(p)}
                            disabled={pdfLoadingRoll === p.rollNumber}
                            title="Download Official PDF Report"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Download size={13} />
                            {pdfLoadingRoll === p.rollNumber ? '...' : 'PDF'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Page {page} of {totalPages} ({total} Total Players)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${cardBorder}`,
                background: isDarkMode ? 'rgba(255,255,255,0.05)' : '#ffffff',
                color: page <= 1 ? 'var(--text-muted)' : 'var(--text)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${cardBorder}`,
                background: isDarkMode ? 'rgba(255,255,255,0.05)' : '#ffffff',
                color: page >= totalPages ? 'var(--text-muted)' : 'var(--text)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

