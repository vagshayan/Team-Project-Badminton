import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  CalendarClock,
  Download,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
  ExternalLink,
  Sparkles,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  Info,
} from 'lucide-react';

const SPORT_CONFIGS = {
  badminton: {
    name: 'Badminton',
    badge: 'BADMINTON',
    color: '#059669',
    lightBg: 'rgba(5, 150, 105, 0.1)',
    border: 'rgba(5, 150, 105, 0.3)',
    emoji: '🏸',
  },
  'table-tennis': {
    name: 'Table Tennis',
    badge: 'TABLE TENNIS',
    color: '#dc2626',
    lightBg: 'rgba(220, 38, 38, 0.1)',
    border: 'rgba(220, 38, 38, 0.3)',
    emoji: '🏓',
  },
  carrom: {
    name: 'Carrom',
    badge: 'CARROM',
    color: '#d97706',
    lightBg: 'rgba(217, 119, 6, 0.1)',
    border: 'rgba(217, 119, 6, 0.3)',
    emoji: '🎯',
  },
};

export default function PlayerPassManagement({ color }) {
  const [passes, setPasses] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [schedule, setSchedule] = useState({});

  const loadPasses = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get('/api/player-passes/admin', { headers });
      setPasses(data || []);
      setNotice('');
    } catch (error) {
      setNotice(error.response?.data?.message || 'Unable to load player passes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPasses();
  }, []);

  useEffect(() => {
    if (!scanning) return undefined;
    const scanner = new Html5QrcodeScanner(
      'player-pass-qr-scanner',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      async (decodedText) => {
        scanner.clear().catch(() => {});
        setScanning(false);
        try {
          const token = localStorage.getItem('token');
          const headers = token ? { Authorization: `Bearer ${token}` } : {};

          // Extract token whether decodedText is a full URL or direct token string
          let passToken = String(decodedText || '').trim();
          if (passToken.includes('/')) {
            passToken = passToken.split('/').filter(Boolean).pop();
          }

          const { data } = await axios.post(
            '/api/player-passes/scan',
            { token: passToken },
            { headers }
          );
          setScanResult(data);
        } catch (err) {
          setScanResult({
            passStatus: 'invalid',
            message: err.response?.data?.message || 'Invalid or unverified pass.',
          });
        }
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scanning]);

  const visiblePasses = useMemo(() => {
    return passes.filter((pass) => {
      const matchQuery = `${pass.player?.name || ''} ${pass.playerId || ''} ${pass.player?.email || ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const matchSport = selectedSport === 'all' || pass.sport === selectedSport;
      return matchQuery && matchSport;
    });
  }, [passes, query, selectedSport]);

  const regenerate = async (pass) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(
        `/api/player-passes/admin/${pass.registrationId}/regenerate`,
        {},
        { headers }
      );
      setNotice(`New secure QR code issued for ${pass.player.name}.`);
      window.open(data.passUrl, '_blank', 'noopener,noreferrer');
      await loadPasses();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Could not regenerate QR.');
    }
  };

  const revoke = async (pass) => {
    if (!window.confirm(`Cancel / invalidate the pass for ${pass.player.name}?`)) return;
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.patch(`/api/player-passes/admin/${pass.registrationId}/revoke`, {}, { headers });
      setNotice(`Pass for ${pass.player.name} has been revoked.`);
      await loadPasses();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Could not cancel pass.');
    }
  };

  const downloadPdf = async (pass) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(
        `/api/player-passes/admin/${pass.registrationId}/pdf`,
        { headers, responseType: 'blob' }
      );
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `PlayerPass-${pass.playerId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice('Could not generate the current player pass PDF.');
    }
  };

  const saveSchedule = async (event) => {
    event.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.patch(
        `/api/player-passes/admin/${scheduleTarget.registrationId}/schedule`,
        schedule,
        { headers }
      );
      setNotice('Match schedule updated! All open player passes reflect this immediately.');
      setScheduleTarget(null);
      await loadPasses();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Could not update schedule.');
    }
  };

  return (
    <section className="ppm-container">
      {/* Top Banner Header */}
      <div className="ppm-header">
        <div>
          <div className="ppm-subtitle">
            <Sparkles size={14} /> OFFICIAL CREDENTIAL MANAGEMENT
          </div>
          <h2 className="ppm-title">Digital Player Pass & QR Hub</h2>
          <p className="ppm-desc">
            Issue, verify, schedule matches, and monitor athlete entry passes across Badminton, Table Tennis, and Carrom.
          </p>
        </div>

        <button
          className="ppm-scanner-btn"
          type="button"
          onClick={() => {
            setScanResult(null);
            setScanning((v) => !v);
          }}
        >
          <QrCode size={18} />
          {scanning ? 'Close Camera Scanner' : 'Launch Organizer QR Scanner'}
        </button>
      </div>

      {notice && (
        <div className="ppm-notice" role="status">
          <Info size={16} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')}>×</button>
        </div>
      )}

      {/* Live QR Scanner Container */}
      {scanning && (
        <div className="ppm-scanner-wrapper">
          <div className="ppm-scanner-box">
            <div id="player-pass-qr-scanner" />
            <p>Point camera at the athlete's Digital Pass QR code</p>
          </div>
        </div>
      )}

      {/* Instant Scan Results Display */}
      {scanResult && (
        <div className={`ppm-scan-card ${scanResult.passStatus === 'valid' ? 'valid' : 'invalid'}`}>
          <div className="ppm-scan-card-header">
            {scanResult.passStatus === 'valid' ? (
              <>
                <ShieldCheck size={24} color="#10b981" />
                <div>
                  <h3>VERIFIED OFFICIAL PASS</h3>
                  <span>Athlete check-in successful</span>
                </div>
              </>
            ) : (
              <>
                <XCircle size={24} color="#ef4444" />
                <div>
                  <h3>INVALID OR CANCELLED PASS</h3>
                  <span>Athlete credential is not valid for entry</span>
                </div>
              </>
            )}
          </div>

          {scanResult.player && (
            <div className="ppm-scan-details">
              <div>
                <strong>Player:</strong> {scanResult.player.name} ({scanResult.playerId})
              </div>
              <div>
                <strong>Sport:</strong> {(scanResult.sport || '').toUpperCase()} • {scanResult.tournament?.category || 'Singles'}
              </div>
              <div>
                <strong>Status:</strong> {scanResult.player.registrationStatus}
              </div>
              <div>
                <strong>Match:</strong>{' '}
                {scanResult.match?.id
                  ? `vs ${scanResult.match.opponent || 'TBD'} • Round ${scanResult.match.round} • Court: ${scanResult.match.court || 'Pending'}`
                  : 'Schedule Pending'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Sport Filter Bar */}
      <div className="ppm-controls">
        <div className="ppm-search-input">
          <Search size={18} color="var(--text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by player name, ID, or email..."
          />
        </div>

        <div className="ppm-filter-tabs">
          {['all', 'badminton', 'table-tennis', 'carrom'].map((s) => (
            <button
              key={s}
              className={`ppm-tab ${selectedSport === s ? 'active' : ''}`}
              onClick={() => setSelectedSport(s)}
            >
              {s === 'all' ? 'All Sports' : SPORT_CONFIGS[s]?.name || s}
            </button>
          ))}
        </div>
      </div>

      {/* Passes Grid / List */}
      {loading ? (
        <div className="ppm-empty">
          <RefreshCw size={24} className="ppm-spin" />
          <p>Loading digital player passes...</p>
        </div>
      ) : visiblePasses.length === 0 ? (
        <div className="ppm-empty">
          <User size={36} color="var(--text-muted)" />
          <p>No player passes found for this query.</p>
        </div>
      ) : (
        <div className="ppm-grid">
          {visiblePasses.map((p) => {
            const sTheme = SPORT_CONFIGS[p.sport] || SPORT_CONFIGS.badminton;
            const isValid = p.passStatus === 'valid';

            return (
              <div key={String(p.registrationId)} className="ppm-card">
                <div className="ppm-card-top" style={{ borderLeftColor: sTheme.color }}>
                  <div className="ppm-avatar" style={{ background: sTheme.lightBg, color: sTheme.color }}>
                    {p.player?.name?.charAt(0)?.toUpperCase() || 'P'}
                  </div>

                  <div className="ppm-card-info">
                    <div className="ppm-sport-tag" style={{ color: sTheme.color }}>
                      {sTheme.emoji} {sTheme.badge}
                    </div>
                    <h4>{p.player?.name}</h4>
                    <span className="ppm-id-sub">
                      ID: {p.playerId} • {p.tournament?.category || 'Singles'}
                    </span>
                  </div>

                  <div className={`ppm-badge ${isValid ? 'valid' : 'invalid'}`}>
                    {isValid ? 'ACTIVE' : 'REVOKED'}
                  </div>
                </div>

                <div className="ppm-card-body">
                  <div className="ppm-row">
                    <span>Tournament:</span>
                    <strong>{p.tournament?.name}</strong>
                  </div>
                  <div className="ppm-row">
                    <span>Match Fixture:</span>
                    <strong style={{ color: p.match?.id ? sTheme.color : 'var(--text-muted)' }}>
                      {p.match?.id
                        ? `vs ${p.match.opponent || 'TBD'} (R${p.match.round || 1})`
                        : 'Schedule Pending'}
                    </strong>
                  </div>
                  <div className="ppm-row">
                    <span>Court / Table:</span>
                    <strong>{p.match?.court || 'TBD'}</strong>
                  </div>
                </div>

                <div className="ppm-card-actions">
                  <button
                    type="button"
                    className="ppm-action-btn view-btn"
                    onClick={() => regenerate(p)}
                    title="Open Live Pass Card & QR"
                  >
                    <QrCode size={15} /> Pass & QR
                  </button>

                  <button
                    type="button"
                    className="ppm-action-btn schedule-btn"
                    onClick={() => {
                      setScheduleTarget(p);
                      setSchedule({});
                    }}
                    title="Edit Schedule & Opponent"
                  >
                    <CalendarClock size={15} /> Fixture
                  </button>

                  <button
                    type="button"
                    className="ppm-action-btn pdf-btn"
                    onClick={() => downloadPdf(p)}
                    title="Download Official PDF"
                  >
                    <Download size={15} /> PDF
                  </button>

                  {p.passStatus !== 'cancelled' && (
                    <button
                      type="button"
                      className="ppm-action-btn cancel-btn"
                      onClick={() => revoke(p)}
                      title="Invalidate / Revoke Pass"
                    >
                      <XCircle size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Edit Modal */}
      {scheduleTarget && (
        <div
          className="ppm-modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setScheduleTarget(null)}
        >
          <form className="ppm-modal" onSubmit={saveSchedule}>
            <div className="ppm-modal-header">
              <CalendarClock size={22} color="var(--primary)" />
              <div>
                <h3>Update Match Fixture</h3>
                <p>Athlete: {scheduleTarget.player?.name} ({scheduleTarget.playerId})</p>
              </div>
            </div>

            <div className="ppm-modal-fields">
              <label>
                <span>Select Opponent</span>
                <select
                  defaultValue=""
                  onChange={(e) =>
                    setSchedule({ ...schedule, opponentRegistrationId: e.target.value })
                  }
                >
                  <option value="">Keep current opponent</option>
                  {passes
                    .filter(
                      (c) =>
                        c.tournament?.id === scheduleTarget.tournament?.id &&
                        c.registrationId !== scheduleTarget.registrationId
                    )
                    .map((c) => (
                      <option key={String(c.registrationId)} value={c.registrationId}>
                        {c.player.name} ({c.playerId})
                      </option>
                    ))}
                </select>
              </label>

              <div className="ppm-modal-row">
                <label>
                  <span>Match Date</span>
                  <input
                    type="date"
                    onChange={(e) => setSchedule({ ...schedule, matchDate: e.target.value })}
                  />
                </label>

                <label>
                  <span>Match Time</span>
                  <input
                    type="time"
                    onChange={(e) => setSchedule({ ...schedule, scheduledTime: e.target.value })}
                  />
                </label>
              </div>

              <div className="ppm-modal-row">
                <label>
                  <span>Court / Table No.</span>
                  <input
                    placeholder="e.g. Court 2 / Table 1"
                    onChange={(e) => setSchedule({ ...schedule, court: e.target.value })}
                  />
                </label>

                <label>
                  <span>Tournament Round</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    onChange={(e) => setSchedule({ ...schedule, round: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Match Venue</span>
                <input
                  placeholder="e.g. Indoor Gymnasium, University of Jaffna"
                  onChange={(e) => setSchedule({ ...schedule, venue: e.target.value })}
                />
              </label>
            </div>

            <div className="ppm-modal-actions">
              <button
                type="button"
                className="ppm-modal-cancel"
                onClick={() => setScheduleTarget(null)}
              >
                Cancel
              </button>
              <button type="submit" className="ppm-modal-submit">
                Save & Broadcast Update
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Embedded CSS */}
      <style>{`
        .ppm-container {
          padding: 8px 0 40px;
          color: var(--text);
        }

        .ppm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .ppm-subtitle {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          color: #3b82f6;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }

        .ppm-title {
          font-size: 26px;
          font-weight: 900;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }

        .ppm-desc {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
          max-width: 600px;
        }

        .ppm-scanner-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          border: 0;
          padding: 12px 20px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35);
          transition: transform 0.2s ease;
        }

        .ppm-scanner-btn:hover {
          transform: translateY(-2px);
        }

        .ppm-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .ppm-notice button {
          margin-left: auto;
          background: transparent;
          border: 0;
          color: #60a5fa;
          font-size: 18px;
          cursor: pointer;
        }

        .ppm-scanner-wrapper {
          max-width: 480px;
          margin: 0 auto 24px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 15px 40px rgba(0,0,0,0.2);
        }

        .ppm-scanner-box p {
          margin: 12px 0 0;
          font-size: 12px;
          color: var(--text-muted);
        }

        .ppm-scan-card {
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid;
        }

        .ppm-scan-card.valid {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.4);
          color: #10b981;
        }

        .ppm-scan-card.invalid {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.4);
          color: #ef4444;
        }

        .ppm-scan-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .ppm-scan-card-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
        }

        .ppm-scan-card-header span {
          font-size: 12px;
          opacity: 0.85;
        }

        .ppm-scan-details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          font-size: 13px;
          color: var(--text);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 10px;
        }

        .ppm-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .ppm-search-input {
          flex: 1;
          min-width: 280px;
          max-width: 440px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 14px;
        }

        .ppm-search-input input {
          border: 0;
          background: transparent;
          outline: 0;
          color: var(--text);
          font-size: 13px;
          width: 100%;
        }

        .ppm-filter-tabs {
          display: flex;
          gap: 8px;
        }

        .ppm-tab {
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ppm-tab.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .ppm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        .ppm-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .ppm-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }

        .ppm-card-top {
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-left: 4px solid;
          border-bottom: 1px solid var(--border);
        }

        .ppm-avatar {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 18px;
          flex-shrink: 0;
        }

        .ppm-card-info {
          flex: 1;
          min-width: 0;
        }

        .ppm-sport-tag {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.8px;
          margin-bottom: 2px;
        }

        .ppm-card-info h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ppm-id-sub {
          font-size: 11px;
          color: var(--text-muted);
        }

        .ppm-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .ppm-badge.valid {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }

        .ppm-badge.invalid {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .ppm-card-body {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 12px;
          border-bottom: 1px solid var(--border);
        }

        .ppm-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ppm-row span {
          color: var(--text-muted);
        }

        .ppm-row strong {
          color: var(--text);
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }

        .ppm-card-actions {
          padding: 10px 14px;
          display: flex;
          gap: 6px;
          background: rgba(0, 0, 0, 0.05);
        }

        .ppm-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text);
          transition: all 0.15s ease;
        }

        .ppm-action-btn:hover {
          background: var(--border);
        }

        .view-btn {
          color: #3b82f6;
          border-color: rgba(59, 130, 246, 0.3);
        }

        .schedule-btn {
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.3);
        }

        .cancel-btn {
          color: #ef4444;
          margin-left: auto;
        }

        .ppm-empty {
          padding: 60px 20px;
          text-align: center;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .ppm-spin {
          animation: spin 1s linear infinite;
        }

        .ppm-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .ppm-modal {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 20px;
          width: 100%;
          max-width: 480px;
          padding: 24px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .ppm-modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ppm-modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }

        .ppm-modal-header p {
          margin: 2px 0 0;
          font-size: 12px;
          color: var(--text-muted);
        }

        .ppm-modal-fields {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .ppm-modal-fields label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
        }

        .ppm-modal-fields input, .ppm-modal-fields select {
          padding: 10px 12px;
          background: var(--bg-input, rgba(255,255,255,0.05));
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text);
          font-size: 13px;
          outline: 0;
        }

        .ppm-modal-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .ppm-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 6px;
        }

        .ppm-modal-cancel {
          padding: 10px 16px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-muted);
          font-weight: 700;
          cursor: pointer;
        }

        .ppm-modal-submit {
          padding: 10px 20px;
          background: var(--primary);
          border: 0;
          border-radius: 10px;
          color: white;
          font-weight: 800;
          cursor: pointer;
        }
      `}</style>
    </section>
  );
}
