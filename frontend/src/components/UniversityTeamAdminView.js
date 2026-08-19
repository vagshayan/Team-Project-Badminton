import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const STANDARD_FACULTIES = [
  'Faculty of Arts',
  'Faculty of Agriculture',
  'Faculty of Allied Health Sciences',
  'Faculty of Engineering',
  'Faculty of Hindu Studies',
  'Faculty of Management Studies & Commerce',
  'Faculty of Medicine',
  'Faculty of Science',
  'Faculty of Performing & Visual Arts',
  'Faculty of Technology',
];

const STANDARD_POSITIONS = ['Captain', 'Vice Captain', 'Game Admin', 'Player'];

const SPORTS = [
  { id: 'badminton', label: 'Badminton', icon: '🏸', color: '#3B82F6' },
  { id: 'table-tennis', label: 'Table Tennis', icon: '🏓', color: '#8B5CF6' },
  { id: 'carrom', label: 'Carrom', icon: '🎯', color: '#EC4899' },
];

export default function UniversityTeamAdminView({ color = '#3B82F6' }) {
  const { admin } = useAuth();
  const currentSport = admin?.sport || 'badminton';
  const activeSportMeta = SPORTS.find((s) => s.id === currentSport) || SPORTS[0];

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Category view filter
  const [activeCategoryTab, setActiveCategoryTab] = useState('ALL'); // 'ALL', 'Men', 'Women'

  // Game-specific player database state
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [selectedPlayerRegNo, setSelectedPlayerRegNo] = useState('');
  const [playersLoading, setPlayersLoading] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [faculty, setFaculty] = useState(STANDARD_FACULTIES[0]);
  const [customFaculty, setCustomFaculty] = useState('');
  const [position, setPosition] = useState(STANDARD_POSITIONS[0]);
  const [customPosition, setCustomPosition] = useState('');
  const [teamGender, setTeamGender] = useState('Men'); // 'Men' (Boys Team) or 'Women' (Girls Team)
  const [memberSport, setMemberSport] = useState(currentSport);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/university-team?sport=${currentSport}`);
      setMembers(res.data || []);
    } catch (err) {
      console.error('Error fetching university team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [currentSport]);

  const fetchAvailablePlayers = async () => {
    setPlayersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get('/api/university-team/available-players', { headers });
      setAvailablePlayers(res.data || []);
    } catch (err) {
      console.error('Error fetching game-specific player database:', err);
      setAvailablePlayers([]);
    } finally {
      setPlayersLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleOpenAddModal = (defaultCategory = 'Men') => {
    setEditingMember(null);
    setSelectedPlayerRegNo('');
    setFullName('');
    setRegistrationNumber('');
    setFaculty(STANDARD_FACULTIES[0]);
    setCustomFaculty('');
    setPosition(STANDARD_POSITIONS[0]);
    setCustomPosition('');
    setTeamGender(defaultCategory);
    setMemberSport(currentSport);
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoUrl('');
    setErrorMessage('');
    setModalOpen(true);
    fetchAvailablePlayers();
  };

  const handleSelectPlayerFromDatabase = (regNo) => {
    setSelectedPlayerRegNo(regNo);
    if (!regNo) return;
    const player = availablePlayers.find((p) => p.registrationNumber === regNo);
    if (player) {
      setFullName(player.fullName || '');
      setRegistrationNumber(player.registrationNumber || '');

      if (player.gender === 'Female') {
        setTeamGender('Women');
      } else if (player.gender === 'Male') {
        setTeamGender('Men');
      }

      const dep = player.faculty || '';
      const matchedFaculty = STANDARD_FACULTIES.find(
        (f) => f.toLowerCase() === dep.toLowerCase() || f.toLowerCase().includes(dep.toLowerCase())
      );

      if (matchedFaculty) {
        setFaculty(matchedFaculty);
        setCustomFaculty('');
      } else if (dep) {
        setFaculty('Other');
        setCustomFaculty(dep);
      } else {
        setFaculty(STANDARD_FACULTIES[0]);
        setCustomFaculty('');
      }

      if (player.photo) {
        setPhotoUrl(player.photo);
        setPhotoPreview(player.photo);
      }
    }
  };

  const handleOpenEditModal = (member) => {
    setEditingMember(member);
    setSelectedPlayerRegNo(member.registrationNumber || '');
    setFullName(member.fullName || '');
    setRegistrationNumber(member.registrationNumber || '');
    setTeamGender(member.teamGender || 'Men');
    setMemberSport(member.sport || currentSport);
    
    if (STANDARD_FACULTIES.includes(member.faculty)) {
      setFaculty(member.faculty);
      setCustomFaculty('');
    } else {
      setFaculty('Other');
      setCustomFaculty(member.faculty || '');
    }

    if (STANDARD_POSITIONS.includes(member.position)) {
      setPosition(member.position);
      setCustomPosition('');
    } else {
      setPosition('Other');
      setCustomPosition(member.position || '');
    }

    setPhotoFile(null);
    setPhotoPreview(member.photo || '');
    setPhotoUrl(member.photo && !member.photo.startsWith('/uploads/') ? member.photo : '');
    setErrorMessage('');
    setModalOpen(true);
  };

  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Image size must be less than 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const finalFaculty = faculty === 'Other' ? customFaculty.trim() : faculty;
    const finalPosition = position === 'Other' ? customPosition.trim() : position;

    if (!fullName.trim()) return setErrorMessage('Full Name is required');
    if (!registrationNumber.trim()) return setErrorMessage('University Registration Number is required');
    if (!finalFaculty) return setErrorMessage('Faculty is required');
    if (!finalPosition) return setErrorMessage('Position/Role is required');

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('registrationNumber', registrationNumber.trim());
      formData.append('faculty', finalFaculty);
      formData.append('position', finalPosition);
      formData.append('sport', currentSport);
      formData.append('teamGender', teamGender);
      if (photoFile) {
        formData.append('photoFile', photoFile);
      } else if (photoUrl) {
        formData.append('photoUrl', photoUrl.trim());
      }

      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (editingMember) {
        await axios.put(`/api/university-team/${editingMember._id}`, formData, { headers });
        showToast('✅ Team member updated successfully!');
      } else {
        await axios.post('/api/university-team', formData, { headers });
        showToast('✅ New team member added successfully!');
      }

      setModalOpen(false);
      fetchMembers();
    } catch (err) {
      console.error('Submit error:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to save team member.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`/api/university-team/${deleteTarget._id}`, { headers });
      showToast('🗑 Team member removed.');
      setDeleteTarget(null);
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete member');
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      (m.fullName || '').toLowerCase().includes(q) ||
      (m.registrationNumber || '').toLowerCase().includes(q) ||
      (m.faculty || '').toLowerCase().includes(q) ||
      (m.position || '').toLowerCase().includes(q)
    );
    const matchesCategory = activeCategoryTab === 'ALL' || m.teamGender === activeCategoryTab;
    return matchesSearch && matchesCategory;
  });

  const boysMembers = filteredMembers.filter((m) => (m.teamGender || 'Men') === 'Men');
  const girlsMembers = filteredMembers.filter((m) => m.teamGender === 'Women');

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

  const renderMemberCard = (member) => {
    const badge = getBadgeStyle(member.position);
    const avatarSrc = member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName)}&background=random&size=200`;
    const isGirls = member.teamGender === 'Women';

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
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          position: 'relative',
        }}
      >
        {/* Top Image Banner */}
        <div style={{
          height: 180,
          position: 'relative',
          background: 'rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}>
          <img
            src={avatarSrc}
            alt={member.fullName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName)}&background=random&size=200`;
            }}
          />

          {/* Position Badge */}
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
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            ...badge,
          }}>
            <span>{badge.icon}</span> {member.position.toUpperCase()}
          </div>

          {/* Team Gender Badge */}
          <div style={{
            position: 'absolute',
            top: 14,
            right: 14,
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 900,
            background: isGirls ? 'rgba(236, 72, 153, 0.25)' : 'rgba(59, 130, 246, 0.25)',
            backdropFilter: 'blur(4px)',
            color: isGirls ? '#EC4899' : '#3B82F6',
            border: `1px solid ${isGirls ? '#EC4899' : '#3B82F6'}60`,
          }}>
            {isGirls ? '👧 Girls Team' : '👦 Boys Team'}
          </div>
        </div>

        {/* Member Info */}
        <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>
              {member.fullName}
            </h3>
            
            <div style={{
              fontSize: 13,
              fontWeight: 800,
              color: isGirls ? '#EC4899' : activeSportMeta.color,
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span>🪪</span> {member.registrationNumber}
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              🎓 {member.faculty}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: 10,
            marginTop: 20,
            paddingTop: 14,
            borderTop: '1px solid var(--border)'
          }}>
            <button
              onClick={() => handleOpenEditModal(member)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text)',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => setDeleteTarget(member)}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 30,
          right: 30,
          background: '#10B981',
          color: '#000',
          fontWeight: 900,
          padding: '14px 24px',
          borderRadius: 14,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 9999,
          fontSize: 14,
        }}>
          {toastMessage}
        </div>
      )}

      {/* Header & Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>{activeSportMeta.icon}</span>
            <h2 style={{ fontSize: 24, fontWeight: 950, margin: 0, letterSpacing: -0.5, textTransform: 'uppercase' }}>
              {activeSportMeta.label} UNIVERSITY TEAM MANAGEMENT
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Manage official Boys Team and Girls Team members for {activeSportMeta.label}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleOpenAddModal('Men')}
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              border: 'none',
              background: activeSportMeta.color,
              color: '#FFF',
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: `0 8px 20px ${activeSportMeta.color}40`,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> ADD BOYS TEAM MEMBER
          </button>

          <button
            onClick={() => handleOpenAddModal('Women')}
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              border: 'none',
              background: '#EC4899',
              color: '#FFF',
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 8px 20px rgba(236, 72, 153, 0.4)',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> ADD GIRLS TEAM MEMBER
          </button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 28,
        background: 'var(--bg-card)',
        padding: 14,
        borderRadius: 20,
        border: '1px solid var(--border)',
      }}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveCategoryTab('ALL')}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              border: activeCategoryTab === 'ALL' ? `1px solid ${activeSportMeta.color}` : '1px solid var(--border)',
              background: activeCategoryTab === 'ALL' ? `${activeSportMeta.color}20` : 'transparent',
              color: activeCategoryTab === 'ALL' ? activeSportMeta.color : 'var(--text-muted)',
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            All Squads ({members.length})
          </button>

          <button
            onClick={() => setActiveCategoryTab('Men')}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              border: activeCategoryTab === 'Men' ? '1px solid #3B82F6' : '1px solid var(--border)',
              background: activeCategoryTab === 'Men' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeCategoryTab === 'Men' ? '#3B82F6' : 'var(--text-muted)',
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            👦 Boys Team ({members.filter((m) => (m.teamGender || 'Men') === 'Men').length})
          </button>

          <button
            onClick={() => setActiveCategoryTab('Women')}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              border: activeCategoryTab === 'Women' ? '1px solid #EC4899' : '1px solid var(--border)',
              background: activeCategoryTab === 'Women' ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
              color: activeCategoryTab === 'Women' ? '#EC4899' : 'var(--text-muted)',
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            👧 Girls Team ({members.filter((m) => m.teamGender === 'Women').length})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ width: 280 }}>
          <input
            type="text"
            placeholder={`🔍 Search ${activeSportMeta.label} roster...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Roster Sections */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px', borderTopColor: activeSportMeta.color }} />
          Loading {activeSportMeta.label} team roster...
        </div>
      ) : filteredMembers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--bg-card)',
          borderRadius: 24,
          border: '1px dashed var(--border)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{activeSportMeta.icon}</div>
          <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>No {activeSportMeta.label} Team Members Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
            {searchQuery
              ? 'No members matching your search query.'
              : `Click "ADD BOYS TEAM MEMBER" or "ADD GIRLS TEAM MEMBER" to build your squad.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {/* Boys Team Section */}
          {(activeCategoryTab === 'ALL' || activeCategoryTab === 'Men') && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: '2px solid rgba(59, 130, 246, 0.3)'
              }}>
                <span style={{ fontSize: 24 }}>👦</span>
                <h3 style={{ fontSize: 18, fontWeight: 950, margin: 0, color: '#3B82F6', letterSpacing: 0.5 }}>
                  BOYS TEAM (MEN) — {boysMembers.length} MEMBERS
                </h3>
              </div>

              {boysMembers.length === 0 ? (
                <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-card)', borderRadius: 16 }}>
                  No Boys Team members added yet.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 20
                }}>
                  {boysMembers.map(renderMemberCard)}
                </div>
              )}
            </div>
          )}

          {/* Girls Team Section */}
          {(activeCategoryTab === 'ALL' || activeCategoryTab === 'Women') && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: '2px solid rgba(236, 72, 153, 0.3)'
              }}>
                <span style={{ fontSize: 24 }}>👧</span>
                <h3 style={{ fontSize: 18, fontWeight: 950, margin: 0, color: '#EC4899', letterSpacing: 0.5 }}>
                  GIRLS TEAM (WOMEN) — {girlsMembers.length} MEMBERS
                </h3>
              </div>

              {girlsMembers.length === 0 ? (
                <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-card)', borderRadius: 16 }}>
                  No Girls Team members added yet.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 20
                }}>
                  {girlsMembers.map(renderMemberCard)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            zIndex: 990,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            width: 560,
            maxWidth: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            borderRadius: 28,
            border: '1px solid var(--border)',
            padding: 28,
            boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 950, textTransform: 'uppercase' }}>
                  {editingMember ? `EDIT ${teamGender === 'Women' ? 'GIRLS' : 'BOYS'} TEAM MEMBER` : `ADD ${teamGender === 'Women' ? 'GIRLS' : 'BOYS'} TEAM MEMBER`}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                  Game: {activeSportMeta.icon} {activeSportMeta.label}
                </span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #EF4444',
                color: '#EF4444',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 18,
              }}>
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Team Category Switcher (Boys vs Girls Team) */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6 }}>
                  TEAM SQUAD CATEGORY *
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setTeamGender('Men')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: 14,
                      border: teamGender === 'Men' ? `2px solid ${activeSportMeta.color}` : '1px solid var(--border)',
                      background: teamGender === 'Men' ? `${activeSportMeta.color}20` : 'var(--bg-input)',
                      color: teamGender === 'Men' ? activeSportMeta.color : 'var(--text-muted)',
                      fontWeight: 900,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    👦 Boys Team (Men)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamGender('Women')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: 14,
                      border: teamGender === 'Women' ? '2px solid #EC4899' : '1px solid var(--border)',
                      background: teamGender === 'Women' ? 'rgba(236, 72, 153, 0.15)' : 'var(--bg-input)',
                      color: teamGender === 'Women' ? '#EC4899' : 'var(--text-muted)',
                      fontWeight: 900,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    👧 Girls Team (Women)
                  </button>
                </div>
              </div>



              {/* Photo Upload / Preview */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.5 }}>
                  MEMBER PHOTO
                </label>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{
                    width: 76,
                    height: 76,
                    borderRadius: 20,
                    overflow: 'hidden',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 30, opacity: 0.5 }}>{teamGender === 'Women' ? '👧' : '👦'}</span>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      style={{ fontSize: 12, width: '100%', marginBottom: 6 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Supports JPEG, PNG, WEBP (Max 5MB)
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6 }}>
                  FULL NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kasun Fernando"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* Registration Number */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6 }}>
                  UNIVERSITY REGISTRATION NUMBER *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UWU/ENG/20/042"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* Faculty Selection */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6 }}>
                  FACULTY *
                </label>
                <select
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: faculty === 'Other' ? 8 : 0,
                  }}
                >
                  {STANDARD_FACULTIES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="Other">Other (Custom Faculty)...</option>
                </select>

                {faculty === 'Other' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter faculty name"
                    value={customFaculty}
                    onChange={(e) => setCustomFaculty(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                )}
              </div>

              {/* Position / Role */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6 }}>
                  TEAM POSITION / ROLE *
                </label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: position === 'Other' ? 8 : 0,
                  }}
                >
                  {STANDARD_POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="Other">Other (Custom Position)...</option>
                </select>

                {position === 'Other' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom position/role"
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 2,
                    padding: '14px',
                    borderRadius: 14,
                    border: 'none',
                    background: teamGender === 'Women' ? '#EC4899' : activeSportMeta.color,
                    color: '#FFF',
                    fontWeight: 950,
                    fontSize: 14,
                    cursor: 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'SAVING...' : editingMember ? 'SAVE CHANGES' : `CREATE ${teamGender === 'Women' ? 'GIRLS' : 'BOYS'} MEMBER`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 995,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            width: 440,
            maxWidth: '100%',
            background: 'var(--bg-card)',
            borderRadius: 24,
            border: '1px solid var(--border)',
            padding: 24,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>REMOVE TEAM MEMBER?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '10px 0 20px' }}>
              Are you sure you want to remove <strong>{deleteTarget.fullName}</strong> ({deleteTarget.registrationNumber}) from the {activeSportMeta.label} {deleteTarget.teamGender === 'Women' ? 'Girls' : 'Boys'} team roster?
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#EF4444',
                  color: '#FFF',
                  fontWeight: 900,
                  cursor: 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'DELETING...' : 'YES, REMOVE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


