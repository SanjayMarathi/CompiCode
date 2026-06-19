import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL, setAuthToken } from '../config';

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        const res = await axios.post(`${API_URL}/token`, formData);
        localStorage.setItem('token', res.data.access_token);
        setAuthToken(res.data.access_token);
        const meRes = await axios.get(`${API_URL}/me`);
        onLogin({ username: meRes.data.username, id: meRes.data.id, is_admin: meRes.data.is_admin });
        // Redirect to the page they were trying to reach before login
        const redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/';
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectTo);
      } else {
        await axios.post(`${API_URL}/register`, { username, password });
        setIsLogin(true);
        alert('Registered! Please sign in.');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Cannot connect to server. Make sure the backend is running.';
      alert(msg);
    }
  };

  // Decorative dots positions
  const dots = [
    { top: '8%', left: '12%' },
    { top: '15%', right: '18%' },
    { top: '35%', left: '8%' },
    { top: '50%', right: '10%' },
    { top: '72%', left: '15%' },
    { top: '80%', right: '22%' },
    { top: '25%', left: '85%' },
    { top: '60%', left: '5%' },
    { top: '45%', right: '5%' },
    { top: '90%', left: '45%' },
  ];

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Decorative vertical lines */}
      <div style={{ position: 'absolute', left: '10%', top: 0, width: '1px', height: '100%', background: 'linear-gradient(to bottom, transparent 0%, #e8e8e8 20%, #e8e8e8 80%, transparent 100%)' }}></div>
      <div style={{ position: 'absolute', left: '25%', top: 0, width: '1px', height: '100%', background: 'linear-gradient(to bottom, transparent 0%, #f0f0f0 30%, #f0f0f0 70%, transparent 100%)' }}></div>
      <div style={{ position: 'absolute', right: '15%', top: 0, width: '1px', height: '100%', background: 'linear-gradient(to bottom, transparent 0%, #e8e8e8 25%, #e8e8e8 75%, transparent 100%)' }}></div>
      <div style={{ position: 'absolute', right: '30%', top: 0, width: '1px', height: '100%', background: 'linear-gradient(to bottom, transparent 0%, #f0f0f0 15%, #f0f0f0 85%, transparent 100%)' }}></div>

      {/* Decorative diagonal lines */}
      <div style={{ position: 'absolute', top: 0, left: '5%', width: '1px', height: '140%', background: 'linear-gradient(to bottom, transparent, #ebebeb, transparent)', transform: 'rotate(15deg)', transformOrigin: 'top left' }}></div>
      <div style={{ position: 'absolute', top: 0, right: '8%', width: '1px', height: '140%', background: 'linear-gradient(to bottom, transparent, #ebebeb, transparent)', transform: 'rotate(-12deg)', transformOrigin: 'top right' }}></div>

      {/* Decorative dots */}
      {dots.map((pos, i) => (
        <div key={i} style={{ position: 'absolute', ...pos, width: '4px', height: '4px', borderRadius: '50%', background: '#7dd3c4', opacity: 0.5 }}></div>
      ))}

      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem', position: 'relative', zIndex: 1 }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '3rem', animation: 'fadeIn 0.6s ease-out' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: '1rem' }}>
              <rect x="4" y="4" width="32" height="32" rx="4" stroke="#000" strokeWidth="2" fill="none"/>
              <path d="M12 20L18 26L28 14" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '0.75rem', color: '#000', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            CompiCode Arena
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#999', lineHeight: 1.7, maxWidth: '520px', margin: '0 auto', fontWeight: 400 }}>
            A competitive programming platform with real-time multiplayer contests, automated judging, and live leaderboards.
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', marginBottom: '4rem', position: 'relative', animation: 'fadeInUp 0.5s ease-out', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.3rem', fontWeight: 600, color: '#111' }}>{isLogin ? 'Sign In' : 'Create Account'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input className="form-input" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input className="form-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontSize: '0.95rem' }}>{isLogin ? 'Sign In →' : 'Create Account →'}</button>
            </form>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }} style={{ color: '#999', fontSize: '0.9rem' }}>
                {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
              </a>
            </div>
          </div>
        </div>
        
        {/* Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '960px', animation: 'fadeIn 0.7s ease-out' }}>
          <div className="hover-lift" style={{ padding: '1.75rem', background: '#fff', border: '1px solid #eee', borderLeft: '3px solid #000', borderRadius: '8px' }}>
            <h3 style={{ color: '#000', marginBottom: '0.6rem', fontSize: '1.1rem', fontWeight: 700 }}>⚡ Sudden Death</h3>
            <p style={{ fontSize: '0.9rem', color: '#888', margin: 0, lineHeight: 1.6 }}>All players solve the same problem simultaneously. The first to pass claims the round and the lobby advances. A global timer enforces the match deadline.</p>
          </div>
          
          <div className="hover-lift" style={{ padding: '1.75rem', background: '#fff', border: '1px solid #eee', borderLeft: '3px solid #555', borderRadius: '8px' }}>
            <h3 style={{ color: '#000', marginBottom: '0.6rem', fontSize: '1.1rem', fontWeight: 700 }}>⏱ Timed Mode</h3>
            <p style={{ fontSize: '0.9rem', color: '#888', margin: 0, lineHeight: 1.6 }}>Each problem has its own countdown. Players work independently and must solve within the per-problem time limit or lose access to it.</p>
          </div>
          
          <div className="hover-lift" style={{ padding: '1.75rem', background: '#fff', border: '1px solid #eee', borderLeft: '3px solid #aaa', borderRadius: '8px' }}>
            <h3 style={{ color: '#000', marginBottom: '0.6rem', fontSize: '1.1rem', fontWeight: 700 }}>📋 Standard Mode</h3>
            <p style={{ fontSize: '0.9rem', color: '#888', margin: 0, lineHeight: 1.6 }}>Players solve all problems independently within a global time limit. Ranked by score then lowest penalty time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
