import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <h1 className="shimmer-text" style={{ fontSize: '9rem', marginBottom: '0', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1 }}>404</h1>
      <h2 className="fade-in stagger-2" style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Page Not Found</h2>
      <p className="fade-in stagger-3" style={{ color: 'var(--text-tertiary)', marginBottom: '2rem', maxWidth: '400px', lineHeight: 1.7 }}>
        The address you are looking for does not exist or has been removed.
      </p>
      <button className="btn btn-primary fade-in stagger-4" onClick={() => navigate('/')} style={{ padding: '0.75rem 2.5rem', fontSize: '1rem' }}>
        Return Home →
      </button>
    </div>
  );
}
