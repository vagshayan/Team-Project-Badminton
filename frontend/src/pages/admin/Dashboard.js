import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import TournamentFormModal from '../../components/TournamentFormModal';
import PasswordConfirmModal from '../../components/PasswordConfirmModal';
import RegistrationsModal from '../../components/RegistrationsModal';

const SPORT_META = {
  badminton:      { label: 'Badminton',    icon: '🏸', color: '#C8A84B' },
  'table-tennis': { label: 'Table Tennis', icon: '🏓', color: '#4B9CC8' },
  carrom:         { label: 'Carrom',       icon: '🎯', color: '#C84B8A' },
};

const CAT_LABELS = {
  'singles-men':   'Singles — Men',
  'singles-women': 'Singles — Women',
  'doubles-men':   'Doubles — Men',
  'doubles-women': 'Doubles — Women',
  'mixed-doubles': 'Mixed Doubles',
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Dashboard() {
  const { admin, logout } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const meta = SPORT_META[admin?.sport] || {};

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try { const res = await axios.get('/api/tournaments/admin'); setTournaments(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleCreate = async (data) => { await axios.post('/api/tournaments', data); setShowCreate(false); fetchTournaments(); showToast('✅ Tournament created!'); };
  const handleUpdate = async (data) => { await axios.put(`/api/tournaments/${editTarget._id}`, data); setEditTarget(null); fetchTournaments(); showToast('✅ Tournament updated!'); };
  const handleDelete = async (password) => { await axios.delete(`/api/tournaments/${deleteTarget._id}`, { data: { password } }); setDeleteTarget(null); fetchTournaments(); showToast('🗑 Tournament deleted.'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--dark)' }}>
      {/* Sidebar */}
      <aside style={{ width: 256, background: 'var(--dark2)', borderRight: '1px solid var(--border)', padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 34 }}>{meta.icon}</span>
          <div>
            <div style={{ fontFamily: 'var(--font-d)', fontSize: 17, fontWeight: 700, letterSpacing: 2, color: meta.color }}>{meta.label?.toUpperCase()}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, marginTop: 2 }}>ADMIN PANEL</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--dark3)', borderRadius: 6, border: '1px solid var(--border)' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-d)', fontSize: 18, fontWeight: 700, color: '#0A0A0A', flexShrink: 0 }}>
            {admin?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{admin?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{admin?.username}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderLeft: `3px solid ${meta.color}`, borderRadius: '0 4px 4px 0', fontSize: 14, fontWeight: 500, color: meta.color, background: `${meta.color}10` }}>
          <span>🏆</span> Tournaments
        </div>
        <button className="btn btn-ghost btn-full" onClick={logout} style={{ marginTop: 'auto' }}>⏏ LOGOUT</button>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '32px 36px', overflow: 'auto' }}>
        <div className="flex-between" style={{ marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>{meta.label} Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Manage open tournaments · {tournaments.length} total</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} style={{ display: 'none' }} />
              <div style={{ width: 40, height: 20, borderRadius: 10, background: editMode ? meta.color : 'var(--dark4)', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, background: 'white', borderRadius: '50%', transition: 'transform 0.2s', transform: editMode ? 'translateX(20px)' : 'translateX(0)' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, color: editMode ? meta.color : 'var(--text-muted)' }}>EDIT {editMode ? 'ON' : 'OFF'}</span>
            </label>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ NEW TOURNAMENT</button>
          </div>
        </div>

        {toast && <div className="alert alert-success" style={{ marginBottom: 20 }}>{toast}</div>}

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /> Loading tournaments...</div>
        ) : tournaments.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, background: 'var(--dark2)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 64 }}>{meta.icon}</div>
            <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 22, color: 'var(--text-muted)', marginTop: 16 }}>No tournaments yet</h3>
            <p style={{ color: 'var(--text-dim)', marginTop: 8, fontSize: 14 }}>Click "+ NEW TOURNAMENT" to create one</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {tournaments.map((t) => (
              <div key={t._id} style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: 3, background: meta.color }} />
                <div style={{ padding: '18px 20px' }}>
                  <div className="flex-between" style={{ marginBottom: 14 }}>
                    <span style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 700, color: meta.color }}>{t.year}</span>
                    <span style={{ fontSize: 11, background: 'rgba(200,168,75,0.1)', border: '1px solid rgba(200,168,75,0.2)', color: 'var(--primary)', padding: '3px 8px', borderRadius: 3, fontWeight: 600 }}>{CAT_LABELS[t.category]}</span>
                  </div>
                  {[['📅', fmtDate(t.date)], ['🕐', t.time], ['📍', t.venue]].map(([icon, text]) => (
                    <div key={icon} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}><span>{icon}</span><span>{text}</span></div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid var(--border)', marginTop: 14, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setViewTarget(t)}>👁 VIEW</button>
                    {editMode && <>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(t)}>✏ EDIT</button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => setDeleteTarget(t)}>🗑 DELETE</button>
                    </>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreate && <TournamentFormModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {editTarget && <TournamentFormModal tournament={editTarget} onClose={() => setEditTarget(null)} onSubmit={handleUpdate} requirePassword />}
      {deleteTarget && <PasswordConfirmModal title="DELETE TOURNAMENT" message={`Delete "${CAT_LABELS[deleteTarget.category]} — ${deleteTarget.year}"? This cannot be undone.`} confirmLabel="DELETE" danger onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
      {viewTarget && <RegistrationsModal tournament={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}