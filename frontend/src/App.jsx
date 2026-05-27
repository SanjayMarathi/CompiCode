import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';

const normalizeUrl = (url) => (url || '').replace(/\/+$/, '');
const configuredApiUrl = normalizeUrl(import.meta.env.VITE_API_URL);
const configuredWsUrl = normalizeUrl(import.meta.env.VITE_WS_URL);
const devApiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const defaultApiUrl = import.meta.env.DEV ? `http://${devApiHost}:8000` : '';
const API_URL = configuredApiUrl || defaultApiUrl;
const deriveWsUrlFromApi = (apiUrl) => {
  if (!apiUrl) {
    return window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`;
  }
  if (apiUrl.startsWith('https://')) return `wss://${apiUrl.slice(8)}`;
  if (apiUrl.startsWith('http://')) return `ws://${apiUrl.slice(7)}`;
  return apiUrl;
};
const WS_URL = configuredWsUrl || deriveWsUrlFromApi(API_URL);

const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

const boilerplates = {
  python: '',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n\t// your code goes here\n\n}',
  java: 'import java.util.*;\nimport java.lang.*;\nimport java.io.*;\n\nclass Codechef\n{\n\tpublic static void main (String[] args) throws java.lang.Exception\n\t{\n\t\t// your code goes here\n\n\t}\n}'
};

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

/**
 * Display penalty value without showing "-0" when penalty is 0.
 * Returns the formatted string like "0", "-5", "-10" etc.
 */
const formatPenalty = (val) => {
  const num = Number(val) || 0;
  if (num === 0) return '0';
  return `-${num}`;
};

// Redirects unauthenticated users to login, saving the current path for redirect-back
function AuthRequired() {
  const navigate = useNavigate();
  useEffect(() => {
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    navigate('/auth');
  }, []);
  return null;
}

function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        const res = await axios.post(`${API_URL}/token`, formData);
        localStorage.setItem('token', res.data.access_token);
        setAuthToken(res.data.access_token);
        const meRes = await axios.get(`${API_URL}/me`);
        onLogin({ username: meRes.data.username, id: meRes.data.id });
        // Redirect to the page they were trying to reach before login
        const redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/';
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectTo);
      } else {
        await axios.post(`${API_URL}/register`, { username, password });
        setIsLogin(true);
        alert('Registered! Please sign in.');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Cannot connect to server. Make sure the backend is running.';
      alert(msg);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', color: '#fff', fontWeight: 800 }}>
          Compi<span style={{ color: '#ff7b00' }}>Code</span> Platform
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto' }}>
          A competitive programming arena with real-time multiplayer contests, automated judging, and a live leaderboard.
        </p>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', marginBottom: '3rem', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,123,0,0.4)', boxShadow: '0 0 30px rgba(255,123,0,0.1)' }}>
        <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '100px', height: '100px', background: 'var(--primary)', filter: 'blur(50px)', opacity: 0.5, borderRadius: '50%', zIndex: 0 }}></div>
        <div style={{ position: 'absolute', bottom: '-50px', right: '-50px', width: '100px', height: '100px', background: 'var(--secondary)', filter: 'blur(50px)', opacity: 0.5, borderRadius: '50%', zIndex: 0 }}></div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>{isLogin ? 'Sign In' : 'Sign Up'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input className="form-input" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}>{isLogin ? 'Sign In' : 'Sign Up'}</button>
        </form>
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }}>
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </a>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '1000px' }}>
        <div style={{ padding: '1.5rem', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderLeft: '4px solid #ff7b00', borderRadius: '8px' }}>
          <h3 style={{ color: '#ff7b00', marginBottom: '0.5rem' }}>Sudden Death</h3>
          <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>All players solve the same problem simultaneously. The first to pass claims the round and the lobby advances. A global timer enforces the match deadline.</p>
        </div>
        
        <div style={{ padding: '1.5rem', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--secondary)', borderRadius: '8px' }}>
          <h3 style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>Timed Mode</h3>
          <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>Each problem has its own countdown. Players work independently and must solve within the per-problem time limit or lose access to it.</p>
        </div>
        
        <div style={{ padding: '1.5rem', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--primary)', borderRadius: '8px' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Standard Mode</h3>
          <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>Players solve all problems independently within a global time limit. Ranked by score then lowest penalty time.</p>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
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

  const renderContestRow = (c) => (
    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '0.5rem' }}>
      <div>
        <div style={{ fontWeight: 600, color: '#fff' }}>{c.title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Code: {c.link_code} &nbsp;|&nbsp; Mode: {c.mode} &nbsp;|&nbsp; <span style={{color: c.status === 'ended' ? 'var(--danger)' : c.status === 'active' ? 'var(--success)' : '#aaa'}}>{c.status.toUpperCase()}</span></div>
      </div>
      <button className="btn btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => navigate(`/contest/${c.link_code}`)}>View</button>
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

function HostPanel() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [mode, setMode] = useState('standard');
  const [penalty, setPenalty] = useState(5);
  const [overallLimit, setOverallLimit] = useState(60);
  const [contestQuestions, setContestQuestions] = useState([]);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankProblems, setBankProblems] = useState([]);
  const [selectedBankIds, setSelectedBankIds] = useState(new Set());
  const [editingIdx, setEditingIdx] = useState(null);

  const emptyProblem = () => ({ title: '', description: '', points: 10, time_limit: 300, test_cases: [{ input_data: '', expected_output: '' }, { input_data: '', expected_output: '' }] });
  const [draft, setDraft] = useState(emptyProblem());

  const openNew = () => { setDraft(emptyProblem()); setEditingIdx(null); setShowProblemForm(true); };
  const openEdit = (idx) => { setDraft({ ...contestQuestions[idx], test_cases: contestQuestions[idx].test_cases.map(t => ({...t})) }); setEditingIdx(idx); setShowProblemForm(true); };

  const openBank = async () => {
    try {
      const res = await axios.get(`${API_URL}/questions`);
      setBankProblems(res.data);
    } catch {}
    setSelectedBankIds(new Set());
    setShowBankModal(true);
  };

  const toggleBankSelect = (id) => {
    setSelectedBankIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    // Filter out problems already in contest
    const addable = bankProblems.filter(p => !contestQuestions.find(q => q.bankId === p.id));
    if (selectedBankIds.size === addable.length && addable.length > 0) {
      setSelectedBankIds(new Set());
    } else {
      setSelectedBankIds(new Set(addable.map(p => p.id)));
    }
  };

  const addSelectedFromBank = async () => {
    const toAdd = bankProblems.filter(p => selectedBankIds.has(p.id) && !contestQuestions.find(q => q.bankId === p.id));
    if (toAdd.length === 0) return;
    
    const newQuestions = [...contestQuestions];
    for (const p of toAdd) {
      try {
        const res = await axios.get(`${API_URL}/questions/${p.id}`);
        const tcs = res.data.test_cases.map(t => ({ input_data: t.input, expected_output: t.expected }));
        newQuestions.push({ bankId: p.id, title: p.title, description: p.description, points: 10, time_limit: 300, fromBank: true, test_cases: tcs });
      } catch {
        // skip failed fetches
      }
    }
    setContestQuestions(newQuestions);
    setShowBankModal(false);
    setSelectedBankIds(new Set());
  };

  const addFromBank = async (p) => {
    if (contestQuestions.find(q => q.bankId === p.id)) return alert('Already added');
    
    // Fetch test cases to avoid rendering crash and populate editor
    try {
      const res = await axios.get(`${API_URL}/questions/${p.id}`);
      const tcs = res.data.test_cases.map(t => ({ input_data: t.input, expected_output: t.expected }));
      setContestQuestions([...contestQuestions, { bankId: p.id, title: p.title, description: p.description, points: 10, time_limit: 300, fromBank: true, test_cases: tcs }]);
      setShowBankModal(false);
    } catch {
      alert("Failed to pull full question data from bank.");
    }
  };

  const saveProblem = (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return alert('Problem title required');
    if (!draft.description.trim()) return alert('Problem description required');
    if (draft.test_cases.length < 2) return alert('At least 2 test cases required');
    for (let tc of draft.test_cases) {
      if (!tc.expected_output.trim()) return alert('All test cases must have expected output');
    }
    if (editingIdx !== null) {
      const n = [...contestQuestions]; n[editingIdx] = draft; setContestQuestions(n);
    } else {
      setContestQuestions([...contestQuestions, draft]);
    }
    setShowProblemForm(false);
  };

  const removeProblem = (idx) => { const n = [...contestQuestions]; n.splice(idx, 1); setContestQuestions(n); };

  const updateTC = (i, field, val) => {
    const tcs = draft.test_cases.map((t, ti) => ti === i ? { ...t, [field]: val } : t);
    setDraft({ ...draft, test_cases: tcs });
  };

  const deployContest = async () => {
    if (!title.trim()) return alert('Contest title is required');
    if (contestQuestions.length === 0) return alert('Add at least 1 problem');
    if (parseInt(overallLimit) < 1) return alert('Time limit must be at least 1 minute');
    try {
      const finalSelection = [];
      for (let q of contestQuestions) {
        if (q.fromBank && q.bankId) {
          // Use existing bank question directly — no re-upload
          finalSelection.push({ question_id: q.bankId, points: parseInt(q.points), time_limit: parseInt(q.time_limit) });
        } else {
          const resQ = await axios.post(`${API_URL}/questions`, {
            title: q.title, description: q.description, is_global: false, test_cases: q.test_cases
          });
          finalSelection.push({ question_id: resQ.data.id, points: parseInt(q.points), time_limit: parseInt(q.time_limit) });
        }
      }
      const res = await axios.post(`${API_URL}/contests`, {
        title, description: desc, mode,
        penalty_per_wrong_answer: parseInt(penalty),
        overall_time_limit: parseInt(overallLimit),
        selected_questions: finalSelection
      });
      navigate(`/contest/${res.data.link_code}`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create contest. Is the server running?');
    }
  };

  const MODE_INFO = {
    standard: { label: 'Standard', color: 'var(--primary)', desc: 'Players solve all problems independently. Ranked by total score, then by lowest penalty.' },
    sudden_death: { label: 'Sudden Death', color: '#ff7b00', desc: 'Everyone solves the same problem simultaneously. First to pass advances the lobby to the next round.' },
    timed: { label: 'Timed Mode', color: 'var(--secondary)', desc: 'Each problem has its own countdown. Once time runs out on a problem, it locks for that player.' },
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>&larr; Dashboard</button>
        <h2 style={{ margin: 0 }}>Create Contest</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start', gap: '1.5rem' }}>

        {/* Left: Settings */}
        <div>
          <div className="glass-panel">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Contest Configuration</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              Configure the rules and environment for your upcoming contest. Choose a game mode that fits your audience and adjust the difficulty through time limits and penalties.
            </p>
            <div className="form-group">
              <label>Contest Title</label>
              <input className="form-input" required placeholder="e.g. Weekly Round #12" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea className="form-input" rows="2" placeholder="Brief description..." value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Mode</label>
              <select className="form-input" value={mode} onChange={e => setMode(e.target.value)}>
                <option value="standard">Standard</option>
                <option value="sudden_death">Sudden Death</option>
                <option value="timed">Timed Mode</option>
              </select>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderLeft: `3px solid ${MODE_INFO[mode].color}`, borderRadius: '4px', marginBottom: '1rem' }}>
              <p style={{ color: MODE_INFO[mode].color, fontWeight: 600, margin: '0 0 0.25rem' }}>{MODE_INFO[mode].label}</p>
              <p style={{ color: '#aaa', fontSize: '0.85rem', margin: 0 }}>{MODE_INFO[mode].desc}</p>
            </div>
            <div className="form-group">
              <label>Overall Time Limit (minutes)</label>
              <input type="number" min="1" max="480" className="form-input" value={overallLimit} onChange={e => setOverallLimit(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Wrong Answer Penalty (points)</label>
              <input type="number" min="0" className="form-input" value={penalty} onChange={e => setPenalty(e.target.value)} />
            </div>
            <button onClick={deployContest} className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}>Create Contest</button>
          </div>
        </div>

        {/* Right: Problems */}
        <div>
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Problems ({contestQuestions.length})</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={openBank} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Problems</button>
                <button className="btn btn-secondary" onClick={openNew} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>+ New</button>
              </div>
            </div>

            {contestQuestions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <p>No problems added yet.</p>
                <p style={{ fontSize: '0.85rem' }}>Click "+ Add Problem" to create your first problem.</p>
              </div>
            )}

            {contestQuestions.map((q, idx) => (
              <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', padding: '1rem', marginBottom: '0.75rem', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>{idx + 1}. {q.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {q.points} pts &nbsp;|&nbsp; {q.test_cases.length} test cases
                      {mode === 'timed' && ` | ${q.time_limit}s limit`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openEdit(idx)}>Edit</button>
                    <button className="btn btn-danger" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => removeProblem(idx)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bank Modal with Select All */}
      {showBankModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e1e1e', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Problem Bank</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {bankProblems.filter(p => !contestQuestions.find(q => q.bankId === p.id)).length > 0 && (
                  <>
                    <button className="btn btn-secondary" onClick={toggleSelectAll} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                      {selectedBankIds.size === bankProblems.filter(p => !contestQuestions.find(q => q.bankId === p.id)).length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedBankIds.size > 0 && (
                      <button className="btn btn-primary" onClick={addSelectedFromBank} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                        Add Selected ({selectedBankIds.size})
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {bankProblems.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No problems available. Go to Problems UI to add some.</p>
              ) : bankProblems.map(p => {
                const alreadyAdded = contestQuestions.find(q => q.bankId === p.id);
                const isSelected = selectedBankIds.has(p.id);
                return (
                  <div key={p.id} onClick={() => { if(!alreadyAdded) toggleBankSelect(p.id); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: isSelected ? 'rgba(255,123,0,0.08)' : 'transparent', borderRadius: '4px', transition: 'background 0.15s', cursor: alreadyAdded ? 'default' : 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                      {!alreadyAdded && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleBankSelect(p.id)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)', flexShrink: 0 }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{p.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description?.slice(0, 80)}...</div>
                      </div>
                    </div>
                    {alreadyAdded ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem' }}>✓ Added</span>
                    ) : (
                      <button className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', flexShrink: 0, marginLeft: '0.5rem' }} onClick={() => addFromBank(p)}>Add</button>
                    )}
                  </div>
                );
              })}
            </div>
            <button className="btn btn-secondary" onClick={() => setShowBankModal(false)} style={{ marginTop: '1rem' }}>Close</button>
          </div>
        </div>
      )}

      {/* Problem Form Modal */}
      {showProblemForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e1e1e', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{editingIdx !== null ? 'Edit Problem' : 'New Problem'}</h3>
            <form onSubmit={saveProblem}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '1.1rem', color: '#fff' }}>Problem Title</label>
                <input required className="form-input" placeholder="e.g. Two Sum" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} style={{ padding: '0.8rem', fontSize: '1rem' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '1.1rem', color: '#fff' }}>Problem Statement</label>
                <textarea required className="form-input" rows="5" placeholder="Describe the problem. Include input/output format and constraints." value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} style={{ padding: '0.8rem', fontFamily: 'inherit', fontSize: '0.95rem' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Points</label>
                  <input type="number" min="1" className="form-input" value={draft.points} onChange={e => setDraft({ ...draft, points: parseInt(e.target.value) })} />
                </div>
                {mode === 'timed' && (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Time Limit (seconds)</label>
                    <input type="number" min="30" className="form-input" value={draft.time_limit} onChange={e => setDraft({ ...draft, time_limit: parseInt(e.target.value) })} />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ color: 'var(--text-secondary)' }}>Test Cases (min 2)</label>
                  <button type="button" className="btn btn-secondary" onClick={() => setDraft({ ...draft, test_cases: [...draft.test_cases, { input_data: '', expected_output: '' }] })} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>+ Row</button>
                </div>
                {draft.test_cases.map((tc, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: '#666', fontSize: '0.8rem', minWidth: '20px' }}>{i + 1}.</span>
                    <input className="form-input" placeholder="Input (empty if none)" value={tc.input_data} onChange={e => updateTC(i, 'input_data', e.target.value)} style={{ flex: 1 }} />
                    <input required className="form-input" placeholder="Expected output" value={tc.expected_output} onChange={e => updateTC(i, 'expected_output', e.target.value)} style={{ flex: 1 }} />
                    {i >= 2 && <button type="button" className="btn btn-danger" onClick={() => setDraft({ ...draft, test_cases: draft.test_cases.filter((_, ti) => ti !== i) })} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>X</button>}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProblemForm(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Save Problem</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SysAdminPanel() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newQTitle, setNewQTitle] = useState('');
  const [newQDesc, setNewQDesc] = useState('');
  const [testCases, setTestCases] = useState([
    { input_data: '', expected_output: '' },
    { input_data: '', expected_output: '' }
  ]);
  const [saving, setSaving] = useState(false);

  const loadProblems = async () => {
    try {
      const res = await axios.get(`${API_URL}/questions`);
      setProblems(res.data);
    } catch {}
  };

  useEffect(() => { loadProblems(); }, []);

  const openNew = () => {
    setEditId(null);
    setNewQTitle(''); setNewQDesc('');
    setTestCases([{ input_data: '', expected_output: '' }, { input_data: '', expected_output: '' }]);
    setShowForm(true);
  };

  const openAppEdit = async (p) => {
    try {
      const res = await axios.get(`${API_URL}/questions/${p.id}`);
      setEditId(p.id);
      setNewQTitle(res.data.title);
      setNewQDesc(res.data.description);
      setTestCases(res.data.test_cases.map(tc => ({ input_data: tc.input, expected_output: tc.expected })));
      setShowForm(true);
    } catch {
      alert("Failed to load question details");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (testCases.length < 2) return alert('Must have at least 2 test cases.');
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`${API_URL}/questions/${editId}`, { title: newQTitle, description: newQDesc, is_global: true, test_cases: testCases });
      } else {
        await axios.post(`${API_URL}/questions`, { title: newQTitle, description: newQDesc, is_global: true, test_cases: testCases });
      }
      setShowForm(false);
      loadProblems();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save.');
    } finally { setSaving(false); }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>&larr; Dashboard</button>
          <div>
            <h2 style={{ margin: 0 }}>Global Problem Bank</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0', maxWidth: '700px', lineHeight: 1.5 }}>
              Manage the official repository of coding challenges. Problems added here will be available to all contest hosts when they are creating their own custom contests.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ padding: '0.5rem 1.25rem' }}>+ New Problem</button>
      </div>

      <div className="glass-panel">
        {problems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <p>No problems in the bank yet.</p>
            <button className="btn btn-primary" onClick={openNew} style={{ marginTop: '1rem' }}>Add Your First Problem</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>#</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Title</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Description</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.8rem 1rem', color: '#666', fontSize: '0.85rem' }}>{i + 1}</td>
                  <td style={{ padding: '0.8rem 1rem', color: '#fff', fontWeight: 600 }}>{p.title}</td>
                  <td style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</td>
                  <td style={{ padding: '0.8rem 1rem' }}><button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openAppEdit(p)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e1e1e', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Add Problem to UI</h3>
            <form onSubmit={handleSave}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '1.1rem', color: '#fff' }}>Problem Title</label>
                <input required className="form-input" placeholder="e.g. Reverse a Linked List" value={newQTitle} onChange={e => setNewQTitle(e.target.value)} style={{ padding: '0.8rem', fontSize: '1rem' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '1.1rem', color: '#fff' }}>Problem Statement</label>
                <textarea required className="form-input" rows="5" placeholder="Full problem description including input/output format and constraints..." value={newQDesc} onChange={e => setNewQDesc(e.target.value)} style={{ padding: '0.8rem', fontFamily: 'inherit', fontSize: '0.95rem' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: 'var(--text-secondary)' }}>Test Cases (min 2)</label>
                <button type="button" className="btn btn-secondary" onClick={() => setTestCases([...testCases, { input_data: '', expected_output: '' }])} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>+ Row</button>
              </div>
              {testCases.map((tc, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: '#666', fontSize: '0.8rem', minWidth: '18px' }}>{idx + 1}.</span>
                  <input className="form-input" placeholder="Input (empty if none)" value={tc.input_data} onChange={e => { const n = [...testCases]; n[idx].input_data = e.target.value; setTestCases(n); }} style={{ flex: 1 }} />
                  <input required className="form-input" placeholder="Expected output" value={tc.expected_output} onChange={e => { const n = [...testCases]; n[idx].expected_output = e.target.value; setTestCases(n); }} style={{ flex: 1 }} />
                  {idx >= 2 && <button type="button" className="btn btn-danger" onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>X</button>}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>{saving ? 'Saving...' : 'Save to UI'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ContestLayout({ userObj }) {
  const { linkCode } = useParams();
  const [contest, setContest] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [contestStarted, setContestStarted] = useState(false);
  const [solvedIds, setSolvedIds] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const navigate = useNavigate();

  const copyInviteLink = () => {
    const fullUrl = `${window.location.origin}/contest/${linkCode}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  useEffect(() => {
    const fetchContest = async () => {
      try {
        const res = await axios.get(`${API_URL}/contests/${linkCode}`);
        setContest(res.data);
        if (res.data.status === 'active') setContestStarted(true);
        await axios.post(`${API_URL}/contests/${res.data.id}/join`).catch(() => {});
        fetchLeaderboard(res.data.id);
        fetchMySolved(res.data.id);
      } catch {
        alert('Contest not found');
      }
    };
    fetchContest();
  }, [linkCode]);

  useEffect(() => {
    if (!contest || contestStarted || contest.mode === 'sudden_death') return;
    const isHost = userObj && userObj.id !== undefined && userObj.id === contest.host_id;
    if (isHost) return;
    const interval = setInterval(() => {
      axios.get(`${API_URL}/contests/${linkCode}`).then(res => {
        setContest(res.data);
        if (res.data.status === 'active') setContestStarted(true);
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [contest, contestStarted, linkCode, userObj]);

  // Auto-refresh leaderboard every 3s
  useEffect(() => {
    if (!contest) return;
    const interval = setInterval(() => {
      fetchLeaderboard(contest.id);
      fetchMySolved(contest.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [contest]);

  // Global contest timer (for standard and timed modes overall)
  useEffect(() => {
    if (contest && contestStarted && (contest.mode === 'standard' || contest.mode === 'timed')) {
      let start;
      if (contest.server_elapsed_seconds !== undefined && contest.server_elapsed_seconds !== null) {
        start = Date.now() - (contest.server_elapsed_seconds * 1000);
      } else if (contest.start_time) {
        start = new Date(contest.start_time + 'Z').getTime();
      } else {
        const lsKey = `contest_${contest.id}_start`;
        if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, Date.now().toString());
        start = parseInt(localStorage.getItem(lsKey));
      }
      
      const updateTimer = () => {
        const currentElapsed = Math.floor((Date.now() - start) / 1000);
        setElapsedSeconds(currentElapsed);
        if (contest.overall_time_limit && currentElapsed >= contest.overall_time_limit * 60) {
           setContest(prev => ({ ...prev, status: 'ended' }));
           setContestStarted(false);
        }
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [contest, contestStarted]);

  const fetchLeaderboard = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/contests/${id}/leaderboard`);
      setLeaderboard(res.data);
    } catch {}
  };

  const fetchMySolved = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/contests/${id}/my-solved`);
      setSolvedIds(res.data.solved_question_ids || []);
    } catch {}
  };

  const handleHostStart = async () => {
    try {
      await axios.post(`${API_URL}/contests/${contest.id}/start`);
      if (contest.mode === 'sudden_death') {
        navigate(`/solve/${contest.id}/sudden-death`);
      } else {
        setContestStarted(true);
        await axios.post(`${API_URL}/contests/${contest.id}/open`);
      }
    } catch (err) {
      alert('Failed to start contest');
    }
  };

  const startStandard = async () => {
    try {
      await axios.post(`${API_URL}/contests/${contest.id}/open`);
      setContestStarted(true);
      setContest(prev => ({ ...prev, status: 'active' }));
    } catch(e) { alert('Failed to open contest'); }
  };

  const endContest = async () => {
    if (!window.confirm("Are you sure you want to end this contest for everyone?")) return;
    try {
      await axios.post(`${API_URL}/contests/${contest.id}/end`);
      setContestStarted(false);
      setContest(prev => ({ ...prev, status: 'ended' }));
    } catch(e) { alert('Failed to end contest'); }
  };

  const handleParticipantEnter = () => {
    if (contest.mode === 'sudden_death') {
      navigate(`/solve/${contest.id}/sudden-death`);
    } else {
      // For standard/timed, just wait for status to become active
    }
  };

  if (!contest) return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="loader" style={{ marginBottom: '1rem', width: '50px', height: '50px', border: '5px solid rgba(255,123,0,0.3)', borderTop: '5px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <h2 className="pulse-text" style={{ color: 'var(--primary)' }}>Entering Arena...</h2>
    </div>
  );

  const MODE_META = {
    standard: { label: 'Standard', color: 'var(--primary)', desc: 'Solve all problems independently. Ranked by score then lowest penalty.' },
    sudden_death: { label: 'Sudden Death', color: '#ff7b00', desc: 'Everyone solves the same problem. First to pass claims the round; lobby advances together.' },
    timed: { label: 'Timed Mode', color: 'var(--secondary)', desc: 'Each problem has its own countdown. Once it expires that problem locks for you permanently.' },
  };
  const meta = MODE_META[contest.mode] || MODE_META.standard;

  const isHost = userObj && userObj.id !== undefined && userObj.id === contest.host_id;

  if (contest.status === 'ended') {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '4rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px solid var(--danger)', marginTop: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '2.5rem', marginBottom: '1rem' }}>Contest Ended</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '2rem' }}>This contest has been terminated by the host. The final standings are locked.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.75rem 2rem' }}>Return to Dashboard</button>
        </div>
        <div className="glass-panel" style={{ width: '100%' }}>
          <h3 style={{ marginBottom: '1rem' }}>Final Standings</h3>
          <CodeforcesStandings leaderboard={leaderboard} questions={contest.questions} />
        </div>
      </div>
    );
  }

  // Show lobby waiting screen before contest is started
  if (!contestStarted) {
    return (
      <div className="container">
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>{contest.title} <span className="badge badge-yellow" style={{ marginLeft: '1rem' }}>{meta.label}</span></h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Access Code: <strong style={{ color: '#fff', cursor: 'pointer', background: '#333', padding: '0.2rem 0.5rem', borderRadius: '4px', letterSpacing: '2px' }} onClick={() => navigator.clipboard.writeText(linkCode)} title="Click to copy">{linkCode}</strong>
              </p>
              <button className="btn btn-primary" onClick={copyInviteLink} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', background: linkCopied ? 'var(--success)' : 'var(--primary)', transition: 'background 0.2s' }}>
                {linkCopied ? '✓ Link Copied!' : '📋 Copy Invite Link'}
              </button>
            </div>
          </div>
          {isHost && <span style={{ fontSize: '0.8rem', background: 'rgba(255,123,0,0.15)', color: '#ff7b00', border: '1px solid #ff7b00', padding: '0.25rem 0.75rem', borderRadius: '4px' }}>HOST</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2.5rem 2rem' }}>
            <div style={{ borderLeft: `4px solid ${meta.color}`, paddingLeft: '1rem', marginBottom: '2rem' }}>
              <h2 style={{ color: meta.color, margin: '0 0 0.5rem' }}>{meta.label}</h2>
              <p style={{ color: '#aaa', margin: 0 }}>{meta.desc}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{contest.questions.length}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Problems</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{contest.overall_time_limit}m</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Time Limit</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{formatPenalty(contest.penalty_per_wrong_answer)}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>WA Penalty</div>
              </div>
            </div>

            {isHost ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>Share the invite link with participants, then start the contest when everyone is ready.</p>
                <button className="btn btn-danger" onClick={handleHostStart} style={{ padding: '0.9rem 3rem', fontSize: '1.1rem' }}>Start Contest</button>
              </div>
            ) : contest.mode === 'sudden_death' ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>Join the waiting room now to secure your spot.</p>
                <button className="btn btn-primary" onClick={handleParticipantEnter} style={{ padding: '0.9rem 3rem', fontSize: '1.1rem' }}>Enter Lobby</button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="loader" style={{ margin: '0 auto 1.5rem', width: '30px', height: '30px', border: '3px solid rgba(255,123,0,0.3)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <h3 className="pulse-text" style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Waiting for host to start the contest...</h3>
                <p style={{ color: '#aaa', fontSize: '0.9rem' }}>The arena will automatically open once the host begins.</p>
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ width: '100%' }}>
            <h3 style={{ marginBottom: '1rem' }}>Standings</h3>
            <CodeforcesStandings leaderboard={leaderboard} questions={contest.questions} />
          </div>
        </div>
      </div>
    );
  }



  // If the contest is active and user is NOT host, and they just joined late — show informational banner
  const isLateJoiner = contestStarted && contest.status === 'active' && !isHost;

  return (
    <div className="container">
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>{contest.title} <span className="badge badge-yellow" style={{ marginLeft: '1rem' }}>{meta.label}</span></h1>
          {contestStarted && (contest.mode === 'standard' || contest.mode === 'timed') && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Time Left:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--secondary)' }}>
                {formatTime(Math.max(0, contest.overall_time_limit * 60 - elapsedSeconds))}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Access Code: <strong style={{ color: '#fff', cursor: 'pointer', background: '#333', padding: '0.2rem 0.5rem', borderRadius: '4px' }} onClick={() => navigator.clipboard.writeText(linkCode)}>{linkCode}</strong></p>
            <button className="btn btn-primary" onClick={copyInviteLink} style={{ padding: '0.25rem 0.7rem', fontSize: '0.78rem', background: linkCopied ? 'var(--success)' : 'var(--primary)', transition: 'background 0.2s' }}>
              {linkCopied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>&larr; Dashboard</button>
          {isHost && contest.status === 'active' && (
            <button className="btn btn-danger" onClick={endContest} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>End Contest</button>
          )}
          {isHost && contest.status === 'pending' && (
            <button className="btn btn-primary" onClick={startStandard} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Start Contest</button>
          )}
        </div>
      </div>

      {/* Late joiner info banner */}
      {isLateJoiner && (
        <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.3)', borderRadius: '6px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem' }}>⚡</span>
          <p style={{ color: 'var(--secondary)', margin: 0, fontSize: '0.9rem' }}>Contest is already in progress. You can still participate — pick a problem and start solving!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          {contest.questions.map((q) => {
            const isSolved = solvedIds.includes(q.id);
            return (
              <div key={q.id} className="glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: isSolved ? '4px solid var(--success)' : '4px solid transparent' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0 }}>{q.title}</h3>
                    {isSolved && <span style={{ background: 'var(--success)', color: '#000', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', letterSpacing: '1px' }}>✓ SOLVED</span>}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Points: <span style={{ color: isSolved ? 'var(--success)' : 'var(--primary)' }}>{q.points}</span> {contest.mode === 'timed' && `| Time Limit: ${q.time_limit}s`}</p>
                </div>
                {isSolved ? (
                  <Link to={`/solve/${contest.id}/${q.id}`} style={{ padding: '0.5rem 1.5rem', background: 'rgba(0,200,0,0.1)', border: '1px solid var(--success)', borderRadius: '4px', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(0,200,0,0.2)'} onMouseLeave={e => e.currentTarget.style.background='rgba(0,200,0,0.1)'}>
                    ✓ Solved — Review
                  </Link>
                ) : (
                  <Link to={`/solve/${contest.id}/${q.id}`} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>Solve</Link>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="glass-panel" style={{ width: '100%' }}>
          <h3 style={{ marginBottom: '1rem' }}>Standings</h3>
          <CodeforcesStandings leaderboard={leaderboard} questions={contest.questions} />
        </div>
      </div>
    </div>
  );
}


// Codeforces-style standings table
function CodeforcesStandings({ leaderboard, questions, title }) {
  const formatTimeStr = (totalSeconds) => {
    if (!totalSeconds) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {title && <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{title}</h3>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', background: '#111' }}>
            <th style={{ padding: '1rem', textAlign: 'left', color: '#999', fontWeight: 500, width: '60px' }}>Rank</th>
            <th style={{ padding: '1rem', textAlign: 'left', color: '#999', fontWeight: 500 }}>Name</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500, width: '80px' }}>Score</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500, width: '120px' }}>Finish Time</th>
            {(questions || []).map((q, i) => (
              <th key={q.id} style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500 }}>Q{i+1} ({q.points || 10})</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leaderboard.length === 0 ? (
            <tr><td colSpan={4 + (questions || []).length} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No submissions yet</td></tr>
          ) : leaderboard.map((l, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #222', background: idx % 2 === 0 ? '#1a1a1a' : '#1e1e1e' }}>
              <td style={{ padding: '1rem', color: idx < 3 ? 'var(--primary)' : '#fff', fontWeight: 700 }}>{idx + 1}</td>
              <td style={{ padding: '1rem' }}>
                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{l.username}</strong>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 600 }}>{l.solved_count ?? l.solved_question_ids?.length ?? 0}</td>
              <td style={{ padding: '1rem', textAlign: 'center', color: '#aaa', fontFamily: 'Consolas, monospace' }}>{formatTimeStr(l.penalty * 60)}</td>
              {(questions || []).map((q) => {
                const stat = l.question_stats?.[String(q.id)];
                if (!stat) return <td key={q.id} style={{ padding: '1rem', textAlign: 'center', color: '#444' }}>-</td>;
                if (stat.solved) return (
                  <td key={q.id} style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ color: 'var(--success)', fontFamily: 'Consolas, monospace', marginBottom: '0.2rem' }}>
                      {formatTimeStr(stat.time_taken || 0)}
                    </div>
                    {stat.wrong_count > 0 && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>+{stat.wrong_count} fails</div>}
                  </td>
                );
                if (stat.wrong_count > 0) return (
                  <td key={q.id} style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>-{stat.wrong_count}</div>
                  </td>
                );
                return <td key={q.id} style={{ padding: '1rem', textAlign: 'center', color: '#444' }}>-</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SolvePlatform() {
  const { contestId, questionId } = useParams();
  const isSuddenDeath = questionId === 'sudden-death';
  
  const navigate = useNavigate();
  const [language, setLanguage] = useState('cpp');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [code, setCode] = useState(() => {
    const saved = localStorage.getItem(`code_${contestId}_${questionId}`);
    return saved !== null ? saved : boilerplates['cpp'];
  });
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('var(--text-secondary)');
  const [evalResults, setEvalResults] = useState(null);
  const [qData, setQData] = useState(null);
  const [alreadySolved, setAlreadySolved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [sdState, setSdState] = useState(null);
  const [sdGlobalTimer, setSdGlobalTimer] = useState(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [roundCountdown, setRoundCountdown] = useState(10);
  const [contestInfo, setContestInfo] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const ws = useRef(null);
  const roundCountdownRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_URL}/me`).then(res => setCurrentUser(res.data)).catch(() => {});
  }, []);

  // Reset state when questionId changes (critical for timed mode navigation)
  useEffect(() => {
    if (!isSuddenDeath) {
      setQData(null);
      setAlreadySolved(false);
      setStatus('');
      setStatusColor('var(--text-secondary)');
      setEvalResults(null);
      setIsSubmitting(false);
      setElapsedSeconds(0);
      
      // Load saved code for this specific question or use boilerplate
      const saved = localStorage.getItem(`code_${contestId}_${questionId}`);
      setCode(saved !== null ? saved : boilerplates[language]);
      
      fetchQuestionDetailed(questionId);
      // Check if already solved
      axios.get(`${API_URL}/contests/${contestId}/my-solved`).then(res => {
        if ((res.data.solved_question_ids || []).map(String).includes(String(questionId))) {
          setAlreadySolved(true);
          setStatus('Already Solved');
          setStatusColor('var(--success)');
        }
      }).catch(() => {});
    }
  }, [contestId, questionId]);

  useEffect(() => {
    // Both sudden death and regular need contest info
    const fetchInfo = () => {
      axios.get(`${API_URL}/contests/${contestId}/info`).then(res => {
        setContestInfo(res.data);
        if (res.data.status === 'ended') {
          navigate(`/contest/${contestId}`);
        }
      }).catch(() => {});
    };
    fetchInfo();
    const infoInterval = setInterval(fetchInfo, 5000);

    // Connect WebSocket for ALL modes to listen for CONTEST_ENDED
    ws.current = new WebSocket(`${WS_URL}/ws/contest/${contestId}`);
    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'CONTEST_ENDED') {
        navigate(`/contest/${contestId}`);
      } else if (isSuddenDeath) {
        if (msg.type === 'SYNC_STATE') {
          setSdState(msg.data);
          setSdGlobalTimer(prev => prev === null ? msg.data.sync_timer : prev);
        } else if (msg.type === 'TIMER_TICK') {
          setSdGlobalTimer(msg.data);
        }
      }
    };
    
    return () => {
      clearInterval(infoInterval);
      if (ws.current) ws.current.close();
      if (roundCountdownRef.current) clearInterval(roundCountdownRef.current);
    };
  }, [contestId, isSuddenDeath, navigate]);

  const endContest = async () => {
    if (!window.confirm("Are you sure you want to end this contest for everyone?")) return;
    try {
      await axios.post(`${API_URL}/contests/${contestId}/end`);
      navigate(`/contest/${contestId}`);
    } catch(e) { alert('Failed to end contest'); }
  };

  // Elapsed time counter for standard/timed modes
  useEffect(() => {
    if (!isSuddenDeath && contestInfo) {
      if (contestInfo.mode === 'standard') {
        let start;
        if (contestInfo.server_elapsed_seconds !== undefined && contestInfo.server_elapsed_seconds !== null) {
          start = Date.now() - (contestInfo.server_elapsed_seconds * 1000);
        } else if (contestInfo.start_time) {
          start = new Date(contestInfo.start_time + 'Z').getTime();
        } else {
          // If start_time is null, try to read from localStorage to avoid resetting
          const lsKey = `contest_${contestId}_start`;
          if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, Date.now().toString());
          start = parseInt(localStorage.getItem(lsKey));
        }
        
        const updateTimer = () => {
          const currentElapsed = Math.floor((Date.now() - start) / 1000);
          setElapsedSeconds(currentElapsed);
          if (contestInfo.overall_time_limit && currentElapsed >= contestInfo.overall_time_limit * 60) {
            alert("Time is up!");
            navigate(`/contest/${contestId}`);
          }
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
      } else if (contestInfo.mode === 'timed') {
        const questions = contestInfo.questions || [];
        const q = questions.find(x => String(x.id) === String(questionId));
        if (q) {
           const timeLimit = q.time_limit;
           const lsKey = `contest_${contestId}_q_${questionId}_start`;
           if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, Date.now().toString());
           const start = parseInt(localStorage.getItem(lsKey));
           // Calculate initial elapsed
           const initialElapsed = Math.floor((Date.now() - start) / 1000);
           if (initialElapsed >= timeLimit) {
             setElapsedSeconds(timeLimit);
             setStatus('Time Up! Locked');
             setStatusColor('var(--danger)');
             setAlreadySolved(true);
           } else {
             setElapsedSeconds(initialElapsed);
           }
           const interval = setInterval(() => {
             const elapsed = Math.floor((Date.now() - start) / 1000);
             if (elapsed >= timeLimit) {
                 setElapsedSeconds(timeLimit);
                 setStatus('Time Up! Locked');
                 setStatusColor('var(--danger)');
                 setAlreadySolved(true);
                 clearInterval(interval);
             } else {
                 setElapsedSeconds(elapsed);
             }
           }, 1000);
           return () => clearInterval(interval);
        }
      }
    }
  }, [isSuddenDeath, contestInfo, questionId, contestId]);

  useEffect(() => {
    if (isSuddenDeath && sdState && sdState.state === 'WAITING_TO_START') {
      axios.get(`${API_URL}/contests/${contestId}/leaderboard`).then(res => setFinalLeaderboard(res.data));
      const interval = setInterval(() => {
        axios.get(`${API_URL}/contests/${contestId}/leaderboard`).then(res => setFinalLeaderboard(res.data));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isSuddenDeath, sdState?.state, contestId]);

  useEffect(() => {
    if (isSuddenDeath && sdState) {
      if (sdState.state === 'CONTEST_OVER' || sdState.state === 'ROUND_OVER') {
        axios.get(`${API_URL}/contests/${contestId}/leaderboard`).then(res => setFinalLeaderboard(res.data));
      }
      // Start round countdown when ROUND_OVER
      if (sdState.state === 'ROUND_OVER') {
        setRoundCountdown(10);
        if (roundCountdownRef.current) clearInterval(roundCountdownRef.current);
        roundCountdownRef.current = setInterval(() => {
          setRoundCountdown(prev => {
            if (prev <= 1) { clearInterval(roundCountdownRef.current); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        if (roundCountdownRef.current) clearInterval(roundCountdownRef.current);
      }
      if (sdState.active_question_id) {
        fetchQuestionDetailed(sdState.active_question_id);
        setAlreadySolved(false);
        setStatus('');
        setEvalResults(null);
      }
    }
  }, [sdState, contestId, isSuddenDeath]);

  const fetchQuestionDetailed = async (qid) => {
    try {
      const resp = await axios.get(`${API_URL}/questions/${qid}`);
      setQData(resp.data);
    } catch {}
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    setCode(boilerplates[lang]);
  };

  const executeSubmission = async () => {
    if (alreadySolved || isSubmitting) return;
    setIsSubmitting(true);
    setStatus('');
    setStatusColor('var(--text-secondary)');
    setEvalResults(null);
    try {
      const activeQ = qData ? qData.id : questionId;
      const res = await axios.post(`${API_URL}/submit`, {
        code, language, question_id: String(activeQ), contest_id: String(contestId)
      });
      if (res.data.already_solved) {
        setStatus('Already Solved!');
        setStatusColor('var(--success)');
        setAlreadySolved(true);
      } else if (res.data.error) {
        setStatus(res.data.error);
        setStatusColor('var(--danger)');
      } else {
        setEvalResults(res.data.results);
        if (res.data.passed) {
          setStatus('Accepted ✔');
          setStatusColor('var(--success)');
          setAlreadySolved(true);
        } else {
          setStatus('Wrong Answer');
          setStatusColor('var(--danger)');
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Submission failed. Please try again.';
      setStatus(detail);
      setStatusColor('var(--danger)');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isSuddenDeath && sdState && sdState.state === 'WAITING_TO_START') {
    return <div className="sudden-death-overlay">
      <h1 className="pulse-text" style={{ fontSize: '3rem', color: '#ff7b00', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Waiting for Match Start</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1rem' }}>The host will initiate the match shortly.</p>
      {finalLeaderboard.length > 0 && (
        <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', textAlign: 'left' }}>
          <CodeforcesStandings leaderboard={finalLeaderboard} questions={contestInfo?.questions} title="Current Standings" />
        </div>
      )}
    </div>;
  }

  if (isSuddenDeath && sdState && sdState.state === 'ROUND_OVER') {
    return <div className="sudden-death-overlay" style={{ background: '#1c1c1c', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', width: '100%', maxWidth: '900px' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '2.5rem', margin: 0 }}>Round {sdState.current_q_idx + 1} Complete</h1>
          <p style={{ color: 'var(--success)', fontWeight: 600, margin: '0.25rem 0 0', fontSize: '1.1rem' }}>Winner: {sdState.winner || 'No winner'}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Next round in <strong style={{ color: 'var(--primary)' }}>{roundCountdown}s</strong></div>
        </div>
      </div>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', textAlign: 'left' }}>
        <CodeforcesStandings leaderboard={finalLeaderboard} questions={contestInfo?.questions} title="Standings" />
      </div>
    </div>;
  }

  if (isSuddenDeath && sdState && sdState.state === 'CONTEST_OVER') {
    return <div className="sudden-death-overlay" style={{ background: '#111', padding: '2rem' }}>
      <h1 style={{ color: 'var(--primary)', fontSize: '4rem', marginBottom: '0.5rem' }}>Match Over</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Final results below</p>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', textAlign: 'left', marginBottom: '1.5rem' }}>
        <CodeforcesStandings leaderboard={finalLeaderboard} questions={contestInfo?.questions} title="Final Standings" />
      </div>
      <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ padding: '0.75rem 2rem' }}>Return to Dashboard</button>
    </div>;
  }

  // Build the navigation list for timed mode (to show all problems with navigation)
  const timedQuestions = (!isSuddenDeath && contestInfo && contestInfo.mode === 'timed' && contestInfo.questions) ? contestInfo.questions : [];
  const isHost = currentUser && contestInfo && currentUser.id === contestInfo.host_id;

  return (
    <div className="solve-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '0.4rem 0.8rem' }}>&larr; Back</button>
          {isHost && (
            <button className="btn btn-danger" onClick={endContest} style={{ padding: '0.4rem 0.8rem' }}>End Contest</button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Sudden Death mode intentionally omits the timer to focus purely on who finishes first */}
          {!isSuddenDeath && contestInfo && contestInfo.mode === 'standard' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Time Left:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--secondary)', background: 'var(--panel-bg)', padding: '0.2rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                {formatTime(Math.max(0, contestInfo.overall_time_limit * 60 - elapsedSeconds))}
              </span>
            </div>
          )}
          {!isSuddenDeath && contestInfo && contestInfo.mode === 'timed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Time Left:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--danger)', background: 'var(--panel-bg)', padding: '0.2rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                {(() => {
                  const questions = contestInfo.questions || [];
                  const q = questions.find(x => String(x.id) === String(questionId));
                  if (!q) return '0:00';
                  return formatTime(Math.max(0, q.time_limit - elapsedSeconds));
                })()}
              </span>
            </div>
          )}
          {isSuddenDeath && <span className="badge badge-orange">SUDDEN DEATH - ROUND {sdState ? sdState.current_q_idx + 1 : 1}</span>}
        </div>
      </div>

      {/* Timed mode: show problem navigation tabs */}
      {timedQuestions.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem 0' }}>
          {timedQuestions.map((tq, idx) => {
            const isActive = String(tq.id) === String(questionId);
            return (
              <Link
                key={tq.id}
                to={`/solve/${contestId}/${tq.id}`}
                className="btn"
                style={{
                  padding: '0.4rem 1rem',
                  fontSize: '0.85rem',
                  background: isActive ? 'var(--primary)' : '#3e3e3e',
                  color: '#fff',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  transition: 'all 0.15s'
                }}
              >
                Q{idx + 1}: {tq.title}
              </Link>
            );
          })}
        </div>
      )}
      
      <div className="problem-title">
        <h1 style={{ margin: 0 }}>{qData ? qData.title : 'Loading Problem...'}</h1>
        <span className="badge badge-yellow" style={{ marginLeft: '1rem' }}>Problem</span>
      </div>
      
      <div className="problem-desc">
        <p style={{ whiteSpace: 'pre-line' }}>{qData ? qData.description : 'Please wait.'}</p>

        {qData && qData.test_cases.slice(0, 2).map((tc, idx) => (
          <div key={idx} className="example-block">
            <strong>Example {idx + 1}:</strong>
            <pre>Input: {tc.input}&#10;Output: {tc.expected}</pre>
          </div>
        ))}
      </div>
      
      <div className={isFullscreen ? 'editor-fullscreen' : 'editor-wrapper'} style={isFullscreen ? {position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: 'var(--editor-bg)', display: 'flex', flexDirection: 'column'} : {}}>
        <div className="editor-toolbar">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select className="form-input" value={language} onChange={handleLanguageChange} style={{ width: 'auto', background: '#333', border: '1px solid #444', color: '#ccc', padding: '0.4rem 1rem', borderRadius: '4px' }}>
              <option value="cpp">C++</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
            <button className="btn btn-secondary" onClick={() => setIsFullscreen(!isFullscreen)} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', background: 'transparent', border: '1px solid var(--border-color)' }}>
              {isFullscreen ? 'Exit Fullscreen' : 'Maximize Editor'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', color: statusColor || 'var(--text-secondary)', marginRight: '1.5rem', fontWeight: 700 }}>
              {status}
            </span>
            <button
              className={`btn ${alreadySolved ? 'btn-secondary' : 'btn-primary'}`}
              onClick={executeSubmission}
              disabled={alreadySolved || isSubmitting}
              style={{ padding: '0.5rem 2.5rem', borderRadius: '0', opacity: (alreadySolved || isSubmitting) ? 0.6 : 1, cursor: (alreadySolved || isSubmitting) ? 'not-allowed' : 'pointer' }}
            >
              {alreadySolved ? '✓ Solved' : isSubmitting ? 'Evaluating...' : 'Submit'}
            </button>
          </div>
        </div>
        <div style={{ height: '400px', background: 'var(--editor-bg)' }}>
          <Editor
            height="100%"
            theme="vs-dark"
            language={language === 'cpp' ? 'cpp' : language}
            value={code}
            onChange={(val) => { setCode(val); localStorage.setItem(`code_${contestId}_${questionId}`, val); }}
            options={{
              minimap: { enabled: false },
              fontSize: 15,
              wordWrap: 'on',
              padding: { top: 16 }
            }}
          />
        </div>
      </div>
      
      {!isFullscreen && (
        <div className="testcase-panel">
          <div className="testcase-header">
             Console Output
          </div>
          <div className="testcase-body">
            {!evalResults && !isSubmitting && <div style={{ color: '#555' }}>You must hit submit to check your code against all hidden testcases...</div>}
            {isSubmitting && !evalResults && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                <div style={{ width: '24px', height: '24px', border: '3px solid rgba(255,123,0,0.3)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }}></div>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Evaluating your submission...</span>
              </div>
            )}
            {evalResults && evalResults.map((res, i) => {
              // Sanitize output to hide code/tracebacks
              let sanitizedActual = res.actual || 'No output';
              if (sanitizedActual.includes('File "') && sanitizedActual.includes('line')) {
                const lines = sanitizedActual.split('\n').map(l => l.trim()).filter(l => l);
                sanitizedActual = lines[lines.length - 1] || 'Runtime/Syntax Error';
              }
              
              return (
                <div key={i} className="test-block" style={{ borderLeft: `4px solid ${res.passed ? 'var(--success)' : 'var(--danger)'}` }}>
                  <div style={{ fontWeight: 700, color: res.passed ? 'var(--success)' : 'var(--danger)', marginBottom: '0.8rem', fontSize: '0.9rem' }}>
                    Testcase {i + 1} {res.passed ? 'Accepted' : 'Wrong Answer'}
                  </div>
                  <div style={{ color: '#ccc', fontFamily: 'Consolas, monospace', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#888' }}>Input:</span> <span style={{ background: '#111', padding: '1px 4px' }}>{res.input}</span></div>
                    <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#888' }}>Expected:</span> <span style={{ background: '#111', padding: '1px 4px' }}>{res.expected}</span></div>
                    <div><span style={{ color: '#888' }}>Actual:</span> <span style={{ background: '#111', padding: '1px 4px' }}>{sanitizedActual}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ marginTop: 'auto', padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
      <div className="container">
        <span style={{ color: '#fff', fontWeight: 700 }}>Compi<span style={{ color: '#ff7b00' }}>Code</span></span> Arena &copy; {new Date().getFullYear()} - Competitive Programming Platform
      </div>
    </footer>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(token);
      axios.get(`${API_URL}/me`).then(res => {
        setUser({ username: res.data.username, id: res.data.id });
        setIsInitializing(false);
      }).catch(() => {
        localStorage.removeItem('token');
        setAuthToken(null);
        setIsInitializing(false);
      });
    } else {
      setIsInitializing(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setAuthToken(null);
    setUser(null);
  };

  if (isInitializing) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loader" style={{ marginBottom: '1rem', width: '50px', height: '50px', border: '5px solid rgba(255,123,0,0.3)', borderTop: '5px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <Router>
      <nav className="navbar">
        <Link to="/" className="brand">Compi<span>Code</span></Link>
        <div className="nav-links">
          {user ? (
            <>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Welcome, <strong style={{ color: 'var(--secondary)' }}>{user.username}</strong></span>
              <button className="btn btn-secondary" onClick={logout} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Log Out</button>
            </>
          ) : (
            <Link to="/auth" className="btn btn-primary" style={{ padding: '0.4rem 1.5rem' }}>Sign In</Link>
          )}
        </div>
      </nav>
      
      <Routes>
        <Route path="/auth" element={<AuthPage onLogin={setUser}/>} />
        <Route path="/" element={user ? <Dashboard /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/host" element={user ? <HostPanel /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/admin" element={user ? <SysAdminPanel /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/sysadmin/problemset" element={user ? <SysAdminPanel /> : <AuthPage onLogin={setUser}/>} />
        <Route path="/contest/:linkCode" element={user ? <ContestLayout userObj={user} /> : <AuthRequired />} />
        <Route path="/solve/:contestId/:questionId" element={user ? <SolvePlatform /> : <AuthRequired />} />
      </Routes>
      <Footer />
    </Router>
  );
}
