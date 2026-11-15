import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Trophy,
  Search,
  User,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Award,
  Sparkles,
  ArrowLeft,
  Lock,
  Download,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { HomeButton, ThemeToggleButton } from '../../components/HeaderControls';
import PlayerPerformanceReportView from '../../components/performance/PlayerPerformanceReportView';

export default function PlayerPerformancePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDarkMode } = useTheme();

  // Search & Active selection state
  const queryRoll = searchParams.get('rollNumber');
  const [selectedRoll, setSelectedRoll] = useState(queryRoll || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [featuredPlayers, setFeaturedPlayers] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  // Private verification toggle
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyRoll, setVerifyRoll] = useState('');
  const [verifyCred, setVerifyCred] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState(null);

  // Check sessionStorage for previous verified student
  useEffect(() => {
    const saved = sessionStorage.getItem('verified_player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.rollNumber) {
          setVerifiedStudent(parsed);
          if (!queryRoll) {
            setSelectedRoll(parsed.rollNumber);
          }
        }
      } catch (e) {
        sessionStorage.removeItem('verified_player');
      }
    }
  }, [queryRoll]);

  // Sync selectedRoll with query params
  useEffect(() => {
    if (queryRoll) {
      setSelectedRoll(queryRoll);
    }
  }, [queryRoll]);

  // Load featured active players on mount
  useEffect(() => {
    setLoadingFeatured(true);
    axios
      .get('/api/performance/search', { params: { matchStatus: 'played', limit: 8 } })
      .catch(() =>
        // Fallback for non-authenticated public query
        axios.get('/api/performance/tournaments')
      )
      .then((res) => {
        if (res.data?.players && res.data.players.length > 0) {
          setFeaturedPlayers(res.data.players);
        } else {
          // If search endpoint required token, load from public registrations
          axios
            .get('/api/university-team/members')
            .catch(() => ({ data: [] }))
            .then((uRes) => {
              if (Array.isArray(uRes.data) && uRes.data.length > 0) {
                setFeaturedPlayers(
                  uRes.data.map((m) => ({
                    name: m.fullName || m.name,
                    rollNumber: m.rollNumber,
                    sport: m.sport || 'badminton',
                    department: m.faculty || m.department || 'Faculty of Science',
                    totalMatches: m.matchesPlayed || 0,
                    wins: m.wins || 0,
                    losses: m.losses || 0,
                    winPercentage: m.winRate || 0,
                  }))
                );
              }
            });
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingFeatured(false));
  }, []);

  // Live player search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        // Query search
        const res = await axios.get('/api/performance/search', {
          params: { q: searchTerm.trim(), limit: 6 },
        });
        setSearchResults(res.data?.players || []);
      } catch (err) {
        // Fallback: try direct player lookup by roll
        try {
          const pRes = await axios.get(
            `/api/performance/player/${encodeURIComponent(searchTerm.trim())}`
          );
          if (pRes.data?.player) {
            setSearchResults([
              {
                name: pRes.data.player.name,
                rollNumber: pRes.data.player.rollNumber,
                sport: pRes.data.player.sport,
                department: pRes.data.player.department,
                totalMatches: pRes.data.summary?.totalMatches || 0,
                wins: pRes.data.summary?.matchesWon || 0,
                losses: pRes.data.summary?.matchesLost || 0,
                winPercentage: pRes.data.summary?.winPercentage || 0,
              },
            ]);
          }
        } catch (e) {
          setSearchResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelectPlayer = (roll) => {
    setSelectedRoll(roll);
    setSearchParams({ rollNumber: roll });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToSearch = () => {
    setSelectedRoll('');
    setSearchParams({});
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setVerifyError('');
    if (!verifyRoll.trim() || !verifyCred.trim()) {
      setVerifyError('Both Registration Number and NIC / Email are required.');
      return;
    }

    setVerifying(true);
    try {
      const res = await axios.post('/api/performance/player/verify', {
        rollNumber: verifyRoll.trim(),
        verification: verifyCred.trim(),
      });

      if (res.data?.verified && res.data?.player) {
        setVerifiedStudent(res.data.player);
        sessionStorage.setItem('verified_player', JSON.stringify(res.data.player));
        setSelectedRoll(res.data.player.rollNumber);
        setShowVerifyModal(false);
      }
    } catch (err) {
      setVerifyError(
        err.response?.data?.message ||
          'Verification failed. The registration number does not match the provided credentials.'
      );
    } finally {
      setVerifying(false);
    }
  };

  const cardBg = isDarkMode ? 'rgba(15, 23, 42, 0.85)' : '#ffffff';
  const cardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0';
  const inputBg = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc';
  const inputBorder = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 2,
        background: 'transparent',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: `1px solid ${cardBorder}`,
          background: isDarkMode ? 'rgba(10, 15, 29, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        >
          <img src="/logo.png" alt="University Logo" style={{ width: 34, height: 34 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)', letterSpacing: 0.5 }}>
              UNIVERSITY OF JAFFNA
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Player Performance & Analytics Portal
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <HomeButton />
          <ThemeToggleButton />
        </div>
      </header>

      {/* Main Container */}
      <main
        style={{
          flex: 1,
          padding: '32px 20px',
          maxWidth: 1240,
          margin: '0 auto',
          width: '100%',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {selectedRoll ? (
          /* Detailed Performance Report View */
          <PlayerPerformanceReportView
            rollNumber={selectedRoll}
            onBack={handleBackToSearch}
          />
        ) : (
          /* Search & Directory Selection View */
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            {/* Hero Title */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 16px',
                  borderRadius: 20,
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#3b82f6',
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 14,
                  letterSpacing: 0.5,
                }}
              >
                <Sparkles size={14} /> OFFICIAL ATHLETE PERFORMANCE ANALYTICS
              </div>
              <h1
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  color: 'var(--text)',
                  margin: '0 0 10px 0',
                  letterSpacing: '-0.5px',
                }}
              >
                Player Performance & Feedback Engine
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-muted)',
                  maxWidth: 620,
                  margin: '0 auto',
                  lineHeight: 1.6,
                }}
              >
                Inspect match-by-match statistics, win conversion rates, 6 interactive visual analytics graphs, and automated coaching feedback for Badminton, Table Tennis, and Carrom.
              </p>
            </div>

            {/* Instant Search Bar Card */}
            <div
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: 20,
                padding: '24px 28px',
                boxShadow: isDarkMode
                  ? '0 20px 40px rgba(0, 0, 0, 0.5)'
                  : '0 10px 30px rgba(0, 0, 0, 0.06)',
                marginBottom: 36,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                SEARCH PLAYER DIRECTORY
              </div>
              <div style={{ position: 'relative' }}>
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Type player name or registration number (e.g. 2022/CSC/002)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 46px',
                    borderRadius: 12,
                    border: `1px solid ${inputBorder}`,
                    background: inputBg,
                    color: 'var(--text)',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {searching && (
                  <div
                    className="spinner"
                    style={{
                      position: 'absolute',
                      right: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 18,
                      height: 18,
                    }}
                  />
                )}
              </div>

              {/* Instant Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    border: `1px solid ${cardBorder}`,
                    borderRadius: 12,
                    background: cardBg,
                    overflow: 'hidden',
                  }}
                >
                  {searchResults.map((player) => (
                    <div
                      key={player.rollNumber}
                      onClick={() => handleSelectPlayer(player.rollNumber)}
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: `1px solid ${cardBorder}`,
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = isDarkMode
                          ? 'rgba(255,255,255,0.05)'
                          : '#f1f5f9')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 14,
                          }}
                        >
                          {player.name ? player.name.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
                            {player.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {player.rollNumber} · {player.department}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 10,
                            background:
                              player.sport === 'badminton'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : player.sport === 'table-tennis'
                                ? 'rgba(59, 130, 246, 0.15)'
                                : 'rgba(245, 158, 11, 0.15)',
                            color:
                              player.sport === 'badminton'
                                ? '#10b981'
                                : player.sport === 'table-tennis'
                                ? '#3b82f6'
                                : '#f59e0b',
                            textTransform: 'uppercase',
                          }}
                        >
                          {player.sport}
                        </span>
                        <ChevronRight size={16} color="var(--text-muted)" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Featured Active Players Grid */}
            <div style={{ marginBottom: 40 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                  ACTIVE TOURNAMENT PARTICIPANTS
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Click any player to inspect complete performance graphs
                </span>
              </div>

              {loadingFeatured ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div
                    className="spinner"
                    style={{ width: 28, height: 28, margin: '0 auto 12px' }}
                  />
                  <div>Loading tournament athletes...</div>
                </div>
              ) : featuredPlayers.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: 'center',
                    background: cardBg,
                    borderRadius: 16,
                    border: `1px solid ${cardBorder}`,
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  Type your registration number in the search box above to load your performance analysis.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 16,
                  }}
                >
                  {featuredPlayers.map((player) => {
                    const sColor =
                      player.sport === 'badminton'
                        ? '#10b981'
                        : player.sport === 'table-tennis'
                        ? '#3b82f6'
                        : '#f59e0b';

                    return (
                      <div
                        key={player.rollNumber}
                        onClick={() => handleSelectPlayer(player.rollNumber)}
                        style={{
                          background: cardBg,
                          border: `1px solid ${cardBorder}`,
                          borderRadius: 16,
                          padding: '18px 20px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.borderColor = sColor;
                          e.currentTarget.style.boxShadow = isDarkMode
                            ? '0 8px 20px rgba(0,0,0,0.4)'
                            : '0 8px 20px rgba(0,0,0,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.borderColor = cardBorder;
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                background: `${sColor}20`,
                                color: sColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: 16,
                              }}
                            >
                              {player.name ? player.name.charAt(0).toUpperCase() : 'P'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: 14 }}>
                                {player.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {player.rollNumber}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: `${sColor}20`,
                              color: sColor,
                              textTransform: 'uppercase',
                            }}
                          >
                            {player.sport}
                          </span>
                        </div>

                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                            border: `1px solid ${cardBorder}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 12,
                          }}
                        >
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Matches: </span>
                            <strong style={{ color: 'var(--text)' }}>{player.totalMatches || 0}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>W/L: </span>
                            <strong style={{ color: '#10b981' }}>{player.wins || 0}</strong>/
                            <strong style={{ color: '#ef4444' }}>{player.losses || 0}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Win%: </span>
                            <strong style={{ color: '#3b82f6' }}>{player.winPercentage || 0}%</strong>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#3b82f6',
                          }}
                        >
                          View Analytics <ChevronRight size={14} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${cardBorder}`,
          padding: '18px 24px',
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-muted)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        © 2026 Sports Tournament Management System · University of Jaffna
      </footer>
    </div>
  );
}
