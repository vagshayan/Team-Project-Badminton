import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Cropper from 'react-easy-crop';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SUN, MOON, EYE, EYE_OFF, LOCK, SEARCH, MENU_OPEN, MENU_CLOSE, CARET_UP, CARET_DOWN, TROPHY, TREE, PEOPLE, PHONE, EMAIL, ID_CARD, CALENDAR, LOCATION, TRASH, CLOSE, SUCCESS, WARNING_ROUND, ARROW_RIGHT, ARROW_LEFT, CHECK_MARK, CROSS, HOURGLASS, MEDAL, DOWNLOAD, CAMERA, USER_ROUND, SHIELD } from '../../components/Icons';
import { Bell, LayoutDashboard, ClipboardCheck, Trophy as TrophyOutline, UsersRound, GitBranch, ClipboardList, UserRound, LogOut } from 'lucide-react';
import TournamentFormModal from '../../components/TournamentFormModal';
import PasswordConfirmModal from '../../components/PasswordConfirmModal';
import RegistrationsModal from '../../components/RegistrationsModal';
import BracketsView from '../../components/BracketsView';
import UniversityTeamAdminView from '../../components/UniversityTeamAdminView';
import RegisterModal from '../../components/RegisterModal';
import { HomeButton, ThemeToggleButton } from '../../components/HeaderControls';
import { exportPlayerListCSV, exportFullPlayerReportPDF, exportSinglePlayerPDF, exportFilteredPlayersPDF, exportFilteredPlayersCSV } from '../../utils/exporters';
import { SPORT_META, getSportMeta } from '../../constants/sports';

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

