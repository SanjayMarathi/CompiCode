import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL, setAuthToken } from '../config';
import Icon from '../components/Icon';
import Logo from '../components/Logo';

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="center-screen" style={{ paddingTop: '4rem' }}>
      <div className="bcard fade-in-up" style={{ width: '100%', maxWidth: 440, textAlign: 'left', padding: '2.8rem 2rem 2rem' }}>
        <span className="bubble"><Icon name={isLogin ? 'key' : 'user'} size={26} /></span>
        <Link to="/" style={{ display: 'inline-block', marginBottom: '1rem' }} aria-label="CompiCode home">
          <Logo size="1.6rem" />
        </Link>
        <h2 style={{ fontSize: '1.9rem', marginBottom: '0.15rem' }}>{isLogin ? 'Welcome back' : 'Join the arena'}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>{isLogin ? 'Sign in to continue to CompiCode.' : 'Create an account to start competing.'}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" className="form-input" required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_handle" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" className="form-input" type="password" required autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: '0.5rem', padding: '0.8rem' }}>
            {submitting ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1.5px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <button type="button" className="btn btn-ghost btn-sm" style={{ border: 'none', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-body)', fontSize: '0.92rem' }} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
