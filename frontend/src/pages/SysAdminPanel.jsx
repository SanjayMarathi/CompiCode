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
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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
    setShowDetailsModal(true);
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
      setShowDetailsModal(false);
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

  if (showForm) {
    return (
      <div className="solve-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ padding: '0.4rem 0.8rem' }}>&larr; Back to Problems</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowDetailsModal(true)} style={{ padding: '0.4rem 0.8rem' }}>Edit Details & Testcases</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '0.4rem 0.8rem' }}>{saving ? 'Saving...' : 'Save Problem'}</button>
          </div>
        </div>

        <div className="problem-title">
          <h1 style={{ margin: 0 }}>{newQTitle || 'Untitled Problem'}</h1>
        </div>
        
        <div className="problem-desc">
          <p style={{ whiteSpace: 'pre-line' }}>{newQDesc || 'No description provided.'}</p>
          {testCases.slice(0, 2).map((tc, idx) => (
            <div key={idx} className="example-block" style={{ marginTop: '1.5rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--primary)' }}>Example {idx + 1}:</strong>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Input:</span>
                <pre style={{ marginTop: '0.25rem', background: '#111', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333' }}>{tc.input_data}</pre>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Output:</span>
                <pre style={{ marginTop: '0.25rem', background: '#111', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333' }}>{tc.expected_output}</pre>
              </div>
            </div>
          ))}
        </div>

        <div className="editor-wrapper">
          <div className="editor-toolbar">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select className="form-input" value={sandboxLang} onChange={e => {setSandboxLang(e.target.value); setSandboxCode(boilerplates[e.target.value]);}} style={{ width: 'auto', background: '#333', border: '1px solid #444', color: '#ccc', padding: '0.4rem 1rem', borderRadius: '4px' }}>
                <option value="cpp">C++</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', color: sandboxError ? 'var(--danger)' : 'var(--text-secondary)', marginRight: '1.5rem', fontWeight: 700 }}>
                {sandboxError}
              </span>
              <button className="btn btn-primary" onClick={runSandbox} disabled={sandboxTesting} style={{ padding: '0.5rem 2.5rem', borderRadius: '0' }}>
                {sandboxTesting ? 'Evaluating...' : 'Run Tests'}
              </button>
            </div>
          </div>
          <div style={{ height: '400px', background: 'var(--editor-bg)' }}>
            <Editor
              height="100%"
              theme="vs-dark"
              language={sandboxLang === 'cpp' ? 'cpp' : sandboxLang}
              value={sandboxCode}
              onChange={val => setSandboxCode(val)}
              options={{ minimap: { enabled: false }, fontSize: 15, wordWrap: 'on', padding: { top: 16 } }}
            />
          </div>
        </div>

        <div className="testcase-panel">
          <div className="testcase-header">Console Output</div>
          <div className="testcase-body">
            {!sandboxResults && !sandboxTesting && <div style={{ color: '#555' }}>Write code and click Run Tests to test your problem cases...</div>}
            {sandboxTesting && !sandboxResults && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                <div style={{ width: '24px', height: '24px', border: '3px solid rgba(255,123,0,0.3)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }}></div>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Evaluating your code...</span>
              </div>
            )}
            {sandboxResults && sandboxResults.map((res, i) => {
               let sanitizedActual = res.actual || 'No output';
               if (sanitizedActual.includes('File "') && sanitizedActual.includes('line')) {
                 const lines = sanitizedActual.split('\n').map(l => l.trim()).filter(l => l);
                 sanitizedActual = lines[lines.length - 1] || 'Runtime/Syntax Error';
               }
               return (
                 <div key={i} className="test-block" style={{ borderLeft: `4px solid ${res.passed ? 'var(--success)' : 'var(--danger)'}` }}>
                   <div style={{ fontWeight: 700, color: res.passed ? 'var(--success)' : 'var(--danger)', marginBottom: '0.8rem', fontSize: '0.9rem' }}>
                     Testcase {i + 1} {res.passed ? 'Passed' : 'Failed'}
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

        {showDetailsModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ background: '#1e1e1e', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Edit Problem Details</h3>
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
                <button type="button" className="btn btn-primary" onClick={() => setShowDetailsModal(false)} style={{ flex: 1 }}>Done</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container">
}
