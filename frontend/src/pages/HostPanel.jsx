import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { API_URL, boilerplates } from '../config';

export default function HostPanel() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [mode, setMode] = useState('standard');
  const [penalty, setPenalty] = useState(5);
  const [overallLimit, setOverallLimit] = useState(60);
  const [evaluationMode, setEvaluationMode] = useState('strict');
  const [scheduledStart, setScheduledStart] = useState('');
  const [contestQuestions, setContestQuestions] = useState([]);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankProblems, setBankProblems] = useState([]);
  const [selectedBankIds, setSelectedBankIds] = useState(new Set());
  const [editingIdx, setEditingIdx] = useState(null);

  const emptyProblem = () => ({ title: '', description: '', points: 10, time_limit: 300, test_cases: [{ input_data: '', expected_output: '' }, { input_data: '', expected_output: '' }] });
  const [draft, setDraft] = useState(emptyProblem());
  const [sandboxLang, setSandboxLang] = useState('cpp');
  const [sandboxCode, setSandboxCode] = useState(boilerplates['cpp']);
  const [sandboxTesting, setSandboxTesting] = useState(false);
  const [sandboxResults, setSandboxResults] = useState(null);
  const [sandboxError, setSandboxError] = useState('');

  const openNew = () => { setDraft(emptyProblem()); setEditingIdx(null); setSandboxCode(boilerplates['cpp']); setSandboxLang('cpp'); setSandboxResults(null); setSandboxError(''); setShowProblemForm(true); };
  const openEdit = (idx) => { setDraft({ ...contestQuestions[idx], test_cases: contestQuestions[idx].test_cases.map(t => ({...t})) }); setEditingIdx(idx); setSandboxCode(boilerplates['cpp']); setSandboxLang('cpp'); setSandboxResults(null); setSandboxError(''); setShowProblemForm(true); };

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
    const addable = bankProblems.filter(p => !contestQuestions.find(q => q.bankId === p.id));
    if (selectedBankIds.size === addable.length && addable.length > 0) {
      setSelectedBankIds(new Set());
    } else {
      setSelectedBankIds(new Set(addable.map(p => p.id)));
    }
  };

  const addSelectedFromBank = async () => {
    // Preserve the exact order in which the host clicked the checkboxes
    const selectedArray = Array.from(selectedBankIds);
    const toAdd = selectedArray
      .map(id => bankProblems.find(p => p.id === id))
      .filter(p => p && !contestQuestions.find(q => q.bankId === p.id));
      
    if (toAdd.length === 0) return;
    
    const newQuestions = [...contestQuestions];
    for (const p of toAdd) {
      try {
        const res = await axios.get(`${API_URL}/questions/${p.id}`);
        const tcs = res.data.test_cases.map(t => ({ input_data: t.input, expected_output: t.expected }));
        newQuestions.push({ bankId: p.id, title: p.title, description: p.description, points: 10, time_limit: 300, fromBank: true, test_cases: tcs });
      } catch {}
    }
    setContestQuestions(newQuestions);
    setShowBankModal(false);
    setSelectedBankIds(new Set());
  };

  const addFromBank = async (p) => {
    if (contestQuestions.find(q => q.bankId === p.id)) return alert('Already added');
    
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

  const runSandbox = async () => {
    if (draft.test_cases.length === 0) return alert('Add at least one test case to test');
    setSandboxTesting(true);
    setSandboxResults(null);
    setSandboxError('');
    try {
      const res = await axios.post(`${API_URL}/sandbox/test`, {
        code: sandboxCode,
        language: sandboxLang,
        test_cases: draft.test_cases
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

  const deployContest = async () => {
    if (!title.trim()) return alert('Contest title is required');
    if (contestQuestions.length === 0) return alert('Add at least 1 problem');
    if (parseInt(overallLimit) < 1) return alert('Time limit must be at least 1 minute');
    try {
      const finalSelection = [];
      for (let q of contestQuestions) {
        if (q.fromBank && q.bankId) {
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
        evaluation_mode: evaluationMode,
        scheduled_start_time: scheduledStart ? scheduledStart : null,
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
            <div className="form-group">
              <label>Scheduled Start Time (Optional, UTC/Local handled by browser)</label>
              <input type="datetime-local" className="form-input" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} />
            </div>
            <button onClick={deployContest} className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}>Create Contest</button>
          </div>
        </div>

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
                      <button className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', flexShrink: 0, marginLeft: '0.5rem' }} onClick={(e) => { e.stopPropagation(); addFromBank(p); }}>Add</button>
                    )}
                  </div>
                );
              })}
            </div>
            <button className="btn btn-secondary" onClick={() => setShowBankModal(false)} style={{ marginTop: '1rem' }}>Close</button>
          </div>
        </div>
      )}

      {showProblemForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e1e1e', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '1200px', maxHeight: '90vh', display: 'flex', gap: '2rem' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
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
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                      <span style={{ color: '#666', fontSize: '0.8rem', minWidth: '20px', marginTop: '0.5rem' }}>{i + 1}.</span>
                      <textarea className="form-input" rows="2" placeholder="Input (empty if none)" value={tc.input_data} onChange={e => updateTC(i, 'input_data', e.target.value)} style={{ flex: 1, fontFamily: 'monospace', resize: 'vertical' }} />
                      <textarea required className="form-input" rows="2" placeholder="Expected output" value={tc.expected_output} onChange={e => updateTC(i, 'expected_output', e.target.value)} style={{ flex: 1, fontFamily: 'monospace', resize: 'vertical' }} />
                      {i >= 2 && <button type="button" className="btn btn-danger" onClick={() => setDraft({ ...draft, test_cases: draft.test_cases.filter((_, ti) => ti !== i) })} style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', marginTop: '0.3rem' }}>X</button>}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowProblemForm(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Save Problem</button>
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
