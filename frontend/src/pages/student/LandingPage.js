import React from 'react';
import { useNavigate } from 'react-router-dom';

const SPORTS = [
  { id: 'badminton', label: 'BADMINTON', icon: '🏸', color: '#C8A84B', path: '/badminton' },
  { id: 'table-tennis', label: 'TABLE TENNIS', icon: '🏓', color: '#4B9CC8', path: '/table-tennis' },
  { id: 'carrom', label: 'CARROM', icon: '🎯', color: '#C84B8A', path: '/carrom' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0A0A0A', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: 'var(--font-d)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <div style={{ fontSize: 60, marginBottom: 10 }}>🏆</div>
        <h1 className="title-text">SPORTS</h1>
        <p className="subtitle-text">TOURNAMENT MANAGER</p>
      </div>

      <div style={{ 
        width: '100%', 
        maxWidth: 480, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 16 
      }}>
        {SPORTS.map((sport) => (
          <button
            key={sport.id}
            onClick={() => navigate(sport.path)}
            className="sport-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '24px 28px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderLeft: `4px solid ${sport.color}`,
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textAlign: 'left',
              width: '100%',
              gap: 24,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ fontSize: 28 }}>{sport.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 3, color: sport.color }}>{sport.label}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4, letterSpacing: 1 }}>View Tournaments →</div>
            </div>
            <div className="hover-glow" style={{ 
              position: 'absolute', 
              inset: 0, 
              background: `linear-gradient(90deg, ${sport.color}00, ${sport.color}05)`,
              opacity: 0,
              transition: 'opacity 0.3s'
            }} />
          </button>
        ))}
      </div>

      <div style={{ marginTop: 80, textAlign: 'center' }}>
        <p style={{ color: '#444', fontSize: 12, maxWidth: 300 }}>
          Student? Use the links above to view & register for tournaments.
        </p>
      </div>

      <style>{`
        .title-text {
          font-size: 56px;
          font-weight: 900;
          letter-spacing: 18px;
          color: #FFFFFF;
          margin: 0;
        }
        .subtitle-text {
          font-size: 14px;
          color: #777;
          letter-spacing: 8px;
          margin-top: 10px;
          font-weight: 500;
        }
        @media (max-width: 480px) {
          .title-text {
            font-size: 40px;
            letter-spacing: 12px;
          }
          .subtitle-text {
            font-size: 11px;
            letter-spacing: 5px;
          }
        }
        .sport-card:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          transform: translateX(8px);
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .sport-card:hover .hover-glow {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
