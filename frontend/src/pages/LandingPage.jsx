import React from 'react';
import { Link, Navigate } from 'react-router-dom';

export default function LandingPage({ user }) {
  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 1rem', overflowX: 'hidden' }}>
      <div className="container scene-3d" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '5rem', perspective: '1000px' }} className="rotate-3d-in">
          <div className="float-3d" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>
            <div className="logo-text" style={{ fontSize: '5rem' }}>CompiCode</div>
          </div>
          <p className="fade-in stagger-2" style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: '650px', margin: '0 auto 2.5rem', fontWeight: 400 }}>
            A competitive programming platform with real-time multiplayer contests, automated judging, and live leaderboards.
          </p>
          <div className="fade-in stagger-3">
            <Link to="/auth" className="btn btn-primary hover-lift" style={{ padding: '1.2rem 3.5rem', fontSize: '1.2rem', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', boxShadow: '0 10px 30px var(--primary-subtle)' }}>
              Start Coding Now →
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', width: '100%', maxWidth: '1000px', marginBottom: '6rem' }}>
          {[
            { icon: '⚡', title: 'Sudden Death', desc: 'All players solve the same problem simultaneously. The first to pass claims the round and the lobby advances.', delay: '0.2s' },
            { icon: '⏱', title: 'Timed Mode', desc: 'Each problem has its own countdown. Players work independently and must solve within the per-problem time limit.', delay: '0.4s' },
            { icon: '📋', title: 'Standard Mode', desc: 'Players solve all problems independently within a global time limit. Ranked by score then lowest penalty time.', delay: '0.6s' },
          ].map((card, i) => (
            <div key={i} className="glass-panel card-3d rotate-3d-in" style={{ padding: '2rem', borderLeft: '4px solid var(--primary)', animationDelay: card.delay, cursor: 'default' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.8rem' }}>{card.icon}</span> <span style={{ color: 'var(--text-primary)' }}>{card.title}</span>
              </h3>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>{card.desc}</p>
            </div>
          ))}
        </div>

        {/* How It Works Section */}
        <div className="scene-3d" style={{ width: '100%', maxWidth: '1000px', marginBottom: '6rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '3rem', color: 'var(--text-primary)', fontWeight: 800 }}>How It Works</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center' }}>
            {[
              { step: '1', title: 'Join a Lobby', desc: 'Host a private contest or join an existing arena with your friends.' },
              { step: '2', title: 'Write Code', desc: 'Use our built-in Monaco editor to write fast, efficient solutions.' },
              { step: '3', title: 'Climb the Ranks', desc: 'Watch the live leaderboard update as you and your opponents pass testcases.' }
            ].map((item, i) => (
              <div key={i} className="card-3d rotate-3d-in" style={{ flex: '1 1 300px', background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', animationDelay: `${i * 0.2 + 0.8}s` }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, margin: '0 auto 1.5rem' }}>{item.step}</div>
                <h4 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>{item.title}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Supported Languages */}
        <div style={{ width: '100%', maxWidth: '800px', marginBottom: '6rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '2rem', color: 'var(--text-primary)' }}>Supported Languages</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap' }}>
            {['C++', 'Python 3', 'Java'].map((lang, i) => (
              <div key={i} className="float-3d" style={{ padding: '1rem 2rem', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', animationDelay: `${i * 0.5}s` }}>
                {lang}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Footer */}
        <div className="glass-panel card-3d rotate-3d-in" style={{ width: '100%', maxWidth: '800px', padding: '4rem 2rem', textAlign: 'center', background: 'linear-gradient(135deg, var(--panel-bg) 0%, var(--primary-subtle) 100%)', border: '1px solid var(--primary)' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Ready to Prove Your Skills?</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>Join the arena today and compete against developers worldwide.</p>
          <Link to="/auth" className="btn btn-primary hover-lift" style={{ padding: '1rem 3rem', fontSize: '1.1rem', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }}>
            Create Free Account
          </Link>
        </div>

      </div>
    </div>
  );
}
