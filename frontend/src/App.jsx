import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
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

import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(token);
      axios.get(`${API_URL}/me`).then(res => {
        setUser({ username: res.data.username, id: res.data.id });
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
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Welcome, <strong style={{ color: 'var(--secondary)' }}>{user.username}</strong></span>
              <button className="btn btn-secondary" onClick={logout} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Log Out</button>
            </>
          ) : (
            <Link to="/auth" className="btn btn-primary" style={{ padding: '0.4rem 1.5rem' }}>Sign In</Link>
          )}
        </div>
      </nav>
      
      <Routes>
        <Route path="/auth" element={<AuthPage onLogin={setUser}/>} />
        <Route path="/" element={user ? <Dashboard /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/host" element={user ? <HostPanel /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/admin" element={user ? <SysAdminPanel /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/sysadmin/problemset" element={user ? <SysAdminPanel /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/contest/:linkCode" element={user ? <ContestLayout userObj={user} /> : <AuthRequired />} />
        <Route path="/solve/:contestId/:questionId" element={user ? <SolvePlatform /> : <AuthRequired />} />
      </Routes>
      <Footer />
    </Router>
  );
}


