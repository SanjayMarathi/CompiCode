import React from 'react';

export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem', background: 'var(--bg-secondary)', transition: 'background 0.4s, border-color 0.4s' }}>
      <div className="container" style={{ animation: 'none' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>CompiCode</span> Arena &copy; {new Date().getFullYear()} — Competitive Programming Platform
      </div>
    </footer>
  );
}
