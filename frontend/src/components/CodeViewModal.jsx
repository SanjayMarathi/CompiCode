import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { API_URL, formatTime } from '../config';
import Icon from './Icon';
import { VerdictPill } from './SubmissionsPanel';
import { defineArenaThemes, monacoThemeName, onEditorMount, useDocumentTheme, EDITOR_OPTIONS } from '../monacoTheme';

const LANG_LABEL = { cpp: 'C++', python: 'Python', java: 'Java' };

/** Read-only view of the code a participant submitted (host only). */
export default function CodeViewModal({ contestId, submission, onClose }) {
  const theme = useDocumentTheme();
  const [state, setState] = useState({ loading: true, code: null, error: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    axios.get(`${API_URL}/contests/${contestId}/submissions/${submission.id}`)
      .then((res) => alive && setState({ loading: false, code: res.data.code, error: '' }))
      .catch((err) => alive && setState({ loading: false, code: null, error: err.response?.data?.detail || 'Could not load this code.' }));
    return () => { alive = false; };
  }, [contestId, submission.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  const tests = submission.total_testcases != null ? `${submission.testcases_passed} / ${submission.total_testcases} tests` : `${submission.testcases_passed} tests passed`;

  // Portalled to <body>: an animated (transformed) ancestor would otherwise become the
  // containing block for this position:fixed overlay and clip it to the panel.
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal code-modal" role="dialog" aria-modal="true" aria-label={`Code by ${submission.username}`}>
        <div className="modal-head" style={{ alignItems: 'flex-start' }}>
          <span className="avatar lg">{(submission.username || '?').charAt(0)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ marginBottom: '0.15rem', overflowWrap: 'anywhere' }}>{submission.username}</h3>
            <div className="list-meta" style={{ marginTop: 0 }}>
              <span>{submission.question_title}</span>
              <span className="dot" />
              <span>{LANG_LABEL[submission.language] || submission.language || 'Unknown language'}</span>
              <span className="dot" />
              <span>{tests}</span>
              <span className="dot" />
              <span>at {formatTime(submission.time_taken)}</span>
            </div>
          </div>
          <VerdictPill verdict={submission.verdict} />
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>

        <div className="modal-body">
          {state.loading && <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>}
          {!state.loading && state.error && <div className="banner danger"><Icon name="alert" size={18} /><span>{state.error}</span></div>}
          {!state.loading && !state.error && !state.code && (
            <div className="banner"><Icon name="eye" size={18} /><span>This submission was made before code was being saved, so its source isn&apos;t available.</span></div>
          )}
          {!state.loading && state.code && (
            <div className="code-box">
              <Editor
                height="100%"
                theme={monacoThemeName(theme)}
                beforeMount={defineArenaThemes}
                onMount={onEditorMount}
                language={submission.language === 'cpp' ? 'cpp' : (submission.language || 'plaintext')}
                value={state.code}
                options={{ ...EDITOR_OPTIONS, readOnly: true, domReadOnly: true, fontSize: 13, padding: { top: 12 }, renderLineHighlight: 'none', wordWrap: 'on' }}
              />
            </div>
          )}
        </div>

        <div className="modal-foot">
          {state.code && <button className="btn btn-secondary btn-sm" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied' : 'Copy code'}</button>}
          <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
