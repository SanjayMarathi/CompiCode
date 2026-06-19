import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';

export default function Dashboard() {
  const [linkCode, setLinkCode] = useState('');
  const [hosted, setHosted] = useState([]);
  const [participated, setParticipated] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const [hostRes, partRes] = await Promise.all([
          axios.get(`${API_URL}/user/contests/hosted`),
        ]);
        setHosted(hostRes.data.sort((a,b) => b.id - a.id));
        setParticipated(partRes.data.sort((a,b) => b.id - a.id));
      } catch (e) {
        console.error("Failed to load history", e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const joinContest = (e) => {
    e.preventDefault();
    if(linkCode) navigate(`/contest/${linkCode}`);
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Not Started';
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  const renderContestRow = (c, idx) => (
    <div key={c.id} className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '10px', marginBottom: '0.75rem', border: '1px solid var(--border-color)', transition: 'all 0.25s', cursor: 'pointer', animationDelay: `${idx * 0.05}s` }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.transform = 'translateX(4px)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateX(0)'; }}>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '0.3rem' }}>{c.title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
          Code: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.link_code}</span> &nbsp;|&nbsp; 
          Mode: <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize', fontWeight: 500 }}>{c.mode.replace('_', ' ')}</span> &nbsp;|&nbsp; 
          Status: <span style={{ fontWeight: 600, color: c.status === 'ended' ? 'var(--text-tertiary)' : c.status === 'active' ? 'var(--success)' : 'var(--text-secondary)' }}>{c.status.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          Hosted by: <span style={{ color: 'var(--text-secondary)' }}>{c.host_name}</span> &nbsp;|&nbsp; 
          Date: {formatDate(c.start_time)}
        </div>
      </div>
      <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => navigate(`/contest/${c.link_code}`)}>View</button>
    </div>
  );

  return (
    <div className="container">
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }} className="fade-in">
        <h1 style={{ fontSize: '2.8rem', margin: 0, fontWeight: 800, letterSpacing: '-0.03em' }}>Arena Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.75rem auto', lineHeight: 1.8, fontSize: '1rem' }}>
          Welcome to your competitive programming workspace. Join an active contest or host your own custom challenge.
        </p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
        <div className="glass-panel hover-lift fade-in-up stagger-1">
          <h3 style={{ fontWeight: 700 }}>Join Contest</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Enter the unique access code assigned to you by the host.</p>
          <form onSubmit={joinContest}>
            <div className="form-group">
              <input className="form-input" placeholder="8-CHAR CODE" required value={linkCode} onChange={e => setLinkCode(e.target.value)} style={{ fontSize: '1.2rem', letterSpacing: '3px', textAlign: 'center', padding: '0.8rem', fontWeight: 600 }} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>Join</button>
          </form>
        </div>
        <div className="glass-panel hover-lift fade-in-up stagger-2" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h3 style={{ fontWeight: 700 }}>Host Contest</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Create a custom workflow, define standard or timed limits, and invite participants.</p>
          <button className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }} onClick={() => navigate('/host')}>Create Contest</button>
        </div>
      </div>

      <div className="glass-panel fade-in-up stagger-3">
        <h2 style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', fontSize: '1.3rem' }}>Contest History</h2>
        {loading ? (
           <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
             <div style={{ width: '30px', height: '30px', border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
           </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
            <div>
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hosted by Me</h3>
              {hosted.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No hosted contests yet.</p> : hosted.map((c, i) => renderContestRow(c, i))}
            </div>
            <div>
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Participated In</h3>
              {participated.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No participation history yet.</p> : participated.map((c, i) => renderContestRow(c, i))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
