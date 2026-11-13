import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { HomeButton, ThemeToggleButton } from '../../components/HeaderControls';
import { BADMINTON, TABLE_TENNIS, CARROM, CROWN, STAR, SHIELD, SHIRT_ICON, GRADUATION_CAP, USER_ROUND, USERS_ROUND, ID_CARD, MENU_OPEN, MENU_CLOSE, ARROW_LEFT } from '../../components/Icons';

const SPORT_META = {
  badminton: { label: 'Badminton', icon: BADMINTON, color: '#3B82F6' },
  'table-tennis': { label: 'Table Tennis', icon: TABLE_TENNIS, color: '#8B5CF6' },
  carrom: { label: 'Carrom', icon: CARROM, color: '#EC4899' },
};

export default function TournamentTeamPage() {
  const { sport: urlSport } = useParams();
  const navigate = useNavigate();
  const sportKey = (urlSport || 'badminton').toLowerCase();
  const meta = SPORT_META[sportKey] || SPORT_META.badminton;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('ALL');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`/api/university-team?sport=${sportKey}`)
      .then((res) => setMembers(res.data || []))
      .catch((err) => console.error('Error fetching university team:', err))
      .finally(() => setLoading(false));
  }, [sportKey]);

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      (m.fullName || '').toLowerCase().includes(q) ||
      (m.registrationNumber || '').toLowerCase().includes(q) ||
      (m.faculty || '').toLowerCase().includes(q) ||
      (m.position || '').toLowerCase().includes(q)
    );
  });

  const getBadgeStyle = (pos) => {
    const p = (pos || '').toLowerCase();
    if (p.includes('captain') && !p.includes('vice')) {
      return { background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#FFF', icon: CROWN };
    }
    if (p.includes('vice captain') || p.includes('vice-captain')) {
      return { background: 'linear-gradient(135deg, #06B6D4, #0284C7)', color: '#FFF', icon: STAR };
    }
    if (p.includes('game admin') || p.includes('admin') || p.includes('manager')) {
      return { background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: '#FFF', icon: SHIELD };
    }
    return { background: `${meta.color}20`, color: meta.color, icon: SHIRT_ICON };
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      {/* Navigation Header */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }} className="team-header-nav">
        <div
          onClick={() => navigate('/')}
          className="brand-block team-header-brand"
          style={{ cursor: 'pointer' }}
        >
          <div className="brand-mark">
            <img src="/logo.png" alt="University of Jaffna logo" />
          </div>
          <span className="brand-divider" aria-hidden="true" />
          <div className="brand-name">
            <span className="brand-university">University of Jaffna</span>
            <span className="brand-line">Sports Tournament Manager</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} className="desktop-sport-switcher">
          {Object.keys(SPORT_META).map((s) => (
            <button
              key={s}
              onClick={() => navigate(`/${s}/team`)}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                border: s === sportKey ? `1px solid ${SPORT_META[s].color}` : 'none',
                background: s === sportKey ? `${SPORT_META[s].color}18` : 'transparent',
                color: s === sportKey ? SPORT_META[s].color : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{SPORT_META[s].icon}</span> {SPORT_META[s].label} Team
            </button>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} className="team-header-controls">
          <div className="app-header-control-group">
            <HomeButton />
            <ThemeToggleButton />
          </div>

          <button
            onClick={() => navigate('/admin/login')}
            style={{ padding: '9px 18px', borderRadius: 12, border: 'none', background: meta.color, color: '#FFF', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            ADMIN LOGIN
          </button>

          {/* Mobile menu button */}
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text)' }}
          >
            {menuOpen ? MENU_CLOSE : MENU_OPEN}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="mobile-dropdown-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-dropdown-menu" onClick={(e) => e.stopPropagation()}>
            <HomeButton variant="menu" onNavigate={() => setMenuOpen(false)} />
            <ThemeToggleButton variant="menu" onToggle={() => setMenuOpen(false)} />
            <button className="mobile-dropdown-item" onClick={() => { navigate(`/${sportKey}`); setMenuOpen(false); }}>
              {ARROW_LEFT} Back to {meta.label} Tournament
            </button>
            {Object.keys(SPORT_META).map((s) => (
              <button
                key={s}
                className={`mobile-dropdown-item${sportKey === s ? ' active' : ''}`}
                style={{ '--sport-color': SPORT_META[s].color }}
                onClick={() => { navigate(`/${s}/team`); setMenuOpen(false); }}
              >
                <span style={{ fontSize: 22 }}>{SPORT_META[s].icon}</span>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{SPORT_META[s].label} Team Members</span>
              </button>
            ))}
            <button className="mobile-dropdown-item" onClick={() => { navigate('/admin/login'); setMenuOpen(false); }}>
              ADMIN LOGIN
            </button>
          </div>
        </div>
      )}

      {/* Main Content Hero */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '36px 24px 20px',
      }}>
        {/* Breadcrumb Tag */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 999,
          background: `${meta.color}18`,
          color: meta.color,
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 1,
          marginBottom: 16,
          border: `1px solid ${meta.color}35`,
        }}>
          <span>OPEN TOURNAMENTS</span> • <span>{meta.label.toUpperCase()}</span> • <span>UNIVERSITY TEAM</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 950, margin: 0, letterSpacing: -1 }}>
              {meta.label.toUpperCase()} — UNIVERSITY TEAM MEMBERS
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginTop: 8, maxWidth: 640 }}>
              Official registered University Team Members representing our university in <strong>{meta.label}</strong> collegiate sports tournaments.
            </p>
          </div>

          <div style={{
            padding: '10px 18px',
            borderRadius: 14,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            fontSize: 13,
            fontWeight: 800,
            color: meta.color,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>{GRADUATION_CAP}</span>
            <span>{members.length} Registered Team {members.length === 1 ? 'Member' : 'Members'}</span>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 28,
          padding: 16,
          background: 'var(--bg-card)',
          borderRadius: 20,
          border: '1px solid var(--border)',
        }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: 260 }}>
            <input
              type="text"
              placeholder={`Search ${meta.label.toLowerCase()} member name, reg. number, or role...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Roster Cards Grid */}
        <div style={{ marginTop: 28, paddingBottom: 60 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ width: 44, height: 44, margin: '0 auto 20px', borderTopColor: meta.color }} />
              <div style={{ fontSize: 16, fontWeight: 700 }}>Loading {meta.label} University Team Members...</div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              background: 'var(--bg-card)',
              borderRadius: 28,
              border: '1px dashed var(--border)',
            }}>
              <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>{GRADUATION_CAP}</div>
              <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>No Team Members Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, marginTop: 8 }}>
                {searchQuery || selectedFaculty !== 'ALL'
                  ? 'No members match the selected search filters.'
                  : `No university team members are currently registered for the ${meta.label} tournament.`}
              </p>
            </div>
          ) : (() => {
            const boys = filteredMembers.filter((m) => (m.teamGender || 'Men') === 'Men');
            const girls = filteredMembers.filter((m) => m.teamGender === 'Women');

            const renderCard = (member) => {
              const badge = getBadgeStyle(member.position);
              const { icon: badgeIcon, ...badgeStyle } = badge;
              const avatarSrc = member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName)}&background=random&size=200`;
              const isGirl = member.teamGender === 'Women';

              return (
                <div
                  key={member._id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 24,
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
                  }}
                >
                  <div style={{ height: 220, position: 'relative', background: 'rgba(0,0,0,0.15)' }}>
                    <img
                      src={avatarSrc}
                      alt={member.fullName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName)}&background=random&size=200`;
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 14,
                      left: 14,
                      padding: '6px 14px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                      ...badgeStyle,
                    }}>
                      <span>{badgeIcon}</span> {member.position.toUpperCase()}
                    </div>
                    <div style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      padding: '4px 12px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 900,
                      background: isGirl ? 'rgba(236, 72, 153, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                      backdropFilter: 'blur(4px)',
                      color: isGirl ? '#EC4899' : '#3B82F6',
                      border: `1px solid ${isGirl ? '#EC4899' : '#3B82F6'}60`,
                    }}>
                      {isGirl ? <>{USER_ROUND} Girls Team</> : <>{USER_ROUND} Boys Team</>}
                    </div>
                  </div>

                  <div style={{ padding: 22, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>
                        {member.fullName}
                      </h3>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isGirl ? '#EC4899' : meta.color, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{ID_CARD}</span> {member.registrationNumber}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, padding: '10px 14px', borderRadius: 14, background: 'var(--bg-input)' }}>
                        {GRADUATION_CAP} <strong>Faculty:</strong><br />{member.faculty}
                      </div>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                {/* Boys Team Section */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, borderBottom: '2px solid rgba(59, 130, 246, 0.3)', paddingBottom: 10 }}>
                    <span style={{ fontSize: 28 }}>{USERS_ROUND}</span>
                    <h3 style={{ fontSize: 22, fontWeight: 950, margin: 0, color: '#3B82F6' }}>
                      BOYS TEAM (MEN) — {boys.length} MEMBERS
                    </h3>
                  </div>
                  {boys.length === 0 ? (
                    <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-card)', borderRadius: 18 }}>
                      No Boys Team members registered.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 24 }}>
                      {boys.map(renderCard)}
                    </div>
                  )}
                </div>

                {/* Girls Team Section */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, borderBottom: '2px solid rgba(236, 72, 153, 0.3)', paddingBottom: 10 }}>
                    <span style={{ fontSize: 28 }}>{USERS_ROUND}</span>
                    <h3 style={{ fontSize: 22, fontWeight: 950, margin: 0, color: '#EC4899' }}>
                      GIRLS TEAM (WOMEN) — {girls.length} MEMBERS
                    </h3>
                  </div>
                  {girls.length === 0 ? (
                    <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-card)', borderRadius: 18 }}>
                      No Girls Team members registered.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 24 }}>
                      {girls.map(renderCard)}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
