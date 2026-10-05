import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL, MODE_META, parseUtc } from '../config';
import Icon from '../components/Icon';
import StatusPill from '../components/StatusPill';
import ConfirmModal from '../components/ConfirmModal';

const readCache = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
};
const writeCache = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
};

// Newest first. Firestore ids are random strings, so sort on timestamps instead.
const sortNewest = (list) => [...list].sort((a, b) => {
  const ta = (parseUtc(a.created_at) || parseUtc(a.start_time) || 0).valueOf();
  const tb = (parseUtc(b.created_at) || parseUtc(b.start_time) || 0).valueOf();
  return tb - ta;
});

const formatDate = (c) => {
  const d = parseUtc(c.created_at) || parseUtc(c.start_time);
  if (!d) return 'Not started';
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export default function Dashboard({ user }) {
  const hostedKey = `dashboard_cache_hosted_${user.id}`;
  const partKey = `dashboard_cache_participated_${user.id}`;

  const [linkCode, setLinkCode] = useState('');
  const [hosted, setHosted] = useState(() => readCache(hostedKey));
  const [participated, setParticipated] = useState(() => readCache(partKey));
  const [loading, setLoading] = useState(() => !localStorage.getItem(hostedKey));
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('hosted');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [hostRes, partRes] = await Promise.all([
          axios.get(`${API_URL}/user/contests/hosted`),
          axios.get(`${API_URL}/user/contests/participated`),
        ]);
        if (!alive) return;
        const h = sortNewest(hostRes.data);
        const p = sortNewest(partRes.data);
        setHosted(h);
        setParticipated(p);
        writeCache(hostedKey, h);
        writeCache(partKey, p);
      } catch (e) {
        console.error('Failed to load history', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [hostedKey, partKey]);

  const joinContest = (e) => {
    e.preventDefault();
    const code = linkCode.trim();
    if (code) navigate(`/contest/${code}`);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/contests/${toDelete.id}`);
      const h = hosted.filter(c => c.id !== toDelete.id);
      const p = participated.filter(c => c.id !== toDelete.id);
      setHosted(h);
      setParticipated(p);
      writeCache(hostedKey, h);
      writeCache(partKey, p);
      setToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete the contest. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // The host is auto-joined to their own contests; don't list those twice.
  const hostedIds = useMemo(() => new Set(hosted.map(c => c.id)), [hosted]);
  const joinedOnly = useMemo(() => participated.filter(c => !hostedIds.has(c.id)), [participated, hostedIds]);

  const q = searchQuery.trim().toLowerCase();
  const matches = (c) => !q || [c.title, c.link_code, c.host_name].some(v => (v || '').toLowerCase().includes(q));
  const rows = (tab === 'hosted' ? hosted : joinedOnly).filter(matches);

  return (
    <div className="container">
      <header className="fade-in-up" style={{ marginBottom: '3.25rem' }}>
        <div className="display-stack sm">
          <span className="eyebrow" style={{ marginBottom: '0.6rem' }}>Welcome back, {user.username}</span>
          <span className="d-xl">Arena</span>
          <span className="d-mid">Dashboard</span>
        </div>
      </header>

      <div className="grid grid-2" style={{ marginBottom: '3rem', gap: '2.5rem 1.75rem' }}>
        <div className="bcard fade-in-up stagger-1">
          <span className="bubble"><Icon name="key" size={26} /></span>
          <h3 className="bcard-title">Join a contest</h3>
          <p className="bcard-text" style={{ marginBottom: '1.1rem' }}>Enter the access code the host shared with you.</p>
          <form onSubmit={joinContest} style={{ display: 'flex', gap: '0.6rem' }}>
            <input className="form-input mono" placeholder="ACCESS CODE" required value={linkCode} onChange={e => setLinkCode(e.target.value)} style={{ letterSpacing: '0.14em', fontWeight: 700 }} />
            <button className="btn btn-primary">Join</button>
          </form>
        </div>

        <div className="bcard is-filled bubble-left fade-in-up stagger-2" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="bubble"><Icon name="plus" size={26} /></span>
          <h3 className="bcard-title">Host a contest</h3>
          <p className="bcard-text" style={{ marginBottom: '1.1rem', flex: 1 }}>Pick a mode, add problems and invite people with a link. Private contests let you approve every request.</p>
          <div><button className="btn btn-primary" onClick={() => navigate('/host')}>Create contest <Icon name="arrow-right" size={18} /></button></div>
        </div>
      </div>

      <section className="panel fade-in-up stagger-3">
        <div className="panel-head">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'hosted'} className={`tab ${tab === 'hosted' ? 'is-on' : ''}`} onClick={() => setTab('hosted')}>
              Hosted <span className="tab-count">{hosted.length}</span>
            </button>
            <button role="tab" aria-selected={tab === 'joined'} className={`tab ${tab === 'joined' ? 'is-on' : ''}`} onClick={() => setTab('joined')}>
              Joined <span className="tab-count">{joinedOnly.length}</span>
            </button>
          </div>
          <div className="search-field">
            <span className="icon"><Icon name="search" size={16} /></span>
            <input type="text" className="form-input" placeholder="Search title, code or host" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <span className="eyebrow">{q ? 'No matches' : 'Nothing here yet'}</span>
            {q ? 'Try a different search.' : tab === 'hosted' ? 'Contests you create will show up here.' : 'Contests you join will show up here.'}
          </div>
        ) : (
          <ul className="list">
            {rows.map((c) => {
              const meta = MODE_META[c.mode] || MODE_META.standard;
              return (
                <li key={c.id} className="list-row">
                  <span className="avatar outline" style={{ borderRadius: 12 }}><Icon name={meta.icon} size={18} /></span>
                  <div className="list-main">
                    <div className="list-title">{c.title}</div>
                    <div className="list-meta">
                      <span className="mono" style={{ letterSpacing: '0.1em' }}>{c.link_code}</span>
                      <span className="dot" />
                      <span>{meta.label}</span>
                      {c.visibility === 'private' && <><span className="dot" /><span className="flex" style={{ gap: 4 }}><Icon name="lock" size={12} /> Private</span></>}
                      <span className="dot" />
                      <span>{formatDate(c)}</span>
                      {tab === 'joined' && <><span className="dot" /><span>by {c.host_name}</span></>}
                    </div>
                  </div>
                  <StatusPill status={c.status} reason={c.end_reason} />
                  <div className="list-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/contest/${c.link_code}`)}>Open</button>
                    {tab === 'hosted' && (
                      <button className="btn btn-danger btn-icon btn-sm" title="Delete contest" aria-label={`Delete ${c.title}`} onClick={() => setToDelete(c)}>
                        <Icon name="trash" size={15} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={!!toDelete}
        tone="danger"
        title="Delete contest"
        confirmLabel="Delete forever"
        busy={deleting}
        requireText={toDelete?.title}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      >
        This permanently deletes <strong style={{ color: 'var(--text-primary)' }}>{toDelete?.title}</strong> along with its participants and every submission.
        {toDelete?.status === 'active' && <> The contest is <strong style={{ color: 'var(--danger)' }}>live right now</strong> — everyone inside will be removed.</>}
        {' '}This cannot be undone.
      </ConfirmModal>
    </div>
  );
}
