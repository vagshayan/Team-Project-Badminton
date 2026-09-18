import React from 'react';
import { motion } from 'framer-motion';
import { FaTrophy, FaXmark, FaAward, FaBolt, FaPercent, FaCalendarCheck, FaRankingStar, FaMedal, FaIdCard, FaBuildingColumns } from 'react-icons/fa6';

export default function TopPerformerModal({ performer, theme, onClose }) {
  if (!performer || !theme) return null;

  return (
    <div 
      className="modal-overlay" 
      style={sh.overlay} 
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div 
        className="modal-card" 
        style={{
          ...sh.card,
          borderColor: `${theme.primary}50`,
          boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 35px ${theme.primary}25`
        }}
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
      >
        {/* Top Sport Accent Bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: theme.accentGradient || theme.primary }} />

        {/* Header & Close */}
        <div style={sh.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🏆</span>
            <div>
              <span style={{ fontSize: 10, fontWeight: 900, color: theme.primary, letterSpacing: 2, textTransform: 'uppercase' }}>OFFICIAL LEADERBOARD</span>
              <h2 style={{ fontSize: 20, fontWeight: 950, margin: 0, letterSpacing: -0.5 }}>TOP PERFORMER</h2>
            </div>
          </div>
          <button onClick={onClose} style={sh.closeBtn} title="Close modal" aria-label="Close modal">
            <FaXmark size={16} />
          </button>
        </div>

        <div style={sh.body}>
          {/* Athlete Profile Section */}
          <div style={sh.profileSection}>
            <div style={{ position: 'relative' }}>
              <div 
                style={{
                  ...sh.avatarRing,
                  borderColor: theme.primary,
                  boxShadow: `0 0 25px ${theme.primary}50`
                }}
              >
                <img 
                  src={performer.photo} 
                  alt={performer.name} 
                  style={sh.avatarImg}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(performer.name)}&background=2563eb&color=fff&size=200`;
                  }}
                />
              </div>
              <div style={{ ...sh.rankFloatingBadge, background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', color: '#0F172A' }}>
                <FaMedal size={11} /> #1
              </div>
            </div>

            <div style={sh.profileInfo}>
              <div style={{ ...sh.sportTag, background: `${theme.primary}18`, color: theme.primary, border: `1px solid ${theme.primary}35` }}>
                <span>{theme.icon}</span>
                <span>{theme.label} · {performer.category}</span>
              </div>
              <h3 style={sh.playerName}>{performer.name}</h3>
              <div style={sh.regNo}>
                <FaIdCard size={12} style={{ color: theme.primary }} />
                <span>REG: <strong>{performer.registrationNo}</strong></span>
              </div>
              <div style={sh.faculty}>
                <FaBuildingColumns size={12} style={{ color: theme.primary }} />
                <span>{performer.faculty}</span>
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          <div style={sh.statsGrid}>
            <div style={sh.statBox}>
              <div style={{ ...sh.statIconWrap, background: `${theme.primary}15`, color: theme.primary }}>
                <FaTrophy size={15} />
              </div>
              <div style={sh.statValue}>{performer.wins}</div>
              <div style={sh.statLabel}>TOTAL WINS</div>
            </div>

            <div style={sh.statBox}>
              <div style={{ ...sh.statIconWrap, background: `${theme.secondary || theme.primary}15`, color: theme.secondary || theme.primary }}>
                <FaPercent size={15} />
              </div>
              <div style={{ ...sh.statValue, color: '#10B981' }}>{performer.winRate}</div>
              <div style={sh.statLabel}>WIN RATE</div>
            </div>

            <div style={sh.statBox}>
              <div style={{ ...sh.statIconWrap, background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
                <FaCalendarCheck size={15} />
              </div>
              <div style={sh.statValue}>{performer.matches}</div>
              <div style={sh.statLabel}>MATCHES</div>
            </div>

            <div style={sh.statBox}>
              <div style={{ ...sh.statIconWrap, background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                <FaBolt size={15} />
              </div>
              <div style={{ ...sh.statValue, color: '#F59E0B' }}>{performer.points}</div>
              <div style={sh.statLabel}>PTS SCORED</div>
            </div>
          </div>

          {/* Achievement Banner */}
          {performer.achievements && (
            <div style={{ ...sh.achievementBanner, borderColor: `${theme.primary}25`, background: `${theme.primary}08` }}>
              <FaAward size={14} style={{ color: '#FBBF24', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{performer.achievements}</span>
            </div>
          )}

          {/* Footer Action */}
          <div style={sh.footer}>
            <button 
              onClick={onClose}
              style={{
                ...sh.actionBtn,
                background: theme.accentGradient || `linear-gradient(135deg, ${theme.primary}, #3B82F6)`,
                boxShadow: `0 8px 20px ${theme.primary}40`
              }}
            >
              <FaRankingStar size={14} /> VIEW ATHLETE PROFILE
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const sh = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(4, 6, 12, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: 20 },
  card: { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 28, width: '100%', maxWidth: 480, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
  header: { padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  body: { padding: '24px 24px 28px', display: 'flex', flexDirection: 'column', gap: 20 },
  profileSection: { display: 'flex', alignItems: 'center', gap: 20 },
  avatarRing: { width: 92, height: 92, borderRadius: '50%', border: '3px solid', overflow: 'hidden', padding: 2, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' },
  rankFloatingBadge: { position: 'absolute', bottom: -4, right: -4, padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 4px 10px rgba(0,0,0,0.4)', border: '2px solid var(--bg-panel)' },
  profileInfo: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  sportTag: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 900, width: 'fit-content', letterSpacing: 0.5, textTransform: 'uppercase' },
  playerName: { fontSize: 20, fontWeight: 950, margin: '2px 0 0', letterSpacing: -0.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  regNo: { fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 },
  faculty: { fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
  statBox: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  statIconWrap: { width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: 950, color: 'var(--text)', lineHeight: 1.1, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1, marginTop: 4, textTransform: 'uppercase' },
  achievementBanner: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: '1px solid' },
  footer: { marginTop: 4 },
  actionBtn: { width: '100%', border: 'none', color: '#FFF', padding: '14px', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.25s ease' }
};
