import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="center-screen">
      <div className="display-stack" style={{ alignItems: 'center' }}>
        <span className="d-num" style={{ fontSize: 'clamp(7rem, 24vw, 15rem)' }}>404</span>
        <span className="d-mid" style={{ margin: '0.1em 0 0' }}>Page not found</span>
      </div>
      <p className="muted" style={{ maxWidth: 400, margin: '1.25rem 0 1.5rem' }}>
        The address you are looking for does not exist or has been removed.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>Return home</button>
    </div>
  );
}
