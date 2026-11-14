import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  Sparkles,
  QrCode,
  ArrowRight,
  User,
  ExternalLink,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { HomeButton, ThemeToggleButton } from '../../components/HeaderControls';

export default function MyPassLookupPage() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const [rollNumber, setRollNumber] = useState('');
  const [verification, setVerification] = useState('');
  const [sport, setSport] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (!rollNumber.trim() || !verification.trim()) {
      setError('Both registration/roll number and NIC / registered email are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/player-passes/student/verify', {
        rollNumber: rollNumber.trim(),
        verification: verification.trim(),
        sport,
      });

      if (res.data?.token) {
        navigate(`/pass/${res.data.token}`);
      } else {
        setError('Pass found, but token could not be resolved.');
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'No matching player pass found. Please check your credentials or contact tournament organizers.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mpl-page">
      {/* Top Navbar */}
      <header className="mpl-header">
        <div className="mpl-brand" onClick={() => navigate('/')}>
          <div className="mpl-logo">UJ</div>
          <div>
            <div className="mpl-title">UNIVERSITY OF JAFFNA</div>
            <div className="mpl-sub">Official Athlete Pass Portal</div>
          </div>
        </div>

        <div className="mpl-nav-right">
          <HomeButton />
          <ThemeToggleButton />
        </div>
      </header>

      {/* Main Form Center */}
      <main className="mpl-main">
        <div className="mpl-card">
          <div className="mpl-icon-box">
            <QrCode size={36} color="#3b82f6" />
          </div>

          <div className="mpl-heading-area">
            <div className="mpl-badge">
              <Sparkles size={13} /> SECURE ATHLETE CREDENTIAL
            </div>
            <h1>Access My Digital Pass</h1>
            <p>
              Verify your identity to retrieve your real-time tournament pass, live match schedule, and gate check-in QR code.
            </p>
          </div>

          {error && (
            <div className="mpl-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="mpl-form">
            <div className="mpl-field">
              <label>STUDENT / REGISTRATION NUMBER</label>
              <input
                type="text"
                placeholder="e.g. 2022/CSC/002"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                required
              />
            </div>

            <div className="mpl-field">
              <label>REGISTERED NIC OR EMAIL</label>
              <input
                type="text"
                placeholder="e.g. 200112345678 or student@univ.jfn.ac.lk"
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
                required
              />
            </div>

            <div className="mpl-field">
              <label>SELECT SPORT (OPTIONAL)</label>
              <select value={sport} onChange={(e) => setSport(e.target.value)}>
                <option value="all">Any Sport (Badminton / TT / Carrom)</option>
                <option value="badminton">🏸 Badminton</option>
                <option value="table-tennis">🏓 Table Tennis</option>
                <option value="carrom">🎯 Carrom</option>
              </select>
            </div>

            <button type="submit" className="mpl-submit-btn" disabled={loading}>
              {loading ? (
                'Verifying Credentials...'
              ) : (
                <>
                  View My Digital Pass <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="mpl-footer-note">
            <Lock size={13} color="#10b981" />
            <span>End-to-end encrypted pass retrieval</span>
          </div>
        </div>
      </main>

      <style>{`
        .mpl-page {
          min-height: 100vh;
          background: ${isDarkMode ? '#0b0f19' : '#f8fafc'};
          color: ${isDarkMode ? '#f8fafc' : '#0f172a'};
          display: flex;
          flex-direction: column;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .mpl-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 32px;
          border-bottom: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'};
          background: ${isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.8)'};
          backdrop-filter: blur(12px);
        }

        .mpl-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .mpl-logo {
          width: 38px;
          height: 38px;
          background: #3b82f6;
          color: white;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-weight: 900;
          font-size: 16px;
        }

        .mpl-title {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .mpl-sub {
          font-size: 11px;
          color: ${isDarkMode ? '#94a3b8' : '#64748b'};
        }

        .mpl-nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mpl-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 16px;
        }

        .mpl-card {
          width: 100%;
          max-width: 460px;
          background: ${isDarkMode ? '#131b2e' : '#ffffff'};
          border: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'};
          border-radius: 24px;
          padding: 36px 32px;
          box-shadow: ${isDarkMode ? '0 25px 60px rgba(0,0,0,0.6)' : '0 15px 40px rgba(0,0,0,0.08)'};
          text-align: center;
        }

        .mpl-icon-box {
          width: 68px;
          height: 68px;
          background: rgba(59, 130, 246, 0.12);
          border-radius: 20px;
          display: grid;
          place-items: center;
          margin: 0 auto 18px;
        }

        .mpl-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.12);
          padding: 4px 12px;
          border-radius: 20px;
          margin-bottom: 10px;
        }

        .mpl-heading-area h1 {
          font-size: 24px;
          font-weight: 900;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .mpl-heading-area p {
          font-size: 13px;
          color: ${isDarkMode ? '#94a3b8' : '#64748b'};
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .mpl-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          border-radius: 12px;
          font-size: 12px;
          text-align: left;
          margin-bottom: 20px;
        }

        .mpl-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          text-align: left;
        }

        .mpl-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .mpl-field label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: ${isDarkMode ? '#94a3b8' : '#64748b'};
        }

        .mpl-field input, .mpl-field select {
          padding: 12px 14px;
          background: ${isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'};
          border: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : '#cbd5e1'};
          border-radius: 12px;
          color: ${isDarkMode ? '#f8fafc' : '#0f172a'};
          font-size: 13px;
          outline: none;
          box-sizing: border-box;
        }

        .mpl-field input:focus, .mpl-field select:focus {
          border-color: #3b82f6;
        }

        .mpl-submit-btn {
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          border: 0;
          padding: 14px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.35);
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .mpl-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          opacity: 0.95;
        }

        .mpl-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mpl-footer-note {
          margin-top: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 11px;
          color: ${isDarkMode ? '#64748b' : '#94a3b8'};
        }
      `}</style>
    </div>
  );
}

