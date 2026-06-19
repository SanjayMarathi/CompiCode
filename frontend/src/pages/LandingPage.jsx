import React from 'react';
import { Link, Navigate } from 'react-router-dom';

export default function LandingPage({ user }) {
  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="fade-in">
          <div className="float" style={{ marginBottom: '1.5rem' }}>
            <img 
              src="/compicode-logo.png" 
              alt="CompiCode Logo" 
              style={{ width: '120px', height: '120px', objectFit: 'contain', filter: 'drop-shadow(var(--shadow-md))' }}
            />
          </div>
          <h1 className="shimmer-text" style={{ fontSize: '4.5rem', marginBottom: '0.75rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
            CompiCode Arena
          </h1>
          <p className="fade-in stagger-2" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: '600px', margin: '0 auto', fontWeight: 400 }}>
            A competitive programming platform with real-time multiplayer contests, automated judging, and live leaderboards.
          </p>
          <div className="fade-in stagger-3" style={{ marginTop: '2.5rem' }}>
            <Link to="/auth" className="btn btn-primary hover-lift" style={{ padding: '1rem 3rem', fontSize: '1.1rem', borderRadius: '8px', textDecoration: 'none' }}>
              Start Coding →
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '960px', marginTop: '2rem' }}>
          {[
            { icon: '⚡', title: 'Sudden Death', desc: 'All players solve the same problem simultaneously. The first to pass claims the round and the lobby advances.', delay: '0.4s' },
            { icon: '⏱', title: 'Timed Mode', desc: 'Each problem has its own countdown. Players work independently and must solve within the per-problem time limit.', delay: '0.55s' },
            { icon: '📋', title: 'Standard Mode', desc: 'Players solve all problems independently within a global time limit. Ranked by score then lowest penalty time.', delay: '0.7s' },
          ].map((card, i) => (
            <div key={i} className="glass-panel hover-lift fade-in-up" style={{ padding: '1.75rem', borderLeft: '3px solid var(--primary)', animationDelay: card.delay, cursor: 'default' }}>
              <h3 style={{ marginBottom: '0.6rem', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>{card.icon}</span> <span style={{ color: 'var(--text-primary)' }}>{card.title}</span>
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
