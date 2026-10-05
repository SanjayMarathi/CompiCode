import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { API_URL, boilerplates, MODE_META } from '../config';
import Icon from '../components/Icon';
import { defineArenaThemes, monacoThemeName, onEditorMount, useDocumentTheme, EDITOR_OPTIONS } from '../monacoTheme';

export default function HostPanel() {
  const navigate = useNavigate();
  const theme = useDocumentTheme();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [mode, setMode] = useState('standard');
  const [visibility, setVisibility] = useState('public');
  const [penalty, setPenalty] = useState(5);
  const [overallLimit, setOverallLimit] = useState(60);
  const [evaluationMode] = useState('strict');
  const [scheduledStart, setScheduledStart] = useState('');
  const [contestQuestions, setContestQuestions] = useState([]);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankProblems, setBankProblems] = useState([]);
  const [selectedBankIds, setSelectedBankIds] = useState(new Set());
  const [editingIdx, setEditingIdx] = useState(null);
  const [deploying, setDeploying] = useState(false);

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
    try { const res = await axios.get(`${API_URL}/questions`); setBankProblems(res.data); } catch { /* shows the empty state */ }
    setSelectedBankIds(new Set());
    setShowBankModal(true);
  };

  const toggleBankSelect = (id) => {
    setSelectedBankIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const addable = bankProblems.filter(p => !contestQuestions.find(q => q.bankId === p.id));

  const toggleSelectAll = () => {
    if (selectedBankIds.size === addable.length && addable.length > 0) setSelectedBankIds(new Set());
    else setSelectedBankIds(new Set(addable.map(p => p.id)));
  };

  const addSelectedFromBank = async () => {
    const selectedArray = Array.from(selectedBankIds);
    const toAdd = selectedArray.map(id => bankProblems.find(p => p.id === id)).filter(p => p && !contestQuestions.find(q => q.bankId === p.id));
    if (toAdd.length === 0) return;
    const newQuestions = [...contestQuestions];
    for (const p of toAdd) {
      try {
        const res = await axios.get(`${API_URL}/questions/${p.id}`);
        const tcs = res.data.test_cases.map(t => ({ input_data: t.input, expected_output: t.expected }));
        newQuestions.push({ bankId: p.id, title: p.title, description: p.description, points: 10, time_limit: 300, fromBank: true, test_cases: tcs });
      } catch { /* skip problems that fail to load */ }
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
    } catch { alert("Failed to pull full question data from bank."); }
  };

  const saveProblem = (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return alert('Problem title required');
    if (!draft.description.trim()) return alert('Problem description required');
    if (draft.test_cases.length < 2) return alert('At least 2 test cases required');
    for (let tc of draft.test_cases) { if (!tc.expected_output.trim()) return alert('All test cases must have expected output'); }
    if (editingIdx !== null) { const n = [...contestQuestions]; n[editingIdx] = draft; setContestQuestions(n); }
    else { setContestQuestions([...contestQuestions, draft]); }
    setShowProblemForm(false);
  };

  const removeProblem = (idx) => { const n = [...contestQuestions]; n.splice(idx, 1); setContestQuestions(n); };

  const updateTC = (i, field, val) => {
    const tcs = draft.test_cases.map((t, ti) => ti === i ? { ...t, [field]: val } : t);
    setDraft({ ...draft, test_cases: tcs });
  };

  const runSandbox = async () => {
    if (draft.test_cases.length === 0) return alert('Add at least one test case to test');
    setSandboxTesting(true); setSandboxResults(null); setSandboxError('');
    try {
      const res = await axios.post(`${API_URL}/sandbox/test`, { code: sandboxCode, language: sandboxLang, test_cases: draft.test_cases });
      if (res.data.error) setSandboxError(res.data.error);
      else setSandboxResults(res.data.results);
    } catch (err) { setSandboxError(err.response?.data?.detail || 'Execution failed.'); }
    finally { setSandboxTesting(false); }
  };

  const deployContest = async () => {
    if (deploying) return;
    if (!title.trim()) return alert('Contest title is required');
    if (contestQuestions.length === 0) return alert('Add at least 1 problem');
    if (parseInt(overallLimit) < 1) return alert('Time limit must be at least 1 minute');
    setDeploying(true);
    try {
      const finalSelection = [];
      for (let q of contestQuestions) {
        if (q.fromBank && q.bankId) { finalSelection.push({ question_id: q.bankId, points: parseInt(q.points), time_limit: parseInt(q.time_limit) }); }
        else {
          const resQ = await axios.post(`${API_URL}/questions`, { title: q.title, description: q.description, is_global: false, test_cases: q.test_cases });
          finalSelection.push({ question_id: resQ.data.id, points: parseInt(q.points), time_limit: parseInt(q.time_limit) });
        }
      }
      const res = await axios.post(`${API_URL}/contests`, {
        title, description: desc, mode, visibility,
        penalty_per_wrong_answer: parseInt(penalty), overall_time_limit: parseInt(overallLimit),
        evaluation_mode: evaluationMode,
        // datetime-local has no timezone; send an absolute instant so every participant sees the same start.
        scheduled_start_time: scheduledStart ? new Date(scheduledStart).toISOString() : null,
        selected_questions: finalSelection
      });
      navigate(`/contest/${res.data.link_code}`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create contest. Is the server running?');
      setDeploying(false);
    }
  };

  const sanitizeActual = (actual) => {
    let s = actual || 'No output';
    if (s.includes('File "') && s.includes('line')) {
      const lines = s.split('\n').map(l => l.trim()).filter(l => l);
      s = lines[lines.length - 1] || 'Runtime/Syntax Error';
    }
    return s;
  };

  const editorProps = {
    height: '100%',
    theme: monacoThemeName(theme),
    beforeMount: defineArenaThemes,
    onMount: onEditorMount,
    options: { ...EDITOR_OPTIONS, fontSize: 13, padding: { top: 12 } },
  };

  return (
    <div className="container">
      <div className="flex fade-in" style={{ marginBottom: '2.25rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard')}><Icon name="arrow-left" size={16} /> Dashboard</button>
        <div className="display-stack sm" style={{ marginLeft: '0.5rem' }}>
          <span className="eyebrow">New contest</span>
          <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 3rem)' }}>Create contest</h1>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', alignItems: 'start', gap: '2.5rem 1.75rem' }}>
        <section className="bcard fade-in-up stagger-1">
          <span className="bubble"><Icon name="flag" size={26} /></span>
          <h3 className="bcard-title">Configuration</h3>
          <p className="bcard-text" style={{ marginBottom: '1.25rem' }}>Set the rules and environment for your contest.</p>

          <div className="form-group"><label htmlFor="c-title">Title</label><input id="c-title" className="form-input" required placeholder="e.g. Weekly Round #12" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="form-group"><label htmlFor="c-desc">Description <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label><textarea id="c-desc" className="form-input" rows="2" placeholder="Brief description…" value={desc} onChange={e => setDesc(e.target.value)} /></div>

          <div className="form-group">
            <label>Mode</label>
            <div className="choice-grid">
              {Object.entries(MODE_META).map(([key, m]) => (
                <button key={key} type="button" className={`choice ${mode === key ? 'is-on' : ''}`} onClick={() => setMode(key)} aria-pressed={mode === key}>
                  <span className="choice-title"><Icon name={m.icon} size={16} /> {m.label}</span>
                  <span className="choice-desc">{m.short}</span>
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.6rem', lineHeight: 1.55 }}>{MODE_META[mode].desc}</p>
          </div>

          <div className="form-group">
            <label>Visibility</label>
            <div className="choice-grid">
              <button type="button" className={`choice ${visibility === 'public' ? 'is-on' : ''}`} onClick={() => setVisibility('public')} aria-pressed={visibility === 'public'}>
                <span className="choice-title"><Icon name="globe" size={16} /> Public</span>
                <span className="choice-desc">Anyone with the link joins</span>
              </button>
              <button type="button" className={`choice ${visibility === 'private' ? 'is-on' : ''}`} onClick={() => setVisibility('private')} aria-pressed={visibility === 'private'}>
                <span className="choice-title"><Icon name="lock" size={16} /> Private</span>
                <span className="choice-desc">You approve each request</span>
              </button>
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: '0 1rem' }}>
            <div className="form-group"><label htmlFor="c-limit">Time limit (min)</label><input id="c-limit" type="number" min="1" max="480" className="form-input" value={overallLimit} onChange={e => setOverallLimit(e.target.value)} /></div>
            <div className="form-group"><label htmlFor="c-pen">WA penalty (pts)</label><input id="c-pen" type="number" min="0" className="form-input" value={penalty} onChange={e => setPenalty(e.target.value)} /></div>
          </div>
          <div className="form-group"><label htmlFor="c-sched">Scheduled start <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label><input id="c-sched" type="datetime-local" className="form-input" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} /></div>

          <button onClick={deployContest} className="btn btn-primary btn-block" disabled={deploying} style={{ padding: '0.85rem' }}>
            {deploying ? 'Creating…' : <>Create contest <Icon name="arrow-right" size={18} /></>}
          </button>
        </section>

        <section className="bcard bubble-left fade-in-up stagger-2">
          <span className="bubble"><Icon name="code" size={26} /></span>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 className="bcard-title" style={{ margin: 0 }}>Problems ({contestQuestions.length})</h3>
            <div className="flex" style={{ gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={openBank}><Icon name="book" size={15} /> Bank</button>
              <button className="btn btn-primary btn-sm" onClick={openNew}><Icon name="plus" size={15} /> New</button>
            </div>
          </div>
          {contestQuestions.length === 0 && (
            <div className="empty-state" style={{ border: '1.5px dashed var(--border-hover)', borderRadius: 12 }}>
              <span className="eyebrow">No problems yet</span>
              Add one from the bank or write your own.
            </div>
          )}
          <ul className="list">
            {contestQuestions.map((q, idx) => (
              <li key={idx} className="list-row">
                <span className="avatar outline">{String.fromCharCode(65 + idx)}</span>
                <div className="list-main">
                  <div className="list-title">{q.title}</div>
                  <div className="list-meta"><span>{q.points} pts</span><span className="dot" /><span>{q.test_cases.length} testcases</span>{mode === 'timed' && <><span className="dot" /><span>{q.time_limit}s limit</span></>}</div>
                </div>
                <div className="list-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(idx)}>Edit</button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => removeProblem(idx)} aria-label={`Remove ${q.title}`} title="Remove"><Icon name="trash" size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {showBankModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowBankModal(false); }}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-head" style={{ justifyContent: 'space-between' }}>
              <h3>Problem bank</h3>
              {addable.length > 0 && (
                <div className="flex" style={{ gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={toggleSelectAll}>{selectedBankIds.size === addable.length ? 'Deselect all' : 'Select all'}</button>
                  {selectedBankIds.size > 0 && <button className="btn btn-primary btn-sm" onClick={addSelectedFromBank}>Add ({selectedBankIds.size})</button>}
                </div>
              )}
            </div>
            <div className="modal-body" style={{ paddingTop: '0.5rem' }}>
              {bankProblems.length === 0 ? (
                <div className="empty-state">No problems available.</div>
              ) : bankProblems.map(p => {
                const alreadyAdded = contestQuestions.find(q => q.bankId === p.id);
                const isSelected = selectedBankIds.has(p.id);
                return (
                  <div key={p.id} className="list-row" onClick={() => { if (!alreadyAdded) toggleBankSelect(p.id); }} style={{ cursor: alreadyAdded ? 'default' : 'pointer', background: isSelected ? 'var(--primary-subtle)' : 'transparent', borderRadius: 8, padding: '0.75rem' }}>
                    {!alreadyAdded && <input type="checkbox" checked={isSelected} onChange={() => toggleBankSelect(p.id)} onClick={(e) => e.stopPropagation()} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }} />}
                    <div className="list-main">
                      <div className="list-title">{p.title}</div>
                      <div className="list-meta" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description?.slice(0, 90)}…</div>
                    </div>
                    {alreadyAdded ? <span className="pill pill-active">Added</span> : <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); addFromBank(p); }}>Add</button>}
                  </div>
                );
              })}
            </div>
            <div className="modal-foot"><button className="btn btn-secondary btn-sm" onClick={() => setShowBankModal(false)}>Close</button></div>
          </div>
        </div>
      )}

      {showProblemForm && (
        <div className="modal-overlay">
          <div className="modal modal-wide split" style={{ gap: '2rem', overflowY: 'auto' }}>
            <div className="split-col">
              <h3 style={{ marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1.5px solid var(--border-color)' }}>{editingIdx !== null ? 'Edit problem' : 'New problem'}</h3>
              <form onSubmit={saveProblem}>
                <div className="form-group"><label>Title</label><input required className="form-input" placeholder="e.g. Two Sum" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
                <div className="form-group"><label>Statement</label><textarea required className="form-input" rows="6" placeholder="Describe the problem…" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
                <div className="grid grid-2" style={{ gap: '0 1rem' }}>
                  <div className="form-group"><label>Points</label><input type="number" min="1" className="form-input" value={draft.points} onChange={e => setDraft({ ...draft, points: parseInt(e.target.value) })} /></div>
                  {mode === 'timed' && (<div className="form-group"><label>Time limit (s)</label><input type="number" min="30" className="form-input" value={draft.time_limit} onChange={e => setDraft({ ...draft, time_limit: parseInt(e.target.value) })} /></div>)}
                </div>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <span className="io-label">Testcases (min 2)</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDraft({ ...draft, test_cases: [...draft.test_cases, { input_data: '', expected_output: '' }] })}><Icon name="plus" size={14} /> Row</button>
                </div>
                {draft.test_cases.map((tc, i) => (
                  <div key={i} className="flex" style={{ alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="faint mono" style={{ fontSize: '0.8rem', minWidth: 22, marginTop: '0.65rem' }}>{i + 1}.</span>
                    <textarea className="form-input mono" rows="2" placeholder="Input" value={tc.input_data} onChange={e => updateTC(i, 'input_data', e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }} />
                    <textarea required className="form-input mono" rows="2" placeholder="Expected output" value={tc.expected_output} onChange={e => updateTC(i, 'expected_output', e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }} />
                    {i >= 2 && <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => setDraft({ ...draft, test_cases: draft.test_cases.filter((_, ti) => ti !== i) })} style={{ marginTop: '0.3rem' }} aria-label="Remove testcase"><Icon name="x" size={14} /></button>}
                  </div>
                ))}
                <div className="flex" style={{ marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowProblemForm(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Save problem</button>
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
                <Editor {...editorProps} language={sandboxLang === 'cpp' ? 'cpp' : sandboxLang} value={sandboxCode} onChange={val => setSandboxCode(val)} />
              </div>
              <div className="flex-between" style={{ marginTop: '1rem' }}>
                <span style={{ color: sandboxError ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.88rem' }}>{sandboxError || (sandboxTesting ? 'Evaluating…' : 'Write a solution to check your testcases')}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={runSandbox} disabled={sandboxTesting}>{sandboxTesting ? 'Running…' : 'Run tests'}</button>
              </div>
              {sandboxResults && (
                <div className="stack" style={{ marginTop: '1rem', gap: '0.5rem', maxHeight: 220, overflowY: 'auto' }}>
                  {sandboxResults.map((res, i) => (
                    <div key={i} style={{ border: `1.5px solid ${res.passed ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 10, padding: '0.55rem 0.8rem', fontSize: '0.82rem' }}>
                      <div className="flex" style={{ gap: '0.4rem', color: res.passed ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                        <Icon name={res.passed ? 'check' : 'x'} size={14} stroke={2.6} /> Case {i + 1} — {res.passed ? 'passed' : 'failed'}
                      </div>
                      {!res.passed && (
                        <div className="mono muted" style={{ marginTop: '0.3rem' }}>
                          <div>expected: {res.expected}</div>
                          <div>actual: {sanitizeActual(res.actual)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
