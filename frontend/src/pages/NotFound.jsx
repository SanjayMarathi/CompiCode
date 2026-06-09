import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <h1 style={{ fontSize: '6rem', color: 'var(--primary)', marginBottom: '0' }}>404</h1>
      <h2 style={{ fontSize: '2rem', color: '#fff', marginBottom: '1rem' }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px' }}>
        The address you are looking for does not exist or has been removed.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/')} style={{ padding: '0.8rem 2rem', fontSize: '1.1rem' }}>
        Return Home
      </button>
    </div>
  );
}
