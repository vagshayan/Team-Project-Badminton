import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { downloadQRCodePNG, downloadPlayerPassPDF } from '../../utils/passDownloader';

const STATUS_CONFIG = {
  confirmed: {
    label: 'REGISTRATION APPROVED',
    subtext: 'Your registration has been officially approved. You are confirmed to compete.',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    icon: '🟢',
    badgeClass: 'status-approved',
  },
  pending: {
    label: 'REGISTRATION PENDING',
    subtext: 'Your registration is under administrative review. Check back soon for approval.',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: '🟡',
    badgeClass: 'status-pending',
  },
  rejected: {
    label: 'REGISTRATION REJECTED',
    subtext: 'Your registration was not approved. Please contact sports administration.',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: '🔴',
    badgeClass: 'status-rejected',
  },
  cancelled: {
    label: 'REGISTRATION CANCELLED',
    subtext: 'This registration has been cancelled.',
    color: '#6B7280',
    bg: 'rgba(107, 114, 128, 0.12)',
    border: 'rgba(107, 114, 128, 0.3)',
    icon: '⚪',
    badgeClass: 'status-cancelled',
  },
};

const formatDate = (d) => {
  if (!d) return 'TBD';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(d);
  }
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  try {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'Yesterday';
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return '';
  }
};

