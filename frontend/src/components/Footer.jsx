import React from 'react';

export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem', background: '#fafafa' }}>
      <div className="container">
        <span style={{ color: '#000', fontWeight: 700 }}>CompiCode</span> Arena &copy; {new Date().getFullYear()} — Competitive Programming Platform
      </div>
    </footer>
  );
}
