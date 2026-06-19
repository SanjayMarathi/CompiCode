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
    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#fafafa', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid #f0f0f0', transition: 'all 0.15s' }}>
      <div>
        <div style={{ fontWeight: 600, color: '#111', fontSize: '1.05rem', marginBottom: '0.3rem' }}>{c.title}</div>
        <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.2rem' }}>
          Code: <span style={{ color: '#333', fontWeight: 500 }}>{c.link_code}</span> &nbsp;|&nbsp; 
          Mode: <span style={{ color: '#333', textTransform: 'capitalize', fontWeight: 500 }}>{c.mode.replace('_', ' ')}</span> &nbsp;|&nbsp; 
          Status: <span style={{ fontWeight: 600, color: c.status === 'ended' ? '#999' : c.status === 'active' ? '#000' : '#aaa' }}>{c.status.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#bbb' }}>
          Hosted by: <span style={{ color: '#666' }}>{c.host_name}</span> &nbsp;|&nbsp; 
          Date: {formatDate(c.start_time)}
        </div>
      </div>
      <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => navigate(`/contest/${c.link_code}`)}>View</button>
    </div>
  );

  return (
    <div className="container">
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>Arena Dashboard</h1>
        <p style={{ color: '#999', maxWidth: '600px', margin: '0.75rem auto', lineHeight: 1.7, fontSize: '1rem' }}>
          Welcome to your competitive programming workspace. Join an active contest by entering an invite code below, or host your own custom challenge.
        </p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
        <div className="glass-panel">
          <h3 style={{ color: '#000', fontWeight: 700 }}>Join Contest</h3>
          <p style={{ color: '#999', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Enter the unique access code assigned to you by the host.</p>
          <form onSubmit={joinContest}>
            <div className="form-group">
              <input className="form-input" placeholder="8-CHAR CODE" required value={linkCode} onChange={e => setLinkCode(e.target.value)} style={{ fontSize: '1.2rem', letterSpacing: '3px', textAlign: 'center', padding: '0.8rem', fontWeight: 600 }} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>Join →</button>
          </form>
        </div>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h3 style={{ color: '#000', fontWeight: 700 }}>Host Contest</h3>
          <p style={{ color: '#999', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Create a custom workflow, define standard or timed limits, and invite participants.</p>
          <button className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }} onClick={() => navigate('/host')}>Create Contest →</button>
        </div>
      </div>

      <div className="glass-panel">
        <h2 style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', color: '#111', fontSize: '1.3rem' }}>Contest History</h2>
        {loading ? (
           <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
             <div className="loader" style={{ width: '30px', height: '30px', border: '3px solid #eee', borderTop: '3px solid #000', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
           </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
            <div>
              <h3 style={{ color: '#555', marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hosted by Me</h3>
              {hosted.length === 0 ? <p style={{ color: '#ccc', fontSize: '0.9rem' }}>No hosted contests yet.</p> : hosted.map(renderContestRow)}
            </div>
            <div>
              <h3 style={{ color: '#555', marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Participated In</h3>
              {participated.length === 0 ? <p style={{ color: '#ccc', fontSize: '0.9rem' }}>No participation history yet.</p> : participated.map(renderContestRow)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
