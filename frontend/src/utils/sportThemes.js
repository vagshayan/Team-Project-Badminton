/**
 * Centralized Sport Themes & Top Performer Profiles
 * University of Jaffna Sports Management System
 */

export const SPORT_THEMES = {
  badminton: {
    id: 'badminton',
    name: 'Badminton',
    label: 'BADMINTON',
    icon: '🏸',
    primary: '#2563EB',
    secondary: '#06B6D4',
    overlay: 'rgba(5, 15, 45, 0.70)',
    bgGradient: 'linear-gradient(135deg, rgba(5, 15, 45, 0.78) 0%, rgba(15, 23, 42, 0.88) 100%)',
    background: '/images/badminton-bg.jpg',
    glow: 'rgba(37, 99, 235, 0.35)',
    accentGradient: 'linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)',
    tagline: 'High-intensity singles, doubles, and mixed matches across university courts.',
  },

  'table-tennis': {
    id: 'table-tennis',
    name: 'Table Tennis',
    label: 'TABLE TENNIS',
    icon: '🏓',
    primary: '#EC4899',
    secondary: '#8B5CF6',
    overlay: 'rgba(30, 10, 35, 0.70)',
    bgGradient: 'linear-gradient(135deg, rgba(30, 10, 35, 0.78) 0%, rgba(15, 23, 42, 0.88) 100%)',
    background: '/images/table-tennis-bg.jpg',
    glow: 'rgba(236, 72, 153, 0.35)',
    accentGradient: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
    tagline: 'Rapid spin rallies, campus rankings, and knockout table draws.',
  },

  carrom: {
    id: 'carrom',
    name: 'Carrom',
    label: 'CARROM',
    icon: '🎯',
    primary: '#A855F7',
    secondary: '#F59E0B',
    overlay: 'rgba(25, 10, 35, 0.72)',
    bgGradient: 'linear-gradient(135deg, rgba(25, 10, 35, 0.78) 0%, rgba(15, 23, 42, 0.88) 100%)',
    background: '/images/carrom-bg.jpg',
    glow: 'rgba(168, 85, 247, 0.35)',
    accentGradient: 'linear-gradient(135deg, #A855F7 0%, #F59E0B 100%)',
    tagline: 'Precision board battles, striker tournaments, and championship finals.',
  },
};

// Aliases
SPORT_THEMES.tableTennis = SPORT_THEMES['table-tennis'];

export const TOP_PERFORMERS = {
  badminton: {
    sportId: 'badminton',
    sportLabel: 'BADMINTON',
    sportIcon: '🏸',
    name: 'Kavisha Ranasinghe',
    registrationNo: '2021/CSC/042',
    faculty: 'Faculty of Science',
    photo: '/images/player1.jpg',
    wins: 12,
    matches: 15,
    winRate: '80%',
    points: 248,
    ranking: 1,
    category: 'Singles — Women',
    achievements: 'University Inter-Faculty Gold Medalist 2024'
  },

  'table-tennis': {
    sportId: 'table-tennis',
    sportLabel: 'TABLE TENNIS',
    sportIcon: '🏓',
    name: 'Vithushan Tharmarajah',
    registrationNo: '2021/ENG/118',
    faculty: 'Faculty of Engineering',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    wins: 10,
    matches: 13,
    winRate: '77%',
    points: 215,
    ranking: 1,
    category: 'Singles — Men',
    achievements: 'Campus Table Tennis Open Champion 2024'
  },

  carrom: {
    sportId: 'carrom',
    sportLabel: 'CARROM',
    sportIcon: '🎯',
    name: 'Senthuran Sivakumar',
    registrationNo: '2021/MGT/089',
    faculty: 'Faculty of Management Studies',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    wins: 14,
    matches: 16,
    winRate: '87%',
    points: 280,
    ranking: 1,
    category: 'Singles — Men',
    achievements: 'Grand Slam Striker of the Year 2024'
  }
};

TOP_PERFORMERS.tableTennis = TOP_PERFORMERS['table-tennis'];
