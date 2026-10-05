import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, NavLink } from 'react-router-dom';
import axios from 'axios';
import { API_URL, setAuthToken } from './config';

import AuthRequired from './components/AuthRequired';
import Footer from './components/Footer';
import BackgroundAnimations from './components/BackgroundAnimations';
import Icon from './components/Icon';
import Logo from './components/Logo';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import HostPanel from './pages/HostPanel';
import SysAdminPanel from './pages/SysAdminPanel';
import ContestLayout from './pages/ContestLayout';
import SolvePlatform from './pages/SolvePlatform';
import NotFound from './pages/NotFound';

export default function App() {
  const [user, setUser] = useState(null);
  // Only wait on /me when there is a saved session to restore.
  const [isInitializing, setIsInitializing] = useState(() => !!localStorage.getItem('token'));
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
      setAlertConfig({ message, title: 'Notice' });
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
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setAuthToken(null);
    setUser(null);
  };

  if (isInitializing) {
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p className="eyebrow pulse-text" style={{ marginTop: '1rem' }}>Loading</p>
      </div>
    );
  }

  return (
    <Router>
      <BackgroundAnimations />
      <nav className="navbar">
        <Link to="/" className="brand" aria-label="CompiCode home">
          <Logo />
        </Link>
        <div className="nav-links">
          {user && (
            <>
              <NavLink to="/dashboard" className="btn btn-ghost btn-sm nav-text-link" style={{ border: 'none' }}>Dashboard</NavLink>
              {user.is_admin && <NavLink to="/admin" className="btn btn-ghost btn-sm nav-text-link" style={{ border: 'none' }}>Problem Bank</NavLink>}
            </>
          )}
          <button className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <span className="ti sun-icon"><Icon name="sun" size={15} stroke={2} /></span>
            <span className="ti moon-icon"><Icon name="moon" size={15} stroke={2} /></span>
          </button>
          {user ? (
            <>
              <span className="user-chip">
                <span className="avatar">{user.username.charAt(0)}</span>
                <span className="uname">{user.username}</span>
                {user.is_admin && <span className="badge badge-solid">Admin</span>}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={logout} aria-label="Log out"><Icon name="logout" size={16} /><span className="lbl">Log out</span></button>
            </>
          ) : (
            <Link to="/auth" className="btn btn-primary btn-sm">Sign in</Link>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/" element={user ? <Dashboard user={user} /> : <LandingPage user={user} />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/auth" />} />
        <Route path="/host" element={user ? <HostPanel /> : <Navigate to="/auth" />} />
        <Route path="/admin" element={user ? (user.is_admin ? <SysAdminPanel /> : <Navigate to="/dashboard" />) : <Navigate to="/auth" />} />
        <Route path="/sysadmin/problemset" element={user ? (user.is_admin ? <SysAdminPanel /> : <Navigate to="/dashboard" />) : <Navigate to="/auth" />} />
        <Route path="/contest/:linkCode" element={user ? <ContestLayout userObj={user} /> : <AuthRequired />} />
        <Route path="/solve/:contestId/:questionId" element={user ? <SolvePlatform /> : <AuthRequired />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />

      {alertConfig && (
        <div className="modal-overlay" style={{ zIndex: 99999 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setAlertConfig(null); }}>
          <div className="modal" role="alertdialog" aria-modal="true">
            <div className="modal-head"><h3>{alertConfig.title}</h3></div>
            <div className="modal-body">{String(alertConfig.message)}</div>
            <div className="modal-foot">
              <button className="btn btn-primary btn-sm" autoFocus onClick={() => setAlertConfig(null)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </Router>
  );
}