const formatDatePreference = (value, dateFormat = 'DD/MM/YYYY') => new Date(value).toLocaleDateString(dateFormat === 'MM/DD/YYYY' ? 'en-US' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatTimePreference = (value, timeFormat = '12-hour') => new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12-hour' });
const fmtDate = (d, dateFormat) => formatDatePreference(d, dateFormat);
const fmtDeadline = (d, fallback, dateFormat) => {
  const target = d || fallback;
  if (!target) return 'N/A';
  return formatDatePreference(target, dateFormat);
};

const AUDIT_ACTION_LABELS = {
  CREATE_TOURNAMENT: 'Created Tournament',
  UPDATE_TOURNAMENT: 'Updated Tournament',
  DELETE_TOURNAMENT: 'Deleted Tournament',
  RESET_DRAW: 'Reset Draw',
  FORCE_UNLOCK_DRAW: 'Force Unlock Draw',
  GENERATE_DRAW: 'Generated Draw',
  PUBLISH_DRAW: 'Published Draw',
  UPDATE_MATCH_SCORE: 'Updated Match Result',
  ADD_TEAM_MEMBER: 'Added Team Member',
  UPDATE_TEAM_MEMBER: 'Updated Team Member',
  APPROVE_PAIR: 'Approved Pair',
  RESET_PAIR: 'Reset Pair',
  LINK_PARTNER: 'Linked Partner',
  REJECT_REGISTRATION: 'Rejected Registration',
  CONFIRMED_REGISTRATION: 'Confirmed Registration',
  PENDING_REGISTRATION: 'Pending Registration',
  CANCELLED_REGISTRATION: 'Cancelled Registration',
  UPDATED_REGISTRATION: 'Updated Player',
};

const AUDIT_MODULE_LABELS = {
  Registration: 'Registrations',
  Tournament: 'Tournaments',
  Match: 'Matches',
  Admin: 'Admins',
};

const VALID_ADMIN_TABS = new Set([
  'dashboard',
  'player-approvals',
  'tournament-setup',
  'university-team',
  'brackets',
  'audit-log',
  'profile',
  'confirmed-summary',
  'pending-approvals'
]);
const DEFAULT_ADMIN_TAB = 'dashboard';

const formatAuditAction = (action) => AUDIT_ACTION_LABELS[action] || action || 'Unknown Action';

const formatAuditModule = (log) => AUDIT_MODULE_LABELS[log.targetModel] || log.targetModel || 'Unknown';

const getTabFromSearch = (search) => {
  try {
    const params = new URLSearchParams(search || window.location.search);
    const tab = params.get('tab') || DEFAULT_ADMIN_TAB;
    return VALID_ADMIN_TABS.has(tab) ? tab : DEFAULT_ADMIN_TAB;
  } catch {
    return DEFAULT_ADMIN_TAB;
  }
};

const formatAuditValue = (value, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const formatAuditFieldName = (key) => key
  .replace(/([A-Z])/g, ' $1')
  .replace(/^./, (letter) => letter.toUpperCase());

const formatTeamMemberDetails = (details, actionLabel) => {
  const fields = [
    formatAuditValue(details.fullName),
    formatAuditValue(details.position),
    formatAuditValue(details.sport).replace(/\b\w/g, (letter) => letter.toUpperCase()),
    formatAuditValue(details.teamGender),
  ].filter(Boolean);
  const registrationNumber = formatAuditValue(details.registrationNumber);
  if (registrationNumber) fields.push(`Registration No: ${registrationNumber}`);
  return `${actionLabel} team member${fields.length ? ` — ${fields.join(', ')}` : ''}`;
};

const formatGenericAuditDetails = (details) => Object.entries(details)
  .filter(([, value]) => value !== null && value !== undefined && value !== '')
  .map(([key, value]) => `${formatAuditFieldName(key)}: ${typeof value === 'object' ? formatGenericAuditDetails(value) : value}`)
  .join(', ') || '—';

const formatAuditDetails = (log, dateFormat = 'DD/MM/YYYY') => {
  if (!log?.details) return '—';
  const details = log.details;
  if (typeof details === 'string') return details;

  const lbl = (category) => CAT_LABELS[category] || category;

  switch (log.action) {
    case 'ADD_TEAM_MEMBER':
      return formatTeamMemberDetails(details, 'Added');
    case 'UPDATE_TEAM_MEMBER':
      return formatTeamMemberDetails(details, 'Updated');
    case 'CREATE_TOURNAMENT':
      return `Created tournament ${lbl(details.category)} ${details.year}`;
    case 'UPDATE_TOURNAMENT': {
      const fields = details.updatedFields || details.after;
      if (fields && Object.keys(fields).length > 0) {
        const updated = Object.keys(fields).map((key) => {
          const value = fields[key];
          if (key === 'category') return `Category to ${lbl(value)}`;
          if (key === 'year') return `Year to ${value}`;
          if (key === 'date') return `Date to ${formatDatePreference(value, dateFormat)}`;
          if (key === 'registrationDeadline') return `Registration deadline to ${formatDatePreference(value, dateFormat)}`;
          return `${key} to ${value}`;
        }).join(', ');
        return `Updated tournament — ${updated}`;
      }
      return 'Updated tournament details';
    }
    case 'DELETE_TOURNAMENT':
      return `Deleted tournament ${lbl(details.category)} ${details.year}`;
    case 'RESET_DRAW':
      return `Reset draw for ${lbl(details.category)}`;
    case 'FORCE_UNLOCK_DRAW':
      return `Force unlocked draw for ${lbl(details.category)}`;
    case 'GENERATE_DRAW':
      return `Generated draw for ${lbl(details.category)} with ${details.confirmedPlayersCount} confirmed players`;
    case 'PUBLISH_DRAW':
      return `Published draw for ${lbl(details.category)}`;
    case 'UPDATE_MATCH_SCORE':
      return `Updated result for round ${details.round}, match ${details.matchNumber}`;
    case 'APPROVE_PAIR':
      return `Approved partner pair ${details.partnerRollNumber || ''}`;
    case 'RESET_PAIR':
      return `Reset approved pair for ${details.partnerRollNumber || 'player'}`;
    case 'LINK_PARTNER':
      return `Linked partner ${details.partnerRollNumber || details.partnerId || ''}`;
    case 'REJECT_REGISTRATION':
      return `Rejected registration ${details.rollNumber}`;
    case 'CONFIRMED_REGISTRATION':
      return `Confirmed registration ${details.rollNumber}`;
    case 'PENDING_REGISTRATION':
      return `Marked registration ${details.rollNumber} as pending`;
    case 'CANCELLED_REGISTRATION':
      return `Cancelled registration ${details.rollNumber}`;
    case 'UPDATED_REGISTRATION':
      if (details.updatedFields && Object.keys(details.updatedFields).length > 0) {
        const fields = Object.keys(details.updatedFields).map((key) => key.replace(/([A-Z])/g, ' $1')).join(', ');
        return `Updated player ${details.rollNumber} (${fields})`;
      }
      return `Updated player ${details.rollNumber}`;
    default:
      return formatGenericAuditDetails(details);
  }
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'GOOD MORNING';
  if (hour < 18) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
};

const formatActivityTime = (date) => {
  if (!date) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.floor(hours / 24)} day${hours < 48 ? '' : 's'} ago`;
};

const statusTone = {
  'In Progress': { color: '#10B981', background: 'rgba(16,185,129,0.14)' },
  'Registration Open': { color: '#3B82F6', background: 'rgba(59,130,246,0.14)' },
  Upcoming: { color: '#F59E0B', background: 'rgba(245,158,11,0.14)' },
  Completed: { color: '#10B981', background: 'rgba(16,185,129,0.14)' },
};

const getTournamentProgressStatus = (tournament) => {
  const progress = Math.min(100, Math.max(0, Number(tournament?.progress) || 0));
  if (progress === 0) return 'Registration Open';
  if (progress === 100) return 'Completed';
  return 'In Progress';
};

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
  const { admin, logout, loginHistory, setAdmin } = useAuth();
  const { isDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(getTabFromSearch(location.search));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarToggleHovered, setSidebarToggleHovered] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [tournaments, setTournaments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState({ totalPlayers: 0, pendingApprovals: 0, activeCategories: 0 });
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [editRegistrationTarget, setEditRegistrationTarget] = useState(null);
  const [removePairTarget, setRemovePairTarget] = useState(null);
  const [removePairLoading, setRemovePairLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [playerPage, setPlayerPage] = useState(1);
  const removePairModalRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoverCategory, setHoverCategory] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationMenuStyle = {
    ...ds.notificationMenu,
    background: isDarkMode ? 'var(--bg-panel)' : '#ffffff',
    border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
    boxShadow: isDarkMode ? '0 30px 70px rgba(0,0,0,0.22)' : '0 18px 42px rgba(15,23,42,0.08)',
  };
  const notificationItemStyle = {
    ...ds.notificationItem,
    background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'var(--bg-input)',
  };
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileName, setProfileName] = useState(admin?.name || '');
  const [profileUsername, setProfileUsername] = useState(admin?.username || '');
  const [profileEmail, setProfileEmail] = useState(admin?.email || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(admin?.avatarUrl || '');
  const [securityQuestion, setSecurityQuestion] = useState(admin?.securityQuestion || '');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSecurityAnswer, setShowSecurityAnswer] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [confirmFocus, setConfirmFocus] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [showPasswordEditor, setShowPasswordEditor] = useState(false);
  const [showSecurityEditor, setShowSecurityEditor] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState('12-hour');
  const [itemsPerPage, setItemsPerPage] = useState('25');
  const skipPreferenceSaveRef = useRef(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSource, setCropSource] = useState('');
  const [cropImage, setCropImage] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropReadyFile, setCropReadyFile] = useState(null);
  const [lastSeenLoginTimestamp, setLastSeenLoginTimestamp] = useState(localStorage.getItem('lastSeenLoginTimestamp') || '');
  // Audit Log states
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    const nextTab = getTabFromSearch(location.search);
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [location.search]);

  useEffect(() => {
    if (!location.search.includes('tab=')) {
      navigate(`?tab=${activeTab}`, { replace: true });
    }
  }, [location.search, activeTab, navigate]);

  const changeTab = (tabId, tournamentId = null) => {
    const normalizedTab = VALID_ADMIN_TABS.has(tabId) ? tabId : DEFAULT_ADMIN_TAB;
    const params = new URLSearchParams({ tab: normalizedTab });
    if (tournamentId) params.set('tournamentId', tournamentId);
    navigate(`?${params.toString()}`, { replace: false });
    if (isMobile) setMobileSidebarOpen(false);
  };
  const [auditDate, setAuditDate] = useState('');
  const filterRef = useRef(null);
  const notificationsRef = useRef(null);
  const sidebarProfileMenuRef = useRef(null);
  const headerProfileMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleAvatarUploadClick = () => {
    fileInputRef.current?.click();
  };

  const openCropModal = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result);
      setCropSource(file.name);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedAreaPixels(null);
      setCropReadyFile(null);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const createCroppedAvatar = async () => {
    if (!cropImage || !croppedAreaPixels) return null;
    const file = await getCroppedImg(cropImage, croppedAreaPixels);
    return file;
  };

  const handleCropConfirm = async () => {
    const croppedFile = await createCroppedAvatar();
    if (!croppedFile) {
      setProfileMessage('Unable to crop the selected image.');
      return;
    }
    setCropReadyFile(croppedFile);
    setCropModalOpen(false);
    await uploadAvatarFile(croppedFile);
  };

  // Link Partner modal state
  const [linkTarget, setLinkTarget] = useState(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkSelected, setLinkSelected] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const validatePassword = (value) => ({
    length: value.length >= 8,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(value),
  });

  const passwordChecks = validatePassword(newPassword);
  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const passwordStrength = newPassword.length === 0
    ? null
    : Object.values(passwordChecks).filter(Boolean).length;
  const passwordStrengthLabel = passwordStrength === 5 ? 'Strong' : passwordStrength >= 3 ? 'Medium' : 'Weak';
  const profileDirty = profileName !== (admin?.name || '')
    || profileUsername !== (admin?.username || '')
    || profileAvatarUrl !== (admin?.avatarUrl || '');
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const showPasswordRequirements = passwordFocus && newPassword.length > 0;
  const showPasswordMatchMessage = confirmPassword.length > 0;

  const getApiBase = () => {
    if (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.startsWith('http')) {
      return process.env.REACT_APP_API_URL;
    }
    if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      return 'http://localhost:5000';
    }
    return '';
  };

  const uploadAvatarFile = async (file) => {
    setProfileMessage('');
    setUploadingAvatar(true);
    try {
      const apiBase = getApiBase();
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await axios.post(`${apiBase}/api/auth/me/avatar`, formData);
      if (res?.status >= 200 && res?.status < 300 && res?.data) {
        const avatarUrl = res.data.avatarUrl || '';
        setProfileAvatarUrl(avatarUrl);
        setAdmin((prev) => prev ? { ...prev, avatarUrl } : prev);
        setProfileMessage('Profile photo updated successfully.');
        showToast('Profile photo updated successfully.');
      } else {
        throw new Error(res?.data?.message || 'Unable to upload avatar');
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Unable to upload avatar';
      setProfileMessage(message);
      showToast(message, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profileAvatarUrl) return;
    setProfileMessage('');
    setUploadingAvatar(true);
    try {
      const apiBase = getApiBase();
      const res = await axios.delete(`${apiBase}/api/auth/me/avatar`);
      if (res?.status >= 200 && res?.status < 300) {
        setProfileAvatarUrl('');
        setAdmin((prev) => prev ? { ...prev, avatarUrl: '' } : prev);
        setProfileMessage('Profile photo removed.');
        showToast('Profile photo removed.');
      } else {
        throw new Error(res?.data?.message || 'Unable to remove avatar');
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Unable to remove avatar';
      setProfileMessage(message);
      showToast(message, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setProfileMessage('Only JPG, PNG, or WEBP files are allowed.');
      showToast('Only JPG, PNG, or WEBP files are allowed.', 'error');
      e.target.value = null;
      return;
    }
    openCropModal(file);
    e.target.value = null;
  };

  const renderPasswordToggle = (label, visible, onToggle) => (
    <button
      type="button"
      onClick={onToggle}
      title={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()} password`}
      aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()} password`}
      style={{
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontSize: 18,
      }}
    >
      {visible ? EYE : EYE_OFF}
    </button>
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      const sidebarNode = sidebarProfileMenuRef.current;
      const headerNode = headerProfileMenuRef.current;
      if (
        !sidebarNode?.contains(event.target) &&
        !headerNode?.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setProfileName(admin?.name || '');
    setProfileUsername(admin?.username || '');
    setProfileEmail(admin?.email || '');
    setProfileAvatarUrl(admin?.avatarUrl || '');
    setSecurityQuestion(admin?.securityQuestion || '');
  }, [admin]);

  const adminPreferencesKey = admin ? `adminPreferences:${admin.id || admin._id || admin.username}` : null;

  useEffect(() => {
    if (!adminPreferencesKey) return;
    skipPreferenceSaveRef.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(adminPreferencesKey) || '{}');
      setDateFormat(saved.dateFormat || 'DD/MM/YYYY');
      setTimeFormat(saved.timeFormat || '12-hour');
      setItemsPerPage(String(saved.itemsPerPage || '25'));
    } catch {
      setDateFormat('DD/MM/YYYY');
      setTimeFormat('12-hour');
      setItemsPerPage('25');
    }
  }, [adminPreferencesKey]);

  useEffect(() => {
    if (!adminPreferencesKey) return;
    if (skipPreferenceSaveRef.current) {
      skipPreferenceSaveRef.current = false;
      return;
    }
    localStorage.setItem(adminPreferencesKey, JSON.stringify({
      dateFormat,
      timeFormat,
      itemsPerPage,
    }));
  }, [adminPreferencesKey, dateFormat, timeFormat, itemsPerPage]);

  const normalizedSport = admin?.sport ? String(admin.sport).trim().toLowerCase() : '';
  const meta = getSportMeta(normalizedSport, isDarkMode) || { label: admin?.sport ? String(admin.sport).trim().toUpperCase() : 'ADMIN', icon: TROPHY, color: '#2563EB' };
  const safeMetaLabel = meta.label || 'ADMIN';

  const loginTimeFormatted = `${formatDatePreference(admin?.loginTimestamp || localStorage.getItem('loginTimestamp') || Date.now(), dateFormat)} ${formatTimePreference(admin?.loginTimestamp || localStorage.getItem('loginTimestamp') || Date.now(), timeFormat)}`;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock body scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    return () => document.body.classList.remove('sidebar-open');
  }, [mobileSidebarOpen]);

  const matchesStatusFilter = (r) => {
    const [cat, stat] = statusFilter.includes(':') ? statusFilter.split(':') : ['all', statusFilter];
    const matCategory = cat === 'all' ? true : r.tournament?.category === cat;
    const matStatus = stat === 'all' ? true : r.status === stat;
    return matCategory && matStatus;
  };

  const filteredRegistrations = registrations.filter(r => {
    const search = searchTerm.toLowerCase();
    const matName = (r.playerName || '').toLowerCase().includes(search);
    const matReg = (r.rollNumber || '').toLowerCase().includes(search);
    return (matName || matReg) && matchesStatusFilter(r);
  });

  const pairCandidates = registrations.filter(matchesStatusFilter);

  const activeCatId = statusFilter.includes(':') ? statusFilter.split(':')[0] : null;
  const loginEvents = Array.isArray(loginHistory) && loginHistory.length > 0 ? loginHistory : [];
  const sortedLoginEvents = [...loginEvents].sort((a, b) => new Date(b) - new Date(a));
  const unreadCount = lastSeenLoginTimestamp
    ? sortedLoginEvents.filter((ts) => new Date(ts) > new Date(lastSeenLoginTimestamp)).length
    : sortedLoginEvents.length;

  const notificationItems = sortedLoginEvents.length > 0
    ? sortedLoginEvents.map((timestamp) => ({
        id: timestamp,
        title: 'Admin login',
        description: `Logged in at ${formatDatePreference(timestamp, dateFormat)} ${formatTimePreference(timestamp, timeFormat)}`,
      }))
    : [{ id: 'none', title: 'No login notifications yet', description: 'Your recent login history will appear here.' }];

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

  const approvalSummary = FILTER_CATEGORIES.map((category) => {
    const categoryRegs = registrations.filter(r => r.tournament?.category === category.id);
    return {
      id: category.id,
      label: category.label,
      total: categoryRegs.length,
      approved: categoryRegs.filter(r => r.status === 'confirmed').length,
      pending: categoryRegs.filter(r => r.status === 'pending').length,
    };
  });

  const pendingRegistrations = registrations.filter(r => r.status === 'pending');

  const registrationChartData = FILTER_CATEGORIES.map((category) => ({
    id: category.id,
    label: CAT_LABELS[category.id],
    ...(() => {
      const categoryRegistrations = registrations.filter((registration) => registration.tournament?.category === category.id);
      const total = categoryRegistrations.length;
      const approved = categoryRegistrations.filter((registration) => registration.status === 'confirmed').length;
      return { approved, total, percentage: total ? Math.round((approved / total) * 100) : 0 };
    })(),
  }));
  const activeTournamentData = dashboardSummary?.activeTournamentData || [];
  const chartTournaments = activeTournamentData;
  const tournamentStatusChartData = [
    { id: 'open', label: 'Registration Open', color: '#3B82F6', count: chartTournaments.filter((tournament) => getTournamentProgressStatus(tournament) === 'Registration Open').length },
    { id: 'progress', label: 'In Progress', color: '#F59E0B', count: chartTournaments.filter((tournament) => getTournamentProgressStatus(tournament) === 'In Progress').length },
    { id: 'completed', label: 'Completed', color: '#22C55E', count: chartTournaments.filter((tournament) => getTournamentProgressStatus(tournament) === 'Completed').length },
  ];
  const tournamentStatusTotal = tournamentStatusChartData.reduce((total, item) => total + item.count, 0);
  const tournamentStatusGradient = tournamentStatusTotal
    ? tournamentStatusChartData.reduce((gradient, item, index) => {
      const start = tournamentStatusChartData.slice(0, index).reduce((total, current) => total + current.count, 0) / tournamentStatusTotal * 100;
      const end = (tournamentStatusChartData.slice(0, index + 1).reduce((total, current) => total + current.count, 0) / tournamentStatusTotal) * 100;
      return `${gradient}${index ? ', ' : ''}${item.color} ${start}% ${end}%`;
    }, '')
    : 'var(--border) 0% 100%';

  const fetchData = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setDashboardError('');
    try {
      const [tRes, sRes, rRes, dRes] = await Promise.all([
        axios.get('/api/tournaments/admin'),
        axios.get('/api/tournaments/stats'),
        axios.get('/api/registrations/admin'),
        axios.get('/api/tournaments/dashboard-summary')
      ]);
      setTournaments(tRes.data);
      setStats(sRes.data);
      setRegistrations(rRes.data);
      setDashboardSummary(dRes.data);
    } catch (err) {
      console.error(err);
      setDashboardError(err.response?.data?.message || 'Unable to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  }, [admin]);

  const fetchAuditLogs = useCallback(async (dateOverride) => {
    if (!admin) return;
    setLoading(true);
    try {
      const params = {};
      const useDate = typeof dateOverride !== 'undefined' ? dateOverride : auditDate;
      if (useDate) {
        params.from = useDate;
        params.to = useDate;
      }
      const res = await axios.get('/api/tournaments/audit-logs', { params });
      setAuditLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [admin, auditDate]);

  useEffect(() => { if (admin) fetchData(); }, [admin, fetchData]);
  useEffect(() => {
    if (admin && (activeTab === 'audit-log' || activeTab === 'profile')) fetchAuditLogs();
  }, [admin, activeTab, fetchAuditLogs]);
  useEffect(() => {
    if (!removePairTarget) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setRemovePairTarget(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [removePairTarget]);
  useEffect(() => {
    if (removePairTarget) {
      removePairModalRef.current?.focus();
    }
  }, [removePairTarget]);

  const showToast = (msg, type = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3500);
  };

  const handleApprovePair = async (leadId) => {
    try {
      await axios.patch(`/api/registrations/${leadId}/approve-pair`);
      fetchData();
      showToast('Pair confirmed!');
    } catch (err) {
      alert(err.response?.data?.message || 'Pair approval failed');
    }
  };

  const handleResetPair = async (leadId) => {
    try {
      await axios.patch(`/api/registrations/${leadId}/reset-pair`);
      fetchData();
      showToast('Pair reset to pending');
    } catch (err) {
      alert(err.response?.data?.message || 'Pair reset failed');
    }
  };

  const handleRemovePair = (leadId) => {
    setRemovePairTarget({ _id: leadId });
  };

  const handleConfirmRemovePair = async () => {
    if (!removePairTarget || !removePairTarget._id) return;
    setRemovePairLoading(true);
    try {
      await axios.patch(`/api/registrations/${removePairTarget._id}/remove-pair`);
      setRemovePairTarget(null);
      fetchData();
      showToast('Pair removed and both players are now unlinked');
    } catch (err) {
      alert(err.response?.data?.message || 'Pair removal failed');
    } finally {
      setRemovePairLoading(false);
    }
  };

  const handleLinkPartner = async () => {
    if (!linkTarget || !linkSelected) return;
    setLinkLoading(true);
    try {
      await axios.patch(`/api/registrations/${linkTarget._id}/link-partner`, { partnerId: linkSelected._id });
      setLinkTarget(null);
      setLinkSelected(null);
      setLinkSearch('');
      fetchData();
      showToast('Players linked as partners!');
    } catch (err) {
      alert(err.response?.data?.message || 'Linking failed');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const res = await axios.patch(`/api/registrations/${id}/status`, { status });
      fetchData();
      const message = res.data.message || 'Status updated!';
      showToast(message);
    }
    catch (err) {
      alert('Action failed');
    }
  };

  const groupedRegistrations = useMemo(() => {
    const regByKey = {};
    const reverseRefs = {};
    const doublesCategories = new Set(['doubles-men', 'doubles-women', 'mixed-doubles']);

    pairCandidates.forEach((r) => {
      const rollKey = r.rollNumber?.trim().toUpperCase();
      const tournamentId = r.tournament?._id?.toString() || r.tournament;
      if (!rollKey || !tournamentId) return;

      const key = `${tournamentId}|${rollKey}`;
      regByKey[key] = r;

      const partnerKey = r.partnerRollNumber?.trim().toUpperCase();
      if (partnerKey) {
        const partnerRefKey = `${tournamentId}|${partnerKey}`;
        reverseRefs[partnerRefKey] = reverseRefs[partnerRefKey] || [];
        reverseRefs[partnerRefKey].push(r);
      }
    });

    const groups = [];
    const seen = new Set();

    filteredRegistrations.forEach((r) => {
      const rollKey = r.rollNumber?.trim().toUpperCase();
      const tournamentId = r.tournament?._id?.toString() || r.tournament;
      if (!rollKey || !tournamentId) return;

      const key = `${tournamentId}|${rollKey}`;
      if (seen.has(key)) return;

      const category = r.tournament?.category;
      if (!doublesCategories.has(category)) {
        groups.push({ kind: 'single', player: r });
        seen.add(key);
        return;
      }

      const partnerKey = r.partnerRollNumber?.trim().toUpperCase();
      const partnerKeyWithTournament = partnerKey ? `${tournamentId}|${partnerKey}` : null;
      const partner = partnerKeyWithTournament ? regByKey[partnerKeyWithTournament] : null;

      if (partner && partner.rollNumber?.trim().toUpperCase() !== rollKey && !seen.has(partnerKeyWithTournament)) {
        groups.push({ kind: 'pair', players: [r, partner] });
        seen.add(key);
        seen.add(partnerKeyWithTournament);
        return;
      }

      const reverse = (reverseRefs[key] || []).find((ref) => {
        const refRoll = ref.rollNumber?.trim().toUpperCase();
        const refKey = `${tournamentId}|${refRoll}`;
        return refRoll !== rollKey && !seen.has(refKey);
      });

      if (reverse) {
        const reverseKey = `${tournamentId}|${reverse.rollNumber?.trim().toUpperCase()}`;
        groups.push({ kind: 'pair', players: [reverse, r] });
        seen.add(key);
        seen.add(reverseKey);
        return;
      }

      groups.push({ kind: 'pair', players: [r, null] });
      seen.add(key);
    });

    return groups;
  }, [filteredRegistrations, pairCandidates]);

  const playerPageSize = Math.max(1, Number(itemsPerPage) || 25);
  const playerPages = useMemo(() => {
    const pages = [];
    let page = [];
    let playerCount = 0;

    groupedRegistrations.forEach((entry) => {
      const entryPlayerCount = entry.kind === 'pair' && entry.players[1] ? 2 : 1;
      if (page.length > 0 && playerCount + entryPlayerCount > playerPageSize) {
        pages.push(page);
        page = [];
        playerCount = 0;
      }
      page.push(entry);
      playerCount += entryPlayerCount;
    });

    if (page.length > 0) pages.push(page);
    return pages;
  }, [groupedRegistrations, playerPageSize]);

  const playerTotalPages = Math.max(1, playerPages.length);
  const paginatedRegistrations = playerPages[playerPage - 1] || [];

  useEffect(() => {
    setPlayerPage(1);
  }, [searchTerm, statusFilter, itemsPerPage]);

  useEffect(() => {
    setPlayerPage((page) => Math.min(page, playerTotalPages));
  }, [playerTotalPages]);

  const handleCreate = async (data) => {
    try { await axios.post('/api/tournaments', data); setShowCreate(false); fetchData(); showToast('Tournament created!'); }
    catch (err) { alert(err.response?.data?.message || 'Error creating tournament'); }
  };
  const handleUpdate = async (data) => {
    try { await axios.put(`/api/tournaments/${editTarget._id}`, { ...data, password: data.password }); setEditTarget(null); fetchData(); showToast('Tournament updated!'); }
    catch (err) { alert(err.response?.data?.message || 'Error updating tournament.'); }
  };
  const handleDelete = async (password) => {
    try { await axios.delete(`/api/tournaments/${deleteTarget._id}`, { data: { password } }); setDeleteTarget(null); fetchData(); showToast('Deleted.'); }
    catch (err) { alert(err.response?.data?.message || 'Invalid password.'); }
  };

  const handleDeleteAccount = async (password) => {
    await axios.delete('/api/auth/me', { data: { password } });
    setShowDeleteAccountModal(false);
    logout();
    navigate('/admin/login?deleted=success', { replace: true });
  };

  const handleClearAllAuditLogs = async () => {
    if (!window.confirm('Are you sure you want to delete ALL audit logs? This action cannot be undone.')) return;
    try {
      await axios.delete('/api/tournaments/audit-logs/clear-all');
      setAuditLogs([]);
      showToast('All audit logs cleared successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Error clearing audit logs.');
    }
  };

  if (!admin) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading admin...</div>;

  const safeAdminName = admin.name || admin.username || 'ADMIN';
  const safeAdminFirstName = (safeAdminName.split(' ')[0] || admin.username || 'ADMIN').toUpperCase();
  const avatarSrc = profileAvatarUrl || admin?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(safeAdminName)}&background=random&size=128`;
  const desktopSidebarW = sidebarCollapsed ? 72 : 340;
  const renderProfileMenu = (menuStyle = {}) => (
    <div style={{
      position: 'absolute',
      left: 0,
      bottom: 'calc(100% + 12px)',
      width: 280,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      boxShadow: '0 30px 70px rgba(0,0,0,0.14)',
      padding: 14,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      backdropFilter: 'blur(25px)',
      ...menuStyle,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <img src={avatarSrc} alt="Profile" style={{ width: 40, height: 40, borderRadius: 14, objectFit: 'cover' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 950 }}>{safeAdminName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{safeMetaLabel.toUpperCase()} MANAGER</div>
        </div>
      </div>
      <button onClick={() => { changeTab('profile'); setProfileMenuOpen(false); }} style={ds.profileMenuItem}>
        <span style={{ fontSize: 16 }}><UserRound size={16} strokeWidth={1.8} aria-hidden="true" /></span>
        <span style={{ flex: 1, fontWeight: 800 }}>Profile Settings</span>
      </button>
      <HomeButton variant="menu" onNavigate={() => setProfileMenuOpen(false)} />
      <ThemeToggleButton variant="menu" onToggle={() => setProfileMenuOpen(false)} />
      <button onClick={() => { logout(); setProfileMenuOpen(false); }} style={{ ...ds.profileMenuItem, color: '#EF4444' }}>
        <span style={{ fontSize: 16 }}><LogOut size={16} strokeWidth={1.8} aria-hidden="true" /></span>
        <span style={{ flex: 1, fontWeight: 800 }}>Sign Out</span>
      </button>
    </div>
  );

  return (
    <div style={ds.container}>

      {/* ── Mobile overlay backdrop ── */}
      {isMobile && mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 199 }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        ...ds.sidebar,
        width: isMobile ? 280 : desktopSidebarW,
        transform: isMobile ? (mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        transition: isMobile
          ? 'transform 0.3s cubic-bezier(0.4,0,0.2,1)'
          : 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
        overflowY: (!isMobile && sidebarCollapsed) ? 'visible' : 'auto',
        overflowX: (!isMobile && sidebarCollapsed) ? 'visible' : 'hidden',
          //overflow: 'hidden',
        zIndex: isMobile ? 200 : 20,
      }}>
        {/* Brand / Toggle Row */}
        <div style={{ ...ds.sidebarBrand, justifyContent: (!isMobile && sidebarCollapsed) ? 'center' : 'flex-start', padding: (!isMobile && sidebarCollapsed) ? '0 14px' : '0 32px', gap: 12, overflow: 'hidden' }}>
          {(!isMobile && sidebarCollapsed) ? (
            <div
              onMouseEnter={() => setSidebarToggleHovered(true)}
              onMouseLeave={() => setSidebarToggleHovered(false)}
              style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}
            >
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Open sidebar"
                style={{ ...ds.logoBox, position: 'relative', background: meta.color, border: 'none', color: 'inherit', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: sidebarToggleHovered ? 0 : 1, transition: 'opacity 0.2s ease' }}>{meta.icon}</span>
                <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: sidebarToggleHovered ? 1 : 0, transition: 'opacity 0.2s ease' }}>{MENU_OPEN}</span>
              </button>
              <span
                role="tooltip"
                style={{
                  position: 'absolute',
                  left: 'calc(100% + 10px)',
                  top: '50%',
                  transform: `translateY(-50%) translateX(${sidebarToggleHovered ? '0' : '-4px'})`,
                  opacity: sidebarToggleHovered ? 1 : 0,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 800,
                  boxShadow: 'var(--shadow)',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                  zIndex: 1100,
                }}
              >
                Open sidebar
              </span>
            </div>
          ) : (
            <div style={{ ...ds.logoBox, background: meta.color, flexShrink: 0 }}>{meta.icon}</div>
          )}
          {!((!isMobile) && sidebarCollapsed) && <div style={{ fontWeight: 950, fontSize: 16, letterSpacing: -0.5, whiteSpace: 'nowrap' }}>ADMIN PANEL</div>}
          <button
            onClick={() => isMobile ? setMobileSidebarOpen(false) : setSidebarCollapsed(c => !c)}
            title={(!isMobile && sidebarCollapsed) ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 8, borderRadius: 10, flexShrink: 0, transition: 'color 0.2s', display: (!isMobile && sidebarCollapsed) ? 'none' : undefined }}
          >
            {(!isMobile && sidebarCollapsed) ? MENU_OPEN : CLOSE}
          </button>
        </div>

        {/* Manager Profile Card */}
        {(isMobile || !sidebarCollapsed) && (
          <div
            style={{
              ...ds.profileCard,
              background: isDarkMode ? 'var(--bg-panel)' : '#ffffff',
              border: isDarkMode ? '1px solid var(--border)' : '1px solid #e5e7eb',
              boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.08)',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={ds.avatarBox}>
              <img
                src={avatarSrc}
                alt="Admin"
                title={safeAdminName}
                style={ds.avatar}
              />
              <div style={ds.statusDot} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...ds.pName, color: isDarkMode ? 'var(--text)' : '#111827' }}>{safeAdminName.toUpperCase()}</div>
              <div style={{ ...ds.pRole, color: isDarkMode ? 'var(--text-muted)' : '#6b7280' }}>{safeMetaLabel.toUpperCase()} MANAGER</div>
            </div>
          </div>
        )}

        <nav style={ds.nav}>
          {[
            { id: 'dashboard', label: 'DASHBOARD VIEW', icon: LayoutDashboard },
            { id: 'player-approvals', label: 'PLAYER APPROVALS', icon: ClipboardCheck },
            { id: 'tournament-setup', label: 'TOURNAMENT SETUP', icon: TrophyOutline },
            { id: 'university-team', label: 'UNIVERSITY TEAM', icon: UsersRound },
            { id: 'brackets', label: 'BRACKETS & DRAWS', icon: GitBranch },
            { id: 'audit-log', label: 'AUDIT LOG', icon: ClipboardList },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              title={(!isMobile && sidebarCollapsed) ? tab.label : ''}
              style={{
                ...ds.navBtn,
                justifyContent: (!isMobile && sidebarCollapsed) ? 'center' : 'flex-start',
                padding: (!isMobile && sidebarCollapsed) ? '18px 0' : '18px 32px',
                background: activeTab === tab.id ? `${meta.color}20` : 'transparent',
                color: activeTab === tab.id ? meta.color : 'var(--text-muted)',
                borderLeft: activeTab === tab.id ? `4px solid ${meta.color}` : '4px solid transparent',
                borderRadius: '0 20px 20px 0',
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span>
              {(isMobile || !sidebarCollapsed) && <span style={{ fontSize: 13, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{tab.label}</span>}
            </button>
            );
          })}
        </nav>

        <div style={{ padding: (!isMobile && sidebarCollapsed) ? '20px 8px 32px' : '24px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: (!isMobile && sidebarCollapsed) ? 'center' : 'stretch' }}>
          <div ref={sidebarProfileMenuRef} style={{ position: 'relative', width: (!isMobile && sidebarCollapsed) ? 56 : '100%', height: (!isMobile && sidebarCollapsed) ? 56 : 'auto', borderRadius: (!isMobile && sidebarCollapsed) ? 16 : 0, background: (!isMobile && sidebarCollapsed) ? 'var(--bg-input)' : 'transparent', border: (!isMobile && sidebarCollapsed) ? '1px solid var(--border)' : 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((open) => !open)}
              style={{
                width: '100%',
                height: (!isMobile && sidebarCollapsed) ? '100%' : 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: (!isMobile && sidebarCollapsed) ? 0 : '14px 18px',
                borderRadius: 18,
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontWeight: 900,
                fontSize: 13,
                justifyContent: (!isMobile && sidebarCollapsed) ? 'center' : 'flex-start',
              }}
            >
              <img
                src={avatarSrc}
                alt="Profile"
                style={{ width: 34, height: 34, borderRadius: 14, objectFit: 'cover' }}
              />
              {((isMobile && !sidebarCollapsed) || (!isMobile && !sidebarCollapsed)) && (
                <>
                  <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontSize: 13, letterSpacing: 0.5, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeAdminFirstName.toUpperCase()}</div>
                  </div>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{profileMenuOpen ? CARET_UP : CARET_DOWN}</span>
                </>
              )}
            </button>

            {profileMenuOpen && !isMobile && sidebarCollapsed && renderProfileMenu({ left: 'calc(100% + 12px)', bottom: 0 })}

            {profileMenuOpen && !(!isMobile && sidebarCollapsed) && (
              <div style={{
                position: 'absolute',
                left: 0,
                bottom: 'calc(100% + 12px)',
                width: 280,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                boxShadow: '0 30px 70px rgba(0,0,0,0.14)',
                padding: 14,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                backdropFilter: 'blur(25px)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <img
                    src={avatarSrc}
                    alt="Profile"
                    style={{ width: 40, height: 40, borderRadius: 14, objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>{safeAdminName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{safeMetaLabel.toUpperCase()} MANAGER</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    changeTab('profile');
                    setProfileMenuOpen(false);
                  }}
                  style={ds.profileMenuItem}
                >
                  <span style={{ fontSize: 16 }}><UserRound size={16} strokeWidth={1.8} aria-hidden="true" /></span>
                  <span style={{ flex: 1, fontWeight: 800 }}>Profile Settings</span>
                </button>
                <HomeButton variant="menu" onNavigate={() => setProfileMenuOpen(false)} />
                <ThemeToggleButton variant="menu" onToggle={() => setProfileMenuOpen(false)} />
                <button
                  onClick={() => {
                    logout();
                    setProfileMenuOpen(false);
                  }}
                  style={{ ...ds.profileMenuItem, color: '#EF4444' }}
                >
                  <span style={{ fontSize: 16 }}><LogOut size={16} strokeWidth={1.8} aria-hidden="true" /></span>
                  <span style={{ flex: 1, fontWeight: 800 }}>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div style={{ ...ds.mainWrapper, marginLeft: isMobile ? 0 : desktopSidebarW, transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)', minWidth: 0 }}>
        {/* ── Mobile top bar ── */}
        {isMobile && (
          <div style={{ height: 64, background: 'var(--nav-bg)', backdropFilter: 'blur(30px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', position: 'sticky', top: 0, zIndex: 10 }}>
            <button
              onClick={() => setMobileSidebarOpen(true)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 24, cursor: 'pointer', padding: 4, lineHeight: 1 }}
              aria-label="Open menu"
            >{MENU_OPEN}</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ ...ds.logoBox, background: meta.color, width: 32, height: 32, fontSize: 18 }}>{meta.icon}</div>
              <span style={{ fontWeight: 950, fontSize: 14, letterSpacing: 0.5 }}>ADMIN PANEL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div ref={notificationsRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(o => !o);
                    if (unreadCount > 0 && sortedLoginEvents.length > 0) {
                      localStorage.setItem('lastSeenLoginTimestamp', sortedLoginEvents[0]);
                      setLastSeenLoginTimestamp(sortedLoginEvents[0]);
                    }
                  }}
                  style={ds.notificationBtn}
                  aria-label="Open notifications"
                >
                  <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
                  {unreadCount > 0 && <span style={ds.notificationBadge}>{unreadCount}</span>}
                </button>
                {notificationsOpen && (
                  <div style={notificationMenuStyle}>
                    <div style={ds.notificationTitle}>Notification</div>
                    {notificationItems.map((item) => (
                      <button key={item.id} onClick={item.action || (() => setNotificationsOpen(false))} style={notificationItemStyle}>
                        <div style={ds.notificationItemTitle}>{item.title}</div>
                        <div style={ds.notificationItemDescription}>{item.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Desktop header ── */}
        {!isMobile && (
          <header style={ds.header}>
            <div style={ds.greetBox}>
              <h2 style={{ fontSize: 28, fontWeight: 950, margin: 0, letterSpacing: -1 }}>
                {new Date().getHours() < 18 ? 'GOOD DAY' : 'GOOD EVENING'}, <span style={{ color: meta.color }}>{safeAdminFirstName.toUpperCase()}</span>
              </h2>
            </div>
            <div style={ds.headerActions}>
              <div ref={notificationsRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(o => !o);
                    if (unreadCount > 0 && sortedLoginEvents.length > 0) {
                      localStorage.setItem('lastSeenLoginTimestamp', sortedLoginEvents[0]);
                      setLastSeenLoginTimestamp(sortedLoginEvents[0]);
                    }
                  }}
                  style={ds.notificationBtn}
                  aria-label="Open notifications"
                >
                  <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
                  {unreadCount > 0 && <span style={ds.notificationBadge}>{unreadCount}</span>}
                </button>
                {notificationsOpen && (
                  <div style={notificationMenuStyle}>
                    <div style={ds.notificationTitle}>Notification</div>
                    {notificationItems.map((item) => (
                      <button key={item.id} onClick={item.action || (() => setNotificationsOpen(false))} style={notificationItemStyle}>
                        <div style={ds.notificationItemTitle}>{item.title}</div>
                        <div style={ds.notificationItemDescription}>{item.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* ── Mobile greeting banner ── */}
        {isMobile && (
          <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 950, margin: 0, letterSpacing: -0.5 }}>
                {new Date().getHours() < 18 ? 'GOOD DAY' : 'GOOD EVENING'}, <span style={{ color: meta.color }}>{safeAdminFirstName.toUpperCase()}</span>
            </h2>
          </div>
        )}

        <main style={{ padding: isMobile ? '20px' : '60px' }} className="mobile-padding">
          {toast && <div className={`alert ${toastType === 'error' ? 'alert-error' : 'alert-success'}`} style={{ padding: '16px 24px', fontSize: 16, marginBottom: 32 }}>{toast}</div>}

          {activeTab === 'dashboard' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, marginBottom: 30 }}>
                {/* <div>
                  <p style={{ ...ds.subtitle, fontSize: 15, margin: 0 }}>Here's what's happening with your {safeMetaLabel.toLowerCase()} tournaments today.</p>
                </div> */}
                <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>{formatDatePreference(new Date(), dateFormat)}</div>
              </div>

              {dashboardError && <div className="alert alert-error" style={{ marginBottom: 20 }}>{dashboardError}</div>}
              {loading && !dashboardSummary ? (
                <div style={{ ...ds.tableBox, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading dashboard data...</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 22 }}>
                    {[
                      { label: 'CONFIRMED PLAYERS', value: dashboardSummary?.confirmedPlayers ?? stats.totalPlayers ?? 0, detail: 'Total registered and approved', icon: PEOPLE, color: '#3B82F6', target: 'confirmed-summary' },
                      { label: 'PENDING APPROVALS', value: dashboardSummary?.pendingApprovals ?? stats.pendingApprovals ?? 0, detail: 'Players awaiting approval', icon: HOURGLASS, color: '#F59E0B', target: 'pending-approvals' },
                      { label: 'ACTIVE TOURNAMENTS', value: dashboardSummary?.activeTournaments ?? 0, detail: 'Currently in progress', icon: TROPHY, color: meta.color, target: 'tournament-setup' },
                    ].map((stat) => (
                      <button key={stat.label} type="button" onClick={() => changeTab(stat.target)} style={{ ...ds.statCard, padding: '22px 20px', borderRadius: 20, cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ ...ds.cardSymbol, color: stat.color, background: `${stat.color}18`, width: 38, height: 38 }}>{stat.icon}</div>
                          <span style={{ color: stat.color, fontSize: 28, fontWeight: 950 }}>{stat.value}</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text)', letterSpacing: 1.1, marginTop: 18 }}>{stat.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{stat.detail}</div>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr', gap: 18, marginBottom: 18 }}>
                    <section style={ds.dashboardPanel}>
                      <div style={ds.dashboardPanelHeader}><div><h3 style={ds.dashboardPanelTitle}>QUICK ACTIONS</h3><p style={ds.dashboardPanelSubtitle}>Jump into the work that matters.</p></div></div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        {[
                          { label: 'Create Tournament', detail: 'Set up a new tournament', icon: '+', action: () => setShowCreate(true), primary: true },
                          { label: 'Manage Players', detail: 'View and approve registrations', icon: PEOPLE, action: () => changeTab('player-approvals') },
                          { label: 'Generate Bracket', detail: 'Create tournament draws', icon: TREE, action: () => changeTab('brackets') },
                          { label: 'Enter Match Result', detail: 'Update match scores', icon: MEDAL, action: () => changeTab('brackets') },
                        ].map((action) => <button key={action.label} type="button" onClick={action.action} style={{ ...ds.quickAction, ...(action.primary ? { background: `color-mix(in srgb, ${meta.color} 76%, #000)`, color: '#fff', borderColor: `color-mix(in srgb, ${meta.color} 76%, #000)` } : {}) }}>
                          <span style={{ ...ds.quickActionIcon, color: action.primary ? '#fff' : meta.color }}>{action.icon}</span>
                          <span style={ds.quickActionText}><strong style={{ ...ds.quickActionTitle, color: action.primary ? '#fff' : 'var(--text)' }}>{action.label}</strong><small style={{ ...ds.quickActionDetail, color: action.primary ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)' }}>{action.detail}</small></span>
                          <span style={{ ...ds.quickActionArrow, color: action.primary ? '#fff' : 'var(--text)' }}>{ARROW_RIGHT}</span>
                        </button>)}
                      </div>
                    </section>
                    <section style={ds.dashboardPanel}>
                      <div style={ds.dashboardPanelHeader}><div><h3 style={ds.dashboardPanelTitle}>{WARNING_ROUND} NEEDS ATTENTION</h3><p style={ds.dashboardPanelSubtitle}>Items requiring a decision.</p></div></div>
                      {dashboardSummary?.attentionItems?.length ? dashboardSummary.attentionItems.slice(0, 4).map((item, index) => <button key={`${item.message}-${index}`} type="button" onClick={() => changeTab(item.tab)} style={ds.attentionItem}><span style={{ color: '#F59E0B', fontSize: 18 }}>!</span><span><strong>{item.message}</strong><small>   Review and take action</small></span><span style={{ marginLeft: 'auto' }}>{ARROW_RIGHT}</span></button>) : <div style={ds.emptyPanel}><span style={{ color: '#10B981', fontSize: 20 }}>{CHECK_MARK}</span> Everything is up to date</div>}
                    </section>
                  </div>

                  <div>
                    <section style={ds.dashboardPanel}>
                      <div style={ds.dashboardPanelHeader}><div><h3 style={ds.dashboardPanelTitle}>{TROPHY} ACTIVE TOURNAMENTS</h3><p style={ds.dashboardPanelSubtitle}>Current {safeMetaLabel.toLowerCase()} tournament progress.</p></div><button type="button" onClick={() => changeTab('tournament-setup')} style={ds.textAction}>View all {ARROW_RIGHT}</button></div>
                      {activeTournamentData.length ? (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
                          {activeTournamentData.map((tournament) => {
                            const cardStatus = getTournamentProgressStatus(tournament);
                            const isCompleted = cardStatus === 'Completed';
                            const tone = statusTone[cardStatus] || statusTone.Upcoming;
                            const isTeamCategory = !['singles-men', 'singles-women'].includes(tournament.category);
                            const progress = Math.min(100, Math.max(0, tournament.progress || 0));
                            return (
                              <article key={tournament._id} style={{ ...ds.tournamentCard, ...(isCompleted ? ds.completedTournamentCard : {}) }}>
                                <div style={ds.tournamentCardTop}>
                                  <div style={{ ...ds.tournamentIcon, color: isCompleted ? '#10B981' : meta.color, background: isCompleted ? 'rgba(16,185,129,0.14)' : `${meta.color}18` }}>{isCompleted ? CHECK_MARK : (isTeamCategory ? PEOPLE : TROPHY)}</div>
                                  <span style={{ ...ds.statusBadge, ...(isCompleted ? ds.completedStatusBadge : { color: tone.color, background: tone.background }) }}>{isCompleted ? <>Completed {CHECK_MARK}</> : cardStatus}</span>
                                </div>
                                <div>
                                  <h4 style={ds.tournamentCardTitle}>{CAT_LABELS[tournament.category] || tournament.category}</h4>
                                  <div style={ds.tournamentCardType}>{isTeamCategory ? 'Team Category' : 'Individual Category'} · {tournament.year}</div>
                                </div>
                                <div style={ds.tournamentMetricGrid}>
                                  <div style={{ ...ds.tournamentMetric, ...(isCompleted ? ds.completedTournamentMetric : {}) }}><strong>{tournament.confirmedPlayers || 0} / {tournament.totalRegistrations || 0}</strong><span> Players</span></div>
                                  <div style={{ ...ds.tournamentMetric, ...(isCompleted ? ds.completedTournamentMetric : {}) }}><strong>{tournament.completedMatches || 0} / {tournament.totalMatches || 0}</strong><span> Matches</span></div>
                                </div>
                                <div style={ds.tournamentProgressBlock}>
                                  <div style={{ ...ds.tournamentProgressHeader, ...(isCompleted ? ds.completedProgressHeader : {}) }}><span>{isCompleted ? 'Tournament Completed' : 'Progress'}</span><strong>{isCompleted ? 100 : progress}%</strong></div>
                                  <div style={ds.progressTrack}><div style={{ ...ds.progressFill, width: isCompleted ? '100%' : `${progress}%`, background: isCompleted ? '#22C55E' : (cardStatus === 'In Progress' ? '#10B981' : tone.color) }} /></div>
                                </div>
                                <button type="button" onClick={() => changeTab('brackets', isCompleted ? tournament._id : null)} style={{ ...ds.manageTournamentButton, ...(isCompleted ? ds.completedTournamentButton : {}) }}>{isCompleted ? 'View Results' : 'Manage Tournament'} {ARROW_RIGHT}</button>
                              </article>
                            );
                          })}
                        </div>
                      ) : <div style={ds.emptyPanel}>No active tournaments.</div>}
                    </section>
                  </div>

                  <div style={{ ...ds.dashboardChartsGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
                    <section style={ds.dashboardPanel}>
                      <div style={ds.dashboardPanelHeader}>
                        <div>
                          <h3 style={ds.dashboardPanelTitle}>PLAYER REGISTRATIONS BY CATEGORY</h3>
                          <p style={ds.dashboardPanelSubtitle}>Registered players across tournament categories.</p>
                        </div>
                      </div>
                      <div style={ds.registrationChart}>
                        {registrationChartData.map((item, index) => (
                          <div
                            key={item.id}
                            style={{
                              ...ds.registrationChartRow,
                              gridTemplateColumns: isMobile ? '1fr' : 'minmax(116px, 0.9fr) minmax(100px, 1.5fr) 82px',
                              gap: isMobile ? 8 : 10,
                            }}
                          >
                            <div style={{ ...ds.registrationChartLabel, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                              <span style={{ ...ds.chartLegendDot, background: ['#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6', '#10B981'][index] }} />
                              {item.label}
                            </div>
                            <div style={{ ...ds.registrationChartTrack, minWidth: 0 }}>
                              <div style={{ ...ds.registrationChartBar, width: `${item.percentage}%`, background: ['#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6', '#10B981'][index] }} />
                            </div>
                            <strong style={{ ...ds.registrationChartValue, fontSize: isMobile ? 12 : 13, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                              {item.approved} / {item.total} <span style={ds.registrationChartPercentage}>({item.percentage}%)</span>
                            </strong>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section style={ds.dashboardPanel}>
                      <div style={ds.dashboardPanelHeader}>
                        <div>
                          <h3 style={ds.dashboardPanelTitle}>TOURNAMENT STATUS</h3>
                          <p style={ds.dashboardPanelSubtitle}>Current status across all tournaments.</p>
                        </div>
                      </div>
                      <div style={{ ...ds.statusChartLayout, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 18 : 28 }}>
                        <div style={{ ...ds.statusDonut, background: `conic-gradient(${tournamentStatusGradient})` }}>
                          <div style={ds.statusDonutCenter}><strong>{tournamentStatusTotal}</strong><span>Total tournaments</span></div>
                        </div>
                        <div style={ds.statusLegend}>
                          {tournamentStatusChartData.map((item) => (
                            <div key={item.id} style={ds.statusLegendRow}>
                              <span style={{ ...ds.chartLegendDot, background: item.color }} />
                              <span>{item.label}</span>
                              <strong>{item.count}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </div>

                </>
              )}
            </div>
          )}

          {activeTab === 'confirmed-summary' && (
            <div style={ds.section}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-end', gap: 16, marginBottom: 32 }}>
                <div>
                  <h2 style={ds.sectionTitle}>CONFIRMED PLAYERS SUMMARY</h2>
                  <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Details by category for registered and approved players.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 30, justifyItems: 'stretch' }}>
                {approvalSummary.map((summary) => (
                  <div key={summary.id} style={{ ...ds.summaryCard, padding: 22, borderRadius: 24, border: '1px solid var(--border)', background: 'var(--bg-card)', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1.2 }}>{summary.label.toUpperCase()}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Registrations</div>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 950, color: 'var(--text)' }}>{summary.total}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 120px', padding: 14, borderRadius: 18, background: 'rgba(16, 185, 129, 0.12)', color: '#0F766E', fontWeight: 800 }}>
                        Approved
                        <div style={{ fontSize: 20, fontWeight: 950, marginTop: 6 }}>{summary.approved}</div>
                      </div>
                      <div style={{ flex: '1 1 120px', padding: 14, borderRadius: 18, background: 'rgba(239, 68, 68, 0.12)', color: '#B91C1C', fontWeight: 800 }}>
                        Pending
                        <div style={{ fontSize: 20, fontWeight: 950, marginTop: 6 }}>{summary.pending}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'pending-approvals' && (
            <div style={ds.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 24 }}>
                <div>
                  <h2 style={ds.sectionTitle}>PENDING PLAYER APPROVALS</h2>
                  <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Only registrations still waiting for approval.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 14, transition: 'all 0.3s' }}>
                      <input type="checkbox" checked={isEditMode} onChange={() => setIsEditMode(!isEditMode)} style={{ display: 'none' }} />
                      <div style={{ width: 50, height: 28, background: isEditMode ? '#10B981' : '#D1D5DB', borderRadius: 14, position: 'relative', transition: 'background 0.3s', display: 'flex', alignItems: 'center', padding: '2px' }}>
                        <div style={{ width: 24, height: 24, background: '#FFF', borderRadius: '50%', transition: 'transform 0.3s', transform: isEditMode ? 'translateX(22px)' : 'translateX(0)' }} />
                      </div>
                      <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 600, color: 'var(--text)', userSelect: 'none' }}>Edit Mode</span>
                    </label>
                  </div>
                  <button onClick={() => changeTab('dashboard')} style={{ ...ds.actionBtn, background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0 20px', height: 44, borderRadius: 16 }}>
                    {ARROW_LEFT} BACK TO DASHBOARD
                  </button>
                </div>
              </div>
              {isEditMode && (
                <div style={{ marginBottom: 18, color: 'var(--primary)', fontWeight: 700 }}>
                  Click a registration entry to open edit mode.
                </div>
              )}
              <div className="responsive-table-wrap" style={{ ...ds.tableBox, overflowX: 'auto' }}>
                <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                    {pendingRegistrations.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 60, textAlign: 'center', fontSize: 18, color: 'var(--text-muted)' }}>No pending registrations found.</td></tr>
                    ) : (
                      pendingRegistrations.map(r => (
                        <tr key={r._id} style={ds.tr}>
                          <td
                            style={{ ...ds.td, cursor: isEditMode ? 'pointer' : 'default' }}
                            onClick={() => isEditMode && setEditRegistrationTarget(r)}
                          >
                            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>{r.playerName}</div>
                            <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>REG: {r.rollNumber}</div>
                            <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 800, marginTop: 4 }}>{r.department}</div>
                            {isEditMode && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>Click to edit</div>}
                          </td>
                          <td style={ds.td}>
                            <div style={{ fontWeight: 800, fontSize: 15 }}>{CAT_LABELS[r.tournament?.category]}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Year: {r.tournament?.year}</div>
                          </td>
                          <td style={ds.td}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{PHONE} <a href={`tel:${r.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.phone}</a></div>
                            <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                              {EMAIL} <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(r.email || '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{r.email}</a>
                            </div>
                            {r.nicNo ? <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>{ID_CARD} {r.nicNo}</div> : null}
                          </td>
                          <td style={ds.td}>
                            <span style={{ padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 900, ...STATUS_STYLE[r.status] }}>{STATUS_STYLE[r.status].label.toUpperCase()}</span>
                          </td>
                          <td style={ds.td}>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <button onClick={() => handleUpdateStatus(r._id, 'confirmed')} style={{ ...ds.actionBtn, background: '#10B981', color: '#000' }}>APPROVE</button>
                              <button onClick={() => handleUpdateStatus(r._id, 'rejected')} style={{ ...ds.actionBtn, background: '#EF4444', color: '#FFF' }}>REJECT</button>
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

          {activeTab === 'player-approvals' && (
            <div style={ds.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                <div>
                  <h2 style={ds.sectionTitle}>PLAYER VERIFICATION BOARD</h2>
                </div>
                <div style={{ display: 'flex', gap: 15, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 14, transition: 'all 0.3s' }}>
                    <input type="checkbox" checked={isEditMode} onChange={() => setIsEditMode(!isEditMode)} style={{ display: 'none' }} />
                    <div style={{ width: 50, height: 28, background: isEditMode ? '#10B981' : '#D1D5DB', borderRadius: 14, position: 'relative', transition: 'background 0.3s', display: 'flex', alignItems: 'center', padding: '2px' }}>
                      <div style={{ width: 24, height: 24, background: '#FFF', borderRadius: '50%', transition: 'transform 0.3s', transform: isEditMode ? 'translateX(22px)' : 'translateX(0)' }} />
                    </div>
                    <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 600, color: 'var(--text)', userSelect: 'none' }}>Edit Mode</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 15, alignItems: isMobile ? 'stretch' : 'center', flex: 1, justifyContent: isMobile ? 'flex-start' : 'flex-end', width: '100%' }}>
                {/* Custom Nested Filter Dropdown (Windows Context Menu Style) */}
                  <div ref={filterRef} style={{ position: 'relative', width: isMobile ? '100%' : 350, zIndex: 50 }}>
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
                      <span style={{ fontSize: 12, opacity: 0.6 }}>{filterOpen ? CARET_UP : CARET_DOWN}</span>
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
                          width: isMobile ? '100%' : 240,
                          maxWidth: '100%'
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
                                    left: isMobile ? 0 : '98%',
                                    top: isMobile ? '100%' : 0,
                                    background: 'var(--bg-card)',
                                    backdropFilter: 'blur(25px)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 16,
                                    boxShadow: 'var(--shadow)',
                                    zIndex: 1001,
                                    padding: '6px 0',
                                    width: isMobile ? '100%' : 200,
                                    maxWidth: '100%'
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
                  >{DOWNLOAD} DOWNLOAD CSV</button>
                  <div style={{ position: 'relative', width: isMobile ? '100%' : 350 }}>
                    <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>{SEARCH}</span>
                    <input
                      type="text"
                      placeholder="Search Name or Reg No..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ ...ds.input, paddingLeft: 50, borderRadius: 20, width: '100%', height: 50 }}
                    />
                  </div>
                </div>
              <div className="responsive-table-wrap" style={{ ...ds.tableBox, overflowX: 'auto' }}>
                <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                      paginatedRegistrations.map((entry, index) => {
                        if (entry.kind === 'single') {
                          const r = entry.player;
                          return (
                            <tr key={r._id} style={ds.tr}>
                              <td
                                style={{ ...ds.td, cursor: isEditMode ? 'pointer' : 'default' }}
                                onClick={() => isEditMode && setEditRegistrationTarget(r)}
                              >
                                <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>{r.playerName}</div>
                                <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>REG: {r.rollNumber}</div>
                                <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 800, marginTop: 4 }}>{r.department}</div>
                                {isEditMode && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>Click to edit</div>}
                              </td>
                              <td style={ds.td}>
                                <div style={{ fontWeight: 800, fontSize: 15 }}>{CAT_LABELS[r.tournament?.category]}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Year: {r.tournament?.year}</div>
                              </td>
                              <td style={ds.td}>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{PHONE} <a href={`tel:${r.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.phone}</a></div>
                                <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                                  {EMAIL} <a
                                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(r.email || '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'inherit', textDecoration: 'none' }}
                                  >
                                    {r.email}
                                  </a>
                                </div>
                                {r.nicNo ? (
                                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>{ID_CARD} {r.nicNo}</div>
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
                          );
                        }

                        const [first, second] = entry.players;
                        const pairReady = second && first?.status === 'confirmed' && second?.status === 'confirmed';
                        const pairApproved = first?.pairStatus === 'approved' || second?.pairStatus === 'approved';
                        const topCellBase = { ...ds.td, border: '1px solid var(--border)', borderBottom: 'none' };
                        const middleCellBase = { ...ds.td, borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderTop: '1px solid var(--border)', borderBottom: 'none' };
                        const footerCell = { ...ds.td, border: '1px solid var(--border)', borderTop: 'none', padding: '18px 18px' };

                        return (
                          <React.Fragment key={`${first._id}-${second ? second._id : 'solo'}`}>
                            <tr style={ds.tr}>
                              <td
                                style={{ ...topCellBase, borderTopLeftRadius: 24, cursor: isEditMode ? 'pointer' : 'default' }}
                                onClick={() => isEditMode && setEditRegistrationTarget(first)}
                              >
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                  <div style={{ fontWeight: 900, fontSize: 18 }}>{first.playerName}</div>
                                  {first.tournament?.category === 'mixed-doubles' && first.gender ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: first.gender === 'Male' ? 'rgba(59,130,246,0.12)' : 'rgba(192,132,252,0.12)', color: first.gender === 'Male' ? '#2563EB' : '#7C3AED' }}>
                                      {first.gender === 'Male' ? '♂' : '♀'} {first.gender}
                                    </span>
                                  ) : null}
                                </div>
                                <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>REG: {first.rollNumber}</div>
                                <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>{first.department}</div>
                                {isEditMode && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>Click to edit</div>}
                              </td>
                              <td style={topCellBase}>
                                <div style={{ fontWeight: 800, fontSize: 15 }}>{CAT_LABELS[first.tournament?.category]}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Year: {first.tournament?.year}</div>
                              </td>
                              <td style={topCellBase}>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{PHONE} <a href={`tel:${first.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{first.phone}</a></div>
                                <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                                  {EMAIL} <a
                                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(first.email || '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'inherit', textDecoration: 'none' }}
                                  >
                                    {first.email}
                                  </a>
                                </div>
                                {first.nicNo ? (
                                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>{ID_CARD} {first.nicNo}</div>
                                ) : null}
                              </td>
                              <td style={topCellBase}>
                                <span style={{ padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 900, ...STATUS_STYLE[first.status] }}>{STATUS_STYLE[first.status].label.toUpperCase()}</span>
                              </td>
                              <td style={{ ...topCellBase, borderTopRightRadius: 24 }}>
                                <div style={{ display: 'flex', gap: 10 }}>
                                  {first.status === 'pending' ? (
                                    <>
                                      <button onClick={() => handleUpdateStatus(first._id, 'confirmed')} style={{ ...ds.actionBtn, background: '#10B981', color: '#000' }}>APPROVE</button>
                                      <button onClick={() => handleUpdateStatus(first._id, 'rejected')} style={{ ...ds.actionBtn, background: '#EF4444', color: '#FFF' }}>REJECT</button>
                                    </>
                                  ) : (
                                    <button onClick={() => handleUpdateStatus(first._id, 'pending')} style={ds.revertBtn}>RESET</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            <tr style={ds.tr}>
                              <td
                                style={{ ...middleCellBase, cursor: isEditMode && second ? 'pointer' : 'default' }}
                                onClick={() => isEditMode && second && setEditRegistrationTarget(second)}
                              >
                                {second ? (
                                  <>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                      <div style={{ fontWeight: 900, fontSize: 18 }}>{second.playerName}</div>
                                      {second.tournament?.category === 'mixed-doubles' && second.gender ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: second.gender === 'Male' ? 'rgba(59,130,246,0.12)' : 'rgba(192,132,252,0.12)', color: second.gender === 'Male' ? '#2563EB' : '#7C3AED' }}>
                                          {second.gender === 'Male' ? '♂' : '♀'} {second.gender}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>REG: {second.rollNumber}</div>
                                    <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>{second.department}</div>
                                    {isEditMode && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>Click to edit</div>}
                                  </>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ fontWeight: 900, fontSize: 18, opacity: 0.65 }}>No partner yet</div>
                                    <button
                                      onClick={() => { setLinkTarget(first); setLinkSearch(''); setLinkSelected(null); }}
                                      style={{
                                        background: 'rgba(59,130,246,0.12)',
                                        border: '1px solid rgba(59,130,246,0.4)',
                                        color: 'var(--primary)',
                                        padding: '7px 14px',
                                        borderRadius: 10,
                                        fontSize: 11,
                                        fontWeight: 900,
                                        cursor: 'pointer',
                                        letterSpacing: 0.5,
                                        width: 'fit-content',
                                        transition: 'all 0.2s',
                                      }}
                                    >
                                      + LINK PARTNER
                                    </button>
                                  </div>
                                )}

                              </td>

                              <td style={middleCellBase}>
                                {second ? (
                                  <>
                                    <div style={{ fontWeight: 800, fontSize: 15 }}>{CAT_LABELS[second.tournament?.category]}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Year: {second.tournament?.year}</div>
                                  </>
                                ) : null}
                              </td>
                              <td style={middleCellBase}>
                                {second ? (
                                  <>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{PHONE} <a href={`tel:${second.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{second.phone}</a></div>
                                    <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                                      {EMAIL} <a
                                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(second.email || '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'inherit', textDecoration: 'none' }}
                                      >
                                        {second.email}
                                      </a>
                                    </div>
                                    {second.nicNo ? (
                                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 2 }}>{ID_CARD} {second.nicNo}</div>
                                    ) : null}
                                  </>
                                ) : null}
                              </td>
                              <td style={middleCellBase}>
                                {second ? (
                                  <span style={{ padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 900, ...STATUS_STYLE[second.status] }}>{STATUS_STYLE[second.status].label.toUpperCase()}</span>
                                ) : null}
                              </td>
                              <td style={middleCellBase}>
                                {second ? (
                                  <div style={{ display: 'flex', gap: 10 }}>
                                    {second.status === 'pending' ? (
                                      <>
                                        <button onClick={() => handleUpdateStatus(second._id, 'confirmed')} style={{ ...ds.actionBtn, background: '#10B981', color: '#000' }}>APPROVE</button>
                                        <button onClick={() => handleUpdateStatus(second._id, 'rejected')} style={{ ...ds.actionBtn, background: '#EF4444', color: '#FFF' }}>REJECT</button>
                                      </>
                                    ) : (
                                      <button onClick={() => handleUpdateStatus(second._id, 'pending')} style={ds.revertBtn}>RESET</button>
                                    )}
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                            <tr style={ds.tr}>
                              <td colSpan={5} style={{ ...footerCell, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, background: 'var(--bg-card)' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                                  {second && (
                                  <button
                                    onClick={() => handleRemovePair(first._id)}
                                    style={{
                                      ...ds.actionBtn,
                                      background: 'rgba(239, 68, 68, 0.08)',
                                      border: '1px solid #EF4444',
                                      color: '#EF4444',
                                      fontSize: 11,
                                      padding: '10px 16px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    REMOVE PAIR
                                  </button>
                                )}
                                {pairApproved && (
                                    <button
                                      onClick={() => handleResetPair(first._id)}
                                      style={{
                                        ...ds.actionBtn,
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-muted)',
                                        fontSize: 11,
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      RESET PAIR
                                    </button>
                                  )}
                                  <button
                                    disabled={!pairReady || pairApproved}
                                    onClick={() => pairReady && !pairApproved && handleApprovePair(first._id)}
                                    style={{
                                      ...ds.actionBtn,
                                      minWidth: 180,
                                      justifyContent: 'center',
                                      border: (!pairReady && !pairApproved) ? '1px solid var(--border)' : 'none',
                                      background: pairApproved
                                        ? '#16A34A'
                                        : pairReady
                                          ? '#2563EB'
                                          : 'var(--bg-input)',
                                      color: pairApproved
                                        ? '#FFF'
                                        : pairReady
                                          ? '#FFF'
                                          : 'var(--text-muted)',
                                      cursor: (pairReady && !pairApproved) ? 'pointer' : 'not-allowed',
                                      boxShadow: pairApproved
                                        ? '0 4px 16px rgba(22,163,74,0.35)'
                                        : pairReady
                                          ? '0 4px 16px rgba(37,99,235,0.35)'
                                          : 'none',
                                      transition: 'all 0.25s ease',
                                    }}
                                  >
                                    {pairApproved ? <>{CHECK_MARK} PAIR APPROVED</> : 'APPROVE PAIR'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })

                    )}
                  </tbody>
                </table>
              </div>
              {groupedRegistrations.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
                  <button
                    type="button"
                    onClick={() => setPlayerPage((page) => Math.max(1, page - 1))}
                    disabled={playerPage === 1}
                    style={{ ...ds.paginationButton, opacity: playerPage === 1 ? 0.45 : 1, cursor: playerPage === 1 ? 'not-allowed' : 'pointer' }}
                  >Previous</button>
                  {Array.from({ length: playerTotalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      type="button"
                      key={page}
                      onClick={() => setPlayerPage(page)}
                      aria-current={playerPage === page ? 'page' : undefined}
                      style={{ ...ds.paginationButton, minWidth: 38, background: playerPage === page ? 'var(--primary)' : 'var(--bg-input)', color: playerPage === page ? '#fff' : 'var(--text)' }}
                    >{page}</button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPlayerPage((page) => Math.min(playerTotalPages, page + 1))}
                    disabled={playerPage === playerTotalPages}
                    style={{ ...ds.paginationButton, opacity: playerPage === playerTotalPages ? 0.45 : 1, cursor: playerPage === playerTotalPages ? 'not-allowed' : 'pointer' }}
                  >Next</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tournament-setup' && (
            <div style={ds.section}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-end', gap: isMobile ? 16 : 0, marginBottom: 40 }}>
                <h2 style={{ ...ds.sectionTitle, fontSize: isMobile ? 20 : 36 }}>TOURNAMENT SETUP BOARD</h2>
                <button onClick={() => setShowCreate(true)} style={{ ...ds.createBtn, width: isMobile ? '100%' : 'auto' }}>+ ADD NEW TOURNAMENT</button>
              </div>
              <div className="responsive-grid-auto">
                {tournaments.map(t => (
                  <div key={t._id} style={ds.tournCard} className="mobile-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                      <div style={{ fontSize: 40, fontWeight: 950, color: 'var(--primary)' }}>{t.year}</div>
                      <div style={{ ...ds.catBadge, color: 'var(--primary)' }}>{CAT_LABELS[t.category]}</div>
                    </div>
                    <div style={ds.tournInfo}>
                      <div style={{ display: 'flex', gap: 10, fontSize: 16 }}>{CALENDAR} <span>Event: {fmtDate(t.date, dateFormat)}</span></div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 16 }}>{HOURGLASS} <span>Closing date: {fmtDeadline(t.registrationDeadline, t.date, dateFormat)}</span></div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 16 }}>{LOCATION} <span>{t.venue}</span></div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      <button onClick={() => setViewTarget(t)} style={{ ...ds.viewBtn, minWidth: 0, flex: '1 1 100%' }}>VIEW REGISTERED PLAYERS</button>
                      <button onClick={() => setEditTarget(t)} style={{ ...ds.viewBtn, flex: '1 1 auto', width: 'auto' }}>✏️ EDIT</button>
                      <button onClick={() => setDeleteTarget(t)} style={{ ...ds.viewBtn, flex: '1 1 auto', width: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>{TRASH}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div style={ds.section}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-end', gap: isMobile ? 16 : 0, marginBottom: 40 }}>
                <div>
                  <h2 style={{ ...ds.sectionTitle, fontSize: isMobile ? 24 : 36, textTransform: 'none' }}>Profile Settings</h2>
                  <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Update your admin profile details and password.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gridTemplateAreas: isMobile ? '"profile" "security" "preferences"' : '"profile profile" "security security" "preferences preferences"', gap: 24, marginBottom: 32 }}>
                <div style={{ gridArea: 'profile', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, boxShadow: 'var(--shadow)' }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ color: 'var(--primary)', fontSize: 12, fontWeight: 950, letterSpacing: 1.4 }}>PROFILE INFORMATION</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Manage the details shown on your administrator account.</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
                    <div style={{ position: 'relative', width: 88, height: 88 }}>
                      <img
                        src={profileAvatarUrl || `https://ui-avatars.com/api/?name=${safeAdminName}&background=random&size=128`}
                        alt="Admin Avatar"
                        style={{ width: '100%', height: '100%', borderRadius: 24, objectFit: 'cover', border: '2px solid var(--border)' }}
                      />
                      <button
                        type="button"
                        onClick={handleAvatarUploadClick}
                        style={ds.avatarUploadBtn}
                        title="Upload profile photo"
                      >
                        {CAMERA}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleAvatarFileChange}
                        disabled={uploadingAvatar}
                        style={ds.hiddenFileInput}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 950 }}>{safeAdminName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>@{profileUsername}</div>
                      <button type="button" onClick={handleAvatarUploadClick} disabled={uploadingAvatar} style={{ ...ds.uploadButton, marginTop: 12, padding: '9px 14px', fontSize: 12 }}>
                        {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                      </button>
                      {profileAvatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          disabled={uploadingAvatar}
                          style={ds.removeAvatarBtn}
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>

                {cropModalOpen && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: 24 }}>
                    <div style={{ width: 'min(92vw, 920px)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: 18, boxShadow: 'var(--shadow)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 900 }}>Crop your profile photo</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Drag the crop box, pinch/scroll to zoom, then save.</div>
                        </div>
                        <button type="button" onClick={() => setCropModalOpen(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>{CLOSE}</button>
                      </div>

                      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 520px', height: 420, position: 'relative', background: 'rgba(0,0,0,0.04)', borderRadius: 8, overflow: 'hidden' }}>
                          {cropImage && (
                            <Cropper
                              image={cropImage}
                              crop={crop}
                              zoom={zoom}
                              aspect={aspect}
                              onCropChange={setCrop}
                              onZoomChange={setZoom}
                              onCropComplete={(croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                            />
                          )}
                        </div>

                        <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>Zoom</label>
                            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '100%', marginTop: 8 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>Aspect</label>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button type="button" onClick={() => setAspect(1)} style={aspect === 1 ? ds.createBtn : ds.revertBtn}>1:1</button>
                              <button type="button" onClick={() => setAspect(3 / 2)} style={aspect === 3 / 2 ? ds.createBtn : ds.revertBtn}>3:2</button>
                              <button type="button" onClick={() => setAspect(4 / 3)} style={aspect === 4 / 3 ? ds.createBtn : ds.revertBtn}>4:3</button>
                            </div>
                          </div>
                          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                            <button type="button" onClick={() => setCropModalOpen(false)} style={{ ...ds.revertBtn, padding: '10px 16px' }}>Cancel</button>
                            <button type="button" onClick={handleCropConfirm} style={{ ...ds.createBtn, padding: '10px 16px' }} disabled={uploadingAvatar}>Save Crop</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              <div style={{ display: 'grid', gap: 18 }}>
                    <div style={{ position: 'relative' }}>
                      <label style={ds.fieldLabel}>Full Name</label>
                      <div style={ds.inputIconWrapper}>
                        <span style={ds.inputIcon}>{USER_ROUND}</span>
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Badminton Admin"
                          style={{ ...ds.input, paddingLeft: 48 }}
                        />
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <label style={ds.fieldLabel}>Username</label>
                      <div style={ds.inputIconWrapper}>
                        <span style={ds.inputIcon}>@</span>
                        <input
                          type="text"
                          value={profileUsername}
                          onChange={(e) => setProfileUsername(e.target.value)}
                          placeholder="admin-username"
                          style={{ ...ds.input, paddingLeft: 48 }}
                        />
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <label style={ds.fieldLabel}>Email Address</label>
                      <div style={ds.inputIconWrapper}>
                        <span style={ds.inputIcon}>{EMAIL}</span>
                        <input type="email" value={profileEmail} readOnly style={{ ...ds.input, paddingLeft: 48, opacity: 0.75 }} />
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <label style={ds.fieldLabel}>Role</label>
                      <input type="text" value={admin?.role === 'super_admin' ? 'Super Administrator' : 'Administrator'} readOnly style={{ ...ds.input, opacity: 0.75 }} />
                    </div>
                    {profileMessage && <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', fontWeight: 700 }}>{profileMessage}</div>}
                    <button
                      onClick={async () => {
                        setSavingProfile(true);
                        setProfileMessage('');
                        try {
                          const apiBase = getApiBase();
                          const res = await axios.put(`${apiBase}/api/auth/me`, {
                            username: profileUsername,
                            name: profileName,
                          });

                          if (res?.status >= 200 && res?.status < 300 && res?.data) {
                            showToast('Profile updated successfully.');
                            setProfileMessage('');
                            setAdmin(res.data);
                            setProfileName(res.data.name || '');
                            setProfileUsername(res.data.username || '');
                            setProfileAvatarUrl(res.data.avatarUrl || '');
                          } else {
                            throw new Error(res?.data?.message || 'Unable to update profile');
                          }
                        } catch (err) {
                          const message = err.response?.data?.message || err.message || 'Unable to update profile';
                          setProfileMessage(message);
                          showToast(message, 'error');
                        } finally {
                          setSavingProfile(false);
                        }
                      }}
                      style={{ ...ds.createBtn, width: '100%', padding: '18px 20px', fontSize: 13, borderRadius: 18, opacity: savingProfile || !profileDirty ? 0.55 : 1, cursor: savingProfile || !profileDirty ? 'not-allowed' : 'pointer' }}
                      disabled={savingProfile || !profileDirty}
                    >
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                      <span style={{ fontSize: 14 }}>{LOCK}</span>
                      <span>Your information is secure and only visible to administrators.</span>
                    </div>
                  </div>
                </div>

                <div style={{ gridArea: 'security', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, boxShadow: 'var(--shadow)' }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ color: 'var(--primary)', fontSize: 12, fontWeight: 950, letterSpacing: 1.4 }}>SECURITY</div>
                    <div style={{ fontSize: 22, fontWeight: 950, marginTop: 8 }}>Keep your account protected</div>
                  </div>
                  <div style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 18, background: 'var(--bg-panel)', marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>{LOCK} Password</div>
                        <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>Password: ••••••••••••</div>
                        <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 12 }}>Last changed: {admin?.passwordChangedAt ? formatDatePreference(admin.passwordChangedAt, dateFormat) : 'Not available'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const opening = !showPasswordEditor;
                          if (opening) {
                            setNewPassword('');
                            setConfirmPassword('');
                            setPasswordMessage('');
                            setShowNewPassword(false);
                            setShowConfirmPassword(false);
                          }
                          setShowPasswordEditor(opening);
                        }}
                        style={{ ...ds.textAction, whiteSpace: 'nowrap' }}
                      >
                        {showPasswordEditor ? 'Cancel' : 'Change Password'} {ARROW_RIGHT}
                      </button>
                    </div>
                  </div>
                  {showPasswordEditor && <div autoComplete="off" style={{ display: 'grid', gap: 18, padding: 18, border: '1px solid var(--border)', borderRadius: 18, marginBottom: 16 }}>
                    <div>
                      <label style={ds.fieldLabel}>New Password</label>
                      <div style={{ position: 'relative' }}><input name="newPassword" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onFocus={() => setPasswordFocus(true)} onBlur={() => setPasswordFocus(false)} placeholder="New password" autoComplete="new-password" style={{ ...ds.input, paddingRight: 46 }} />{renderPasswordToggle('New', showNewPassword, () => setShowNewPassword((v) => !v))}</div>
                    </div>
                    <div>
                      <label style={ds.fieldLabel}>Confirm New Password</label>
                      <div style={{ position: 'relative' }}><input name="confirmNewPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onFocus={() => setConfirmFocus(true)} onBlur={() => setConfirmFocus(false)} placeholder="Confirm new password" autoComplete="new-password" style={{ ...ds.input, paddingRight: 46, borderColor: confirmPassword.length > 0 ? (passwordsMatch ? '#10B981' : '#EF4444') : 'var(--border)' }} />{renderPasswordToggle('Confirm', showConfirmPassword, () => setShowConfirmPassword((v) => !v))}</div>
                      {showPasswordMatchMessage && <div style={{ marginTop: 10, color: passwordsMatch ? '#10B981' : '#EF4444', fontWeight: 700 }}>{passwordsMatch ? <>{CHECK_MARK} Passwords match</> : <>{CROSS} Passwords do not match</>}</div>}
                    </div>
                    {newPassword.length > 0 && <div style={{ display: 'flex', gap: 4 }}>{[1, 2, 3, 4, 5].map((level) => <div key={level} style={{ height: 4, flex: 1, borderRadius: 99, background: level <= passwordStrength ? (passwordStrength >= 5 ? '#10B981' : passwordStrength >= 3 ? '#F59E0B' : '#EF4444') : 'var(--border)' }} />)}</div>}
                    {passwordMessage && <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(239, 68, 68, 0.12)', color: '#B91C1C', fontWeight: 700 }}>{passwordMessage}</div>}
                    <button onClick={async () => {
                        setSavingSecurity(true);
                        setPasswordMessage('');
                        if (!passwordValid || !confirmPassword || !passwordsMatch) {
                          const message = 'Enter a valid matching new password.';
                          setPasswordMessage(message);
                          showToast(message, 'error');
                          setSavingSecurity(false);
                          return;
                        }
                        try {
                          const apiBase = getApiBase();
                          const res = await axios.put(`${apiBase}/api/auth/me/password`, { newPassword, confirmPassword });
                          const message = res.data?.message || 'Password changed successfully';
                          setPasswordMessage(message);
                          setAdmin((prev) => prev ? { ...prev, passwordChangedAt: new Date().toISOString() } : prev);
                          setNewPassword(''); setConfirmPassword('');
                          showToast(message);
                        } catch (err) {
                          const message = err.response?.data?.message || 'Unable to update password';
                          setPasswordMessage(message);
                          showToast(message, 'error');
                        } finally {
                          setSavingSecurity(false);
                        }
                      }} style={{ ...ds.actionBtn, width: '100%', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '14px 20px', borderRadius: 14, fontWeight: 900 }} disabled={savingSecurity || !passwordValid || !passwordsMatch}>
                      {savingSecurity ? 'Saving...' : 'Save New Password'}
                    </button>
                  </div>}

                  <div style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 18, background: 'var(--bg-panel)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>{SHIELD} Security Question</div>
                        <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>{admin?.securityQuestion || 'No security question set'}</div>
                        <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 13 }}>Security answer: ••••••••</div>
                      </div>
                      <button type="button" onClick={() => setShowSecurityEditor((value) => !value)} style={{ ...ds.textAction, whiteSpace: 'nowrap' }}>{showSecurityEditor ? 'Cancel' : 'Change Security Question'} {ARROW_RIGHT}</button>
                    </div>
                  </div>
                  {showSecurityEditor && <div style={{ display: 'grid', gap: 18, padding: 18, border: '1px solid var(--border)', borderRadius: 18, marginTop: 16 }}>
                    <div>
                      <label style={ds.fieldLabel}>Select New Security Question</label>
                      <select value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} style={ds.input}><option value="">Select a question</option><option value="What is your favorite sport?">What is your favorite sport?</option><option value="What was the name of your first school?">What was the name of your first school?</option><option value="What city were you born in?">What city were you born in?</option><option value="What is your favorite team?">What is your favorite team?</option></select>
                    </div>
                    <div>
                      <label style={ds.fieldLabel}>New Security Answer</label>
                      <div style={{ position: 'relative' }}><input type={showSecurityAnswer ? 'text' : 'password'} value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} placeholder="Enter a new answer" autoComplete="new-password" style={{ ...ds.input, paddingRight: 46 }} />{renderPasswordToggle('Answer', showSecurityAnswer, () => setShowSecurityAnswer((v) => !v))}</div>
                    </div>
                    {securityMessage && <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', fontWeight: 700 }}>{securityMessage}</div>}
                    <button onClick={async () => {
                        setSavingSecurity(true);
                        setSecurityMessage('');
                        if (!securityQuestion.trim() || !securityAnswer.trim()) {
                          const message = 'Security question and answer are required.';
                          setSecurityMessage(message);
                          showToast(message, 'error');
                          setSavingSecurity(false);
                          return;
                        }
                        try {
                          const apiBase = getApiBase();
                          const res = await axios.post(`${apiBase}/api/auth/update-security-question`, {
                            securityQuestion: securityQuestion.trim(),
                            securityAnswer: securityAnswer.trim(),
                          });
                          const message = res.data?.message || 'Security question updated successfully';
                          setSecurityMessage(message);
                          setSecurityAnswer('');
                          setAdmin((prev) => prev ? { ...prev, securityQuestion: securityQuestion.trim() } : prev);
                          showToast(message);
                        } catch (err) {
                          const message = err.response?.data?.message || 'Unable to update security question';
                          setSecurityMessage(message);
                          showToast(message, 'error');
                        } finally {
                          setSavingSecurity(false);
                        }
                      }}
                      style={{ ...ds.actionBtn, width: '100%', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '14px 20px', borderRadius: 14, fontWeight: 900 }} disabled={savingSecurity}>
                      {savingSecurity ? 'Saving...' : 'Save Security Question'}
                    </button>
                  </div>}
                </div>

                <div style={{ display: 'none' }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Change Password</div>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Keep your account secure by updating your password regularly.</p>
                  </div>
                  <div style={{ display: 'grid', gap: 18 }}>
                    <div>
                      <label style={ds.fieldLabel}>New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          onFocus={() => setPasswordFocus(true)}
                          onBlur={() => setPasswordFocus(false)}
                          placeholder="New password"
                          style={{ ...ds.input, paddingRight: 46 }}
                        />
                        {renderPasswordToggle('New', showNewPassword, () => setShowNewPassword((v) => !v))}
                      </div>
                      {newPassword.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div key={level} style={{ height: 4, flex: 1, borderRadius: 99, background: level <= passwordStrength ? (passwordStrength >= 5 ? '#10B981' : passwordStrength >= 3 ? '#F59E0B' : '#EF4444') : 'var(--border)' }} />
                            ))}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: passwordStrength >= 5 ? '#10B981' : passwordStrength >= 3 ? '#F59E0B' : '#EF4444' }}>
                            Password strength: {passwordStrengthLabel}
                          </div>
                        </div>
                      )}
                      {showPasswordRequirements && (
                        <div style={{ marginTop: 10, padding: '14px 16px', borderRadius: 16, background: 'rgba(15, 23, 42, 0.06)' }}>
                          <div style={{ marginBottom: 8, fontWeight: 700 }}>Password must include:</div>
                          <div style={{ color: passwordChecks.length ? '#10B981' : '#EF4444', display: 'flex', gap: 8 }}><span>{passwordChecks.length ? CHECK_MARK : CROSS}</span><span>At least 8 characters</span></div>
                          <div style={{ color: passwordChecks.uppercase ? '#10B981' : '#EF4444', display: 'flex', gap: 8 }}><span>{passwordChecks.uppercase ? CHECK_MARK : CROSS}</span><span>One uppercase letter (A-Z)</span></div>
                          <div style={{ color: passwordChecks.lowercase ? '#10B981' : '#EF4444', display: 'flex', gap: 8 }}><span>{passwordChecks.lowercase ? CHECK_MARK : CROSS}</span><span>One lowercase letter (a-z)</span></div>
                          <div style={{ color: passwordChecks.number ? '#10B981' : '#EF4444', display: 'flex', gap: 8 }}><span>{passwordChecks.number ? CHECK_MARK : CROSS}</span><span>One number (0-9)</span></div>
                          <div style={{ color: passwordChecks.special ? '#10B981' : '#EF4444', display: 'flex', gap: 8 }}><span>{passwordChecks.special ? CHECK_MARK : CROSS}</span><span>One special character</span></div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={ds.fieldLabel}>Confirm New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onFocus={() => setConfirmFocus(true)}
                          onBlur={() => setConfirmFocus(false)}
                          placeholder="Confirm new password"
                          style={{ ...ds.input, paddingRight: 46 }}
                        />
                        {renderPasswordToggle('Confirm', showConfirmPassword, () => setShowConfirmPassword((v) => !v))}
                      </div>
                      {showPasswordMatchMessage && (
                        <div style={{ marginTop: 10, color: passwordsMatch ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                          {passwordsMatch ? <>{CHECK_MARK} Passwords match</> : <>{CROSS} Passwords do not match.</>}
                        </div>
                      )}
                    </div>
                    {passwordMessage && <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(239, 68, 68, 0.12)', color: '#B91C1C', fontWeight: 700 }}>{passwordMessage}</div>}
                    <button
                      onClick={async () => {
                        setChangingPassword(true);
                        setPasswordMessage('');
                        if (!passwordValid) {
                          const message = 'New password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
                          setPasswordMessage(message);
                          showToast(message, 'error');
                          setChangingPassword(false);
                          return;
                        }
                        if (!confirmPassword) {
                          const message = 'Please confirm your new password.';
                          setPasswordMessage(message);
                          showToast(message, 'error');
                          setChangingPassword(false);
                          return;
                        }
                        if (!passwordsMatch) {
                          const message = 'New password and confirmation do not match.';
                          setPasswordMessage(message);
                          showToast(message, 'error');
                          setChangingPassword(false);
                          return;
                        }
                        try {
                          const apiBase = getApiBase();
                          const res = await axios.put(`${apiBase}/api/auth/me/password`, { newPassword, confirmPassword });
                          const message = res.data?.message || 'Password updated successfully';
                          setPasswordMessage(message);
                          showToast(message);
                          setNewPassword('');
                          setConfirmPassword('');
                        } catch (err) {
                          const message = err.response?.data?.message || 'Unable to update password';
                          setPasswordMessage(message);
                          showToast(message, 'error');
                        } finally {
                          setChangingPassword(false);
                        }
                      }}
                      style={{ ...ds.actionBtn, width: '100%', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '18px 20px', fontSize: 13, borderRadius: 18, fontWeight: 900 }}
                      disabled={changingPassword}
                    >
                      {changingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </div>

                <div style={{ gridArea: 'preferences', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: 28, boxShadow: 'var(--shadow)' }}>
                  <div style={{ color: 'var(--primary)', fontSize: 12, fontWeight: 950, letterSpacing: 1.4, marginBottom: 18 }}>PREFERENCES</div>
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                      <div><div style={{ fontWeight: 850 }}>Dark Mode</div><div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Use the dashboard theme.</div></div>
                      <ThemeToggleButton variant="settings" />
                    </div>
                    <div style={ds.preferenceRow}>
                      <span style={ds.preferenceLabel}>Date Format</span>
                      <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} style={ds.preferenceSelect}>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      </select>
                    </div>
                    <div style={ds.preferenceRow}>
                      <span style={ds.preferenceLabel}>Time Format</span>
                      <select value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)} style={ds.preferenceSelect}>
                        <option value="12-hour">12-hour</option>
                        <option value="24-hour">24-hour</option>
                      </select>
                    </div>
                    <div style={ds.preferenceRow}>
                      <span style={ds.preferenceLabel}>Items Per Page</span>
                      <select value={itemsPerPage} onChange={(e) => setItemsPerPage(e.target.value)} style={ds.preferenceSelect}>
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                      </select>
                    </div>
                  </div>
                </div>

              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(239, 68, 68, 0.45)', borderRadius: 24, padding: 28, boxShadow: 'var(--shadow)' }}>
                <div style={{ color: '#EF4444', fontSize: 12, fontWeight: 950, letterSpacing: 1.4 }}>DANGER ZONE</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 18, marginTop: 14 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 950 }}>{TRASH} Delete Account</div>
                    <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>Permanently delete your administrator account.</div>
                  </div>
                  <button type="button" onClick={() => setShowDeleteAccountModal(true)} style={{ ...ds.actionBtn, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#EF4444', padding: '13px 20px', borderRadius: 14, fontWeight: 900, whiteSpace: 'nowrap' }}>
                    {TRASH} Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit-log' && (
            <div style={ds.section}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-end', gap: 16, marginBottom: 32 }}>
                <div>
                  <h2 style={ds.sectionTitle}>AUDIT LOG</h2>
                  <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Track important admin actions performed in the system.</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, width: isMobile ? '100%' : 'auto', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={auditDate}
                    onChange={(e) => {
                      setAuditDate(e.target.value);
                      fetchAuditLogs(e.target.value);
                    }}
                    style={{ ...ds.input, width: isMobile ? '100%' : 220 }}
                  />
                  <button
                    onClick={handleClearAllAuditLogs}
                    style={{ ...ds.actionBtn, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#EF4444', padding: '0 20px', height: 44, borderRadius: 16, whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700 }}
                  >
                    {TRASH} CLEAR ALL
                  </button>
                </div>
              </div>
              <div className="responsive-table-wrap" style={{ ...ds.tableBox, overflowX: 'auto' }}>
                <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={ds.thead}>
                    <tr>
                      <th style={{ ...ds.th_header, width: '18%' }}>TIME</th>
                      <th style={{ ...ds.th_header, width: '18%' }}>USER</th>
                      <th style={{ ...ds.th_header, width: '22%' }}>ACTION</th>
                      <th style={{ ...ds.th_header, width: '16%' }}>MODULE</th>
                      <th style={{ ...ds.th_header, width: '26%' }}>DETAILS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 60, textAlign: 'center', fontSize: 18, color: 'var(--text-muted)' }}>No audit entries found for the selected filters.</td></tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log._id} style={ds.tr}>
                          <td style={ds.td}>{formatDatePreference(log.createdAt, dateFormat)}<br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTimePreference(log.createdAt, timeFormat)}</span></td>
                          <td style={ds.td}>{log.admin?.name || log.admin?.username || 'System'}</td>
                          <td style={ds.td}><strong>{formatAuditAction(log.action)}</strong></td>
                          <td style={ds.td}>{formatAuditModule(log)}</td>
                          <td style={{ ...ds.td, maxWidth: 320, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.5 }}>{formatAuditDetails(log, dateFormat)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'university-team' && (
            <UniversityTeamAdminView color={meta.color} />
          )}

          {activeTab === 'brackets' && (
            <BracketsView admin={admin} color={meta.color} initialTournamentId={new URLSearchParams(location.search).get('tournamentId')} />
          )}
        </main>
      </div>

      {showCreate && <TournamentFormModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {editTarget && <TournamentFormModal tournament={editTarget} onClose={() => setEditTarget(null)} onSubmit={handleUpdate} requirePassword />}
      {viewTarget && <RegistrationsModal tournament={viewTarget} onClose={() => setViewTarget(null)} />}
      {deleteTarget && <PasswordConfirmModal title="DELETE TOURNAMENT" message={`Delete ${CAT_LABELS[deleteTarget.category]}? This will remove all registration data.`} confirmLabel="DELETE NOW" danger onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
      {showDeleteAccountModal && <PasswordConfirmModal title={<>{WARNING_ROUND} Delete your account?</>} message="This action cannot be undone." confirmLabel="Delete Account" danger showPasswordToggle onConfirm={handleDeleteAccount} onClose={() => setShowDeleteAccountModal(false)} />}

      {removePairTarget && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setRemovePairTarget(null); }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 610,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-pair-modal-title"
            aria-describedby="remove-pair-modal-desc"
            tabIndex={-1}
            onKeyDown={e => {
              if (e.key === 'Escape') setRemovePairTarget(null);
            }}
            style={{
              width: 520,
              maxWidth: '100%',
              background: 'var(--bg-card)',
              borderRadius: 28,
              border: '1px solid var(--border)',
              boxShadow: '0 40px 90px rgba(0,0,0,0.32)',
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              outline: 'none',
            }}
          >
            <div>
              <div id="remove-pair-modal-title" style={{ fontSize: 10, fontWeight: 900, color: 'var(--primary)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Remove Pair</div>
              <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: -0.5, marginBottom: 8 }}>Confirm pair removal</div>
              <div id="remove-pair-modal-desc" style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.75 }}>
                Are you sure you want to remove this pair? Both players will be unlinked and marked as 'No partner yet', and will need to register a new partner to continue.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setRemovePairTarget(null)}
                style={{ ...ds.revertBtn, padding: '12px 20px', borderRadius: 14, minWidth: 120 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemovePair}
                disabled={removePairLoading}
                style={{
                  ...ds.actionBtn,
                  background: '#EF4444',
                  color: '#FFF',
                  border: '1px solid #EF4444',
                  padding: '12px 20px',
                  borderRadius: 14,
                  minWidth: 140,
                  cursor: removePairLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {removePairLoading ? 'Removing...' : 'Remove Pair'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editRegistrationTarget && (
        <RegisterModal
          tournament={editRegistrationTarget.tournament}
          initialData={editRegistrationTarget}
          onClose={() => {
            setEditRegistrationTarget(null);
            fetchData();
          }}
        />
      )}


      {/* ── Link Partner Modal ── */}
      {linkTarget && (() => {
        const soloOptions = registrations.filter(r => {
          const targetTournamentId = String(linkTarget.tournament?._id || linkTarget.tournament || '');
          const candidateTournamentId = String(r.tournament?._id || r.tournament || '');
          const isSameTournament = targetTournamentId && candidateTournamentId && targetTournamentId === candidateTournamentId;
          const hasNoPartner = !r.partnerRollNumber || r.partnerRollNumber.trim() === '';
          const isConfirmed = r.status === 'confirmed';
          const isNotSelf = String(r._id) !== String(linkTarget._id);

          const category = linkTarget.tournament?.category;
          const isGenderCompatible = (() => {
            if (!category) return false;
            const targetGender = String(linkTarget.gender || '').trim().toLowerCase();
            const candidateGender = String(r.gender || '').trim().toLowerCase();

            if (category === 'mixed-doubles') {
              return (targetGender === 'male' && candidateGender === 'female') || (targetGender === 'female' && candidateGender === 'male');
            }
            if (category === 'doubles-men') {
              return (!targetGender || targetGender === 'male') && (!candidateGender || candidateGender === 'male');
            }
            if (category === 'doubles-women') {
              return (!targetGender || targetGender === 'female') && (!candidateGender || candidateGender === 'female');
            }
            return false;
          })();

          return (
            isNotSelf &&
            isSameTournament &&
            hasNoPartner &&
            isConfirmed &&
            isGenderCompatible
          );
        }).filter(r =>
          !linkSearch ||
          r.playerName.toLowerCase().includes(linkSearch.toLowerCase()) ||
          r.rollNumber.toLowerCase().includes(linkSearch.toLowerCase())
        );

        return (
          <div
            onClick={e => { if (e.target === e.currentTarget) { setLinkTarget(null); setLinkSelected(null); setLinkSearch(''); } }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(10px)',
              zIndex: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
          >
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 28,
              border: '1px solid var(--border)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
              padding: '40px',
              width: 540,
              maxWidth: '100%',
              display: 'flex', flexDirection: 'column', gap: 24,
              animation: 'fadeIn 0.2s ease',
            }}>
              {/* Header */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--primary)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Manual Partner Link</div>
                <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: -0.5, marginBottom: 4 }}>
                  Assign partner for <span style={{ color: 'var(--primary)' }}>{linkTarget.playerName}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {CAT_LABELS[linkTarget.tournament?.category]} &middot; Year {linkTarget.tournament?.year} &middot; REG: {linkTarget.rollNumber}
                </div>
              </div>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>{SEARCH}</span>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name or reg number..."
                  value={linkSearch}
                  onChange={e => setLinkSearch(e.target.value)}
                  style={{ ...ds.input, paddingLeft: 46, borderRadius: 14, fontSize: 14 }}
                />
              </div>

              {/* Player list */}
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {soloOptions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>
                    {linkSearch ? 'No matching solo players found.' : 'No other unpaired players in this category.'}
                  </div>
                ) : soloOptions.map(r => {
                  const isSelected = linkSelected?._id === r._id;
                  return (
                    <div
                      key={r._id}
                      onClick={() => setLinkSelected(isSelected ? null : r)}
                      style={{
                        padding: '14px 18px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(59,130,246,0.1)' : 'var(--bg-input)',
                        transition: 'all 0.15s',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 15 }}>{r.playerName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontWeight: 600 }}>
                          REG: {r.rollNumber} &middot; {r.department}
                        </div>
                      </div>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        border: isSelected ? 'none' : '2px solid var(--border)',
                        background: isSelected ? 'var(--primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, color: '#fff', flexShrink: 0, transition: 'all 0.15s'
                      }}>
                        {isSelected ? CHECK_MARK : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button
                  onClick={() => { setLinkTarget(null); setLinkSelected(null); setLinkSearch(''); }}
                  style={{ ...ds.revertBtn, padding: '14px 28px', borderRadius: 14 }}
                >
                  CANCEL
                </button>
                <button
                  disabled={!linkSelected || linkLoading}
                  onClick={handleLinkPartner}
                  style={{
                    ...ds.actionBtn,
                    padding: '14px 28px',
                    borderRadius: 14,
                    fontSize: 13,
                    background: linkSelected ? 'var(--primary)' : 'var(--bg-input)',
                    color: linkSelected ? '#FFF' : 'var(--text-muted)',
                    border: linkSelected ? 'none' : '1px solid var(--border)',
                    cursor: (!linkSelected || linkLoading) ? 'not-allowed' : 'pointer',
                    boxShadow: linkSelected ? '0 8px 24px rgba(59,130,246,0.35)' : 'none',
                    transition: 'all 0.2s',
                    minWidth: 160,
                  }}
                >
                  {linkLoading
                    ? 'Linking...'
                    : linkSelected
                      ? `LINK WITH ${linkSelected.playerName.split(' ')[0].toUpperCase()}`
                      : 'SELECT A PLAYER'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const ds = {
  container: { display: 'flex', minHeight: '100vh', background: 'transparent', color: 'var(--text)', fontFamily: 'Inter, sans-serif', position: 'relative', zIndex: 2 },
  sidebar: { width: 340, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0 },
  sidebarBrand: { minHeight: 100, display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)', padding: '0 24px' },
  //sidebarBrand: { height: 110, display: 'flex', alignItems: 'center', px: 32, gap: 16, borderBottom: '1px solid var(--border)', padding: '0 32px' },
  // logoBox: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' },
  // profileCard: { padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, borderBottom: '1px solid var(--border)' },
  // avatarBox: { position: 'relative', width: 90, height: 90 },
  // avatar: { width: '100%', height: '100%', borderRadius: 32, objectFit: 'cover', border: '3px solid var(--border)' },
  // statusDot: { position: 'absolute', bottom: -5, right: -5, width: 22, height: 22, background: '#10B981', border: '4px solid var(--bg-card)', borderRadius: '50%' },
  logoBox: { width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 0 22px rgba(59, 130, 246, 0.18)' },
  profileCard: { padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)', borderRadius: '0 0 24px 24px', background: 'var(--bg-panel)' },
  avatarBox: { position: 'relative', width: 96, height: 96 },
  avatar: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--border)' },
  statusDot: { position: 'absolute', bottom: -6, right: -6, width: 18, height: 18, background: '#10B981', border: '3px solid var(--bg-panel)', borderRadius: '50%' },
  
  pName: { fontSize: 16, fontWeight: 950, letterSpacing: 0.5 },
  pRole: { fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1.5, marginTop: 4 },
  nav: { flex: 1, padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 4 },
  navBtn: { display: 'flex', alignItems: 'center', gap: 20, padding: '18px 32px', border: 'none', cursor: 'pointer', fontWeight: 800, transition: 'all 0.3s' },
  mainWrapper: { flex: 1, marginLeft: 340 },
  header: { height: 110, background: 'var(--nav-bg)', backdropFilter: 'blur(30px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px', position: 'sticky', top: 0, zIndex: 10 },
  greetBox: { display: 'flex', flexDirection: 'column', gap: 4 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 18 },
  domainBadge: { padding: '10px 24px', borderRadius: 40, fontSize: 11, fontWeight: 900, border: '1px solid' },
  preferenceRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 42, padding: '8px 0', borderBottom: '1px solid var(--border)' },
  paginationButton: { minHeight: 38, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 12, fontWeight: 850, cursor: 'pointer' },
  preferenceLabel: { fontSize: 13, fontWeight: 850 },
  preferenceSelect: { minWidth: 132, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 12, fontWeight: 750, outline: 'none' },
  logoutBtn: { color: '#EF4444', fontWeight: 950, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, letterSpacing: 1 },
  notificationBtn: { position: 'relative', border: 'none', background: 'var(--bg-input)', color: 'var(--text)', width: 48, height: 48, borderRadius: 16, fontSize: 18, cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', display: 'grid', placeItems: 'center' },
  notificationBadge: { position: 'absolute', top: 8, right: 8, minWidth: 18, height: 18, borderRadius: 999, background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' },
  notificationMenu: { position: 'absolute', right: 0, top: 'calc(100% + 12px)', width: 320, background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, boxShadow: '0 30px 70px rgba(0,0,0,0.22)', padding: 16, zIndex: 1100 },
  notificationTitle: { fontSize: 14, fontWeight: 900, color: 'var(--text)', marginBottom: 8 },
  notificationItem: { width: '100%', textAlign: 'left', border: 'none', background: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 18, cursor: 'pointer', transition: 'background 0.2s ease, transform 0.2s ease', color: 'var(--text)', display: 'grid', gap: 8, marginBottom: 6 },
  notificationItemTitle: { fontSize: 14, fontWeight: 900, marginBottom: 4 },
  notificationItemDescription: { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 },
  profileMenuItem: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: 'none', background: 'transparent', color: 'var(--text)', padding: '14px 12px', borderRadius: 14, cursor: 'pointer', fontSize: 13, transition: 'all 0.2s', textAlign: 'left' },
  title: { fontSize: 56, fontWeight: 950, marginBottom: 8, letterSpacing: -2, textTransform: 'uppercase' },
  subtitle: { color: 'var(--text-muted)', marginBottom: 60, fontSize: 18, fontWeight: 500 },
  statCard: { background: 'var(--bg-card)', padding: '48px 32px', borderRadius: 40, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', position: 'relative' },
  cardSymbol: { width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 24 },
  dashboardPanel: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, boxShadow: 'var(--shadow)', minWidth: 0 },
  dashboardChartsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginTop: 18 },
  registrationChart: { display: 'grid', gap: 16, paddingTop: 4, minWidth: 0 },
  registrationChartRow: { display: 'grid', gridTemplateColumns: 'minmax(116px, 0.9fr) minmax(100px, 1.5fr) 82px', alignItems: 'center', gap: 10, minWidth: 0 },
  registrationChartLabel: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, color: 'var(--text)', fontSize: 12, fontWeight: 800, overflowWrap: 'anywhere' },
  chartLegendDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  registrationChartTrack: { height: 10, borderRadius: 999, background: 'var(--bg-input)', overflow: 'hidden', minWidth: 0 },
  registrationChartBar: { height: '100%', minWidth: 4, borderRadius: 999, transition: 'width 0.3s ease' },
  registrationChartValue: { color: 'var(--text)', fontSize: 13, textAlign: 'right', minWidth: 0 },
  registrationChartPercentage: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 700 },
  statusChartLayout: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, minHeight: 194 },
  statusDonut: { width: 156, height: 156, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 },
  statusDonutCenter: { width: 106, height: 106, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  statusDonutCenterStrong: { color: 'var(--text)', fontSize: 27, fontWeight: 950, lineHeight: 1 },
  statusLegend: { display: 'grid', gap: 14, minWidth: 150 },
  statusLegendRow: { display: 'grid', gridTemplateColumns: '9px 1fr auto', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 },
  dashboardPanelHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  dashboardPanelTitle: { margin: 0, fontSize: 13, fontWeight: 950, letterSpacing: 1.2 },
  dashboardPanelSubtitle: { margin: '5px 0 0', color: 'var(--text-muted)', fontSize: 12 },
  tournamentCard: { minHeight: 265, display: 'flex', flexDirection: 'column', gap: 14, padding: 18, borderRadius: 18, border: '1px solid var(--border)', background: 'var(--bg-input)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' },
  completedTournamentCard: { borderColor: 'rgba(34,197,94,0.65)', background: 'rgba(20,83,45,0.28)', boxShadow: '0 8px 24px rgba(34,197,94,0.16)' },
  completedStatusBadge: { color: '#86EFAC', background: 'rgba(34,197,94,0.2)' },
  tournamentCardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  tournamentIcon: { width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 13, fontSize: 22 },
  tournamentCardTitle: { margin: 0, fontSize: 16, fontWeight: 950, lineHeight: 1.25, color: 'var(--text)' },
  tournamentCardType: { marginTop: 5, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' },
  tournamentMetricGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 2 },
  tournamentMetric: { padding: 10, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' },
  tournamentProgressBlock: { marginTop: 'auto' },
  tournamentProgressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, marginBottom: 7 },
  manageTournamentButton: { width: '100%', marginTop: 2, padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 11, fontWeight: 900, cursor: 'pointer', textAlign: 'center' },
  completedTournamentMetric: { background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.28)' },
  completedProgressHeader: { color: '#86EFAC' },
  completedTournamentButton: { borderColor: '#22C55E', background: '#15803D', color: '#F0FDF4', boxShadow: '0 4px 14px rgba(34,197,94,0.18)' },
  quickAction: { display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', minWidth: 0, padding: '14px 12px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', cursor: 'pointer' },
  quickActionIcon: { width: 30, height: 30, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 950, flexShrink: 0 },
  quickActionText: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, lineHeight: 1.2 },
  quickActionTitle: { display: 'block', fontSize: 13, fontWeight: 950, lineHeight: 1.25, overflowWrap: 'anywhere' },
  quickActionDetail: { display: 'block', fontSize: 11, fontWeight: 650, lineHeight: 1.3, overflowWrap: 'anywhere' },
  quickActionArrow: { marginLeft: 'auto', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 16 },
  attentionItem: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', textAlign: 'left', cursor: 'pointer' },
  emptyPanel: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 4px', color: 'var(--text-muted)', fontSize: 13 },
  tournamentRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid var(--border)' },
  statusBadge: { padding: '5px 9px', borderRadius: 999, fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' },
  progressTrack: { height: 6, marginTop: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width 0.3s ease' },
  smallAction: { border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', borderRadius: 10, padding: '8px 10px', fontSize: 11, fontWeight: 900, cursor: 'pointer', flexShrink: 0 },
  textAction: { border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: 11, fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' },
  matchRow: { display: 'flex', gap: 10, padding: '13px 0', borderBottom: '1px solid var(--border)' },
  matchTime: { color: 'var(--text)', fontSize: 12, fontWeight: 900, minWidth: 66 },
  activityRow: { display: 'flex', gap: 10, padding: '10px 0' },
  section: { animation: 'fadeIn 0.5s ease' },
  sectionTitle: { fontSize: 36, fontWeight: 950, marginBottom: 32, letterSpacing: -1, textTransform: 'uppercase' },
  tableBox: { borderRadius: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', background: 'var(--bg-card)' },
  thead: { background: 'var(--bg-input)', borderBottom: '2px solid var(--border)' },
  th_header: { padding: '24px 32px', fontSize: 13, textTransform: 'uppercase', color: 'var(--text)', letterSpacing: 1.5, fontWeight: 950 },
  tr: { borderTop: '1px solid var(--border)', transition: 'background 0.2s' },
  input: { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '14px 18px', borderRadius: 16, fontSize: 16, outline: 'none', transition: 'all 0.2s' },
  hiddenFileInput: { display: 'none' },
  inputIconWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted)' },
  fileUploadBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '20px', borderRadius: 20, border: '1px dashed rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'all 0.2s', minHeight: 100 },
  fileUploadBoxHover: { borderColor: 'rgba(59, 130, 246, 0.6)', background: 'rgba(59, 130, 246, 0.08)' },
  fileUploadInfo: { display: 'flex', alignItems: 'center', gap: 14 },
  uploadIconCircle: { width: 44, height: 44, borderRadius: 16, background: 'rgba(59, 130, 246, 0.16)', display: 'grid', placeItems: 'center', fontSize: 20, color: 'var(--primary)' },
  uploadTextPrimary: { fontSize: 15, fontWeight: 900, color: 'var(--text)' },
  uploadTextSecondary: { fontSize: 13, color: 'var(--text-muted)', marginTop: 4 },
  uploadButton: { background: 'var(--primary)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  removeAvatarBtn: { marginTop: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: 'var(--text)', padding: '10px 16px', borderRadius: 14, cursor: 'pointer', fontWeight: 700 },
  avatarUploadBtn: { position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.15)' },
  td: { padding: '20px 16px', whiteSpace: 'nowrap' },
  actionBtn: { border: 'none', padding: '12px 20px', borderRadius: 12, fontWeight: 950, fontSize: 12, cursor: 'pointer', letterSpacing: 0.5 },
  revertBtn: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '12px 20px', borderRadius: 12, fontWeight: 950, fontSize: 12, cursor: 'pointer' },
  tournCard: { background: 'var(--bg-card)', padding: '40px', borderRadius: 40, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 28 },
  catBadge: { background: 'var(--bg-input)', padding: '10px 18px', borderRadius: 14, fontSize: 13, fontWeight: 950, letterSpacing: 0.5, border: '1px solid var(--border)' },
  tournInfo: { color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 10 },
  viewBtn: { flex: 1, background: 'var(--bg-input)', border: 'none', color: 'var(--text)', padding: '16px', borderRadius: 18, cursor: 'pointer', fontWeight: 900, fontSize: 14, transition: 'all 0.2s', letterSpacing: 0.5 },
  createBtn: { background: 'var(--primary)', color: '#FFF', border: 'none', padding: '18px 40px', borderRadius: 20, fontWeight: 950, fontSize: 15, cursor: 'pointer', boxShadow: '0 15px 30px -5px rgba(59, 130, 246, 0.4)' },
  filterSelect: { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '12px 20px', borderRadius: 16, fontSize: 13, fontWeight: 800, cursor: 'pointer', outline: 'none' }
};




// Helper: create a cropped image blob from an image source and pixel crop
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 512 / Math.max(pixelCrop.width, pixelCrop.height));
  canvas.width = Math.max(1, Math.round(pixelCrop.width * scale));
  canvas.height = Math.max(1, Math.round(pixelCrop.height * scale));
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      const file = new File([blob], 'avatar.jpg', { type: blob.type });
      resolve(file);
    }, 'image/jpeg', 0.9);
  });
}
