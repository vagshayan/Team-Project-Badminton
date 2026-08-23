import { BADMINTON, TABLE_TENNIS, CARROM } from '../components/Icons';

export const SPORTS = [
  {
    id: 'badminton',
    label: 'Badminton',
    icon: BADMINTON,
    color: '#a85e09',
    darkColor: '#FBBF24',
    accent: '#F5C542',
    darkAccent: '#FDE68A',
    path: '/badminton',
  },
  {
    id: 'table-tennis',
    label: 'Table Tennis',
    icon: TABLE_TENNIS,
    color: '#1f87a6',
    darkColor: '#67E8F9',
    accent: '#4FC7EA',
    darkAccent: '#A5F3FC',
    path: '/table-tennis',
  },
  {
    id: 'carrom',
    label: 'Carrom',
    icon: CARROM,
    color: '#ac1764',
    darkColor: '#F472B6',
    accent: '#EF5DA8',
    darkAccent: '#F9A8D4',
    path: '/carrom',
  },
];

export const SPORT_META = SPORTS.reduce((meta, sport) => {
  meta[sport.id] = sport;
  return meta;
}, {});

export const getSportMeta = (sportId, isDarkMode = false) => {
  const rawMeta = SPORT_META[sportId] || SPORT_META.badminton;

  return {
    ...rawMeta,
    color: isDarkMode ? rawMeta.darkColor || rawMeta.color : rawMeta.color,
    accent: isDarkMode ? rawMeta.darkAccent || rawMeta.accent : rawMeta.accent,
  };
};

export const getSportColor = (sportId, isDarkMode = false) => {
  const meta = getSportMeta(sportId, isDarkMode);
  return meta.color;
};

export const getSportAccent = (sportId, isDarkMode = false) => {
  const meta = getSportMeta(sportId, isDarkMode);
  return meta.accent;
};
