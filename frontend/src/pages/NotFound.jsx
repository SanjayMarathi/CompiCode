import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <h1 style={{ fontSize: '8rem', color: '#000', marginBottom: '0', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1 }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', color: '#333', marginBottom: '1rem', fontWeight: 500 }}>Page Not Found</h2>
      <p style={{ color: '#999', marginBottom: '2rem', maxWidth: '400px', lineHeight: 1.6 }}>
        The address you are looking for does not exist or has been removed.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/')} style={{ padding: '0.75rem 2.5rem', fontSize: '1rem' }}>
        Return Home →
      </button>
    </div>
  );
}
