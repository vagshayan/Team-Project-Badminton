import React from 'react';
import { useNavigate } from 'react-router-dom';
import { House, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function HomeButton({ variant = 'header', className = '', onNavigate, style }) {
  const navigate = useNavigate();
  const isMenuItem = variant === 'menu';
  const classes = isMenuItem
    ? `app-menu-action ${className}`.trim()
    : `app-header-button app-home-button ${className}`.trim();

  return (
    <button
      type="button"
      className={classes}
      style={style}
      onClick={() => {
        navigate('/');
        onNavigate?.();
      }}
      aria-label="Home"
      title={isMenuItem ? undefined : 'Home'}
      role={isMenuItem ? 'menuitem' : undefined}
    >
      <House size={17} strokeWidth={1.8} aria-hidden="true" />
      <span>Home</span>
    </button>
  );
}

export function ThemeToggleButton({ variant = 'header', className = '', onToggle, style }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const isMenuItem = variant === 'menu';
  const Icon = isDarkMode ? Sun : Moon;
  const actionLabel = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';
  const classes = isMenuItem
    ? `app-menu-action ${className}`.trim()
    : `app-header-button app-theme-button ${className}`.trim();

  return (
    <button
      type="button"
      className={classes}
      style={style}
      onClick={() => {
        toggleTheme();
        onToggle?.();
      }}
      aria-label={actionLabel}
      aria-checked={variant === 'settings' ? isDarkMode : undefined}
      role={variant === 'settings' ? 'switch' : isMenuItem ? 'menuitem' : undefined}
      title={isMenuItem ? undefined : actionLabel}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      {isMenuItem && <span>{isDarkMode ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}