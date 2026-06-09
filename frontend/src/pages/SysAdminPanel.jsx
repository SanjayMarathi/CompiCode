import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { API_URL, boilerplates } from '../config';

export default function SysAdminPanel() {
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
  const [sandboxLang, setSandboxLang] = useState('cpp');
  const [sandboxCode, setSandboxCode] = useState(boilerplates['cpp']);
  const [sandboxTesting, setSandboxTesting] = useState(false);
  const [sandboxResults, setSandboxResults] = useState(null);
  const [sandboxError, setSandboxError] = useState('');

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
    setSandboxCode(boilerplates['cpp']); setSandboxLang('cpp'); setSandboxResults(null); setSandboxError('');
    setShowForm(true);
  };

  const openAppEdit = async (p) => {
    try {
      const res = await axios.get(`${API_URL}/questions/${p.id}`);
      setEditId(p.id);
      setNewQTitle(res.data.title);
      setNewQDesc(res.data.description);
      setTestCases(res.data.test_cases.map(tc => ({ input_data: tc.input, expected_output: tc.expected })));
      setSandboxCode(boilerplates['cpp']); setSandboxLang('cpp'); setSandboxResults(null); setSandboxError('');
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

  const runSandbox = async () => {
    if (testCases.length === 0) return alert('Add at least one test case to test');
    setSandboxTesting(true);
    setSandboxResults(null);
    setSandboxError('');
    try {
      const res = await axios.post(`${API_URL}/sandbox/test`, {
        code: sandboxCode,
        language: sandboxLang,
        test_cases: testCases
      });
      if (res.data.error) {
        setSandboxError(res.data.error);
      } else {
        setSandboxResults(res.data.results);
      }
    } catch (err) {
      setSandboxError(err.response?.data?.detail || 'Execution failed.');
    } finally {
      setSandboxTesting(false);
    }
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
          <div style={{ background: '#1e1e1e', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '1200px', maxHeight: '90vh', display: 'flex', gap: '2rem' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
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
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ color: '#666', fontSize: '0.8rem', minWidth: '18px', marginTop: '0.5rem' }}>{idx + 1}.</span>
                    <textarea className="form-input" rows="2" placeholder="Input (empty if none)" value={tc.input_data} onChange={e => { const n = [...testCases]; n[idx].input_data = e.target.value; setTestCases(n); }} style={{ flex: 1, fontFamily: 'monospace', resize: 'vertical' }} />
                    <textarea required className="form-input" rows="2" placeholder="Expected output" value={tc.expected_output} onChange={e => { const n = [...testCases]; n[idx].expected_output = e.target.value; setTestCases(n); }} style={{ flex: 1, fontFamily: 'monospace', resize: 'vertical' }} />
                    {idx >= 2 && <button type="button" className="btn btn-danger" onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', marginTop: '0.3rem' }}>X</button>}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>{saving ? 'Saving...' : 'Save to UI'}</button>
                </div>
              </form>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0 }}>Sandbox Testing</h3>
                <select className="form-input" value={sandboxLang} onChange={e => {setSandboxLang(e.target.value); setSandboxCode(boilerplates[e.target.value]);}} style={{ width: 'auto', padding: '0.3rem 0.8rem', background: '#333' }}>
                  <option value="cpp">C++</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                </select>
              </div>
              
              <div style={{ flex: 1, border: '1px solid #333', minHeight: '300px' }}>
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={sandboxLang === 'cpp' ? 'cpp' : sandboxLang}
                  value={sandboxCode}
                  onChange={val => setSandboxCode(val)}
                  options={{ minimap: { enabled: false }, fontSize: 14 }}
                />
              </div>
              
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: sandboxError ? 'var(--danger)' : 'var(--text-secondary)' }}>{sandboxError || (sandboxTesting ? 'Evaluating...' : 'Write code to test your problem cases')}</span>
                <button type="button" className="btn btn-primary" onClick={runSandbox} disabled={sandboxTesting}>
                  {sandboxTesting ? 'Running...' : 'Run Tests'}
                </button>
              </div>
              
              {sandboxResults && (
                <div style={{ marginTop: '1rem', background: '#111', padding: '1rem', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                  {sandboxResults.map((res, i) => {
                     let sanitizedActual = res.actual || 'No output';
                     if (sanitizedActual.includes('File "') && sanitizedActual.includes('line')) {
                       const lines = sanitizedActual.split('\n').map(l => l.trim()).filter(l => l);
                       sanitizedActual = lines[lines.length - 1] || 'Runtime/Syntax Error';
                     }
                     return (
                       <div key={i} style={{ borderLeft: `3px solid ${res.passed ? 'var(--success)' : 'var(--danger)'}`, paddingLeft: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                         <div style={{ color: res.passed ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>Testcase {i + 1}: {res.passed ? 'Passed' : 'Failed'}</div>
                         <div style={{ color: '#aaa', marginTop: '0.2rem', fontFamily: 'monospace' }}>Expected: {res.expected}</div>
                         <div style={{ color: '#aaa', fontFamily: 'monospace' }}>Actual: {sanitizedActual}</div>
                       </div>
                     );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
