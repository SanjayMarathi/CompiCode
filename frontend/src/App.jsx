import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL, setAuthToken } from './config';

import AuthRequired from './components/AuthRequired';
import Footer from './components/Footer';
import BackgroundAnimations from './components/BackgroundAnimations';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import HostPanel from './pages/HostPanel';
import SysAdminPanel from './pages/SysAdminPanel';
import ContestLayout from './pages/ContestLayout';
import SolvePlatform from './pages/SolvePlatform';
import NotFound from './pages/NotFound';

import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [alertConfig, setAlertConfig] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    document.body.classList.add('theme-transitioning');
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    setTimeout(() => document.body.classList.remove('theme-transitioning'), 500);
  };

  useEffect(() => {
    window.alert = (message) => {
      setAlertConfig({ message, title: 'Notification' });
    };

    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(token);
      axios.get(`${API_URL}/me`).then(res => {
        setUser({ username: res.data.username, id: res.data.id, is_admin: res.data.is_admin });
        setIsInitializing(false);
      }).catch(() => {
        localStorage.removeItem('token');
        setAuthToken(null);
        setIsInitializing(false);
      });
    } else {
      setIsInitializing(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setAuthToken(null);
    setUser(null);
  };

  if (isInitializing) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ marginBottom: '1.5rem', width: '50px', height: '50px', border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <p className="pulse-text" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <BackgroundAnimations />
      <nav className="navbar">
        <Link to="/" className="brand">Compi<span>Code</span></Link>
        <div className="nav-links">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <span className="toggle-icon sun-icon">☀️</span>
            <span className="toggle-icon moon-icon">🌙</span>
          </button>
          {user ? (
            <>
              {user.is_admin && <span className="badge" style={{ marginRight: '0.5rem' }}>Admin</span>}
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Welcome, <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong></span>
              <button className="btn btn-secondary" onClick={logout} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Log Out</button>
            </>
          ) : (
            <Link to="/auth" className="btn btn-primary" style={{ padding: '0.4rem 1.5rem' }}>Sign In</Link>
          )}
        </div>
      </nav>
      
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/" element={user ? <Dashboard /> : <LandingPage user={user} />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
        <Route path="/host" element={user ? <HostPanel /> : <Navigate to="/auth" />} />
        <Route path="/admin" element={user ? (user.is_admin ? <SysAdminPanel /> : <Navigate to="/dashboard" />) : <Navigate to="/auth" />} />
        <Route path="/sysadmin/problemset" element={user ? (user.is_admin ? <SysAdminPanel /> : <Navigate to="/dashboard" />) : <Navigate to="/auth" />} />
        <Route path="/contest/:linkCode" element={user ? <ContestLayout userObj={user} /> : <AuthRequired />} />
        <Route path="/solve/:contestId/:questionId" element={user ? <SolvePlatform /> : <AuthRequired />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />

      {alertConfig && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--overlay-bg)', backdropFilter: 'blur(8px)' }}>
          <div className="fade-in-scale" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{alertConfig.title}</h3>
            </div>
            <div style={{ padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              {alertConfig.message}
            </div>
            <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-primary" onClick={() => setAlertConfig(null)} style={{ padding: '0.4rem 1.5rem' }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </Router>
  );
}
