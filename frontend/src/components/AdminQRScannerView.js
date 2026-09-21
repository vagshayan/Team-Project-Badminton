import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode/cjs/index.js';

const SPORT_META = {
  badminton: { label: 'Badminton', icon: '🏸', color: '#3B82F6', unit: 'Court' },
  'table-tennis': { label: 'Table Tennis', icon: '🏓', color: '#8B5CF6', unit: 'Table' },
  carrom: { label: 'Carrom', icon: '🎯', color: '#EC4899', unit: 'Board' },
};

export default function AdminQRScannerView({ adminSport }) {
  const [activeMode, setActiveMode] = useState('camera'); // 'camera' | 'file' | 'manual'
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [recentCheckIns, setRecentCheckIns] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize camera list
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          setSelectedCameraId(devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Camera detection error:', err);
      });

    return () => {
      stopCameraScanner();
    };
  }, []);

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Stop scanner error:', err);
      }
    }
    setScanning(false);
  };

  const startCameraScanner = async (cameraId) => {
    setErrorMsg('');
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader-container');
      }

      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      const camId = cameraId || selectedCameraId || { facingMode: 'environment' };

      await html5QrCodeRef.current.start(
        camId,
        config,
        (decodedText) => {
          handleVerify(decodedText);
          stopCameraScanner();
        },
        (errorMessage) => {
          // Ignore frame decode misses
        }
      );
      setScanning(true);
    } catch (err) {
      setErrorMsg('Failed to start camera scanner: ' + (err.message || err));
      setScanning(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErrorMsg('');
    setLoading(true);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader-container');
      }
      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      if (decodedText) {
        handleVerify(decodedText);
      }
    } catch (err) {
      setErrorMsg('Could not detect a valid QR code in the uploaded image.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVerify = async (scannedValue) => {
    const input = scannedValue || manualInput;
    if (!input || !input.trim()) {
      setErrorMsg('Please scan a QR code or enter a Registration Number / Pass Token.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessToast('');

    try {
      const isRollNumber = /^\d{4}\/[A-Z]{2,3}\/\d{3}$/i.test(input.trim());
      const payload = isRollNumber ? { rollNumber: input.trim() } : { qrInput: input.trim() };

      const res = await axios.post('/api/player-qr/admin/verify', payload);
      if (res.data.success) {
        setVerificationResult(res.data);
      } else {
        setErrorMsg(res.data.message || 'Verification failed.');
      }
    } catch (err) {
      setVerificationResult(null);
      setErrorMsg(err.response?.data?.message || 'Player verification failed. QR code or student not found.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!verificationResult || !verificationResult.player) return;
    setCheckInLoading(true);
    setErrorMsg('');
    setSuccessToast('');

    try {
      const payload = {
        qrToken: verificationResult.registration?.qrToken,
        rollNumber: verificationResult.player.rollNumber,
        matchId: verificationResult.currentMatch?.id,
      };

      const res = await axios.post('/api/player-qr/admin/check-in', payload);
      if (res.data.success) {
        setSuccessToast(res.data.message || 'Player checked in successfully!');

        // Update local verification result state
        setVerificationResult((prev) => ({
          ...prev,
          currentMatch: prev.currentMatch ? {
            ...prev.currentMatch,
            isCheckedIn: true,
            checkedInAt: res.data.checkIn?.checkedInAt || new Date(),
          } : null,
        }));

        // Add to recent check-ins list
        setRecentCheckIns((prev) => [
          {
            id: Date.now(),
            name: verificationResult.player.name,
            rollNumber: verificationResult.player.rollNumber,
            sport: verificationResult.sport,
            round: verificationResult.currentMatch?.round || 1,
            court: verificationResult.currentMatch?.court || 'Court 1',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev.slice(0, 9),
        ]);
      } else {
        setErrorMsg(res.data.message || 'Check-in failed.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Check-in failed.');
    } finally {
      setCheckInLoading(false);
    }
  };

  const sportMeta = SPORT_META[verificationResult?.sport || adminSport] || { label: 'Sports', icon: '🏆', color: '#3B82F6', unit: 'Court' };

  return (
    <div className="admin-qr-scanner-view">
      {/* Header Banner */}
      <div className="scanner-header">
        <div>
          <h1 className="scanner-title">QR PASS VERIFIER & MATCH CHECK-IN</h1>
          <p className="scanner-subtitle">
            Scan player digital pass QR codes, verify tournament eligibility, and record match check-ins.
          </p>
        </div>
        <div className="sport-badge-pill" style={{ background: `${sportMeta.color}22`, color: sportMeta.color, borderColor: `${sportMeta.color}40` }}>
          <span>{sportMeta.icon}</span> {adminSport ? adminSport.toUpperCase() : 'ALL SPORTS'}
        </div>
      </div>

      {/* Toast Notifications */}
      {successToast && (
        <div className="scanner-alert alert-success">
          <span>✅</span> {successToast}
        </div>
      )}
      {errorMsg && (
        <div className="scanner-alert alert-error">
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      {/* Main Grid: Scanner Left, Results Right */}
      <div className="scanner-grid">
        {/* Left Column: Scanning Modes */}
        <div className="scanner-card">
          <div className="mode-toggle-tabs">
            <button
              className={`mode-tab ${activeMode === 'camera' ? 'active' : ''}`}
              onClick={() => {
                setActiveMode('camera');
                setErrorMsg('');
              }}
            >
              📹 Live Camera
            </button>
            <button
              className={`mode-tab ${activeMode === 'file' ? 'active' : ''}`}
              onClick={() => {
                setActiveMode('file');
                stopCameraScanner();
                setErrorMsg('');
              }}
            >
              📁 Upload Image
            </button>
            <button
              className={`mode-tab ${activeMode === 'manual' ? 'active' : ''}`}
              onClick={() => {
                setActiveMode('manual');
                stopCameraScanner();
                setErrorMsg('');
              }}
            >
              ⌨️ Manual Search
            </button>
          </div>

          <div className="scanner-body">
            {/* Mode 1: Camera Scanner */}
            {activeMode === 'camera' && (
              <div className="camera-mode-wrap">
                {cameras.length > 1 && (
                  <div className="cam-select-row">
                    <label>Select Camera:</label>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => {
                        setSelectedCameraId(e.target.value);
                        if (scanning) startCameraScanner(e.target.value);
                      }}
                      className="cam-select"
                    >
                      {cameras.map((c) => (
                        <option key={c.id} value={c.id}>{c.label || `Camera ${c.id}`}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div id="qr-reader-container" className="qr-viewport">
                  {!scanning && (
                    <div className="camera-placeholder">
                      <span className="cam-icon">📷</span>
                      <p>Camera is paused. Click below to start live scanning.</p>
                    </div>
                  )}
                </div>

                <div className="scanner-controls">
                  {!scanning ? (
                    <button onClick={() => startCameraScanner()} className="btn-scan-primary">
                      ▶️ Start Camera Scanner
                    </button>
                  ) : (
                    <button onClick={stopCameraScanner} className="btn-scan-danger">
                      ⏹️ Stop Camera
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Mode 2: File Upload Scanner */}
            {activeMode === 'file' && (
              <div className="file-mode-wrap">
                <div className="dropzone-box" onClick={() => fileInputRef.current?.click()}>
                  <span className="upload-icon">🖼️</span>
                  <h3>Upload QR Code Image</h3>
                  <p>Click to select a screenshot or photo of the player's QR Pass</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <button type="button" className="btn-browse">Browse Image</button>
                </div>
              </div>
            )}

            {/* Mode 3: Manual Entry */}
            {activeMode === 'manual' && (
              <div className="manual-mode-wrap">
                <label className="manual-label">ENTER REGISTRATION NUMBER OR QR TOKEN</label>
                <div className="search-input-group">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. 2022/CSC/001 or token..."
                    className="manual-input"
                    onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  />
                  <button onClick={() => handleVerify()} className="btn-search-primary" disabled={loading}>
                    {loading ? 'Searching...' : '🔍 Verify'}
                  </button>
                </div>
                <span className="search-tip">💡 Tip: You can type a Registration Number (e.g. 2023/CSE/015) or paste a pass token directly.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Verification & Check-In Card */}
        <div className="results-column">
          {verificationResult ? (
            <div className="verification-card">
              {/* Card Header with Status */}
              <div className="verification-header">
                <div className="player-meta-lead">
                  <span className="sport-icon-tag">{verificationResult.sportIcon}</span>
                  <div>
                    <h2 className="v-player-name">{verificationResult.player.name}</h2>
                    <span className="v-reg-no">🆔 {verificationResult.player.rollNumber}</span>
                  </div>
                </div>
                <div className="v-status-badge">
                  <span className={`status-badge-lg status-${verificationResult.registration?.status}`}>
                    {verificationResult.registration?.statusLabel?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
              </div>

              {/* Eligibility Banner */}
              <div className={`eligibility-strip ${verificationResult.eligible ? 'eligible' : 'not-eligible'}`}>
                <span className="elig-icon">{verificationResult.eligible ? '🟢' : '🔴'}</span>
                <div>
                  <strong>{verificationResult.eligible ? 'ELIGIBLE FOR MATCH' : 'NOT ELIGIBLE'}</strong>
                  <p>{verificationResult.reason}</p>
                </div>
              </div>

              {/* Player Details Grid */}
              <div className="v-details-grid">
                <div className="v-detail-cell">
                  <span className="cell-label">SPORT / CATEGORY</span>
                  <span className="cell-val">{verificationResult.sportLabel} — {verificationResult.tournament?.categoryLabel}</span>
                </div>
                <div className="v-detail-cell">
                  <span className="cell-label">FACULTY / DEPARTMENT</span>
                  <span className="cell-val">{verificationResult.player.department || 'General'}</span>
                </div>
                {verificationResult.player.partnerName && (
                  <div className="v-detail-cell full-span">
                    <span className="cell-label">DOUBLES PARTNER</span>
                    <span className="cell-val">🤝 {verificationResult.player.partnerName} ({verificationResult.player.partnerRollNumber})</span>
                  </div>
                )}
              </div>

              {/* Upcoming Match Section */}
              <div className="v-match-section">
                <h3 className="v-section-title">🏆 CURRENT / UPCOMING MATCH</h3>
                {verificationResult.currentMatch ? (
                  <div className="v-match-box">
                    <div className="match-lead-row">
                      <span className="v-round">Round {verificationResult.currentMatch.round} · Match #{verificationResult.currentMatch.matchNumber}</span>
                      <span className="v-court-tag">{verificationResult.currentMatch.court}</span>
                    </div>

                    <div className="v-opponent-row">
                      <span>Opponent: <strong>{verificationResult.currentMatch.opponentName}</strong></span>
                      <span>⏰ {verificationResult.currentMatch.time}</span>
                    </div>

                    <div className="v-checkin-action-row">
                      {verificationResult.currentMatch.isCheckedIn ? (
                        <div className="checked-in-banner">
                          <span>✅</span>
                          <strong>PLAYER ALREADY CHECKED IN</strong>
                        </div>
                      ) : (
                        <button
                          onClick={handleCheckIn}
                          disabled={!verificationResult.eligible || checkInLoading}
                          className="btn-checkin-confirm"
                        >
                          {checkInLoading ? 'Checking in...' : `🟢 Check-In Player (${verificationResult.currentMatch.court})`}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="v-no-match">
                    <span>📅</span> No active match scheduled for this tournament yet.
                  </div>
                )}
              </div>

              {/* Pass Actions */}
              <div className="v-footer-actions">
                <a
                  href={`/player/qr/${verificationResult.registration?.qrToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-view-pass"
                >
                  📱 View Digital Pass
                </a>
                <button onClick={() => setVerificationResult(null)} className="btn-clear">
                  ✕ Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="awaiting-scan-card">
              <span className="idle-icon">📷</span>
              <h3>Ready to Scan</h3>
              <p>Scan a player's Digital Pass QR Code or use Manual Search to verify registration and manage check-in.</p>
            </div>
          )}

          {/* Recent Check-Ins List */}
          {recentCheckIns.length > 0 && (
            <div className="recent-checkins-card">
              <h3 className="recent-title">⏱️ RECENT CHECK-INS (THIS SESSION)</h3>
              <div className="recent-list">
                {recentCheckIns.map((ci) => (
                  <div key={ci.id} className="recent-item">
                    <div className="recent-name-box">
                      <strong>{ci.name}</strong>
                      <span className="recent-reg">{ci.rollNumber}</span>
                    </div>
                    <div className="recent-meta-box">
                      <span className="recent-court">📍 {ci.court}</span>
                      <span className="recent-time">🕒 {ci.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .admin-qr-scanner-view {
          padding: 10px 0;
          color: var(--text, #E2E8F0);
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .scanner-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .scanner-title {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.5px;
          margin: 0 0 6px 0;
          color: var(--text, #FFF);
        }

        .scanner-subtitle {
          font-size: 14px;
          color: var(--text-muted, #94A3B8);
          margin: 0;
        }

        .sport-badge-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .scanner-alert {
          padding: 14px 20px;
          border-radius: 14px;
          margin-bottom: 20px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .alert-success {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10B981;
        }

        .alert-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #EF4444;
        }

        .scanner-grid {
          display: grid;
          grid-template-columns: 440px 1fr;
          gap: 28px;
          align-items: start;
        }

        .scanner-card {
          background: var(--bg-card, #111827);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .mode-toggle-tabs {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
        }

        .mode-tab {
          flex: 1;
          background: transparent;
          border: none;
          padding: 14px 8px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted, #94A3B8);
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }

        .mode-tab.active {
          color: var(--primary, #3B82F6);
          border-bottom-color: var(--primary, #3B82F6);
          background: rgba(59, 130, 246, 0.08);
        }

        .scanner-body {
          padding: 24px;
        }

        .cam-select-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          font-size: 12px;
          font-weight: 700;
        }

        .cam-select {
          flex: 1;
          background: var(--bg-input, #0B1120);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
          color: var(--text, #FFF);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
        }

        .qr-viewport {
          width: 100%;
          min-height: 280px;
          background: #000;
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
          border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
        }

        .camera-placeholder {
          text-align: center;
          padding: 20px;
          color: #94A3B8;
        }

        .cam-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 10px;
        }

        .scanner-controls {
          display: flex;
          justify-content: center;
        }

        .btn-scan-primary {
          background: #10B981;
          color: #000;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          width: 100%;
          font-size: 14px;
          transition: transform 0.1s;
        }

        .btn-scan-danger {
          background: #EF4444;
          color: #FFF;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          width: 100%;
          font-size: 14px;
        }

        .dropzone-box {
          border: 2px dashed var(--border, rgba(255, 255, 255, 0.2));
          border-radius: 18px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(255, 255, 255, 0.02);
        }

        .dropzone-box:hover {
          border-color: var(--primary, #3B82F6);
          background: rgba(59, 130, 246, 0.04);
        }

        .upload-icon {
          font-size: 42px;
          display: block;
          margin-bottom: 12px;
        }

        .dropzone-box h3 {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 6px 0;
        }

        .dropzone-box p {
          font-size: 12px;
          color: var(--text-muted, #94A3B8);
          margin: 0 0 16px 0;
        }

        .btn-browse {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
          color: var(--text, #FFF);
          padding: 8px 18px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12px;
        }

        .manual-mode-wrap {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .manual-label {
          font-size: 11px;
          font-weight: 900;
          color: var(--text-muted, #94A3B8);
          letter-spacing: 0.5px;
        }

        .search-input-group {
          display: flex;
          gap: 10px;
        }

        .manual-input {
          flex: 1;
          background: var(--bg-input, #0B1120);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
          color: var(--text, #FFF);
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
        }

        .btn-search-primary {
          background: var(--primary, #3B82F6);
          color: #FFF;
          border: none;
          padding: 12px 20px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .search-tip {
          font-size: 11px;
          color: var(--text-muted, #64748B);
          line-height: 1.4;
        }

        /* RESULTS COLUMN */
        .results-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .verification-card {
          background: var(--bg-card, #111827);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
          border-radius: 24px;
          padding: 26px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .verification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
        }

        .player-meta-lead {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .sport-icon-tag {
          font-size: 32px;
        }

        .v-player-name {
          font-size: 22px;
          font-weight: 900;
          margin: 0 0 2px 0;
          color: var(--text, #FFF);
        }

        .v-reg-no {
          font-size: 13px;
          font-weight: 700;
          color: #60A5FA;
        }

        .status-badge-lg {
          padding: 6px 14px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .status-confirmed {
          background: rgba(16, 185, 129, 0.2);
          color: #10B981;
          border: 1px solid rgba(16, 185, 129, 0.4);
        }

        .status-pending {
          background: rgba(245, 158, 11, 0.2);
          color: #F59E0B;
          border: 1px solid rgba(245, 158, 11, 0.4);
        }

        .status-rejected {
          background: rgba(239, 68, 68, 0.2);
          color: #EF4444;
          border: 1px solid rgba(239, 68, 68, 0.4);
        }

        .eligibility-strip {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 14px;
          margin-bottom: 20px;
          border: 1px solid;
        }

        .eligibility-strip.eligible {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.3);
          color: #10B981;
        }

        .eligibility-strip.not-eligible {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #EF4444;
        }

        .eligibility-strip p {
          margin: 2px 0 0 0;
          font-size: 12px;
          color: var(--text-muted, #94A3B8);
        }

        .v-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }

        .v-detail-cell {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
          border-radius: 12px;
          padding: 10px 14px;
        }

        .v-detail-cell.full-span {
          grid-column: span 2;
        }

        .cell-label {
          display: block;
          font-size: 10px;
          font-weight: 800;
          color: var(--text-muted, #64748B);
          margin-bottom: 2px;
        }

        .cell-val {
          font-size: 13px;
          font-weight: 700;
          color: var(--text, #F8FAFC);
        }

        .v-section-title {
          font-size: 12px;
          font-weight: 900;
          color: #FBBF24;
          letter-spacing: 0.5px;
          margin: 0 0 12px 0;
        }

        .v-match-box {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          border-radius: 16px;
          padding: 18px;
        }

        .match-lead-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .v-round {
          font-size: 13px;
          font-weight: 800;
          color: var(--text, #FFF);
        }

        .v-court-tag {
          font-size: 11px;
          font-weight: 800;
          background: rgba(59, 130, 246, 0.2);
          color: #60A5FA;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .v-opponent-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: var(--text-muted, #94A3B8);
          margin-bottom: 16px;
        }

        .btn-checkin-confirm {
          background: #10B981;
          color: #000;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 900;
          font-size: 14px;
          cursor: pointer;
          width: 100%;
          transition: all 0.2s;
        }

        .btn-checkin-confirm:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
        }

        .btn-checkin-confirm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .checked-in-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #10B981;
          font-size: 13px;
          background: rgba(16, 185, 129, 0.12);
          padding: 10px 16px;
          border-radius: 10px;
        }

        .v-no-match {
          text-align: center;
          padding: 24px;
          color: var(--text-muted, #94A3B8);
          font-size: 13px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 14px;
        }

        .v-footer-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .btn-view-pass {
          flex: 1;
          text-align: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
          color: var(--text, #FFF);
          text-decoration: none;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
        }

        .btn-clear {
          background: transparent;
          border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
          color: var(--text-muted, #94A3B8);
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .awaiting-scan-card {
          background: var(--bg-card, #111827);
          border: 1px dashed var(--border, rgba(255, 255, 255, 0.15));
          border-radius: 24px;
          padding: 60px 30px;
          text-align: center;
          color: var(--text-muted, #94A3B8);
        }

        .idle-icon {
          font-size: 54px;
          display: block;
          margin-bottom: 14px;
          opacity: 0.6;
        }

        .recent-checkins-card {
          background: var(--bg-card, #111827);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
          border-radius: 20px;
          padding: 20px;
        }

        .recent-title {
          font-size: 12px;
          font-weight: 900;
          color: var(--text-muted, #64748B);
          letter-spacing: 0.5px;
          margin: 0 0 14px 0;
        }

        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .recent-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.05));
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px;
        }

        .recent-reg {
          display: block;
          font-size: 11px;
          color: #60A5FA;
        }

        .recent-meta-box {
          text-align: right;
          font-size: 11px;
          color: var(--text-muted, #94A3B8);
        }

        .recent-court {
          display: block;
          font-weight: 700;
          color: #38BDF8;
        }

        @media (max-width: 960px) {
          .scanner-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
