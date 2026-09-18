import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';
import { useTheme } from '../../context/ThemeContext';
import { SUN, MOON, ARROW_RIGHT, MENU_OPEN, MENU_CLOSE } from '../../components/Icons';
import { SPORTS, getSportMeta } from '../../constants/sports';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <div className="landing-hero-page">
      <div className="landing-inner">
        <header className="landing-header">
          <div className="brand-block">
            <div className="brand-mark">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 3H14V8C14 10.2 12.2 12 10 12C7.8 12 6 10.2 6 8V3Z" stroke="#0a0e17" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 4H3.5C3.5 6.5 4.5 8 6 8" stroke="#0a0e17" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 4H16.5C16.5 6.5 15.5 8 14 8" stroke="#0a0e17" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 12V15" stroke="#0a0e17" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M7 17H13" stroke="#0a0e17" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 15V17" stroke="#0a0e17" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="brand-name">
                <span className="brand-line">Sports Tournament</span>
                <span className="brand-line">Manager</span>
              </div>
              {/* <div className="brand-subtitle">University Tournaments</div> */}
            </div>
          </div>

          <div className="header-actions-desktop">
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? SUN : MOON}
            </button>
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

                <button
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    toggleTheme();
                  }}
                  role="menuitem"
                >
                  {isDarkMode ? SUN : MOON} &nbsp; {isDarkMode ? 'Light mode' : 'Dark mode'}
                </button>
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
                Registration, brackets, player lists, and exports for <strong>Badminton</strong>, <strong>Table Tennis</strong>, and <strong>Carrom</strong> — all in one clean tournament hub.
              </p>

              <div className="hero-actions">
                <button className="button-primary" onClick={() => navigate('/brackets')}>
                  View live brackets {ARROW_RIGHT}
                </button>
                <button className="button-secondary" onClick={() => navigate('/analytics')}>
                  Player Analytics {ARROW_RIGHT}
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
                return (
                  <button
                    key={sport.id}
                    className="tournament-card"
                    style={{ "--accent": sportMeta.accent }}
                    onClick={() => navigate(sport.path)}
                  >
                    <div className="tournament-icon">{sportMeta.icon}</div>
                    <div className="tournament-card-body">
                      <div className="tournament-title">{sportMeta.label}</div>
                      <div className="tournament-link" style={{ color: sportMeta.color }}>
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
