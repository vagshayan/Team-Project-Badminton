import React, { useState } from 'react';
import axios from 'axios';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function EditMatchStatsModal({ match, sport = 'badminton', onClose, onSuccess }) {
  const { isDarkMode } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [score1, setScore1] = useState(match?.pointsScored ?? 0);
  const [score2, setScore2] = useState(match?.pointsConceded ?? 0);
  const [winnerId, setWinnerId] = useState(match?.winnerId || '');

  // Detailed player metrics
  const [setsWon1, setSetsWon1] = useState(match?.setsWon ?? 0);
  const [setsLost1, setSetsLost1] = useState(match?.setsLost ?? 0);
  const [gamesWon1, setGamesWon1] = useState(match?.gamesWon ?? 0);
  const [gamesLost1, setGamesLost1] = useState(match?.gamesLost ?? 0);
  const [boardsWon1, setBoardsWon1] = useState(match?.boardsWon ?? 0);
  const [boardsLost1, setBoardsLost1] = useState(match?.boardsLost ?? 0);
  const [coins1, setCoins1] = useState(match?.coinsPocketed ?? 0);
  const [fouls1, setFouls1] = useState(match?.fouls ?? 0);
  const [notes, setNotes] = useState(match?.notes || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        score1: Number(score1) || 0,
        score2: Number(score2) || 0,
        notes,
        player1Stats: {
          pointsScored: Number(score1) || 0,
          pointsConceded: Number(score2) || 0,
          setsWon: Number(setsWon1) || 0,
          setsLost: Number(setsLost1) || 0,
          gamesWon: Number(gamesWon1) || 0,
          gamesLost: Number(gamesLost1) || 0,
          boardsWon: Number(boardsWon1) || 0,
          boardsLost: Number(boardsLost1) || 0,
          coinsPocketed: Number(coins1) || 0,
          fouls: Number(fouls1) || 0,
        },
        player2Stats: {
          pointsScored: Number(score2) || 0,
          pointsConceded: Number(score1) || 0,
          setsWon: Number(setsLost1) || 0,
          setsLost: Number(setsWon1) || 0,
          gamesWon: Number(gamesLost1) || 0,
          gamesLost: Number(gamesWon1) || 0,
          boardsWon: Number(boardsLost1) || 0,
          boardsLost: Number(boardsWon1) || 0,
          coinsPocketed: 0,
          fouls: 0,
        },
      };

      if (winnerId) payload.winnerId = winnerId;

      const token = localStorage.getItem('token');
      await axios.put(`/api/performance/match/${match.matchId}/stats`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to update match performance statistics');
    } finally {
      setSubmitting(false);
    }
  };

  const bgModal = isDarkMode ? '#0f172a' : '#ffffff';
  const borderModal = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0';
  const inputBg = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc';
  const inputBorder = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          backgroundColor: bgModal,
          border: `1px solid ${borderModal}`,
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: `1px solid ${borderModal}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Enter / Update Match Statistics
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {match.tournamentName} · Round {match.round}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24, overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                fontSize: 13,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Points Scored
              </label>
              <input
                type="number"
                min="0"
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: 'var(--text)',
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Points Conceded
              </label>
              <input
                type="number"
                min="0"
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: 'var(--text)',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Sport Specific Metrics */}
          {sport === 'badminton' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Sets Won
                </label>
                <input
                  type="number"
                  min="0"
                  value={setsWon1}
                  onChange={(e) => setSetsWon1(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${inputBorder}`,
                    background: inputBg,
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Sets Lost
                </label>
                <input
                  type="number"
                  min="0"
                  value={setsLost1}
                  onChange={(e) => setSetsLost1(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${inputBorder}`,
                    background: inputBg,
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>
            </div>
          )}

          {sport === 'table-tennis' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Games Won
                </label>
                <input
                  type="number"
                  min="0"
                  value={gamesWon1}
                  onChange={(e) => setGamesWon1(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${inputBorder}`,
                    background: inputBg,
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Games Lost
                </label>
                <input
                  type="number"
                  min="0"
                  value={gamesLost1}
                  onChange={(e) => setGamesLost1(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${inputBorder}`,
                    background: inputBg,
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>
            </div>
          )}

          {sport === 'carrom' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Boards Won
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={boardsWon1}
                    onChange={(e) => setBoardsWon1(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Boards Lost
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={boardsLost1}
                    onChange={(e) => setBoardsLost1(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Coins Pocketed
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={coins1}
                    onChange={(e) => setCoins1(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Recorded Fouls
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={fouls1}
                    onChange={(e) => setFouls1(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Notes / Technical Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Decider set won at deuce"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: `1px solid ${inputBorder}`,
                background: 'transparent',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                border: 'none',
                background: '#3b82f6',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {submitting ? 'Saving...' : 'Save Statistics'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

