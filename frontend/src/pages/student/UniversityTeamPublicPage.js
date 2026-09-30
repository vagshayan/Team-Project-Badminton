import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const SPORTS = [
  { id: 'badminton', label: 'Badminton', icon: '🏸', color: '#3B82F6' },
  { id: 'table-tennis', label: 'Table Tennis', icon: '🏓', color: '#8B5CF6' },
  { id: 'carrom', label: 'Carrom', icon: '🎯', color: '#EC4899' },
];

export default function UniversityTeamPublicPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();

  const queryParams = new URLSearchParams(location.search);
  const initialSport = queryParams.get('sport') || 'badminton';

  const [activeSport, setActiveSport] = useState(initialSport);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('ALL');
  const [menuOpen, setMenuOpen] = useState(false);

  const activeSportMeta = SPORTS.find((s) => s.id === activeSport) || SPORTS[0];

  useEffect(() => {
    setLoading(true);
    axios
      .get(`/api/university-team?sport=${activeSport}`)
      .then((res) => setMembers(res.data || []))
      .catch((err) => console.error('Error fetching university team:', err))
      .finally(() => setLoading(false));
  }, [activeSport]);

  const facultiesList = ['ALL', ...Array.from(new Set(members.map((m) => m.faculty).filter(Boolean)))];

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (m.fullName || '').toLowerCase().includes(q) ||
      (m.registrationNumber || '').toLowerCase().includes(q) ||
      (m.faculty || '').toLowerCase().includes(q) ||
      (m.position || '').toLowerCase().includes(q);

    const matchesFaculty = selectedFaculty === 'ALL' || m.faculty === selectedFaculty;
    return matchesSearch && matchesFaculty;
  });

  const getBadgeStyle = (pos) => {
    const p = (pos || '').toLowerCase();
    if (p.includes('captain') && !p.includes('vice')) {
      return { background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#FFF', icon: '👑' };
    }
    if (p.includes('vice captain') || p.includes('vice-captain')) {
      return { background: 'linear-gradient(135deg, #06B6D4, #0284C7)', color: '#FFF', icon: '⭐' };
    }
    if (p.includes('game admin') || p.includes('admin') || p.includes('manager')) {
      return { background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: '#FFF', icon: '🛡️' };
    }
    return { background: 'rgba(59, 130, 246, 0.15)', color: activeSportMeta.color, icon: '🎽' };
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
        padding: '14px 28px',
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 12, background: activeSportMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            🏆
          </div>
          <span style={{ fontWeight: 950, fontSize: 18, letterSpacing: -0.5 }}>UoJ SPORTS</span>
        </div>

        {/* Desktop Navbar switcher links */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} className="desktop-sport-switcher">
          <button
            onClick={() => navigate('/')}
            style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}
          >
            Home
          </button>
          <button
            onClick={() => navigate('/badminton')}
            style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}
          >
            🏸 Badminton
          </button>
          <button
            onClick={() => navigate('/table-tennis')}
            style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}
          >
            🏓 Table Tennis
          </button>
          <button
            onClick={() => navigate('/carrom')}
            style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}
          >
            🎯 Carrom
          </button>
          <button
            onClick={() => navigate('/brackets')}
            style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}
          >
            🌳 Brackets
          </button>
          <button
            onClick={() => navigate('/results/university-team')}
            style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: `${activeSportMeta.color}20`, color: activeSportMeta.color, fontWeight: 900, cursor: 'pointer', borderBottom: `2px solid ${activeSportMeta.color}` }}
          >
            🎓 University Team
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }} className="mobile-controls">
          <button
            onClick={toggleTheme}
            style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer', fontSize: 18 }}
          >
            {isDarkMode ? '🌞' : '🌙'}
          </button>

          <button
            onClick={() => navigate('/admin/login')}
            style={{ padding: '9px 18px', borderRadius: 12, border: 'none', background: activeSportMeta.color, color: '#FFF', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            <span className="admin-full-text">ADMIN LOGIN</span>
            <span className="admin-short-text">ADMIN</span>
          </button>

          {/* Mobile menu trigger */}
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text)' }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="mobile-dropdown-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-dropdown-menu" onClick={(e) => e.stopPropagation()}>
            <button className="mobile-dropdown-item" onClick={() => { navigate('/'); setMenuOpen(false); }}>
              🏠 Home
            </button>
            <button className="mobile-dropdown-item" onClick={() => { navigate('/badminton'); setMenuOpen(false); }}>
              🏸 Badminton
            </button>
            <button className="mobile-dropdown-item" onClick={() => { navigate('/table-tennis'); setMenuOpen(false); }}>
              🏓 Table Tennis
            </button>
            <button className="mobile-dropdown-item" onClick={() => { navigate('/carrom'); setMenuOpen(false); }}>
              🎯 Carrom
            </button>
            <button className="mobile-dropdown-item" onClick={() => { navigate('/brackets'); setMenuOpen(false); }}>
              🌳 Live Brackets
            </button>
            <button className="mobile-dropdown-item active" style={{ '--sport-color': activeSportMeta.color }} onClick={() => { navigate('/results/university-team'); setMenuOpen(false); }}>
              🎓 University Team Members
            </button>
          </div>
        </div>
      )}

      {/* Main Content Hero */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '40px 24px 20px',
      }}>
        {/* Breadcrumb / Category Tag */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: `${activeSportMeta.color}20`, color: activeSportMeta.color, fontSize: 12, fontWeight: 900, letterSpacing: 1, marginBottom: 16 }}>
          <span>RESULTS</span> • <span>OFFICIAL {activeSportMeta.label.toUpperCase()} ROSTER</span>
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 950, margin: 0, letterSpacing: -1, textTransform: 'uppercase' }}>
          {activeSportMeta.label} UNIVERSITY TEAM MEMBERS
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16, marginTop: 8, maxWidth: 640 }}>
          Meet the official University Team squad representing our institution in competitive collegiate {activeSportMeta.label.toLowerCase()} tournaments.
        </p>

        {/* Sport Switcher Tabs */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
          {SPORTS.map((s) => {
            const isActive = activeSport === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSport(s.id);
                  setSelectedFaculty('ALL');
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: 14,
                  border: isActive ? `2px solid ${s.color}` : '1px solid var(--border)',
                  background: isActive ? `${s.color}20` : 'var(--bg-card)',
                  color: isActive ? s.color : 'var(--text-muted)',
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{s.icon}</span> {s.label}
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 24,
          padding: 16,
          background: 'var(--bg-card)',
          borderRadius: 20,
          border: '1px solid var(--border)',
        }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <input
              type="text"
              placeholder={`🔍 Search ${activeSportMeta.label} member name, reg. number, faculty, or role...`}
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

          {/* Faculty Selector */}
          {facultiesList.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>Faculty:</span>
              <select
                value={selectedFaculty}
                onChange={(e) => setSelectedFaculty(e.target.value)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {facultiesList.map((f) => (
                  <option key={f} value={f}>
                    {f === 'ALL' ? 'All Faculties' : f}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>


        {/* Roster Grid */}
        <div style={{ marginTop: 32, paddingBottom: 60 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ width: 44, height: 44, margin: '0 auto 20px', borderTopColor: activeSportMeta.color }} />
              <div style={{ fontSize: 16, fontWeight: 700 }}>Loading {activeSportMeta.label} Team Members...</div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              background: 'var(--bg-card)',
              borderRadius: 28,
              border: '1px dashed var(--border)',
            }}>
              <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>👥</div>
              <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>No Team Members Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 15, marginTop: 8 }}>
                {searchQuery || selectedFaculty !== 'ALL'
                  ? 'No members match the selected search filters.'
                  : `The ${activeSportMeta.label} university team list has not been published yet.`}
              </p>
            </div>
          ) : (() => {
            const boys = filteredMembers.filter((m) => (m.teamGender || 'Men') === 'Men');
            const girls = filteredMembers.filter((m) => m.teamGender === 'Women');

            const renderCard = (member) => {
              const badge = getBadgeStyle(member.position);
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
                  className="university-team-card"
                >
                  <div style={{ height: 220, position: 'relative', background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
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
                      ...badge,
                    }}>
                      <span>{badge.icon}</span> {member.position.toUpperCase()}
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
                      {isGirl ? '👧 Girls Team' : '👦 Boys Team'}
                    </div>
                  </div>

                  <div style={{ padding: 22, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 950, color: 'var(--text)' }}>
                        {member.fullName}
                      </h3>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isGirl ? '#EC4899' : activeSportMeta.color, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🪪</span> {member.registrationNumber}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, padding: '10px 14px', borderRadius: 14, background: 'var(--bg-input)' }}>
                        🎓 <strong>Faculty:</strong><br />{member.faculty}
                      </div>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
                {/* Boys Team Section */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, borderBottom: '2px solid rgba(59, 130, 246, 0.3)', paddingBottom: 10 }}>
                    <span style={{ fontSize: 28 }}>👦</span>
                    <h3 style={{ fontSize: 22, fontWeight: 950, margin: 0, color: '#3B82F6' }}>
                      BOYS TEAM (MEN) — {boys.length} MEMBERS
                    </h3>
                  </div>
                  {boys.length === 0 ? (
                    <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-card)', borderRadius: 18 }}>
                      No Boys Team members published yet.
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
                    <span style={{ fontSize: 28 }}>👧</span>
                    <h3 style={{ fontSize: 22, fontWeight: 950, margin: 0, color: '#EC4899' }}>
                      GIRLS TEAM (WOMEN) — {girls.length} MEMBERS
                    </h3>
                  </div>
                  {girls.length === 0 ? (
                    <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-card)', borderRadius: 18 }}>
                      No Girls Team members published yet.
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
