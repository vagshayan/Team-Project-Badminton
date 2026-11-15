import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import homeBgDark from '../assets/home-bg-dark.jpg';
import homeBgLight from '../assets/home-bg-light1.jpg';

export default function GlobalBackground() {
  const { isDarkMode } = useTheme();
  const location = useLocation();

  // Exception: Do not apply background images to brackets and draw-related pages
  if (location.pathname === '/brackets') {
    return null;
  }

  return (
    <>
      <div
        className={`site-bg-image site-bg-image-dark ${isDarkMode ? 'active' : ''}`}
        style={{ backgroundImage: `url(${homeBgDark})` }}
      />
      <div
        className={`site-bg-image site-bg-image-light ${!isDarkMode ? 'active' : ''}`}
        style={{ backgroundImage: `url(${homeBgLight})` }}
      />
      <div className="site-bg-overlay" />
    </>
  );
}
