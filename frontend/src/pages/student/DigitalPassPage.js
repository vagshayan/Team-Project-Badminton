import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import {
  Download,
  ShieldCheck,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  User,
  Trophy,
  ArrowLeft,
  Share2,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react';

const SPORT_THEMES = {
  badminton: {
    name: 'Badminton',
    badge: 'BADMINTON CHAMPIONSHIP',
    accent: '#059669',
    accentLight: '#34d399',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #10b981 100%)',
    subtleBg: 'rgba(16, 185, 129, 0.08)',
    borderGlow: 'rgba(16, 185, 129, 0.35)',
    iconBg: '#065f46',
    emoji: '🏸',
  },
  'table-tennis': {
    name: 'Table Tennis',
    badge: 'TABLE TENNIS TOURNAMENT',
    accent: '#dc2626',
    accentLight: '#f87171',
    gradient: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #f97316 100%)',
    subtleBg: 'rgba(239, 68, 68, 0.08)',
    borderGlow: 'rgba(239, 68, 68, 0.35)',
    iconBg: '#991b1b',
    emoji: '🏓',
  },
  carrom: {
    name: 'Carrom',
    badge: 'CARROM BOARD MASTER',
    accent: '#d97706',
    accentLight: '#fbbf24',
    gradient: 'linear-gradient(135deg, #78350f 0%, #d97706 50%, #f59e0b 100%)',
    subtleBg: 'rgba(245, 158, 11, 0.08)',
    borderGlow: 'rgba(245, 158, 11, 0.35)',
    iconBg: '#92400e',
    emoji: '🎯',
  },
};

const formatDate = (value) => {
  if (!value) return 'Schedule Pending';
  try {
    const d = new Date(value);
    return isNaN(d.getTime())
      ? value
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return 'Schedule Pending';
  }
};

export default function DigitalPassPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [pass, setPass] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const theme = SPORT_THEMES[pass?.sport] || SPORT_THEMES.badminton;

  const loadPass = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get(`/api/player-passes/token/${encodeURIComponent(token)}`);
      setPass(data);
      setError('');
      setLastRefreshed(new Date());

      // Generate enhanced high-contrast QR with custom styling
      const qrData = await QRCode.toDataURL(window.location.href, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });
      setQrUrl(qrData);
    } catch (requestError) {
      setError(
        requestError.response?.data?.passStatus === 'invalid'
          ? 'This player pass is invalid or has expired.'
          : 'Unable to load official tournament player pass.'
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadPass();
    const interval = setInterval(() => loadPass(true), 25000);
    return () => clearInterval(interval);
  }, [token]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const response = await axios.get(
        `/api/player-passes/token/${encodeURIComponent(token)}/pdf`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `PlayerPass-${pass?.player?.name?.replace(/\s+/g, '_') || 'Official'}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not download PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="dp-loading-screen">
        <div className="dp-loading-spinner" />
        <p>Loading Official Digital Player Pass...</p>
        <style>{`
          .dp-loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #0b0f19;
            color: #f1f5f9;
            font-family: system-ui, -apple-system, sans-serif;
            gap: 16px;
          }
          .dp-loading-spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top-color: #10b981;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error && !pass) {
    return (
      <div className="dp-error-screen">
        <div className="dp-error-card">
          <XCircle size={52} color="#ef4444" />
          <h2>Pass Unavailable</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>Return to Home</button>
        </div>
        <style>{`
          .dp-error-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0b0f19;
            padding: 20px;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .dp-error-card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 20px;
            padding: 40px 30px;
            max-width: 420px;
            text-align: center;
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          }
          .dp-error-card h2 { margin: 8px 0 0; font-size: 22px; font-weight: 800; }
          .dp-error-card p { color: #94a3b8; font-size: 14px; margin: 0 0 16px; }
          .dp-error-card button {
            background: #3b82f6;
            color: white;
            border: 0;
            padding: 10px 24px;
            border-radius: 10px;
            font-weight: 700;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  const isValid = pass?.passStatus === 'valid';

  return (
    <div className="dp-page-container">
      {/* Background glowing aura */}
      <div
        className="dp-aura-1"
        style={{ background: theme.gradient }}
      />
      <div
        className="dp-aura-2"
        style={{ background: theme.gradient }}
      />

      {/* Top Navbar */}
      <nav className="dp-top-nav">
        <button onClick={() => navigate('/')} className="dp-nav-home-btn">
          <ArrowLeft size={16} /> Home
        </button>
        <div className="dp-nav-title">
          <span className="dp-nav-badge">OFFICIAL VERIFIED BADGE</span>
        </div>
        <button onClick={handleShare} className="dp-nav-share-btn" title="Copy shareable link">
          <Share2 size={16} /> {copied ? 'Copied!' : 'Share'}
        </button>
      </nav>

      {/* Main Digital Pass Card Container */}
      <div className="dp-wrapper">
        <div className="dp-card">
          {/* Card Holographic Header Banner */}
          <div className="dp-banner" style={{ background: theme.gradient }}>
            <div className="dp-banner-pattern" />
            <div className="dp-banner-content">
              <div className="dp-banner-top-row">
                <div className="dp-univ-brand">
                  <div className="dp-univ-badge">UJ</div>
                  <div>
                    <div className="dp-univ-sub">UNIVERSITY OF JAFFNA</div>
                    <div className="dp-univ-main">PHYSICAL EDUCATION UNIT</div>
                  </div>
                </div>

                <div className={`dp-status-pill ${isValid ? 'valid' : 'invalid'}`}>
                  {isValid ? (
                    <>
                      <ShieldCheck size={14} /> OFFICIAL PASS
                    </>
                  ) : (
                    <>
                      <XCircle size={14} /> {pass?.passStatus?.toUpperCase() || 'INVALID'}
                    </>
                  )}
                </div>
              </div>

              {/* Tournament Title */}
              <div className="dp-tournament-title-area">
                <div className="dp-sport-pill">
                  <span>{theme.emoji}</span> {theme.badge}
                </div>
                <h1 className="dp-tournament-name">{pass?.tournament?.name || 'Tournament 2026'}</h1>
                <div className="dp-tournament-category">
                  CATEGORY: {(pass?.tournament?.category || 'Singles').toUpperCase().replace(/-/g, ' ')}
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Tear Perforation Wave */}
          <div className="dp-perforation">
            <div className="dp-notch left" />
            <div className="dp-dash-line" />
            <div className="dp-notch right" />
          </div>

          {/* Card Body */}
          <div className="dp-body">
            {/* Athlete Profile Highlight */}
            <div className="dp-athlete-section">
              <div
                className="dp-athlete-avatar"
                style={{
                  background: theme.gradient,
                  boxShadow: `0 10px 25px ${theme.borderGlow}`,
                }}
              >
                <span>{pass?.player?.name?.charAt(0)?.toUpperCase() || 'P'}</span>
              </div>

              <div className="dp-athlete-meta">
                <div className="dp-athlete-sub">VERIFIED ATHLETE</div>
                <h2 className="dp-athlete-name">{pass?.player?.name}</h2>
                <div className="dp-id-chips">
                  <span className="dp-chip player-id" style={{ borderColor: theme.accent, color: theme.accent }}>
                    ID: {pass?.playerId}
                  </span>
                  <span className="dp-chip reg-id">
                    REG: #{String(pass?.registrationId).slice(-6)}
                  </span>
                </div>
              </div>
            </div>

            {/* Two-Column Details Grid */}
            <div className="dp-details-grid">
              <div className="dp-detail-item">
                <span className="dp-detail-label">STUDENT / ROLL NUMBER</span>
                <strong className="dp-detail-val">{pass?.player?.rollNumber || pass?.playerId || 'N/A'}</strong>
              </div>
              <div className="dp-detail-item">
                <span className="dp-detail-label">REGISTRATION STATUS</span>
                <strong className="dp-detail-val reg-status" style={{ color: theme.accent }}>
                  ● {pass?.player?.registrationStatus?.toUpperCase() || 'ACTIVE'}
                </strong>
              </div>
              <div className="dp-detail-item">
                <span className="dp-detail-label">ATHLETE EMAIL</span>
                <strong className="dp-detail-val text-truncate">{pass?.player?.email || 'N/A'}</strong>
              </div>
              <div className="dp-detail-item">
                <span className="dp-detail-label">CONTACT PHONE</span>
                <strong className="dp-detail-val">{pass?.player?.phone || 'N/A'}</strong>
              </div>
              <div className="dp-detail-item">
                <span className="dp-detail-label">EVENT TOURNAMENT YEAR</span>
                <strong className="dp-detail-val">{pass?.tournament?.year || '2026'}</strong>
              </div>
              <div className="dp-detail-item">
                <span className="dp-detail-label">REGISTRATION DATE</span>
                <strong className="dp-detail-val">{formatDate(pass?.player?.registrationDate)}</strong>
              </div>
            </div>

            {/* Match Schedule Showcase Card */}
            <div
              className="dp-match-card"
              style={{
                borderColor: theme.borderGlow,
                background: theme.subtleBg,
              }}
            >
              <div className="dp-match-header">
                <div className="dp-match-header-left">
                  <Clock size={16} color={theme.accent} />
                  <span style={{ color: theme.accent }}>LIVE MATCH SCHEDULE</span>
                </div>
                <span className="dp-match-status-badge">
                  {pass?.match?.status || 'Active Schedule'}
                </span>
              </div>

              {pass?.match?.id ? (
                <div className="dp-match-grid">
                  <div className="dp-match-stat">
                    <span className="stat-label">ROUND</span>
                    <strong className="stat-val">Round {pass?.match?.round || 1}</strong>
                  </div>
                  <div className="dp-match-stat">
                    <span className="stat-label">OPPONENT</span>
                    <strong className="stat-val stat-opponent">
                      {pass?.match?.opponent || 'TBD (Bracket)'}
                    </strong>
                  </div>
                  <div className="dp-match-stat">
                    <span className="stat-label">DATE & TIME</span>
                    <strong className="stat-val">
                      {formatDate(pass?.match?.date)}
                      {pass?.match?.time ? ` • ${pass?.match?.time}` : ''}
                    </strong>
                  </div>
                  <div className="dp-match-stat">
                    <span className="stat-label">COURT / TABLE</span>
                    <strong className="stat-val" style={{ color: theme.accent }}>
                      {pass?.match?.court || 'Main Court'}
                    </strong>
                  </div>
                  <div className="dp-match-stat full-width">
                    <span className="stat-label">VENUE LOCATION</span>
                    <strong className="stat-val">
                      <MapPin size={13} style={{ display: 'inline', marginRight: 4 }} />
                      {pass?.match?.venue || pass?.tournament?.venue || 'Indoor Gymnasium, University of Jaffna'}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="dp-match-pending-box">
                  <Trophy size={20} color={theme.accent} />
                  <div>
                    <strong>Match Schedule Pending</strong>
                    <p>Draws & fixtures are being finalized by organizers. This pass automatically updates live.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Glowing QR Code Card Section */}
            <div className="dp-qr-card">
              <div className="dp-qr-frame" style={{ boxShadow: `0 0 25px ${theme.borderGlow}` }}>
                {qrUrl ? (
                  <img src={qrUrl} alt="Official Pass Verification QR Code" className="dp-qr-img" />
                ) : (
                  <div className="dp-qr-placeholder" />
                )}
                <div className="dp-qr-scan-badge" style={{ background: theme.accent }}>
                  SCAN TO VERIFY
                </div>
              </div>

              <div className="dp-qr-instructions">
                <h3>Official Gate & Referee QR</h3>
                <p>Present this encrypted QR code at the entrance or court table. Organizers can scan directly with any device camera to verify real-time status.</p>
                <div className="dp-security-notice">
                  <ShieldCheck size={14} color="#10b981" />
                  <span>Encrypted 256-bit token • Live synchronized</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="dp-actions-row">
              <button
                type="button"
                className="dp-btn-download"
                style={{ background: theme.gradient }}
                onClick={handleDownloadPdf}
                disabled={downloading || !isValid}
              >
                <Download size={18} />
                {downloading ? 'Generating Official PDF...' : 'Download Official PDF Pass'}
              </button>

              <button
                type="button"
                className="dp-btn-refresh"
                onClick={() => loadPass(false)}
                title="Refresh latest match updates"
              >
                <RefreshCw size={17} />
              </button>
            </div>

            <div className="dp-sync-footer">
              <span className="dp-sync-dot" />
              Auto-sync enabled • Last checked: {lastRefreshed.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded High-Fidelity CSS Styles */}
      <style>{`
        .dp-page-container {
          min-height: 100vh;
          background: #090d16;
          color: #f8fafc;
          padding: 24px 16px 60px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .dp-aura-1 {
          position: fixed;
          top: -150px;
          left: -150px;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          opacity: 0.18;
          filter: blur(120px);
          pointer-events: none;
          z-index: 0;
        }

        .dp-aura-2 {
          position: fixed;
          bottom: -150px;
          right: -150px;
          width: 550px;
          height: 550px;
          border-radius: 50%;
          opacity: 0.14;
          filter: blur(130px);
          pointer-events: none;
          z-index: 0;
        }

        .dp-top-nav {
          max-width: 680px;
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 10;
        }

        .dp-nav-home-btn, .dp-nav-share-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #e2e8f0;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: all 0.2s ease;
        }

        .dp-nav-home-btn:hover, .dp-nav-share-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          transform: translateY(-1px);
        }

        .dp-nav-badge {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .dp-wrapper {
          max-width: 680px;
          margin: 0 auto;
          position: relative;
          z-index: 10;
        }

        .dp-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
        }

        .dp-banner {
          padding: 32px 32px 28px;
          position: relative;
          color: white;
          overflow: hidden;
        }

        .dp-banner-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px);
          background-size: 16px 16px;
          opacity: 0.6;
          pointer-events: none;
        }

        .dp-banner-content {
          position: relative;
          z-index: 2;
        }

        .dp-banner-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 24px;
        }

        .dp-univ-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dp-univ-badge {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .dp-univ-sub {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          opacity: 0.9;
        }

        .dp-univ-main {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.4px;
        }

        .dp-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.8px;
          backdrop-filter: blur(10px);
        }

        .dp-status-pill.valid {
          background: rgba(16, 185, 129, 0.3);
          border: 1px solid rgba(16, 185, 129, 0.6);
          color: #a7f3d0;
        }

        .dp-status-pill.invalid {
          background: rgba(239, 68, 68, 0.3);
          border: 1px solid rgba(239, 68, 68, 0.6);
          color: #fecaca;
        }

        .dp-sport-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .dp-tournament-name {
          font-size: 26px;
          font-weight: 900;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
          line-height: 1.2;
        }

        .dp-tournament-category {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          opacity: 0.9;
        }

        .dp-perforation {
          position: relative;
          height: 24px;
          background: #111827;
          display: flex;
          align-items: center;
        }

        .dp-notch {
          position: absolute;
          width: 28px;
          height: 28px;
          background: #090d16;
          border-radius: 50%;
          top: -2px;
        }

        .dp-notch.left {
          left: -14px;
          box-shadow: inset -2px 0 3px rgba(0,0,0,0.4);
        }

        .dp-notch.right {
          right: -14px;
          box-shadow: inset 2px 0 3px rgba(0,0,0,0.4);
        }

        .dp-dash-line {
          width: 100%;
          margin: 0 28px;
          border-bottom: 2px dashed rgba(255, 255, 255, 0.15);
        }

        .dp-body {
          padding: 24px 32px 32px;
        }

        .dp-athlete-section {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 26px;
        }

        .dp-athlete-avatar {
          width: 72px;
          height: 72px;
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 32px;
          font-weight: 900;
          flex-shrink: 0;
          border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .dp-athlete-meta {
          flex: 1;
        }

        .dp-athlete-sub {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          color: #94a3b8;
          margin-bottom: 2px;
        }

        .dp-athlete-name {
          font-size: 24px;
          font-weight: 900;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.3px;
        }

        .dp-id-chips {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .dp-chip {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #cbd5e1;
        }

        .dp-details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .dp-detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dp-detail-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: #64748b;
        }

        .dp-detail-val {
          font-size: 13px;
          font-weight: 700;
          color: #e2e8f0;
        }

        .text-truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dp-match-card {
          border: 1px solid;
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .dp-match-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .dp-match-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .dp-match-status-badge {
          font-size: 11px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.08);
          padding: 3px 10px;
          border-radius: 20px;
          color: #94a3b8;
        }

        .dp-match-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .dp-match-stat {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .dp-match-stat.full-width {
          grid-column: 1 / -1;
        }

        .stat-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: #64748b;
        }

        .stat-val {
          font-size: 13px;
          font-weight: 700;
          color: #f1f5f9;
        }

        .stat-opponent {
          color: #f59e0b;
        }

        .dp-match-pending-box {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
        }

        .dp-match-pending-box strong {
          font-size: 13px;
          color: #f1f5f9;
          display: block;
          margin-bottom: 2px;
        }

        .dp-match-pending-box p {
          margin: 0;
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.4;
        }

        .dp-qr-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 24px;
          margin-bottom: 24px;
        }

        .dp-qr-frame {
          position: relative;
          background: #ffffff;
          padding: 10px;
          border-radius: 18px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .dp-qr-img {
          width: 140px;
          height: 140px;
          display: block;
          border-radius: 10px;
        }

        .dp-qr-placeholder {
          width: 140px;
          height: 140px;
          background: #e2e8f0;
          border-radius: 10px;
        }

        .dp-qr-scan-badge {
          margin-top: 8px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.8px;
          color: white;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .dp-qr-instructions h3 {
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 6px;
        }

        .dp-qr-instructions p {
          font-size: 12px;
          color: #94a3b8;
          margin: 0 0 12px;
          line-height: 1.5;
        }

        .dp-security-notice {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          padding: 5px 10px;
          border-radius: 8px;
        }

        .dp-actions-row {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .dp-btn-download {
          flex: 1;
          border: 0;
          color: white;
          padding: 16px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(0,0,0,0.4);
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .dp-btn-download:hover:not(:disabled) {
          transform: translateY(-2px);
          opacity: 0.95;
        }

        .dp-btn-download:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dp-btn-refresh {
          width: 52px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #cbd5e1;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .dp-btn-refresh:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        .dp-sync-footer {
          text-align: center;
          font-size: 11px;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .dp-sync-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
          box-shadow: 0 0 8px #10b981;
        }

        @media (max-width: 620px) {
          .dp-body {
            padding: 20px 18px 24px;
          }
          .dp-banner {
            padding: 24px 20px 20px;
          }
          .dp-tournament-name {
            font-size: 21px;
          }
          .dp-details-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .dp-match-grid {
            grid-template-columns: 1fr;
          }
          .dp-qr-card {
            flex-direction: column;
            text-align: center;
          }
          .dp-security-notice {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
