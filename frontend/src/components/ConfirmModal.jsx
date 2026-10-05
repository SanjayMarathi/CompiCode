import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

/**
 * Themed replacement for window.confirm.
 * `requireText` makes the user type a phrase before the confirm button unlocks
 * (used for irreversible actions such as deleting a contest).
 */
export default function ConfirmModal({ open, ...props }) {
  // The inner component mounts fresh on every open, so typed text never leaks between uses.
  return open ? <ConfirmDialog {...props} /> : null;
}

function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  requireText,
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const locked = requireText ? typed.trim() !== requireText.trim() : false;
  const danger = tone === 'danger';

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          {danger && <span className="modal-icon danger"><Icon name="alert" size={20} /></span>}
          <h3 style={danger ? { color: 'var(--danger)' } : undefined}>{title}</h3>
        </div>
        <div className="modal-body">
          {children}
          {requireText && (
            <div style={{ marginTop: '1rem' }}>
              <label className="io-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                Type <span className="mono" style={{ color: 'var(--text-primary)', letterSpacing: 0, textTransform: 'none' }}>{requireText}</span> to confirm
              </label>
              <input className="form-input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={requireText} />
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy || locked}
            style={danger && !locked && !busy ? { background: 'var(--danger)', color: '#fff' } : undefined}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
