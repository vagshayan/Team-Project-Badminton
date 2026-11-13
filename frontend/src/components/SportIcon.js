import React from 'react';

const SPORT_COLORS = {
  badminton: '#F5C542',
  'table-tennis': '#4FC7EA',
  carrom: '#EF5DA8',
};

export default function SportIcon({ sportId, accent, size = '1em', strokeWidth = 1.8, ...props }) {
  const color = accent || SPORT_COLORS[sportId] || 'currentColor';
  const line = {
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} focusable="false" aria-hidden="true" {...props}>
      {sportId === 'badminton' && (
        <g {...line}>
          <g transform="rotate(-34 20 21)">
            <ellipse cx="20" cy="21" rx="8" ry="11" />
            <path d="M15 14l10 14M25 14L15 28M20 32l-7 17m4-2 4 2" />
          </g>
          <g transform="rotate(34 44 21)">
            <ellipse cx="44" cy="21" rx="8" ry="11" />
            <path d="M39 14l10 14M49 14L39 28M44 32l7 17m-4-2-4 2" />
          </g>
          <path d="M28 8l4 10 4-10M29 9h6m-5 9h4M30 18l2 3 2-3" />
        </g>
      )}
      {sportId === 'table-tennis' && (
        <g {...line}>
          <g transform="rotate(-34 20 25)">
            <ellipse cx="20" cy="25" rx="9" ry="12" />
            <path d="M20 37v14m-3-1h6" />
          </g>
          <g transform="rotate(34 42 25)">
            <ellipse cx="42" cy="25" rx="9" ry="12" />
            <path d="M42 37v14m-3-1h6" />
          </g>
          <circle cx="49" cy="12" r="3.5" />
        </g>
      )}
      {sportId === 'carrom' && (
        <g {...line}>
          <rect x="8" y="8" width="48" height="48" rx="5" />
          <rect x="15" y="15" width="34" height="34" rx="2" />
          <circle cx="15" cy="15" r="3.5" fill="#080D15" />
          <circle cx="49" cy="15" r="3.5" fill="#080D15" />
          <circle cx="15" cy="49" r="3.5" fill="#080D15" />
          <circle cx="49" cy="49" r="3.5" fill="#080D15" />
          <circle cx="25" cy="31" r="3.2" />
          <circle cx="39" cy="33" r="3.2" />
          <circle cx="32" cy="25" r="3.4" fill="#EF4444" stroke={color} />
        </g>
      )}
    </svg>
  );
}