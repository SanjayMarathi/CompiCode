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
  const [newQInputFmt, setNewQInputFmt] = useState('');
  const [newQOutputFmt, setNewQOutputFmt] = useState('');
  const [newQConstraints, setNewQConstraints] = useState('');
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
    setNewQInputFmt(''); setNewQOutputFmt(''); setNewQConstraints('');
    setTestCases([{ input_data: '', expected_output: '' }, { input_data: '', expected_output: '' }]);
    setSandboxCode(boilerplates['cpp']); setSandboxLang('cpp'); setSandboxResults(null); setSandboxError('');
    setShowForm(true);
  };

  const openAppEdit = async (p) => {
    try {
      const res = await axios.get(`${API_URL}/questions/${p.id}`);
      setEditId(p.id);
      setNewQTitle(res.data.title);
      
      let desc = res.data.description || '';
      let inputFmt = '';
      let outputFmt = '';
      let constraints = '';

      const inputSplit = desc.split('### Input Format');
      if (inputSplit.length > 1) {
        desc = inputSplit[0].trim();
        const outputSplit = inputSplit[1].split('### Output Format');
        if (outputSplit.length > 1) {
          inputFmt = outputSplit[0].trim();
          const constraintsSplit = outputSplit[1].split('### Constraints');
          if (constraintsSplit.length > 1) {
            outputFmt = constraintsSplit[0].trim();
            constraints = constraintsSplit[1].trim();
          } else {
            outputFmt = outputSplit[1].trim();
          }
        } else {
          inputFmt = inputSplit[1].trim();
        }
      }

      setNewQDesc(desc);
      setNewQInputFmt(inputFmt);
      setNewQOutputFmt(outputFmt);
      setNewQConstraints(constraints);
      
      setTestCases(res.data.test_cases.map(tc => ({ input_data: tc.input, expected_output: tc.expected })));
      setSandboxCode(boilerplates['cpp']); setSandboxLang('cpp'); setSandboxResults(null); setSandboxError('');
      setShowForm(true);
    } catch {
      alert("Failed to load question details");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this problem?")) return;
    try {
      await axios.delete(`${API_URL}/questions/${id}`);
      loadProblems();
    } catch {
      alert("Failed to delete problem");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (testCases.length < 2) return alert('Must have at least 2 test cases.');
    setSaving(true);
    try {
      let combinedDesc = newQDesc.trim();
      if (newQInputFmt.trim()) combinedDesc += `\n\n### Input Format\n${newQInputFmt.trim()}`;
      if (newQOutputFmt.trim()) combinedDesc += `\n\n### Output Format\n${newQOutputFmt.trim()}`;
      if (newQConstraints.trim()) combinedDesc += `\n\n### Constraints\n${newQConstraints.trim()}`;
      
      if (editId) {
        await axios.put(`${API_URL}/questions/${editId}`, { title: newQTitle, description: combinedDesc, is_global: true, test_cases: testCases });
      } else {
        await axios.post(`${API_URL}/questions`, { title: newQTitle, description: combinedDesc, is_global: true, test_cases: testCases });
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
      <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>&larr; Dashboard</button>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Global Problem Bank</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0', maxWidth: '700px', lineHeight: 1.6 }}>
              Manage the official repository of coding challenges. Problems added here will be available to all contest hosts when they are creating their own custom contests.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ padding: '0.5rem 1.25rem' }}>+ New Problem</button>
      </div>

      <div className="glass-panel fade-in-up">
        {problems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
            <p>No problems in the bank yet.</p>
            <button className="btn btn-primary" onClick={openNew} style={{ marginTop: '1rem' }}>Add Your First Problem</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                <th style={{ textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p, i) => (
                <tr key={p.id} className="hover-lift" style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '0.8rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{i + 1}</td>
                  <td style={{ padding: '0.8rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{p.title}</td>
                  <td style={{ padding: '0.8rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openAppEdit(p)}>Edit</button>
                      <button type="button" className="btn btn-danger" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleDelete(p.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-bg)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="fade-in-scale" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '1200px', maxHeight: '90vh', display: 'flex', gap: '2rem', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
              <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>Add Problem to Bank</h3>
              <form onSubmit={handleSave}>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Problem Title</label>
                  <input required className="form-input" placeholder="e.g. Reverse a Linked List" value={newQTitle} onChange={e => setNewQTitle(e.target.value)} style={{ padding: '0.8rem', fontSize: '1rem' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Description</label>
                  <textarea required className="form-input" rows="4" placeholder="Detailed problem statement..." value={newQDesc} onChange={e => setNewQDesc(e.target.value)} style={{ padding: '0.8rem', fontFamily: 'inherit', fontSize: '0.95rem' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Input Format</label>
                  <textarea className="form-input" rows="2" placeholder="e.g. The first line contains an integer N..." value={newQInputFmt} onChange={e => setNewQInputFmt(e.target.value)} style={{ padding: '0.8rem', fontFamily: 'inherit', fontSize: '0.95rem' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Output Format</label>
                  <textarea className="form-input" rows="2" placeholder="e.g. Print N space-separated integers..." value={newQOutputFmt} onChange={e => setNewQOutputFmt(e.target.value)} style={{ padding: '0.8rem', fontFamily: 'inherit', fontSize: '0.95rem' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Constraints</label>
                  <textarea className="form-input" rows="2" placeholder="e.g. 1 <= N <= 10^5" value={newQConstraints} onChange={e => setNewQConstraints(e.target.value)} style={{ padding: '0.8rem', fontFamily: 'inherit', fontSize: '0.95rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ color: 'var(--text-secondary)' }}>Test Cases (min 2)</label>
                  <button type="button" className="btn btn-secondary" onClick={() => setTestCases([...testCases, { input_data: '', expected_output: '' }])} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>+ Row</button>
                </div>
                {testCases.map((tc, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', minWidth: '18px', marginTop: '0.5rem' }}>{idx + 1}.</span>
                    <textarea className="form-input" rows="2" placeholder="Input (empty if none)" value={tc.input_data} onChange={e => { const n = [...testCases]; n[idx].input_data = e.target.value; setTestCases(n); }} style={{ flex: 1, fontFamily: 'monospace', resize: 'vertical' }} />
                    <textarea required className="form-input" rows="2" placeholder="Expected output" value={tc.expected_output} onChange={e => { const n = [...testCases]; n[idx].expected_output = e.target.value; setTestCases(n); }} style={{ flex: 1, fontFamily: 'monospace', resize: 'vertical' }} />
                    {idx >= 2 && <button type="button" className="btn btn-danger" onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', marginTop: '0.3rem' }}>X</button>}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>{saving ? 'Saving...' : 'Save to Bank'}</button>
                </div>
              </form>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Sandbox Testing</h3>
                <select className="form-input" value={sandboxLang} onChange={e => {setSandboxLang(e.target.value); setSandboxCode(boilerplates[e.target.value]);}} style={{ width: 'auto', padding: '0.3rem 0.8rem' }}>
                  <option value="cpp">C++</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                </select>
              </div>
              
              <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', minHeight: '300px' }}>
                <Editor
                  height="100%"
                  theme={document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs-dark'}
                  language={sandboxLang === 'cpp' ? 'cpp' : sandboxLang}
                  value={sandboxCode}
                  onChange={val => setSandboxCode(val)}
                  options={{ minimap: { enabled: false }, fontSize: 14 }}
                />
              </div>
              
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: sandboxError ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.9rem' }}>{sandboxError || (sandboxTesting ? 'Evaluating...' : 'Write code to test your problem cases')}</span>
                <button type="button" className="btn btn-primary" onClick={runSandbox} disabled={sandboxTesting}>
                  {sandboxTesting ? 'Running...' : 'Run Tests'}
                </button>
              </div>
              
              {sandboxResults && (
                <div className="fade-in-scale" style={{ marginTop: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
                  {sandboxResults.map((res, i) => {
                     let sanitizedActual = res.actual || 'No output';
                     if (sanitizedActual.includes('File "') && sanitizedActual.includes('line')) {
                       const lines = sanitizedActual.split('\n').map(l => l.trim()).filter(l => l);
                       sanitizedActual = lines[lines.length - 1] || 'Runtime/Syntax Error';
                     }
                     return (
                       <div key={i} className="hover-lift" style={{ borderLeft: `3px solid ${res.passed ? 'var(--success)' : 'var(--danger)'}`, paddingLeft: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                         <div style={{ color: res.passed ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>Testcase {i + 1}: {res.passed ? 'Passed' : 'Failed'}</div>
                         <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem', fontFamily: 'monospace' }}>Expected: {res.expected}</div>
                         <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>Actual: {sanitizedActual}</div>
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
