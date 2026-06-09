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
        onLogin({ username: meRes.data.username, id: meRes.data.id });
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

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', color: '#fff', fontWeight: 800 }}>
          Compi<span style={{ color: '#ff7b00' }}>Code</span> Platform
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto' }}>
          A competitive programming arena with real-time multiplayer contests, automated judging, and a live leaderboard.
        </p>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', marginBottom: '3rem', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,123,0,0.4)', boxShadow: '0 0 30px rgba(255,123,0,0.1)' }}>
        <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '100px', height: '100px', background: 'var(--primary)', filter: 'blur(50px)', opacity: 0.5, borderRadius: '50%', zIndex: 0 }}></div>
        <div style={{ position: 'absolute', bottom: '-50px', right: '-50px', width: '100px', height: '100px', background: 'var(--secondary)', filter: 'blur(50px)', opacity: 0.5, borderRadius: '50%', zIndex: 0 }}></div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>{isLogin ? 'Sign In' : 'Sign Up'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input className="form-input" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}>{isLogin ? 'Sign In' : 'Sign Up'}</button>
        </form>
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }}>
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </a>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '1000px' }}>
        <div style={{ padding: '1.5rem', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderLeft: '4px solid #ff7b00', borderRadius: '8px' }}>
          <h3 style={{ color: '#ff7b00', marginBottom: '0.5rem' }}>Sudden Death</h3>
          <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>All players solve the same problem simultaneously. The first to pass claims the round and the lobby advances. A global timer enforces the match deadline.</p>
        </div>
        
        <div style={{ padding: '1.5rem', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--secondary)', borderRadius: '8px' }}>
          <h3 style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>Timed Mode</h3>
          <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>Each problem has its own countdown. Players work independently and must solve within the per-problem time limit or lose access to it.</p>
        </div>
        
        <div style={{ padding: '1.5rem', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--primary)', borderRadius: '8px' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Standard Mode</h3>
          <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>Players solve all problems independently within a global time limit. Ranked by score then lowest penalty time.</p>
        </div>
      </div>
    </div>
  );
}
