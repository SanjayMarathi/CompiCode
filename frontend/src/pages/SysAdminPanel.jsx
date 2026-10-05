import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { API_URL, boilerplates } from '../config';
import Icon from '../components/Icon';
import ConfirmModal from '../components/ConfirmModal';
import { defineArenaThemes, monacoThemeName, onEditorMount, useDocumentTheme, EDITOR_OPTIONS } from '../monacoTheme';

const blankCases = () => [{ input_data: '', expected_output: '' }, { input_data: '', expected_output: '' }];

export default function SysAdminPanel() {
  const navigate = useNavigate();
  const theme = useDocumentTheme();
  const [problems, setProblems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newQTitle, setNewQTitle] = useState('');
  const [newQDesc, setNewQDesc] = useState('');
  const [newQInputFmt, setNewQInputFmt] = useState('');
  const [newQOutputFmt, setNewQOutputFmt] = useState('');
  const [newQConstraints, setNewQConstraints] = useState('');
  const [testCases, setTestCases] = useState(blankCases());
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [sandboxLang, setSandboxLang] = useState('cpp');
  const [sandboxCode, setSandboxCode] = useState(boilerplates['cpp']);
  const [sandboxTesting, setSandboxTesting] = useState(false);
  const [sandboxResults, setSandboxResults] = useState(null);
  const [sandboxError, setSandboxError] = useState('');

  const loadProblems = async () => {
    try {
      const res = await axios.get(`${API_URL}/questions`);
      setProblems(res.data);
    } catch { /* leave the previous list */ }
  };

  useEffect(() => { loadProblems(); }, []);

  const resetSandbox = () => { setSandboxCode(boilerplates['cpp']); setSandboxLang('cpp'); setSandboxResults(null); setSandboxError(''); };

  const openNew = () => {
    setEditId(null);
    setNewQTitle(''); setNewQDesc('');
    setNewQInputFmt(''); setNewQOutputFmt(''); setNewQConstraints('');
    setTestCases(blankCases());
    resetSandbox();
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
      resetSandbox();
      setShowForm(true);
    } catch {
      alert('Failed to load question details');
    }
  };

  const handleDelete = async () => {
    const target = toDelete;
    setToDelete(null);
    if (!target) return;
    try {
      await axios.delete(`${API_URL}/questions/${target.id}`);
      loadProblems();
    } catch {
      alert('Failed to delete problem');
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
      const res = await axios.post(`${API_URL}/sandbox/test`, { code: sandboxCode, language: sandboxLang, test_cases: testCases });
      if (res.data.error) setSandboxError(res.data.error);
      else setSandboxResults(res.data.results);
    } catch (err) {
      setSandboxError(err.response?.data?.detail || 'Execution failed.');
    } finally {
      setSandboxTesting(false);
    }
  };

  const setCase = (idx, field, val) => setTestCases(testCases.map((t, i) => (i === idx ? { ...t, [field]: val } : t)));

  const fmtField = (label, value, setter, rows, placeholder) => (
    <div className="form-group">
      <label>{label}</label>
      <textarea className="form-input" rows={rows} placeholder={placeholder} value={value} onChange={e => setter(e.target.value)} />
    </div>
  );

  return (
    <div className="container">
      <div className="flex-between fade-in" style={{ marginBottom: '2rem', alignItems: 'flex-end' }}>
        <div className="flex" style={{ alignItems: 'flex-start', gap: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard')} style={{ marginTop: '0.4rem' }}><Icon name="arrow-left" size={16} /> Dashboard</button>
          <div className="display-stack sm">
            <span className="eyebrow">Administration</span>
            <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 3rem)' }}>Problem bank</h1>
            <p className="muted" style={{ marginTop: '0.5rem', maxWidth: 640, lineHeight: 1.6, fontSize: '0.92rem' }}>
              The official repository of challenges. Problems added here are available to every host.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={16} /> New problem</button>
      </div>

      <section className="panel fade-in-up">
        {problems.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <span className="eyebrow">The bank is empty</span>
            <button className="btn btn-primary" onClick={openNew} style={{ marginTop: '1rem' }}>Add your first problem</button>
          </div>
        ) : (
          <ul className="list">
            {problems.map((p, i) => (
              <li key={p.id} className="list-row">
                <span className="avatar outline">{i + 1}</span>
                <div className="list-main">
                  <div className="list-title">{p.title}</div>
                  <div className="list-meta" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.description || '').replace(/\n+/g, ' ')}</div>
                </div>
                <div className="list-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAppEdit(p)}>Edit</button>
                  <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => setToDelete(p)} aria-label={`Delete ${p.title}`} title="Delete"><Icon name="trash" size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal open={!!toDelete} tone="danger" title="Delete problem" confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setToDelete(null)}>
        Delete <strong style={{ color: 'var(--text-primary)' }}>{toDelete?.title}</strong> from the bank? Contests that already use it will lose the problem.
      </ConfirmModal>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal modal-wide split" style={{ gap: '2rem', overflowY: 'auto' }}>
            <div className="split-col">
              <h3 style={{ marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1.5px solid var(--border-color)' }}>{editId ? 'Edit problem' : 'Add problem to bank'}</h3>
              <form onSubmit={handleSave}>
                <div className="form-group"><label>Title</label><input required className="form-input" placeholder="e.g. Reverse a Linked List" value={newQTitle} onChange={e => setNewQTitle(e.target.value)} /></div>
                <div className="form-group"><label>Description</label><textarea required className="form-input" rows="4" placeholder="Detailed problem statement…" value={newQDesc} onChange={e => setNewQDesc(e.target.value)} /></div>
                {fmtField('Input format', newQInputFmt, setNewQInputFmt, 2, 'e.g. The first line contains an integer N…')}
                {fmtField('Output format', newQOutputFmt, setNewQOutputFmt, 2, 'e.g. Print N space-separated integers…')}
                {fmtField('Constraints', newQConstraints, setNewQConstraints, 2, 'e.g. 1 <= N <= 10^5')}
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <span className="io-label">Testcases (min 2)</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTestCases([...testCases, { input_data: '', expected_output: '' }])}><Icon name="plus" size={14} /> Row</button>
                </div>
                {testCases.map((tc, idx) => (
                  <div key={idx} className="flex" style={{ alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="faint mono" style={{ fontSize: '0.8rem', minWidth: 22, marginTop: '0.65rem' }}>{idx + 1}.</span>
                    <textarea className="form-input mono" rows="2" placeholder="Input (empty if none)" value={tc.input_data} onChange={e => setCase(idx, 'input_data', e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }} />
                    <textarea required className="form-input mono" rows="2" placeholder="Expected output" value={tc.expected_output} onChange={e => setCase(idx, 'expected_output', e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }} />
                    {idx >= 2 && <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))} style={{ marginTop: '0.3rem' }} aria-label="Remove testcase"><Icon name="x" size={14} /></button>}
                  </div>
                ))}
                <div className="flex" style={{ marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>{saving ? 'Saving…' : 'Save to bank'}</button>
                </div>
              </form>
            </div>

            <div className="split-col split-side">
              <div className="flex-between" style={{ marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1.5px solid var(--border-color)' }}>
                <h3 style={{ margin: 0 }}>Sandbox</h3>
                <select className="form-input" value={sandboxLang} onChange={e => { setSandboxLang(e.target.value); setSandboxCode(boilerplates[e.target.value]); }} style={{ width: 'auto', padding: '0.3rem 2.2rem 0.3rem 0.8rem' }}>
                  <option value="cpp">C++</option><option value="python">Python</option><option value="java">Java</option>
                </select>
              </div>
              <div style={{ flex: 1, border: '1.5px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', minHeight: 300 }}>
                <Editor
                  height="100%"
                  theme={monacoThemeName(theme)}
                  beforeMount={defineArenaThemes}
                  onMount={onEditorMount}
                  language={sandboxLang === 'cpp' ? 'cpp' : sandboxLang}
                  value={sandboxCode}
                  onChange={val => setSandboxCode(val)}
                  options={{ ...EDITOR_OPTIONS, fontSize: 13, padding: { top: 12 } }}
                />
              </div>
              <div className="flex-between" style={{ marginTop: '1rem' }}>
                <span style={{ color: sandboxError ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.88rem' }}>{sandboxError || (sandboxTesting ? 'Evaluating…' : 'Write a solution to check your testcases')}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={runSandbox} disabled={sandboxTesting}>{sandboxTesting ? 'Running…' : 'Run tests'}</button>
              </div>
              {sandboxResults && (
                <div className="stack fade-in-scale" style={{ marginTop: '1rem', gap: '0.5rem', maxHeight: 220, overflowY: 'auto' }}>
                  {sandboxResults.map((res, i) => {
                    let actual = res.actual || 'No output';
                    if (actual.includes('File "') && actual.includes('line')) {
                      const lines = actual.split('\n').map(l => l.trim()).filter(l => l);
                      actual = lines[lines.length - 1] || 'Runtime/Syntax Error';
                    }
                    return (
                      <div key={i} style={{ border: `1.5px solid ${res.passed ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 10, padding: '0.55rem 0.8rem', fontSize: '0.82rem' }}>
                        <div className="flex" style={{ gap: '0.4rem', color: res.passed ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                          <Icon name={res.passed ? 'check' : 'x'} size={14} stroke={2.6} /> Case {i + 1} — {res.passed ? 'passed' : 'failed'}
                        </div>
                        {!res.passed && (
                          <div className="mono muted" style={{ marginTop: '0.3rem' }}>
                            <div>expected: {res.expected}</div>
                            <div>actual: {actual}</div>
                          </div>
                        )}
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
