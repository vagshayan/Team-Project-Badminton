import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';

const apiBaseUrl = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.startsWith('http')
  ? process.env.REACT_APP_API_URL
  : (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:5000'
    : '');

if (apiBaseUrl) {
  axios.defaults.baseURL = apiBaseUrl;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);