import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';
import { useTheme } from '../../context/ThemeContext';
import { ARROW_RIGHT, MENU_OPEN, MENU_CLOSE } from '../../components/Icons';
import { SPORTS, getSportMeta } from '../../constants/sports';
import { HomeButton, ThemeToggleButton } from '../../components/HeaderControls';
import SportIcon from '../../components/SportIcon';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openTournamentCounts, setOpenTournamentCounts] = useState({});
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  useEffect(() => {
    let mounted = true;

    Promise.all(
      SPORTS.map((sport) => axios.get(`/api/tournaments/public/${sport.id}`)
        .then((response) => ({ sport: sport.id, count: Array.isArray(response.data) ? response.data.length : 0 }))
        .catch(() => ({ sport: sport.id, count: 0 })))
    ).then((results) => {
      if (!mounted) return;
      const counts = {};
      results.forEach((result) => { counts[result.sport] = result.count; });
      setOpenTournamentCounts(counts);
    });

    return () => { mounted = false; };
  }, []);

  return (
    <div className="landing-hero-page">
      <div className="landing-inner">
        <header className="landing-header">
          <div className="brand-block">
            <div className="brand-mark">
              <img src="/logo.png" alt="Sports Tournament Manager logo" />
            </div>
            <span className="brand-divider" aria-hidden="true" />
            <div>
              <div className="brand-name">
                <span className="brand-university">University of Jaffna</span>
                <span className="brand-line">Sports Tournament Manager</span>
              </div>
              {/* <div className="brand-subtitle">University Tournaments</div> */}
            </div>
          </div>

          <div className="header-actions-desktop">
            <div className="app-header-control-group">
              <HomeButton />
              <ThemeToggleButton />
            </div>
            <button className="admin-login-btn" onClick={() => navigate('/admin/login')}>
              Admin login
            </button>
          </div>

          <div className="header-actions-mobile" ref={menuRef}>
            <button
              className="icon-btn menu-toggle"
              onClick={() => setMenuOpen((s) => !s)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              title="Open menu"
            >
              <svg width="18" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {menuOpen && (
              <div className="menu-popover" role="menu">
                <HomeButton variant="menu" onNavigate={() => setMenuOpen(false)} />
                <button
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/admin/login');
                  }}
                  role="menuitem"
                >
                  Admin login
                </button>

                <ThemeToggleButton variant="menu" onToggle={() => setMenuOpen(false)} />
              </div>
            )}
          </div>
        </header>

        <main className="landing-main">
          <section className="hero-grid">
            <div className="hero-copy">
              <div className="hero-badge">University Tournaments</div>
              <h1 className="hero-title">Manage every<br />match day.</h1>
              <p className="hero-desc">
                Registration, brackets, player lists, and exports for <strong>Badminton</strong>, <strong>Table Tennis</strong>, and <strong>Carrom</strong> - all in one clean tournament hub.
              </p>

              <div className="hero-actions">
                <button className="button-primary" onClick={() => navigate('/brackets')}>
                  View live brackets {ARROW_RIGHT}
                </button>
              </div>
            </div>

            <aside className="hero-visual">
              <div className="visual-graphic">
                <div className="visual-circle-large" />
                <div className="visual-circle-small" />
              </div>
            </aside>
          </section>

          <section className="open-tournaments">
            <div className="open-tournaments-label">Open tournaments</div>
            <div className="tournaments-grid">
              {SPORTS.map((sport) => {
                const sportMeta = getSportMeta(sport.id, isDarkMode);
                const iconColor = isDarkMode ? sportMeta.accent : sportMeta.color;
                return (
                  <button
                    key={sport.id}
                    className="tournament-card"
                    style={{ "--accent": sportMeta.accent }}
                    onClick={() => navigate(sport.path)}
                  >
                    <div className="tournament-icon" style={{ "--accent": sportMeta.accent }}>
                      <SportIcon sportId={sport.id} accent={iconColor} size={64} strokeWidth={1.8} />
                    </div>
                    <div className="tournament-card-body">
                      <div className="tournament-title">{sportMeta.label}</div>
                      <div className="tournament-count">
                        {openTournamentCounts[sport.id] || 0} Open Tournament{openTournamentCounts[sport.id] === 1 ? '' : 's'}
                      </div>
                      <div className="tournament-link" style={{ color: sportMeta.accent }}>
                        View Tournaments {ARROW_RIGHT}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        <footer className="landing-footer">
          © 2026 Sports Tournament Manager · University Tournaments
        </footer>
      </div>
    </div>
  );
}