export default function DigitalPlayerPassPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const passCardRef = useRef(null);

  const [passData, setPassData] = useState(null);
  const [matchData, setMatchData] = useState({ nextMatch: null, upcomingMatches: [], matchHistory: [] });
  const [timeline, setTimeline] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'matches' | 'history' | 'timeline'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const passUrl = typeof window !== 'undefined' ? `${window.location.origin}/player/qr/${token}` : '';

  const fetchData = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [passRes, matchRes, timelineRes] = await Promise.allSettled([
        axios.get(`/api/player-qr/${token}`),
        axios.get(`/api/player-qr/${token}/matches`),
        axios.get(`/api/player-qr/${token}/timeline`),
      ]);

      if (passRes.status === 'fulfilled' && passRes.value.data.success) {
        setPassData(passRes.value.data);
      } else {
        const msg = passRes.status === 'rejected'
          ? (passRes.reason.response?.data?.message || 'Invalid or revoked QR pass.')
          : 'Player pass not found.';
        setError(msg);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (matchRes.status === 'fulfilled' && matchRes.value.data.success) {
        setMatchData({
          nextMatch: matchRes.value.data.nextMatch || null,
          upcomingMatches: matchRes.value.data.upcomingMatches || [],
          matchHistory: matchRes.value.data.matchHistory || [],
        });
      }

      if (timelineRes.status === 'fulfilled' && timelineRes.value.data.success) {
        setTimeline(timelineRes.value.data.timeline || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds for live updates
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(passUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadQR = () => {
    const filename = `${(passData?.player?.rollNumber || 'Player').replace(/[\/\\]/g, '_')}_QR_Code.png`;
    downloadQRCodePNG('.qr-box svg', filename);
  };

  const handleDownloadPass = () => {
    downloadPlayerPassPDF(passData, matchData);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="pass-loading-screen">
        <div className="pass-spinner"></div>
        <h2>Loading Digital Player Pass...</h2>
        <p>Fetching real-time registration and tournament status</p>
        <style>{`
          .pass-loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #090D16;
            color: #E2E8F0;
            font-family: 'Inter', system-ui, sans-serif;
            text-align: center;
            padding: 20px;
          }
          .pass-spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(59, 130, 246, 0.2);
            border-top-color: #3B82F6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error || !passData) {
    return (
      <div className="pass-error-screen">
        <div className="pass-error-card">
          <div className="error-icon">⚠️</div>
          <h2>Player Pass Not Found</h2>
          <p>{error || 'This QR Code is invalid, expired, or has been revoked by administration.'}</p>
          <div className="error-actions">
            <button onClick={() => fetchData()} className="btn-primary">Try Again</button>
            <button onClick={() => navigate('/')} className="btn-secondary">Go to Home</button>
          </div>
        </div>
        <style>{`
          .pass-error-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #090D16;
            color: #E2E8F0;
            font-family: 'Inter', system-ui, sans-serif;
            padding: 24px;
          }
          .pass-error-card {
            background: #131B2E;
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 24px;
            padding: 40px;
            max-width: 460px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          }
          .error-icon { font-size: 54px; margin-bottom: 16px; }
          .pass-error-card h2 { font-size: 22px; font-weight: 800; color: #EF4444; margin-bottom: 12px; }
          .pass-error-card p { font-size: 14px; color: #94A3B8; line-height: 1.6; margin-bottom: 28px; }
          .error-actions { display: flex; gap: 12px; justify-content: center; }
          .btn-primary { background: #3B82F6; color: #FFF; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; }
          .btn-secondary { background: rgba(255,255,255,0.08); color: #FFF; border: 1px solid rgba(255,255,255,0.15); padding: 12px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  const { player, tournament, registration, sport, sportLabel, sportIcon, sportColor, courtUnit } = passData;
  const statusInfo = STATUS_CONFIG[registration.status] || STATUS_CONFIG.pending;
  const nextMatch = matchData.nextMatch;

  return (
    <div className="digital-pass-page">
      {/* Top Header */}
      <header className="pass-top-nav">
        <Link to="/" className="nav-brand">
          <span className="brand-logo">🏆</span>
          <div className="brand-text">
            <span className="brand-title">UNIVERSITY INDOOR GAMES</span>
            <span className="brand-sub">Official Digital Player Credential</span>
          </div>
        </Link>
        <div className="nav-actions">
          <button
            onClick={handleDownloadPass}
            className="btn-download-pass"
            title="Download Digital Player Pass as PDF"
          >
            📥 <span className="hide-mobile">Download Pass</span>
          </button>
          <button
            onClick={handleDownloadQR}
            className="btn-download-qr"
            title="Download QR Code as Image"
          >
            🖼️ <span className="hide-mobile">Download QR</span>
          </button>
          <button
            onClick={() => fetchData(true)}
            className={`btn-refresh ${refreshing ? 'spinning' : ''}`}
            title="Refresh latest status"
          >
            🔄 <span className="hide-mobile">Refresh</span>
          </button>
          <button onClick={handlePrint} className="btn-print" title="Print Player Pass">
            🖨️ <span className="hide-mobile">Print</span>
          </button>
        </div>
      </header>

      <div className="pass-container">
        {/* Main Pass Hero Card */}
        <div className="pass-hero-grid">
          {/* Left Column: Digital Credential Card */}
          <div className="pass-credential-wrapper" ref={passCardRef}>
            <div className="digital-pass-card" style={{ borderColor: `${sportColor}40` }}>
              {/* Card Header */}
              <div className="card-header" style={{ background: `linear-gradient(135deg, ${sportColor}22 0%, #131B2E 100%)` }}>
                <div className="header-badge-row">
                  <span className="uni-badge">UNIVERSITY OF JAFFNA</span>
                  <span className="sport-pill" style={{ background: `${sportColor}25`, color: sportColor, borderColor: `${sportColor}50` }}>
                    {sportIcon} {sportLabel.toUpperCase()}
                  </span>
                </div>
                <h1 className="tournament-heading">INDOOR GAMES {tournament.year || new Date().getFullYear()}</h1>
                <div className="category-tag">{tournament.categoryLabel || tournament.category}</div>
              </div>

              {/* Status Banner */}
              <div className="status-strip" style={{ background: statusInfo.bg, borderColor: statusInfo.border }}>
                <div className="status-indicator">
                  <span className="status-dot-pulse" style={{ background: statusInfo.color }}></span>
                  <span className="status-title" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                </div>
                <p className="status-desc">{statusInfo.subtext}</p>
              </div>

              {/* Player Info Section */}
              <div className="card-body">
                <div className="player-highlight">
                  <div className="avatar-placeholder" style={{ background: `linear-gradient(135deg, ${sportColor}, #1D4ED8)` }}>
                    {player.name ? player.name.charAt(0).toUpperCase() : '👤'}
                  </div>
                  <div className="player-text">
                    <h2 className="player-name">{player.name}</h2>
                    <div className="player-reg-no">
                      <span className="reg-icon">🆔</span> {player.rollNumber}
                    </div>
                  </div>
                </div>

                <div className="info-grid-2">
                  <div className="info-item">
                    <span className="info-label">FACULTY / DEPT</span>
                    <span className="info-value">{player.department || 'General'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">ACADEMIC YEAR</span>
                    <span className="info-value">{player.year || 'N/A'}</span>
                  </div>
                  {player.partnerName && (
                    <div className="info-item full-width">
                      <span className="info-label">DOUBLES PARTNER</span>
                      <span className="info-value highlight-partner">
                        🤝 {player.partnerName} {player.partnerRollNumber ? `(${player.partnerRollNumber})` : ''}
                      </span>
                    </div>
                  )}
                  <div className="info-item">
                    <span className="info-label">TOURNAMENT VENUE</span>
                    <span className="info-value">📍 {tournament.venue || 'Indoor Sports Complex'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">EVENT DATE</span>
                    <span className="info-value">📅 {formatDate(tournament.date)}</span>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="qr-code-section">
                  <div className="qr-box">
                    <QRCodeSVG
                      value={passUrl}
                      size={170}
                      level="H"
                      includeMargin={true}
                      bgColor="#FFFFFF"
                      fgColor="#0A0F1D"
                    />
                  </div>
                  <div className="qr-instructions">
                    <span className="scan-badge">SCAN TO VERIFY PASS</span>
                    <p className="qr-note">Present this official QR code at the venue check-in desk before each scheduled match.</p>
                    <div className="qr-action-btns">
                      <button onClick={handleDownloadPass} className="btn-card-action btn-card-pass" title="Download Official Pass PDF">
                        📥 Download Pass
                      </button>
                      <button onClick={handleDownloadQR} className="btn-card-action btn-card-qr" title="Download QR PNG">
                        🖼️ Download QR
                      </button>
                      <button onClick={handleCopyLink} className="btn-card-action btn-card-copy">
                        {copied ? '✅ Copied!' : '🔗 Copy Link'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="card-footer">
                <span>Pass Token: <code className="token-code">{passData.qrToken?.slice(0, 12)}...</code></span>
                <span>Real-Time Sync Active ⚡</span>
              </div>
            </div>
          </div>

          {/* Right Column: Next Match Spotlight, Updates & Tabs */}
          <div className="pass-details-column">
            {/* NEXT MATCH SPOTLIGHT */}
            <div className="spotlight-card">
              <div className="spotlight-header">
                <div className="spotlight-badge">
                  <span className="trophy-icon">🏆</span> NEXT SCHEDULED MATCH
                </div>
                {nextMatch && (
                  <span className={`match-status-badge status-${nextMatch.status}`}>
                    {nextMatch.status?.toUpperCase()}
                  </span>
                )}
              </div>

              {nextMatch ? (
                <div className="spotlight-body">
                  <div className="match-round-tag">
                    {nextMatch.roundLabel} · Match #{nextMatch.matchNumber}
                  </div>

                  <div className="vs-matchup-box">
                    <div className="team-box my-team">
                      <span className="team-role">YOU</span>
                      <span className="team-name">{player.name}</span>
                      <span className="team-reg">{player.rollNumber}</span>
                    </div>
                    <div className="vs-divider">VS</div>
                    <div className="team-box opp-team">
                      <span className="team-role">OPPONENT</span>
                      <span className="team-name">{nextMatch.opponent?.name || 'TBD'}</span>
                      <span className="team-reg">{nextMatch.opponent?.rollNumber || ''}</span>
                    </div>
                  </div>

                  <div className="match-meta-grid">
                    <div className="meta-cell">
                      <span className="meta-icon">📅</span>
                      <div>
                        <div className="meta-label">MATCH DATE</div>
                        <div className="meta-val">{formatDate(nextMatch.date)}</div>
                      </div>
                    </div>
                    <div className="meta-cell">
                      <span className="meta-icon">⏰</span>
                      <div>
                        <div className="meta-label">TIME</div>
                        <div className="meta-val">{nextMatch.time || 'TBD'}</div>
                      </div>
                    </div>
                    <div className="meta-cell">
                      <span className="meta-icon">📍</span>
                      <div>
                        <div className="meta-label">VENUE</div>
                        <div className="meta-val">{nextMatch.venue || tournament.venue}</div>
                      </div>
                    </div>
                    <div className="meta-cell">
                      <span className="meta-icon">🏸</span>
                      <div>
                        <div className="meta-label">{courtUnit?.toUpperCase() || 'COURT'}</div>
                        <div className="meta-val highlight-court">{nextMatch.court || `${courtUnit} ${nextMatch.matchNumber}`}</div>
                      </div>
                    </div>
                  </div>

                  <div className="checkin-status-banner">
                    {nextMatch.isCheckedIn ? (
                      <div className="checkin-confirmed">
                        <span>✅</span>
                        <div>
                          <strong>CHECKED IN AT VENUE</strong>
                          <p>Verified on {formatDate(nextMatch.checkedInAt)} · Ready for match</p>
                        </div>
                      </div>
                    ) : (
                      <div className="checkin-pending">
                        <span>⏳</span>
                        <div>
                          <strong>CHECK-IN REQUIRED</strong>
                          <p>Present your QR code to venue staff before starting</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="no-match-box">
                  <span className="empty-icon">📅</span>
                  <h3>No Upcoming Matches Scheduled Yet</h3>
                  <p>Tournament draws and match schedules will be published by the sport administrator soon.</p>
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="pass-tabs-bar">
              <button
                className={`pass-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                🔔 Updates ({timeline.length})
              </button>
              <button
                className={`pass-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
                onClick={() => setActiveTab('matches')}
              >
                🏸 Upcoming ({matchData.upcomingMatches.length})
              </button>
              <button
                className={`pass-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                🏁 Match History ({matchData.matchHistory.length})
              </button>
            </div>

            {/* Tab 1: Updates Timeline */}
            {activeTab === 'overview' && (
              <div className="tab-pane-timeline">
                {timeline.length > 0 ? (
                  <div className="timeline-flow">
                    {timeline.map((item, idx) => (
                      <div key={item.id || idx} className={`timeline-card type-${item.type}`}>
                        <div className="timeline-icon-wrap">{item.icon || '🔔'}</div>
                        <div className="timeline-content">
                          <div className="timeline-top">
                            <span className="timeline-title">{item.title}</span>
                            <span className="timeline-time">{formatTimeAgo(item.timestamp)}</span>
                          </div>
                          <p className="timeline-msg">{item.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-tab-state">No timeline events recorded yet.</div>
                )}
              </div>
            )}

            {/* Tab 2: Upcoming Matches */}
            {activeTab === 'matches' && (
              <div className="tab-pane-matches">
                {matchData.upcomingMatches.length > 0 ? (
                  matchData.upcomingMatches.map((m) => (
                    <div key={m.id} className="match-list-item">
                      <div className="match-list-header">
                        <span className="round-badge">{m.roundLabel} · Match #{m.matchNumber}</span>
                        <span className={`status-pill ${m.isCheckedIn ? 'checked-in' : ''}`}>
                          {m.isCheckedIn ? '✅ Checked In' : 'Scheduled'}
                        </span>
                      </div>
                      <div className="match-list-opp">
                        <span className="vs-tag">VS</span>
                        <strong>{m.opponent?.name || 'To Be Decided'}</strong>
                        {m.opponent?.rollNumber && <span className="opp-reg">({m.opponent.rollNumber})</span>}
                      </div>
                      <div className="match-list-details">
                        <span>📍 {m.venue}</span>
                        <span>🏸 {m.court}</span>
                        <span>⏰ {m.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-tab-state">No pending upcoming matches.</div>
                )}
              </div>
            )}

            {/* Tab 3: Match History */}
            {activeTab === 'history' && (
              <div className="tab-pane-history">
                {matchData.matchHistory.length > 0 ? (
                  matchData.matchHistory.map((m) => (
                    <div key={m.id} className={`history-card ${m.isWinner ? 'winner-card' : 'loser-card'}`}>
                      <div className="history-header">
                        <span className="history-round">{m.roundLabel}</span>
                        <span className={`result-tag ${m.isWinner ? 'won' : 'lost'}`}>
                          {m.isWinner ? '🏆 WON' : 'COMPLETED'}
                        </span>
                      </div>
                      <div className="history-opp">
                        <span>Opponent: <strong>{m.opponent?.name || 'Competitor'}</strong></span>
                      </div>
                      <div className="history-footer">
                        <span>Score: {m.myScore} - {m.opponentScore}</span>
                        <span>{formatDate(m.date)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-tab-state">No completed matches yet.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .digital-pass-page {
          min-height: 100vh;
          background: #090D16;
          color: #E2E8F0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding-bottom: 60px;
        }

        .pass-top-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 28px;
          background: rgba(13, 20, 36, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }

        .brand-logo {
          font-size: 28px;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
        }

        .brand-title {
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #F8FAFC;
        }

        .brand-sub {
          font-size: 11px;
          color: #94A3B8;
          font-weight: 500;
        }

        .nav-actions {
          display: flex;
          gap: 10px;
        }

        .btn-refresh, .btn-print, .btn-download-pass, .btn-download-qr {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #F8FAFC;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-download-pass {
          background: rgba(59, 130, 246, 0.18);
          border-color: rgba(59, 130, 246, 0.4);
          color: #60A5FA;
        }

        .btn-download-pass:hover {
          background: #3B82F6;
          color: #FFF;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
        }

        .btn-download-qr:hover {
          background: rgba(255, 255, 255, 0.16);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .btn-refresh:hover, .btn-print:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        .pass-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 20px;
        }

        .pass-hero-grid {
          display: grid;
          grid-template-columns: 460px 1fr;
          gap: 32px;
          align-items: start;
        }

        /* DIGITAL PASS CARD */
        .digital-pass-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
        }

        .card-header {
          padding: 24px 24px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .header-badge-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .uni-badge {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
          color: #FBBF24;
          text-transform: uppercase;
        }

        .sport-pill {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid;
          letter-spacing: 0.5px;
        }

        .tournament-heading {
          font-size: 20px;
          font-weight: 900;
          margin: 0 0 4px 0;
          letter-spacing: -0.5px;
          color: #FFFFFF;
        }

        .category-tag {
          font-size: 13px;
          color: #94A3B8;
          font-weight: 600;
        }

        /* STATUS STRIP */
        .status-strip {
          padding: 14px 24px;
          border-top: 1px solid;
          border-bottom: 1px solid;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .status-dot-pulse {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 10px currentColor;
        }

        .status-title {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .status-desc {
          font-size: 12px;
          color: #94A3B8;
          margin: 0;
          line-height: 1.4;
        }

        /* CARD BODY */
        .card-body {
          padding: 24px;
        }

        .player-highlight {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 22px;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .avatar-placeholder {
          width: 52px;
          height: 52px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 900;
          color: #FFF;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .player-name {
          font-size: 20px;
          font-weight: 900;
          color: #FFFFFF;
          margin: 0 0 4px 0;
          letter-spacing: -0.5px;
        }

        .player-reg-no {
          font-size: 13px;
          font-weight: 700;
          color: #60A5FA;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .info-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 24px;
        }

        .info-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 10px 14px;
          border-radius: 14px;
        }

        .info-item.full-width {
          grid-column: span 2;
        }

        .info-label {
          display: block;
          font-size: 10px;
          font-weight: 800;
          color: #64748B;
          letter-spacing: 0.5px;
          margin-bottom: 3px;
        }

        .info-value {
          font-size: 13px;
          font-weight: 700;
          color: #F1F5F9;
        }

        .highlight-partner {
          color: #38BDF8;
        }

        /* QR SECTION */
        .qr-code-section {
          background: #0B1120;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .qr-box {
          background: #FFF;
          padding: 8px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        }

        .qr-instructions {
          flex: 1;
        }

        .scan-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 900;
          background: rgba(59, 130, 246, 0.15);
          color: #60A5FA;
          padding: 3px 8px;
          border-radius: 6px;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .qr-note {
          font-size: 11px;
          color: #94A3B8;
          line-height: 1.4;
          margin: 0 0 10px 0;
        }

        .qr-action-btns {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .btn-card-action {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #FFF;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .btn-card-action:hover {
          background: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .btn-card-pass {
          background: rgba(59, 130, 246, 0.25);
          border-color: rgba(59, 130, 246, 0.5);
          color: #93C5FD;
        }

        .btn-card-pass:hover {
          background: #3B82F6;
          color: #FFF;
        }

        .btn-card-qr {
          background: rgba(16, 185, 129, 0.2);
          border-color: rgba(16, 185, 129, 0.4);
          color: #6EE7B7;
        }

        .btn-card-qr:hover {
          background: #10B981;
          color: #000;
        }

        .btn-card-copy {
          background: rgba(255, 255, 255, 0.05);
          color: #94A3B8;
        }

        .card-footer {
          padding: 12px 24px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #64748B;
        }

        .token-code {
          color: #94A3B8;
          background: rgba(255, 255, 255, 0.05);
          padding: 2px 4px;
          border-radius: 4px;
        }

        /* RIGHT COLUMN */
        .pass-details-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* SPOTLIGHT CARD */
        .spotlight-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 26px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }

        .spotlight-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .spotlight-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 900;
          color: #FBBF24;
          letter-spacing: 1px;
        }

        .match-status-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(59, 130, 246, 0.2);
          color: #60A5FA;
        }

        .match-round-tag {
          font-size: 14px;
          font-weight: 800;
          color: #94A3B8;
          margin-bottom: 16px;
        }

        .vs-matchup-box {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 16px;
          align-items: center;
          background: #0B1120;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .team-box {
          display: flex;
          flex-direction: column;
        }

        .team-role {
          font-size: 10px;
          font-weight: 900;
          color: #64748B;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }

        .team-name {
          font-size: 16px;
          font-weight: 800;
          color: #FFFFFF;
        }

        .team-reg {
          font-size: 12px;
          color: #60A5FA;
          font-weight: 600;
        }

        .vs-divider {
          font-size: 14px;
          font-weight: 900;
          color: #E2E8F0;
          background: rgba(255, 255, 255, 0.08);
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .match-meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .meta-cell {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 12px;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .meta-icon {
          font-size: 20px;
        }

        .meta-label {
          font-size: 9px;
          font-weight: 900;
          color: #64748B;
          letter-spacing: 0.5px;
        }

        .meta-val {
          font-size: 12px;
          font-weight: 700;
          color: #F8FAFC;
        }

        .highlight-court {
          color: #38BDF8;
          font-weight: 800;
        }

        .checkin-status-banner {
          border-radius: 14px;
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .checkin-confirmed {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #10B981;
        }

        .checkin-confirmed p, .checkin-pending p {
          margin: 2px 0 0 0;
          font-size: 12px;
          color: #94A3B8;
        }

        .checkin-pending {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #F59E0B;
        }

        .no-match-box {
          text-align: center;
          padding: 40px 20px;
          color: #94A3B8;
        }

        .empty-icon {
          font-size: 42px;
          display: block;
          margin-bottom: 12px;
        }

        /* TABS BAR */
        .pass-tabs-bar {
          display: flex;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 12px;
        }

        .pass-tab-btn {
          background: transparent;
          border: none;
          color: #94A3B8;
          font-size: 13px;
          font-weight: 700;
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pass-tab-btn.active {
          background: rgba(59, 130, 246, 0.18);
          color: #60A5FA;
        }

        /* TIMELINE FLOW */
        .timeline-flow {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .timeline-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          transition: transform 0.2s;
        }

        .timeline-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .timeline-icon-wrap {
          font-size: 24px;
          line-height: 1;
        }

        .timeline-content {
          flex: 1;
        }

        .timeline-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .timeline-title {
          font-size: 14px;
          font-weight: 800;
          color: #FFFFFF;
        }

        .timeline-time {
          font-size: 11px;
          color: #64748B;
          font-weight: 600;
        }

        .timeline-msg {
          font-size: 13px;
          color: #94A3B8;
          margin: 0;
          line-height: 1.5;
        }

        /* MATCH LIST */
        .tab-pane-matches, .tab-pane-history {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .match-list-item, .history-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 18px 20px;
        }

        .match-list-header, .history-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .round-badge, .history-round {
          font-size: 12px;
          font-weight: 800;
          color: #94A3B8;
        }

        .status-pill {
          font-size: 11px;
          font-weight: 700;
          color: #94A3B8;
        }

        .status-pill.checked-in {
          color: #10B981;
        }

        .match-list-opp {
          font-size: 16px;
          color: #FFF;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .vs-tag {
          font-size: 10px;
          font-weight: 900;
          color: #64748B;
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .opp-reg {
          font-size: 12px;
          color: #60A5FA;
        }

        .match-list-details {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #94A3B8;
        }

        .result-tag {
          font-size: 11px;
          font-weight: 900;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .result-tag.won {
          background: rgba(16, 185, 129, 0.2);
          color: #10B981;
        }

        .result-tag.lost {
          background: rgba(255, 255, 255, 0.08);
          color: #94A3B8;
        }

        .history-card.winner-card {
          border-left: 4px solid #10B981;
        }

        .history-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          font-size: 12px;
          color: #94A3B8;
        }

        .empty-tab-state {
          text-align: center;
          padding: 32px;
          color: #64748B;
          font-size: 14px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 16px;
          border: 1px dashed rgba(255, 255, 255, 0.08);
        }

        @media (max-width: 960px) {
          .pass-hero-grid {
            grid-template-columns: 1fr;
          }
          .match-meta-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .pass-container {
            padding: 16px 12px;
          }
          .hide-mobile {
            display: none;
          }
          .qr-code-section {
            flex-direction: column;
            text-align: center;
          }
          .match-meta-grid {
            grid-template-columns: 1fr;
          }
          .vs-matchup-box {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .card-body {
            padding: 16px;
          }
          .info-grid-2 {
            grid-template-columns: 1fr;
          }
        }

        @media print {
          .pass-top-nav, .nav-actions, .pass-details-column, .copy-link-btn {
            display: none !important;
          }
          .digital-pass-page {
            background: #FFF !important;
            color: #000 !important;
            padding: 0 !important;
          }
          .digital-pass-card {
            border: 2px solid #000 !important;
            box-shadow: none !important;
            max-width: 500px !important;
            margin: 0 auto !important;
          }
          .card-header, .card-body, .qr-code-section, .status-strip {
            background: #FFF !important;
            color: #000 !important;
            border-color: #CCC !important;
          }
          .tournament-heading, .player-name, .info-value, .status-title {
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
