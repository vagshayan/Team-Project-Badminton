import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const SPORTS = [
  { id: 'badminton', label: 'Badminton', icon: '🏸', accent: '#f5c542', path: '/badminton' },
  { id: 'carrom', label: 'Carrom', icon: '🎯', accent: '#ef5da8', path: '/carrom' },
  { id: 'table-tennis', label: 'Table Tennis', icon: '🏓', accent: '#4fc7ea', path: '/table-tennis' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-hero-page">
      <div className="landing-inner">
        <header className="landing-header">
          <div className="brand-block">
            <div className="brand-mark">ST</div>
            <div>
              <div className="brand-title">Sports Tournament Manager</div>
              <div className="brand-subtitle">University Tournaments</div>
            </div>
          </div>

          <button className="admin-login-btn" onClick={() => navigate('/admin/login')}>
            Admin login
          </button>
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
                  View live brackets →
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
              {SPORTS.map((sport) => (
                <button
                  key={sport.id}
                  className="tournament-card"
                  style={{ borderTopColor: sport.accent }}
                  onClick={() => navigate(sport.path)}
                >
                  <div className="tournament-icon">{sport.icon}</div>
                  <div className="tournament-card-body">
                    <div className="tournament-title">{sport.label}</div>
                    <div className="tournament-link" style={{ color: sport.accent }}>
                      View tournaments →
                    </div>
                  </div>
                </button>
              ))}
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
