import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL, formatTime, timeAgo } from '../config';
import Icon from './Icon';
import CodeViewModal from './CodeViewModal';

const VERDICT = {
  accepted: { label: 'Accepted', cls: 'pill-active' },
  wrong_answer: { label: 'Wrong answer', cls: 'pill-ended' },
  error: { label: 'Error', cls: 'pill-ended' },
};
const LANG_LABEL = { cpp: 'C++', python: 'Python', java: 'Java' };

export function VerdictPill({ verdict }) {
  const v = VERDICT[verdict] || VERDICT.wrong_answer;
  return <span className={`pill ${v.cls}`}>{v.label}</span>;
}

/**
 * Host-only list of everything participants submitted, filterable by person and problem.
 * `userFilter` is lifted so clicking a name in the standings can jump straight here.
 */
export default function SubmissionsPanel({ contestId, live, userFilter, onUserFilter }) {
  const [rows, setRows] = useState(null); // null while the first load is in flight
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [problem, setProblem] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    const run = () => axios.get(`${API_URL}/contests/${contestId}/submissions`, { params: { limit: 500 } })
      .then((res) => {
        if (!alive) return;
        setRows(res.data.submissions);
        setTotal(res.data.total);
        setError('');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.response?.data?.detail || 'Could not load submissions.');
        setRows((prev) => prev ?? []);
      });
    run();
    const timer = live ? setInterval(run, 8000) : null;
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [contestId, live]);

  const people = useMemo(() => {
    const seen = new Map();
    (rows || []).forEach((r) => seen.set(r.user_id, r.username));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const problems = useMemo(() => {
    const seen = new Map();
    (rows || []).forEach((r) => seen.set(r.question_id, r.question_title));
    return [...seen.entries()];
  }, [rows]);

  const shown = (rows || []).filter((r) => (!userFilter || r.user_id === userFilter) && (!problem || r.question_id === problem));

  if (rows === null) return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
        <div className="filters">
          <select className="form-input" value={userFilter} onChange={(e) => onUserFilter(e.target.value)} aria-label="Filter by participant">
            <option value="">All participants</option>
            {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select className="form-input" value={problem} onChange={(e) => setProblem(e.target.value)} aria-label="Filter by problem">
            <option value="">All problems</option>
            {problems.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
          {(userFilter || problem) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { onUserFilter(''); setProblem(''); }}>Clear</button>
          )}
        </div>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {shown.length} of {total} submission{total === 1 ? '' : 's'}{live ? ' · live' : ''}
        </span>
      </div>

      {error && <div className="banner danger" style={{ marginBottom: '0.75rem' }}><Icon name="alert" size={18} /><span>{error}</span></div>}

      {shown.length === 0 ? (
        <div className="empty-state">
          <span className="eyebrow">{total === 0 ? 'No submissions yet' : 'No matches'}</span>
          {total === 0 ? 'Code appears here as soon as participants submit.' : 'Try clearing the filters.'}
        </div>
      ) : (
        <ul className="list">
          {shown.map((r) => (
            <li key={r.id} className="list-row">
              <span className="avatar">{(r.username || '?').charAt(0)}</span>
              <div className="list-main">
                <div className="list-title">{r.username} <span className="faint" style={{ fontWeight: 500 }}>· {r.question_title}</span></div>
                <div className="list-meta">
                  <span>{r.total_testcases != null ? `${r.testcases_passed}/${r.total_testcases} tests` : `${r.testcases_passed} tests`}</span>
                  <span className="dot" />
                  <span>{LANG_LABEL[r.language] || r.language || '—'}</span>
                  <span className="dot" />
                  <span>at {formatTime(r.time_taken)}</span>
                  <span className="dot" />
                  <span>{timeAgo(r.timestamp)}</span>
                </div>
              </div>
              <VerdictPill verdict={r.verdict} />
              <div className="list-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setOpen(r)} title={r.has_code ? 'View the submitted code' : 'No code was saved for this older submission'}>
                  <Icon name="code" size={14} /> View code
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && <CodeViewModal key={open.id} contestId={contestId} submission={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
