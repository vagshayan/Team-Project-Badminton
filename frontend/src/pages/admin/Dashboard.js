import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import TournamentFormModal from '../../components/TournamentFormModal';
import PasswordConfirmModal from '../../components/PasswordConfirmModal';
import RegistrationsModal from '../../components/RegistrationsModal';
import BracketsView from '../../components/BracketsView';
import { exportPlayerListCSV, exportFullPlayerReportPDF, exportSinglePlayerPDF, exportFilteredPlayersPDF, exportFilteredPlayersCSV } from '../../utils/exporters';

const SPORT_META = {
  badminton: { label: 'Badminton', icon: '🏸', color: '#3B82F6' },
  'table-tennis': { label: 'Table Tennis', icon: '🏓', color: '#8B5CF6' },
  carrom: { label: 'Carrom', icon: '🎯', color: '#EC4899' },
};

const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};

const STATUS_STYLE = {
  pending: { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', label: 'Pending' },
  confirmed: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', label: 'Approved' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', label: 'Rejected' },
  cancelled: { bg: 'rgba(156, 163, 175, 0.15)', color: '#6B7280', label: 'Cancelled' },
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const FILTER_CATEGORIES = [
  {
    id: 'singles-men',
    label: 'Singles-Men',
    options: [
      { value: 'singles-men:all', label: 'All-Registrations' },
      { value: 'singles-men:confirmed', label: 'Approved-only' },
      { value: 'singles-men:rejected', label: 'Rejected-only' },
      { value: 'singles-men:pending', label: 'Pending-only' },
    ]
  },
  {
    id: 'singles-women',
    label: 'Singles-Women',
    options: [
      { value: 'singles-women:all', label: 'All-Registrations' },
      { value: 'singles-women:confirmed', label: 'Approved-only' },
      { value: 'singles-women:rejected', label: 'Rejected-only' },
      { value: 'singles-women:pending', label: 'Pending-only' },
    ]
  },
  {
    id: 'doubles-men',
    label: 'Doubles-Men',
    options: [
      { value: 'doubles-men:all', label: 'All-Registrations' },
      { value: 'doubles-men:confirmed', label: 'Approved-only' },
      { value: 'doubles-men:rejected', label: 'Rejected-only' },
      { value: 'doubles-men:pending', label: 'Pending-only' },
    ]
  },
  {
    id: 'doubles-women',
    label: 'Doubles-Women',
    options: [
      { value: 'doubles-women:all', label: 'All-Registrations' },
      { value: 'doubles-women:confirmed', label: 'Approved-only' },
      { value: 'doubles-women:rejected', label: 'Rejected-only' },
      { value: 'doubles-women:pending', label: 'Pending-only' },
    ]
  },
  {
    id: 'mixed-doubles',
    label: 'Mixed-Doubles',
    options: [
      { value: 'mixed-doubles:all', label: 'All-Registrations' },
      { value: 'mixed-doubles:confirmed', label: 'Approved-only' },
      { value: 'mixed-doubles:rejected', label: 'Rejected-only' },
      { value: 'mixed-doubles:pending', label: 'Pending-only' },
    ]
  }
];

export default function Dashboard() {
  const { admin, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tournaments, setTournaments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState({ totalPlayers: 0, pendingApprovals: 0, activeCategories: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoverCategory, setHoverCategory] = useState(null);
  const filterRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const meta = admin?.sport ? SPORT_META[admin.sport] : SPORT_META['badminton'];

  const filteredRegistrations = registrations.filter(r => {
    const matName = (r.playerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matReg = (r.rollNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === 'all') return matName || matReg;
    const [cat, stat] = statusFilter.includes(':') ? statusFilter.split(':') : ['all', statusFilter];
    const matCategory = cat === 'all' ? true : r.tournament?.category === cat;
    const matStatus = stat === 'all' ? true : r.status === stat;
    return (matName || matReg) && matCategory && matStatus;
  });

  const activeCatId = statusFilter.includes(':') ? statusFilter.split(':')[0] : null;

  let selectedLabel = 'All Registrations';
  let selectedCategoryLabel = 'Showing all';
  for (const cat of FILTER_CATEGORIES) {
    const opt = cat.options.find(o => o.value === statusFilter);
    if (opt) {
      selectedLabel = opt.label;
      selectedCategoryLabel = cat.label;
      break;
    }
  }

  const fetchData = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try {
      const [tRes, sRes, rRes] = await Promise.all([
        axios.get('/api/tournaments/admin'),
        axios.get('/api/tournaments/stats'),
        axios.get('/api/registrations/admin')
      ]);
      setTournaments(tRes.data);
      setStats(sRes.data);
      setRegistrations(rRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => { if (admin) fetchData(); }, [admin, fetchData]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleUpdateStatus = async (id, status) => {
    try {
      const res = await axios.patch(`/api/registrations/${id}/status`, { status });
      fetchData();
      const message = res.data.message || '✅ Status updated!';
      showToast(message);
    }
    catch (err) {
      alert('Action failed');
    }
  };

  const handleCreate = async (data) => {
    try { await axios.post('/api/tournaments', data); setShowCreate(false); fetchData(); showToast('✅ Tournament created!'); }
    catch (err) { alert(err.response?.data?.message || 'Error creating tournament'); }
  };
  const handleUpdate = async (data) => {
    try { await axios.put(`/api/tournaments/${editTarget._id}`, { ...data, password: data.password }); setEditTarget(null); fetchData(); showToast('✅ Tournament updated!'); }
    catch (err) { alert(err.response?.data?.message || 'Error updating tournament.'); }
  };
  const handleDelete = async (password) => {
    try { await axios.delete(`/api/tournaments/${deleteTarget._id}`, { data: { password } }); setDeleteTarget(null); fetchData(); showToast('🗑 Deleted.'); }
    catch (err) { alert(err.response?.data?.message || 'Invalid password.'); }
  };

  if (!admin) return null;

  return (
    <div style={ds.container}>
      {/* Sidebar */}
      <aside style={ds.sidebar}>
        <div style={ds.sidebarBrand}>
          <div style={{ ...ds.logoBox, background: meta.color }}>{meta.icon}</div>
          <div style={{ fontWeight: 950, fontSize: 18, letterSpacing: -0.5 }}>ADMIN CONTROL PANEL</div>
        </div>

        {/* Manager Profile Card */}
        <div style={ds.profileCard}>
          <div style={ds.avatarBox}>
            <img src={`https://ui-avatars.com/api/?name=${admin.name}&background=random&size=128`} alt="Admin" style={ds.avatar} />
            <div style={ds.statusDot} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={ds.pName}>{admin.name.toUpperCase()}</div>
            <div style={ds.pRole}>{meta.label.toUpperCase()} MANAGER</div>
          </div>
        </div>

        <nav style={ds.nav}>
          {[
            { id: 'dashboard', label: 'DASHBOARD VIEW', icon: '💎' },
            { id: 'player-approvals', label: 'PLAYER APPROVALS', icon: '🎯' },
            { id: 'tournament-setup', label: 'TOURNAMENT SETUP', icon: '🏆' },
            { id: 'brackets', label: 'BRACKETS & DRAWS', icon: '🌳' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ ...ds.navBtn, background: activeTab === tab.id ? `${meta.color}20` : 'transparent', color: activeTab === tab.id ? meta.color : 'var(--text-muted)', borderLeft: activeTab === tab.id ? `4px solid ${meta.color}` : '4px solid transparent', borderRadius: '0 20px 20px 0' }}>
              <span style={{ fontSize: 24 }}>{tab.icon}</span> <span style={{ fontSize: 13, letterSpacing: 0.5 }}>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={toggleTheme} style={ds.themeBtn}>{isDarkMode ? '⛅ DAY MODE' : '🌙 NIGHT MODE'}</button>
          <button onClick={logout} style={ds.logoutBtn}>SIGN OUT</button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div style={ds.mainWrapper}>
        <header style={ds.header}>
          <div style={ds.greetBox}>
            <h2 style={{ fontSize: 28, fontWeight: 950, margin: 0, letterSpacing: -1 }}>
              {new Date().getHours() < 12 ? '☀️ GOOD MORNING' : new Date().getHours() < 18 ? '🌤️ GOOD AFTERNOON' : '🌙 GOOD EVENING'}, <span style={{ color: meta.color }}>{admin.name.split(' ')[0].toUpperCase()}</span>
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1.5 }}>SYSTEM STATUS: OPTIMAL</p>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ ...ds.domainBadge, borderColor: meta.color, color: meta.color }}>{meta.label.toUpperCase()} CONTROL</div>
          </div>
        </header>

        <main style={{ padding: '60px' }}>
          {toast && <div className="alert alert-success" style={{ padding: '16px 24px', fontSize: 16, marginBottom: 32 }}>{toast}</div>}

          {activeTab === 'dashboard' && (
            <div>
              <h1 style={ds.title}>DASHBOARD OVERVIEW</h1>
              <p style={ds.subtitle}>Real-time metrics for your managed tournaments.</p>

              <div style={ds.statsGrid}>
                {[
                  { label: 'Confirmed Players', val: stats.totalPlayers || 0, color: '#3B82F6', icon: '👥' },
                  { label: 'Awaiting Approvals', val: stats.pendingApprovals || 0, color: '#EF4444', icon: '⏳' },
                  { label: 'Active Domains', val: stats.activeCategories || 0, color: '#9333EA', icon: '🎖️' },
                ].map((s) => (
                  <div key={s.label} style={ds.statCard}>
                    <div style={{ ...ds.cardSymbol, color: s.color, background: `${s.color}15` }}>{s.icon}</div>
                    <div style={{ fontSize: 64, fontWeight: 950 }}>{s.val}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 2 }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'player-approvals' && (
            <div style={ds.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                <h2 style={ds.sectionTitle}>PLAYER VERIFICATION BOARD</h2>
                <div style={{ display: 'flex', gap: 15, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                  {/* Custom Nested Filter Dropdown (Windows Context Menu Style) */}
                  <div ref={filterRef} style={{ position: 'relative', width: 350, zIndex: 50 }}>
                    <div
                      onClick={() => {
                        setFilterOpen(!filterOpen);
                        if (!filterOpen) setHoverCategory(activeCatId);
                      }}
                      style={{
                        ...ds.filterSelect,
                        width: '100%',
                        height: 50,
                        borderRadius: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 20px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{selectedCategoryLabel}</span>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{selectedLabel}</span>
                      </div>
                      <span style={{ fontSize: 12, opacity: 0.6 }}>{filterOpen ? '▲' : '▼'}</span>
                    </div>

                    {filterOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '110%',
                          left: 0,
                          background: 'var(--bg-card)',
                          backdropFilter: 'blur(25px)',
                          border: '1px solid var(--border)',
                          borderRadius: 16,
                          boxShadow: 'var(--shadow)',
                          zIndex: 1000,
                          padding: '6px 0',
                          width: 240
                        }}
                      >
                        {FILTER_CATEGORIES.map((cat) => {
                          const isCategorySelected = activeCatId === cat.id;
                          const isHovered = hoverCategory === cat.id;
                          return (
                            <div
                              key={cat.id}
                              style={{ position: 'relative' }}
                              onMouseEnter={() => setHoverCategory(cat.id)}
                            >
                              <div
                                className={`context-menu-item ${isHovered ? 'active-hover' : ''}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 16px',
                                  height: 40
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ width: 16, textAlign: 'center', fontWeight: 900, color: 'var(--primary)' }}>
                                    {isCategorySelected ? '•' : ''}
                                  </span>
                                  <span>{cat.label}</span>
                                </div>
                                <span className="arrow-indicator" style={{ fontSize: 14, color: 'var(--text-muted)' }}>›</span>
                              </div>

                              {isHovered && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: '98%',
                                    top: 0,
                                    background: 'var(--bg-card)',
                                    backdropFilter: 'blur(25px)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 16,
                                    boxShadow: 'var(--shadow)',
                                    zIndex: 1001,
                                    padding: '6px 0',
                                    width: 200
                                  }}
                                >
                                  {cat.options.map((opt) => {
                                    const isOptionSelected = statusFilter === opt.value;
                                    return (
                                      <div
                                        key={opt.value}
                                        onClick={() => {
                                          setStatusFilter(opt.value);
                                          setFilterOpen(false);
                                        }}
                                        className="context-menu-item"
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 10,
                                          padding: '10px 16px',
                                          height: 40
                                        }}
                                      >
                                        <span style={{ width: 16, textAlign: 'center', fontWeight: 900, color: 'var(--primary)' }}>
                                          {isOptionSelected ? '•' : ''}
                                        </span>
                                        <span>{opt.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const unique = Array.from(new Map(filteredRegistrations.map(item => [item.rollNumber, item])).values());
                      exportFilteredPlayersCSV(unique, `${admin.sport.toUpperCase()} PARTICIPANTS - ${statusFilter.toUpperCase()}`);
                    }}
                    style={{ ...ds.actionBtn, background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0 25px', height: 50, borderRadius: 20, whiteSpace: 'nowrap' }}
                  >💾 DOWNLOAD CSV</button>
                  <div style={{ position: 'relative', width: 350 }}>
                    <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Search Name or Reg No..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ ...ds.input, paddingLeft: 50, borderRadius: 20, width: '100%', height: 50 }}
                    />
                  </div>
                </div>
              </div>
              <div style={ds.tableBox}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={ds.thead}>
                    <tr>
                      <th style={{ ...ds.th_header, width: '25%' }}>PARTICIPANT</th>
                      <th style={{ ...ds.th_header, width: '20%' }}>CATEGORY & YEAR</th>
                      <th style={{ ...ds.th_header, width: '20%' }}>CONTACT</th>
                      <th style={{ ...ds.th_header, width: '15%' }}>STATUS</th>
                      <th style={{ ...ds.th_header, width: '20%' }}>ACTION CENTER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegistrations.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 60, textAlign: 'center', fontSize: 18, color: 'var(--text-muted)' }}>No matching registrations found for current filters.</td></tr>
                    ) : (
                      filteredRegistrations
                        .map(r => (
                          <tr key={r._id} style={ds.tr}>
                            <td style={ds.td}>
                              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>{r.playerName}</div>
                              <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>REG: {r.rollNumber}</div>
                              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 800, marginTop: 4 }}>{r.department}</div>
                            </td>
                            <td style={ds.td}>
                              <div style={{ fontWeight: 800, fontSize: 15 }}>{CAT_LABELS[r.tournament?.category]}</div>
                              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Year: {r.tournament?.year}</div>
                            </td>
                            <td style={ds.td}>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>📞 <a href={`tel:${r.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.phone}</a></div>
                              <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                                📧 <a
                                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(r.email || '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: 'inherit', textDecoration: 'none' }}
                                >
                                  {r.email}
                                </a>
                              </div>
                              {r.nicNo ? (
                                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>🪪 {r.nicNo}</div>
                              ) : null}
                            </td>
                            <td style={ds.td}>
                              <span style={{ padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 900, ...STATUS_STYLE[r.status] }}>{STATUS_STYLE[r.status].label.toUpperCase()}</span>
                            </td>
                            <td style={ds.td}>
                              <div style={{ display: 'flex', gap: 10 }}>
                                {r.status === 'pending' ? (
                                  <>
                                    <button onClick={() => handleUpdateStatus(r._id, 'confirmed')} style={{ ...ds.actionBtn, background: '#10B981', color: '#000' }}>APPROVE</button>
                                    <button onClick={() => handleUpdateStatus(r._id, 'rejected')} style={{ ...ds.actionBtn, background: '#EF4444', color: '#FFF' }}>REJECT</button>
                                  </>
                                ) : (
                                  <button onClick={() => handleUpdateStatus(r._id, 'pending')} style={ds.revertBtn}>RESET</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'tournament-setup' && (
            <div style={ds.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
                <h2 style={ds.sectionTitle}>TOURNAMENT SETUP BOARD</h2>
                <button onClick={() => setShowCreate(true)} style={ds.createBtn}>+ ADD NEW TOURNAMENT</button>
              </div>
              <div style={ds.grid}>
                {tournaments.map(t => (
                  <div key={t._id} style={ds.tournCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                      <div style={{ fontSize: 40, fontWeight: 950, color: 'var(--primary)' }}>{t.year}</div>
                      <div style={{ ...ds.catBadge, color: 'var(--primary)' }}>{CAT_LABELS[t.category]}</div>
                    </div>
                    <div style={ds.tournInfo}>
                      <div style={{ display: 'flex', gap: 10, fontSize: 16 }}>🗓️ <span>{fmtDate(t.date)}</span></div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 16 }}>📍 <span>{t.venue}</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button onClick={() => setViewTarget(t)} style={ds.viewBtn}>VIEW REGISTERED PLAYERS</button>
                      <button onClick={async () => {
                        const res = await axios.get(`/api/registrations/tournament/${t._id}`);
                        exportPlayerListCSV(t, res.data);
                      }} style={{ ...ds.viewBtn, width: 'auto', px: 20 }}>📊 CSV</button>
                      <button onClick={async () => {
                        const res = await axios.get(`/api/registrations/tournament/${t._id}`);
                        exportFullPlayerReportPDF(t, res.data);
                      }} style={{ ...ds.viewBtn, width: 'auto', px: 20, color: '#EF4444' }}>📄 FULL PDF</button>
                      <button onClick={() => setEditTarget(t)} style={{ ...ds.viewBtn, width: 'auto', px: 20 }}>✏️</button>
                      <button onClick={() => setDeleteTarget(t)} style={{ ...ds.viewBtn, width: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'brackets' && (
            <BracketsView admin={admin} color={meta.color} />
          )}
        </main>
      </div>

      {showCreate && <TournamentFormModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {editTarget && <TournamentFormModal tournament={editTarget} onClose={() => setEditTarget(null)} onSubmit={handleUpdate} requirePassword />}
      {viewTarget && <RegistrationsModal tournament={viewTarget} onClose={() => setViewTarget(null)} />}
      {deleteTarget && <PasswordConfirmModal title="DELETE TOURNAMENT" message={`Delete ${CAT_LABELS[deleteTarget.category]}? This will remove all registration data.`} confirmLabel="DELETE NOW" danger onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}

const ds = {
  container: { display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: 340, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0 },
  sidebarBrand: { height: 110, display: 'flex', alignItems: 'center', px: 32, gap: 16, borderBottom: '1px solid var(--border)', padding: '0 32px' },
  logoBox: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' },
  profileCard: { padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, borderBottom: '1px solid var(--border)' },
  avatarBox: { position: 'relative', width: 90, height: 90 },
  avatar: { width: '100%', height: '100%', borderRadius: 32, objectFit: 'cover', border: '3px solid var(--border)' },
  statusDot: { position: 'absolute', bottom: -5, right: -5, width: 22, height: 22, background: '#10B981', border: '4px solid var(--bg-card)', borderRadius: '50%' },
  pName: { fontSize: 16, fontWeight: 950, letterSpacing: 0.5 },
  pRole: { fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1.5, marginTop: 4 },
  nav: { flex: 1, padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 4 },
  navBtn: { display: 'flex', alignItems: 'center', gap: 20, padding: '18px 32px', border: 'none', cursor: 'pointer', fontWeight: 800, transition: 'all 0.3s' },
  mainWrapper: { flex: 1, marginLeft: 340 },
  header: { height: 110, background: 'var(--nav-bg)', backdropFilter: 'blur(30px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px', position: 'sticky', top: 0, zIndex: 10 },
  greetBox: { display: 'flex', flexDirection: 'column', gap: 4 },
  domainBadge: { padding: '10px 24px', borderRadius: 40, fontSize: 11, fontWeight: 900, border: '1px solid' },
  themeBtn: { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '14px', borderRadius: '14px', fontSize: 12, fontWeight: 900, cursor: 'pointer' },
  logoutBtn: { color: '#EF4444', fontWeight: 950, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, letterSpacing: 1 },
  title: { fontSize: 56, fontWeight: 950, marginBottom: 8, letterSpacing: -2, textTransform: 'uppercase' },
  subtitle: { color: 'var(--text-muted)', marginBottom: 60, fontSize: 18, fontWeight: 500 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, marginBottom: 70 },
  statCard: { background: 'var(--bg-card)', padding: '48px 32px', borderRadius: 40, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', position: 'relative' },
  cardSymbol: { width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 24 },
  section: { animation: 'fadeIn 0.5s ease' },
  sectionTitle: { fontSize: 36, fontWeight: 950, marginBottom: 32, letterSpacing: -1, textTransform: 'uppercase' },
  tableBox: { borderRadius: 40, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)', background: 'var(--bg-card)' },
  thead: { background: 'var(--bg-input)', borderBottom: '2px solid var(--border)' },
  th_header: { padding: '24px 32px', fontSize: 13, textTransform: 'uppercase', color: 'var(--text)', letterSpacing: 1.5, fontWeight: 950 },
  tr: { borderTop: '1px solid var(--border)', transition: 'background 0.2s' },
  input: { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '14px 18px', borderRadius: 12, fontSize: 16, outline: 'none', transition: 'all 0.2s' },
  td: { padding: '28px 32px' },
  actionBtn: { border: 'none', padding: '12px 20px', borderRadius: 12, fontWeight: 950, fontSize: 12, cursor: 'pointer', letterSpacing: 0.5 },
  revertBtn: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '12px 20px', borderRadius: 12, fontWeight: 950, fontSize: 12, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 32 },
  tournCard: { background: 'var(--bg-card)', padding: '40px', borderRadius: 40, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 28 },
  catBadge: { background: 'var(--bg-input)', padding: '10px 18px', borderRadius: 14, fontSize: 13, fontWeight: 950, letterSpacing: 0.5, border: '1px solid var(--border)' },
  tournInfo: { color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 10 },
  viewBtn: { flex: 1, background: 'var(--bg-input)', border: 'none', color: 'var(--text)', padding: '16px', borderRadius: 18, cursor: 'pointer', fontWeight: 900, fontSize: 14, transition: 'all 0.2s', letterSpacing: 0.5 },
  createBtn: { background: 'var(--primary)', color: '#FFF', border: 'none', padding: '18px 40px', borderRadius: 20, fontWeight: 950, fontSize: 15, cursor: 'pointer', boxShadow: '0 15px 30px -5px rgba(59, 130, 246, 0.4)' },
  filterSelect: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '12px 20px', borderRadius: 16, fontSize: 13, fontWeight: 800, cursor: 'pointer', outline: 'none' }
};