import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import PlayerPerformanceDashboard from '../../components/PlayerPerformanceDashboard';
import HeadToHeadComparison from '../../components/HeadToHeadComparison';

const SPORT_META = {
  badminton: { label: 'BADMINTON', icon: '🏸', color: '#3B82F6' },
  'table-tennis': { label: 'TABLE TENNIS', icon: '🏓', color: '#8B5CF6' },
  carrom: { label: 'CARROM', icon: '🎯', color: '#EC4899' },
};

export default function PlayerAnalyticsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDarkMode, toggleTheme } = useTheme();

  const initialSport = params.sport || searchParams.get('sport') || 'badminton';
  const initialRoll = searchParams.get('roll') || searchParams.get('player') || searchParams.get('playerA') || '';
  const initialPlayerB = searchParams.get('playerB') || '';
  const initialTab = searchParams.get('tab') === 'h2h' || window.location.pathname.includes('compare') || window.location.pathname.includes('h2h') ? 'h2h' : 'insights';

  const [sport, setSport] = useState(initialSport);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [menuOpen, setMenuOpen] = useState(false);

  const meta = SPORT_META[sport] || SPORT_META.badminton;

  const handleSportChange = (newSport) => {
    setSport(newSport);
    const query = new URLSearchParams(searchParams);
    query.set('sport', newSport);
    navigate(`/${newSport}/analytics?${query.toString()}`, { replace: true });
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    const query = new URLSearchParams(searchParams);
    query.set('tab', tab);
    navigate(`/${sport}/analytics?${query.toString()}`, { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-main)' }}>
      {/* ── TOP NAVIGATION ─────────────────────────────────────────────────── */}
      <nav style={styles.nav} className="mobile-nav">
        <div style={styles.brand} onClick={() => navigate('/')} className="mobile-brand">
          <div style={styles.logoCircle} className="mobile-logo">🏆</div>
          <span style={styles.brandName} className="mobile-title-main">UoJ SPORTS</span>
        </div>

        {/* Desktop inline sports tabs */}
        <div style={styles.sportSwitcher} className="desktop-sport-switcher">
          {Object.keys(SPORT_META).map((s) => (
            <button
              key={s}
              onClick={() => handleSportChange(s)}
              style={{
                ...styles.sportBtn,
                color: sport === s ? SPORT_META[s].color : 'var(--text-muted)',
                borderBottom: sport === s ? `3px solid ${SPORT_META[s].color}` : 'none',
              }}
            >
              <span style={{ fontSize: 22 }}>{SPORT_META[s].icon}</span>
              <span style={{ fontSize: 13, fontWeight: 900 }}>{SPORT_META[s].label}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }} className="mobile-controls">
          <button
            onClick={() => navigate(`/${sport}`)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 800,
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            ← Tournaments
          </button>
          <button onClick={toggleTheme} style={styles.themeToggle} className="mobile-btn">
            {isDarkMode ? '🌞' : '🌙'}
          </button>
          <button onClick={() => navigate(`/admin/login?sport=${encodeURIComponent(sport)}`)} style={styles.adminBtn} className="mobile-btn">
            <span className="admin-full-text">ADMIN</span>
            <span className="admin-short-text">ADMIN</span>
          </button>
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle game menu"
          >
            <span className="hamburger-icon">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-dropdown-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-dropdown-menu" onClick={(e) => e.stopPropagation()}>
            {Object.keys(SPORT_META).map((s) => (
              <button
                key={s}
                className={`mobile-dropdown-item${sport === s ? ' active' : ''}`}
                style={{ '--sport-color': SPORT_META[s].color }}
                onClick={() => { handleSportChange(s); setMenuOpen(false); }}
              >
                <span style={{ fontSize: 22 }}>{SPORT_META[s].icon}</span>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{SPORT_META[s].label}</span>
                {sport === s && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── HERO BANNER ────────────────────────────────────────────────────── */}
      <div style={styles.hero}>
        <div style={{ ...styles.heroBlob, background: meta.color }} />
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: `${meta.color}15`,
          border: `1px solid ${meta.color}40`,
          borderRadius: 20,
          padding: '4px 14px',
          fontSize: 12,
          fontWeight: 800,
          color: meta.color,
          marginBottom: 12,
        }}>
          <span>{meta.icon}</span>
          <span>{meta.label} ANALYTICS ENGINE</span>
        </div>
        <h1 style={styles.heroTitle} className="mobile-hero-title">
          {activeTab === 'h2h' ? 'HEAD-TO-HEAD & PLAYER COMPARISON' : 'PLAYER PERFORMANCE & SMART SUGGESTIONS'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 680, margin: '8px auto 0', lineHeight: 1.5 }}>
          {activeTab === 'h2h'
            ? 'Compare any two players side-by-side with historical rivalry match records, attribute analysis, and predictive win probability.'
            : 'Real-time statistical evaluation, performance scoring, trend analysis, and rule-based personalized suggestions.'}
        </p>

        {/* ── SUB-NAV TABS: INDIVIDUAL INSIGHTS vs HEAD-TO-HEAD ──────────────── */}
        <div style={{
          display: 'inline-flex',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: 5,
          marginTop: 24,
          boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
        }}>
          <button
            onClick={() => handleTabSwitch('insights')}
            style={{
              padding: '10px 24px',
              borderRadius: 999,
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              background: activeTab === 'insights' ? meta.color : 'transparent',
              color: activeTab === 'insights' ? '#FFFFFF' : 'var(--text-muted)',
              boxShadow: activeTab === 'insights' ? `0 4px 14px ${meta.color}40` : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            📊 Individual Insights
          </button>
          <button
            onClick={() => handleTabSwitch('h2h')}
            style={{
              padding: '10px 24px',
              borderRadius: 999,
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              background: activeTab === 'h2h' ? meta.color : 'transparent',
              color: activeTab === 'h2h' ? '#FFFFFF' : 'var(--text-muted)',
              boxShadow: activeTab === 'h2h' ? `0 4px 14px ${meta.color}40` : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            ⚔️ Head-to-Head (H2H)
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT (SWITCH BETWEEN VIEWS) ─────────────────────────────── */}
      <main style={{ padding: '0 16px' }}>
        {activeTab === 'h2h' ? (
          <HeadToHeadComparison
            initialSport={sport}
            defaultPlayerA={initialRoll}
            defaultPlayerB={initialPlayerB}
            onSportChange={(newSport) => setSport(newSport)}
          />
        ) : (
          <PlayerPerformanceDashboard
            initialSport={sport}
            defaultRollNumber={initialRoll}
            onSportChange={(newSport) => setSport(newSport)}
            onNavigateToH2H={(roll) => {
              setActiveTab('h2h');
              const query = new URLSearchParams();
              query.set('sport', sport);
              query.set('tab', 'h2h');
              query.set('playerA', roll);
              navigate(`/${sport}/analytics?${query.toString()}`, { replace: true });
            }}
          />
        )}
      </main>
    </div>
  );
}


const styles = {
  nav: {
    height: 70,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(10px)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  brandName: {
    fontWeight: 950,
    fontSize: 16,
    letterSpacing: 1,
  },
  sportSwitcher: {
    display: 'flex',
    gap: 8,
    height: '100%',
    alignItems: 'center',
  },
  sportBtn: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  themeToggle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  },
  adminBtn: {
    padding: '8px 18px',
    borderRadius: 10,
    background: 'var(--text)',
    color: 'var(--bg)',
    border: 'none',
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 0.5,
    cursor: 'pointer',
  },
  hero: {
    textAlign: 'center',
    padding: '40px 20px 30px',
    position: 'relative',
    overflow: 'hidden',
  },
  heroBlob: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: '50%',
    filter: 'blur(120px)',
    opacity: 0.15,
    top: -150,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: -1,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 950,
    letterSpacing: 0.5,
    margin: '0 auto',
  },
};
