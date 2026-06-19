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

  const dots = [
    { top: '8%', left: '12%', delay: '0s' }, { top: '15%', right: '18%', delay: '1s' },
    { top: '35%', left: '8%', delay: '2s' }, { top: '50%', right: '10%', delay: '0.5s' },
    { top: '72%', left: '15%', delay: '1.5s' }, { top: '80%', right: '22%', delay: '3s' },
    { top: '25%', left: '85%', delay: '2.5s' }, { top: '60%', left: '5%', delay: '0.8s' },
    { top: '45%', right: '5%', delay: '1.8s' }, { top: '90%', left: '45%', delay: '3.5s' },
    { top: '20%', left: '50%', delay: '4s' }, { top: '65%', right: '30%', delay: '2.2s' },
  ];

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 60px)', overflow: 'hidden', background: 'var(--bg-color)' }}>
      {/* Animated decorative lines */}
      {[10, 25, 75, 90].map((pos, i) => (
        <div key={`vl-${i}`} style={{
          position: 'absolute',
          left: `${pos}%`,
          top: 0,
          width: '1px',
          height: '100%',
          background: `linear-gradient(to bottom, transparent 0%, var(--line-color) ${20 + i * 5}%, var(--line-color) ${80 - i * 5}%, transparent 100%)`,
          animation: `drawLine 1.5s ease-out ${i * 0.2}s both`,
        }}></div>
      ))}

      {/* Diagonal lines with animation */}
      <div style={{ position: 'absolute', top: 0, left: '5%', width: '1px', height: '140%', background: 'linear-gradient(to bottom, transparent, var(--line-color), transparent)', transform: 'rotate(15deg)', transformOrigin: 'top left', animation: 'fadeIn 2s ease-out 0.5s both' }}></div>
      <div style={{ position: 'absolute', top: 0, right: '8%', width: '1px', height: '140%', background: 'linear-gradient(to bottom, transparent, var(--line-color), transparent)', transform: 'rotate(-12deg)', transformOrigin: 'top right', animation: 'fadeIn 2s ease-out 0.8s both' }}></div>

      {/* Animated pulsing dots */}
      {dots.map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: '5px', height: '5px', borderRadius: '50%',
          background: 'var(--dot-color)',
          animation: `dotPulse 3s ease-in-out ${pos.delay} infinite`,
        }}></div>
      ))}

      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem', position: 'relative', zIndex: 1 }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="fade-in">
          <div className="float" style={{ marginBottom: '1.5rem' }}>
            <svg width="44" height="44" viewBox="0 0 40 40" fill="none">
              <rect x="4" y="4" width="32" height="32" rx="6" stroke="var(--primary)" strokeWidth="2" fill="none" />
              <path d="M12 20L18 26L28 14" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="shimmer-text" style={{ fontSize: '4rem', marginBottom: '0.75rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
            CompiCode Arena
          </h1>
          <p className="fade-in stagger-2" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: '540px', margin: '0 auto', fontWeight: 400 }}>
            A competitive programming platform with real-time multiplayer contests, automated judging, and live leaderboards.
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel fade-in-up stagger-3" style={{ width: '100%', maxWidth: '420px', marginBottom: '4rem', position: 'relative', boxShadow: 'var(--shadow-lg)' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.3rem', fontWeight: 700 }}>{isLogin ? 'Sign In' : 'Create Account'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input className="form-input" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem', fontSize: '0.95rem' }}>{isLogin ? 'Sign In →' : 'Create Account →'}</button>
          </form>
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }} style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', transition: 'color 0.2s' }}>
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </a>
          </div>
        </div>
        
        {/* Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '960px' }}>
          {[
            { icon: '⚡', title: 'Sudden Death', desc: 'All players solve the same problem simultaneously. The first to pass claims the round and the lobby advances.', delay: '0.4s' },
            { icon: '⏱', title: 'Timed Mode', desc: 'Each problem has its own countdown. Players work independently and must solve within the per-problem time limit.', delay: '0.55s' },
            { icon: '📋', title: 'Standard Mode', desc: 'Players solve all problems independently within a global time limit. Ranked by score then lowest penalty time.', delay: '0.7s' },
          ].map((card, i) => (
            <div key={i} className="glass-panel hover-lift fade-in-up" style={{ padding: '1.75rem', borderLeft: '3px solid var(--primary)', animationDelay: card.delay, cursor: 'default' }}>
              <h3 style={{ marginBottom: '0.6rem', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>{card.icon}</span> {card.title}
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
