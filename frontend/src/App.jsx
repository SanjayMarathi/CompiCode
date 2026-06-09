import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL, setAuthToken } from './config';

import AuthRequired from './components/AuthRequired';
import Footer from './components/Footer';

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
        <div className="loader" style={{ marginBottom: '1rem', width: '50px', height: '50px', border: '5px solid rgba(255,123,0,0.3)', borderTop: '5px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <Router>
      <nav className="navbar">
        <Link to="/" className="brand">Compi<span>Code</span></Link>
        <div className="nav-links">
          {user ? (
            <>
              {user.is_admin && <span className="badge badge-yellow" style={{ marginRight: '1rem' }}>Admin</span>}
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Welcome, <strong style={{ color: 'var(--secondary)' }}>{user.username}</strong></span>
              <button className="btn btn-secondary" onClick={logout} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Log Out</button>
            </>
          ) : (
            <Link to="/auth" className="btn btn-primary" style={{ padding: '0.4rem 1.5rem' }}>Sign In</Link>
          )}
        </div>
      </nav>
      
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/" element={user ? <Dashboard /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/host" element={user ? <HostPanel /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/admin" element={user ? (user.is_admin ? <SysAdminPanel /> : <Navigate to="/dashboard" />) : <AuthPage onLogin={setUser}/>} />
        <Route path="/sysadmin/problemset" element={user ? (user.is_admin ? <SysAdminPanel /> : <Navigate to="/dashboard" />) : <AuthPage onLogin={setUser}/>} />
        <Route path="/contest/:linkCode" element={user ? <ContestLayout userObj={user} /> : <AuthRequired />} />
        <Route path="/solve/:contestId/:questionId" element={user ? <SolvePlatform /> : <AuthRequired />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />

      {alertConfig && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#1e1e1e', border: '1px solid var(--border-color)', borderRadius: '8px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden', animation: 'fadeInUp 0.2s ease-out' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,123,0,0.1)' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem' }}>{alertConfig.title}</h3>
            </div>
            <div style={{ padding: '1.5rem', color: '#fff', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {alertConfig.message}
            </div>
            <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)' }}>
              <button className="btn btn-primary" onClick={() => setAlertConfig(null)} style={{ padding: '0.4rem 1.5rem' }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </Router>
  );
}


