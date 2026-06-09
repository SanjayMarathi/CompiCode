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
          axios.get(`${API_URL}/user/contests/participated`)
        ]);
        setHosted(hostRes.data);
        setParticipated(partRes.data);
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

  const renderContestRow = (c) => (
    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontWeight: 600, color: '#fff', fontSize: '1.05rem', marginBottom: '0.2rem' }}>{c.title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
          Code: <span style={{ color: '#fff' }}>{c.link_code}</span> &nbsp;|&nbsp; 
          Mode: <span style={{ color: '#fff', textTransform: 'capitalize' }}>{c.mode.replace('_', ' ')}</span> &nbsp;|&nbsp; 
          Status: <span style={{ fontWeight: 600, color: c.status === 'ended' ? 'var(--danger)' : c.status === 'active' ? 'var(--success)' : '#aaa' }}>{c.status.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>
          Hosted by: <span style={{ color: 'var(--secondary)' }}>{c.host_name}</span> &nbsp;|&nbsp; 
          Date: {formatDate(c.start_time)}
        </div>
      </div>
      <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => navigate(`/contest/${c.link_code}`)}>View</button>
    </div>
  );

  return (
    <div className="container">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3rem', margin: 0 }}>Arena Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.5rem auto', lineHeight: 1.6 }}>
          Welcome to your competitive programming workspace. You can join an active contest by entering an invite code below, or take the lead and host your own custom challenge for others to participate in.
        </p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        <div className="glass-panel">
          <h3 style={{ color: 'var(--primary)' }}>Join Contest</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Enter the unique access code assigned to you by the host.</p>
          <form onSubmit={joinContest}>
            <div className="form-group">
              <input className="form-input" placeholder="8-CHAR CODE" required value={linkCode} onChange={e => setLinkCode(e.target.value)} style={{ fontSize: '1.2rem', letterSpacing: '2px', textAlign: 'center' }} />
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', padding: '0.8rem' }}>Join</button>
          </form>
        </div>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--secondary)' }}>Host Contest</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Create a custom workflow, define standard or timed limits, and invite participants.</p>
          <button className="btn btn-primary" style={{ padding: '0.8rem 2rem' }} onClick={() => navigate('/host')}>Create Contest</button>
        </div>
      </div>

      <div className="glass-panel">
        <h2 style={{ marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>Contest History</h2>
        {loading ? (
           <div className="loader" style={{ margin: '2rem auto', width: '30px', height: '30px', border: '3px solid rgba(255,123,0,0.3)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
            <div>
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '1.1rem' }}>Hosted by Me</h3>
              {hosted.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No hosted contests yet.</p> : hosted.map(renderContestRow)}
            </div>
            <div>
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '1.1rem' }}>Participated In</h3>
              {participated.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No participation history yet.</p> : participated.map(renderContestRow)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
