import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
        const redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/dashboard';
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
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1, width: '100%' }}>
        {/* Auth Card */}
        <div className="glass-panel fade-in-up" style={{ width: '100%', maxWidth: '420px', position: 'relative', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <img 
                src="/compicode-logo.png" 
                alt="CompiCode Logo" 
                style={{ width: '60px', height: '60px', objectFit: 'contain', filter: 'drop-shadow(var(--shadow-sm))', marginBottom: '1rem' }}
              />
            </Link>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{isLogin ? 'Welcome Back' : 'Join the Arena'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{isLogin ? 'Sign in to continue to CompiCode' : 'Create your account to start competing'}</p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label style={{ color: 'var(--text-primary)' }}>Username</label>
              <input className="form-input" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" />
            </div>
            <div className="form-group">
              <label style={{ color: 'var(--text-primary)' }}>Password</label>
              <input className="form-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '0.8rem', fontSize: '1rem', fontWeight: 600 }}>{isLogin ? 'Sign In →' : 'Create Account →'}</button>
          </form>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }} style={{ color: 'var(--primary)', fontSize: '0.95rem', transition: 'color 0.2s', fontWeight: 500, textDecoration: 'none' }}>
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
