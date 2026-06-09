import React from 'react';

export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
      <div className="container">
        <span style={{ color: '#fff', fontWeight: 700 }}>Compi<span style={{ color: '#ff7b00' }}>Code</span></span> Arena &copy; {new Date().getFullYear()} - Competitive Programming Platform
      </div>
    </footer>
  );
}
