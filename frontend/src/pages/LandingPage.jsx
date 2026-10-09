import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { MODE_META } from '../config';

const MODES = [
  { key: 'sudden_death', side: 'left', filled: false, points: ['Everyone is on the same problem', 'First to pass every test claims the round', 'The whole lobby advances together'] },
  { key: 'timed', side: 'right', filled: true, points: ['Every problem has its own countdown', 'When it hits zero, that problem locks', 'Rewards speed and decisiveness'] },
  { key: 'standard', side: 'left', filled: false, points: ['Solve all problems at your own pace', 'One global time limit for the contest', 'Wrong answers cost points'] },
];

const STEPS = [
  { title: 'Join a lobby', desc: 'Host a private contest or jump into one with an access code.' },
  { title: 'Write code', desc: 'A full Monaco editor with C++, Python and Java support.' },
  { title: 'Climb the ranks', desc: 'Standings update live as you and your rivals pass testcases.' },
];

export default function LandingPage({ user }) {
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="container" style={{ paddingTop: '3rem' }}>
      {/* Hero */}
      <section className="hero-grid fade-in-up" style={{ marginBottom: '6.5rem' }}>
        <div>
          <div className="display-stack">
            <span className="d-num">3</span>
            <span className="d-mid">Ways to</span>
            <span className="d-xl">Compete</span>
          </div>
          <p className="muted" style={{ fontSize: '1.1rem', lineHeight: 1.7, maxWidth: 520, margin: '1.75rem 0 2rem' }}>
            A competitive programming arena with real-time multiplayer contests, automated judging and live standings.
          </p>
          <div className="flex" style={{ flexWrap: 'wrap' }}>
            <Link to="/auth" className="btn btn-primary btn-lg">Start coding <Icon name="arrow-right" size={20} /></Link>
            <a href="#modes" className="btn btn-secondary btn-lg">See the modes</a>
          </div>
        </div>

        <div className="bcard" style={{ marginTop: '1.5rem' }}>
          <span className="bubble"><Icon name="trophy" size={26} /></span>
          <h3 className="bcard-title">Built for the arena</h3>
          <ul className="bcard-list">
            <li>Real-time leaderboards over WebSockets</li>
            <li>Sandboxed judge for C++, Python and Java</li>
            <li>Private contests with host approval</li>
            <li>Hidden testcases and per-problem points</li>
          </ul>
        </div>
      </section>

      {/* Modes timeline */}
      <section id="modes" style={{ marginBottom: '6rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span className="eyebrow">Pick your format</span>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', marginTop: '0.4rem' }}>Three contest modes</h2>
        </div>
        <div className="zz">
          {MODES.map((m, i) => {
            const meta = MODE_META[m.key];
            return (
              <div key={m.key} className={`zz-item ${m.side} fade-in-up`} style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
                <span className="node" />
                <div className={`bcard ${m.filled ? 'is-filled' : ''} ${m.side === 'right' ? 'bubble-left' : ''}`}>
                  <span className="bubble"><Icon name={meta.icon} size={26} /></span>
                  <h3 className="bcard-title">{meta.label}</h3>
                  <ul className="bcard-list">{m.points.map(p => <li key={p}>{p}</li>)}</ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section style={{ marginBottom: '6rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="eyebrow">From zero to ranked</span>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', marginTop: '0.4rem' }}>How it works</h2>
        </div>
        <div className="grid grid-3" style={{ gap: '2.5rem 1.5rem' }}>
          {STEPS.map((s, i) => (
            <div key={s.title} className="bcard bcard-sm fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="bubble step-num">{i + 1}</span>
              <h3 className="bcard-title" style={{ fontSize: '1.15rem' }}>{s.title}</h3>
              <p className="bcard-text">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <div className="bcard is-filled bubble-left" style={{ textAlign: 'center', padding: '3rem 2rem 2.4rem' }}>
          <span className="bubble"><Icon name="code" size={26} /></span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 2.6rem)' }}>Ready to prove your skills?</h2>
          <p className="bcard-text" style={{ margin: '0 0 1.75rem' }}>C++ · Python 3 · Java — create a free account and enter the arena.</p>
          <Link to="/auth" className="btn btn-primary btn-lg">Create free account</Link>
        </div>
      </section>
    </div>
  );
}
