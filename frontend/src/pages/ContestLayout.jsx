import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL, WS_URL, MODE_META, END_REASON_TEXT, formatTime, formatPenalty, timeAgo } from '../config';
import CodeforcesStandings from '../components/CodeforcesStandings';
import ConfirmModal from '../components/ConfirmModal';
import StatusPill from '../components/StatusPill';
import SubmissionsPanel from '../components/SubmissionsPanel';
import Icon from '../components/Icon';

const letter = (i) => String.fromCharCode(65 + (i % 26));

/* ---------- Host approval queue ---------- */
function JoinRequests({ requests, busy, onAccept, onReject, onAcceptAll }) {
  return (
    <section className="panel fade-in-up">
      <div className="panel-head">
        <div className="flex">
          <h3 style={{ margin: 0 }}>Join requests</h3>
          <span className="tab-count" style={{ border: '1.5px solid var(--line-strong)', color: 'var(--text-primary)' }}>{requests.length}</span>
        </div>
        {requests.length > 1 && (
          <button className="btn btn-secondary btn-sm" onClick={onAcceptAll} disabled={busy}><Icon name="check" size={15} /> Accept all</button>
        )}
      </div>
      {requests.length === 0 ? (
        <div className="empty-state" style={{ padding: '1.25rem 1rem' }}>
          <span className="eyebrow">All clear</span>
          New requests appear here automatically.
        </div>
      ) : (
        <div className="req-list">
          {requests.map((p) => (
            <div key={p.id} className="req-row">
              <span className="avatar">{(p.username || '?').charAt(0)}</span>
              <div className="req-who">
                <div className="req-name">{p.username}</div>
                <div className="req-time">{p.requested_at ? `Requested ${timeAgo(p.requested_at)}` : 'Waiting for approval'}</div>
              </div>
              <div className="req-actions">
                <button className="btn btn-danger btn-sm" onClick={() => onReject(p.id)} disabled={busy} aria-label={`Decline ${p.username}`}><Icon name="x" size={15} /> Decline</button>
                <button className="btn btn-primary btn-sm" onClick={() => onAccept(p.id)} disabled={busy} aria-label={`Accept ${p.username}`}><Icon name="check" size={15} /> Accept</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Full-page status card (loading errors, pending, declined) ---------- */
function CenterCard({ icon, title, children, actions, spin }) {
  return (
    <div className="center-screen">
      <div className="bcard fade-in-up" style={{ '--cx': '50%', width: '100%', maxWidth: 480, textAlign: 'center', padding: '3rem 2rem 2rem' }}>
        <span className="bubble"><Icon name={icon} size={26} /></span>
        <h2 style={{ fontSize: '1.9rem' }}>{title}</h2>
        <div className="bcard-text" style={{ marginBottom: actions ? '1.5rem' : 0 }}>{children}</div>
        {spin && <div className="spinner" style={{ margin: '0 auto 1.5rem' }} />}
        {actions}
      </div>
    </div>
  );
}

export default function ContestLayout({ userObj }) {
  const { linkCode } = useParams();
  const navigate = useNavigate();

  const [contest, setContest] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [leaderboard, setLeaderboard] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`leaderboard_cache_${linkCode}`)) || []; } catch { return []; }
  });
  const [solvedIds, setSolvedIds] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scheduledCountdown, setScheduledCountdown] = useState(null);
  const [participantStatus, setParticipantStatus] = useState(null);
  const [pending, setPending] = useState([]);
  const [reqBusy, setReqBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [dialog, setDialog] = useState(null); // 'end' | 'delete' | { kick: {id, name} }
  const [dialogBusy, setDialogBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [hostTab, setHostTab] = useState('standings'); // host only: 'standings' | 'submissions'
  const [inspectUser, setInspectUser] = useState('');

  const goneRef = useRef(false); // set once we are leaving because the contest was deleted
  const startingRef = useRef(false);

  // Primitives pulled out so effects depend on exactly what they read.
  const cid = contest?.id;
  const cStatus = contest?.status;
  const cMode = contest?.mode;
  const cVisibility = contest?.visibility;
  const cSchedule = contest?.scheduled_start_time;
  const cLimit = contest?.overall_time_limit;
  const cElapsed = contest?.server_elapsed_seconds;
  const uid = userObj?.id;

  const isHost = !!(uid && contest && uid === contest.host_id);
  const contestStarted = cStatus === 'active';
  const meta = MODE_META[cMode] || MODE_META.standard;

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  };
  const copyInviteLink = async () => {
    if (await copyText(`${window.location.origin}/contest/${linkCode}`)) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const fetchLeaderboard = useCallback(async (id) => {
    try {
      const res = await axios.get(`${API_URL}/contests/${id}/leaderboard`);
      setLeaderboard(res.data);
      try { localStorage.setItem(`leaderboard_cache_${linkCode}`, JSON.stringify(res.data)); } catch { /* ignore */ }
    } catch { /* keep the last known standings */ }
  }, [linkCode]);

  const fetchMySolved = useCallback(async (id) => {
    try {
      const res = await axios.get(`${API_URL}/contests/${id}/my-solved`);
      setSolvedIds(res.data.solved_question_ids || []);
    } catch { /* ignore */ }
  }, []);

  const fetchPending = useCallback(async (id) => {
    try {
      const res = await axios.get(`${API_URL}/contests/${id}/pending`);
      setPending(res.data);
    } catch { /* ignore */ }
  }, []);

  const handleDeleted = useCallback(() => {
    if (goneRef.current) return;
    goneRef.current = true;
    alert('This contest was deleted by its host.');
    navigate('/dashboard');
  }, [navigate]);

  // Initial load + join handshake.
  useEffect(() => {
    let alive = true;
    setLoadError(null);
    (async () => {
      let data;
      try {
        data = (await axios.get(`${API_URL}/contests/${linkCode}`)).data;
      } catch (err) {
        if (alive) setLoadError(err.response?.status === 404 ? 'notfound' : 'network');
        return;
      }
      if (!alive) return;
      setContest(data);

      if (data.status === 'ended') {
        setParticipantStatus('accepted');
      } else {
        let status = null;
        try {
          status = (await axios.post(`${API_URL}/contests/${data.id}/join`)).data.status;
        } catch {
          try { status = (await axios.get(`${API_URL}/contests/${data.id}/my-status`)).data.status; } catch { /* fall through */ }
        }
        // If the handshake failed entirely, fail closed for private contests.
        if (alive) setParticipantStatus(status || (data.visibility === 'private' ? 'pending' : 'accepted'));
      }
      fetchLeaderboard(data.id);
      fetchMySolved(data.id);
    })();
    return () => { alive = false; };
  }, [linkCode, reloadKey, fetchLeaderboard, fetchMySolved]);

  // Host: show the approval queue immediately instead of after the first poll.
  useEffect(() => {
    if (isHost && cVisibility === 'private' && cStatus !== 'ended') fetchPending(cid);
  }, [isHost, cid, cVisibility, cStatus, fetchPending]);

  // One poll drives status changes, standings, approvals and the pending-user check.
  useEffect(() => {
    if (!cid || cStatus === 'ended') return;
    const id = cid;
    const tick = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/contests/${linkCode}`);
        setContest(prev => (prev && prev.status === data.status ? prev : data));
      } catch (err) {
        if (err.response?.status === 404) handleDeleted();
      }
      fetchLeaderboard(id);
      fetchMySolved(id);
      if (!isHost && participantStatus === 'pending') {
        try {
          const { data } = await axios.get(`${API_URL}/contests/${id}/my-status`);
          if (data.status === 'accepted' || data.status === 'rejected') setParticipantStatus(data.status);
        } catch { /* ignore */ }
      }
      if (isHost && cVisibility === 'private') fetchPending(id);
    };
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
  }, [cid, cStatus, cVisibility, linkCode, isHost, participantStatus, fetchLeaderboard, fetchMySolved, fetchPending, handleDeleted]);

  // Countdown for standard + timed contests, driven by the server's clock.
  useEffect(() => {
    if (cStatus !== 'active' || !cMode || cMode === 'sudden_death') return;
    const startedAt = Date.now() - (cElapsed || 0) * 1000;
    const limitSec = (cLimit || 0) * 60;
    const update = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(elapsed);
      if (limitSec && elapsed >= limitSec) {
        setContest(prev => (prev && prev.status === 'active' ? { ...prev, status: 'ended', end_reason: 'time_up' } : prev));
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [cid, cStatus, cMode, cLimit, cElapsed]);

  const handleHostStart = useCallback(async () => {
    if (startingRef.current || !cid) return;
    startingRef.current = true;
    try {
      await axios.post(`${API_URL}/contests/${cid}/start`);
      if (cMode === 'sudden_death') {
        navigate(`/solve/${cid}/sudden-death`);
      } else {
        setContest(prev => ({ ...prev, status: 'active', server_elapsed_seconds: 0 }));
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start the contest.');
    } finally {
      startingRef.current = false;
    }
  }, [cid, cMode, navigate]);

  // Scheduled start countdown (the host's browser triggers the start).
  useEffect(() => {
    if (cStatus !== 'waiting' || !cSchedule) return;
    const startMs = new Date(cSchedule).getTime();
    const update = () => {
      const diffMs = startMs - Date.now();
      if (diffMs <= 0) {
        setScheduledCountdown(0);
        if (isHost) handleHostStart();
        else if (cMode === 'sudden_death') navigate(`/solve/${cid}/sudden-death`);
      } else {
        setScheduledCountdown(Math.floor(diffMs / 1000));
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [cid, cStatus, cSchedule, cMode, isHost, handleHostStart, navigate]);

  // Live pushes: kicks, host ending the contest, deletion.
  useEffect(() => {
    if (!cid || !uid) return;
    const ws = new WebSocket(`${WS_URL}/ws/contest/${cid}`);
    ws.onmessage = async (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'KICK_USER' && msg.user_id === uid) {
        alert('You have been kicked from the contest by the host.');
        navigate('/dashboard');
      } else if (msg.type === 'CONTEST_DELETED') {
        handleDeleted();
      } else if (msg.type === 'CONTEST_ENDED') {
        try {
          const { data } = await axios.get(`${API_URL}/contests/${cid}/info`);
          setContest(prev => ({ ...prev, ...data, status: 'ended' }));
        } catch {
          setContest(prev => ({ ...prev, status: 'ended' }));
        }
      }
    };
    return () => ws.close();
  }, [cid, uid, navigate, handleDeleted]);

  const handleAccept = async (userId) => {
    setReqBusy(true);
    try {
      await axios.post(`${API_URL}/contests/${contest.id}/accept/${userId}`);
      setPending(p => p.filter(x => x.id !== userId));
      fetchLeaderboard(contest.id);
    } catch { alert('Could not accept that request.'); }
    setReqBusy(false);
  };
  const handleReject = async (userId) => {
    setReqBusy(true);
    try {
      await axios.post(`${API_URL}/contests/${contest.id}/reject/${userId}`);
      setPending(p => p.filter(x => x.id !== userId));
    } catch { alert('Could not decline that request.'); }
    setReqBusy(false);
  };
  const handleAcceptAll = async () => {
    setReqBusy(true);
    const results = await Promise.allSettled(pending.map(p => axios.post(`${API_URL}/contests/${contest.id}/accept/${p.id}`)));
    const okIds = new Set(pending.filter((_, i) => results[i].status === 'fulfilled').map(p => p.id));
    setPending(p => p.filter(x => !okIds.has(x.id)));
    fetchLeaderboard(contest.id);
    setReqBusy(false);
  };

  const runDialogAction = async () => {
    setDialogBusy(true);
    try {
      if (dialog === 'end') {
        await axios.post(`${API_URL}/contests/${contest.id}/end`);
        setContest(prev => ({ ...prev, status: 'ended', end_reason: 'host' }));
      } else if (dialog === 'delete') {
        goneRef.current = true; // our own delete must not trigger the "deleted by host" notice
        await axios.delete(`${API_URL}/contests/${contest.id}`);
        navigate('/dashboard');
        return;
      } else if (dialog?.kick) {
        await axios.delete(`${API_URL}/contests/${contest.id}/kick/${dialog.kick.id}`);
        fetchLeaderboard(contest.id);
      }
      setDialog(null);
    } catch (err) {
      goneRef.current = false;
      alert(err.response?.data?.detail || 'That action failed. Please try again.');
      setDialog(null);
    } finally {
      setDialogBusy(false);
    }
  };

  /* ---------- Non-contest states ---------- */
  if (loadError) {
    return (
      <CenterCard
        icon="alert"
        title={loadError === 'notfound' ? 'Contest not found' : 'Cannot reach the server'}
        actions={
          <div className="flex" style={{ justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Dashboard</button>
            {loadError === 'network' && <button className="btn btn-primary" onClick={() => setReloadKey(k => k + 1)}>Try again</button>}
          </div>
        }
      >
        {loadError === 'notfound' ? 'Check the access code and try again. The contest may have been deleted.' : 'The contest could not be loaded. Check your connection and try again.'}
      </CenterCard>
    );
  }

  if (!contest || (!isHost && participantStatus === null && contest.status !== 'ended')) {
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p className="eyebrow pulse-text" style={{ marginTop: '1rem' }}>Entering the arena</p>
      </div>
    );
  }

  if (!isHost && participantStatus === 'pending') {
    return (
      <CenterCard
        icon="hourglass"
        title="Waiting for approval"
        spin
        actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>Back to dashboard</button>}
      >
        <strong style={{ color: 'var(--text-primary)' }}>{contest.title}</strong> is a private contest{contest.host_name ? <> hosted by {contest.host_name}</> : null}. You will be let in as soon as the host accepts your request.
      </CenterCard>
    );
  }

  if (!isHost && participantStatus === 'rejected') {
    return (
      <CenterCard
        icon="x"
        title="Request declined"
        actions={<button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>}
      >
        The host did not accept your request to join <strong style={{ color: 'var(--text-primary)' }}>{contest.title}</strong>.
      </CenterCard>
    );
  }

  /* ---------- Shared pieces ---------- */
  const remaining = Math.max(0, (contest.overall_time_limit || 0) * 60 - elapsedSeconds);
  const showTimer = contestStarted && contest.mode !== 'sudden_death' && contest.overall_time_limit;
  const lowTime = showTimer && remaining <= Math.min(60, contest.overall_time_limit * 6);

  const header = (
    <header className="panel fade-in" style={{ marginBottom: '1.5rem' }}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{meta.label} contest{contest.host_name ? ` · hosted by ${contest.host_name}` : ''}</span>
          <h1 style={{ margin: '0.35rem 0 0.75rem', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', overflowWrap: 'anywhere' }}>{contest.title}</h1>
          <div className="flex" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <StatusPill status={contest.status} reason={contest.end_reason} />
            {contest.visibility === 'private' && <span className="badge"><Icon name="lock" size={12} /> Private</span>}
            {isHost && <span className="badge badge-solid">Host</span>}
            <button className="code-chip" onClick={() => copyText(linkCode)} title="Copy access code"><Icon name="copy" size={13} /> {linkCode}</button>
            <button className="btn btn-secondary btn-sm" onClick={copyInviteLink}>
              <Icon name={linkCopied ? 'check' : 'link'} size={14} /> {linkCopied ? 'Copied' : 'Copy invite link'}
            </button>
          </div>
        </div>
        <div className="flex" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.6rem' }}>
          {showTimer && (
            <span className={`timer-chip ${lowTime ? 'low' : ''}`}><span className="tl">Time left</span>{formatTime(remaining)}</span>
          )}
          {isHost && contest.status === 'active' && (
            <button className="btn btn-danger btn-sm" onClick={() => setDialog('end')}>End contest</button>
          )}
          {isHost && (
            <button className="btn btn-danger btn-icon btn-sm" onClick={() => setDialog('delete')} title="Delete contest" aria-label="Delete contest"><Icon name="trash" size={15} /></button>
          )}
        </div>
      </div>
    </header>
  );

  const canReview = isHost && contest.status !== 'waiting';
  const standingsTitle = contest.status === 'ended' ? 'Final standings' : 'Standings';
  const standings = (
    <section className="panel fade-in-up stagger-2">
      <div className="panel-head">
        {canReview ? (
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={hostTab === 'standings'} className={`tab ${hostTab === 'standings' ? 'is-on' : ''}`} onClick={() => setHostTab('standings')}>{standingsTitle}</button>
            <button role="tab" aria-selected={hostTab === 'submissions'} className={`tab ${hostTab === 'submissions' ? 'is-on' : ''}`} onClick={() => setHostTab('submissions')}>
              <Icon name="code" size={15} /> Submissions
            </button>
          </div>
        ) : (
          <h3>{standingsTitle}</h3>
        )}
      </div>
      {canReview && hostTab === 'submissions' ? (
        <SubmissionsPanel contestId={contest.id} live={contest.status === 'active'} userFilter={inspectUser} onUserFilter={setInspectUser} />
      ) : (
        <CodeforcesStandings
          leaderboard={leaderboard}
          questions={contest.questions}
          mode={contest.mode}
          isHost={isHost}
          onKick={(id, name) => setDialog({ kick: { id, name } })}
          onInspect={canReview ? (id) => { setInspectUser(id); setHostTab('submissions'); } : undefined}
          meId={userObj?.id}
        />
      )}
    </section>
  );

  const requestsPanel = isHost && contest.visibility === 'private' && contest.status !== 'ended' && (
    <JoinRequests requests={pending} busy={reqBusy} onAccept={handleAccept} onReject={handleReject} onAcceptAll={handleAcceptAll} />
  );

  const dialogs = (
    <>
      <ConfirmModal
        open={dialog === 'end'} tone="danger" title="End contest" confirmLabel="End for everyone"
        busy={dialogBusy} onConfirm={runDialogAction} onCancel={() => setDialog(null)}
      >
        This ends <strong style={{ color: 'var(--text-primary)' }}>{contest.title}</strong> for every participant immediately. Standings are locked and no more submissions are accepted.
      </ConfirmModal>
      <ConfirmModal
        open={dialog === 'delete'} tone="danger" title="Delete contest" confirmLabel="Delete forever"
        requireText={contest.title} busy={dialogBusy} onConfirm={runDialogAction} onCancel={() => setDialog(null)}
      >
        This permanently deletes <strong style={{ color: 'var(--text-primary)' }}>{contest.title}</strong>, its participants and every submission. Anyone inside is removed. This cannot be undone.
      </ConfirmModal>
      <ConfirmModal
        open={!!dialog?.kick} tone="danger" title="Kick participant" confirmLabel="Kick"
        busy={dialogBusy} onConfirm={runDialogAction} onCancel={() => setDialog(null)}
      >
        Remove <strong style={{ color: 'var(--text-primary)' }}>{dialog?.kick?.name}</strong> from the contest? All of their submissions will be deleted.
      </ConfirmModal>
    </>
  );

  /* ---------- Ended ---------- */
  if (contest.status === 'ended') {
    return (
      <div className="container">
        {header}
        <div className="bcard bubble-left fade-in-up" style={{ marginBottom: '2.5rem', textAlign: 'center', padding: '2.8rem 1.5rem 2rem' }}>
          <span className="bubble"><Icon name="flag" size={24} /></span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)' }}>Contest ended</h2>
          <p className="bcard-text" style={{ marginBottom: '1.4rem' }}>{END_REASON_TEXT[contest.end_reason] || 'This contest is over. Final standings are locked.'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </div>
        {standings}
        {dialogs}
      </div>
    );
  }

  /* ---------- Lobby (not started) ---------- */
  if (!contestStarted) {
    const countdown = scheduledCountdown !== null && scheduledCountdown > 0 ? formatTime(scheduledCountdown) : '0:00';
    return (
      <div className="container">
        {header}
        <div className="stack">
          <section className="fade-in-up stagger-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '2rem 1.25rem', marginBottom: '0.5rem' }}>
            {[
              { icon: 'list', value: contest.questions.length, label: 'Problems' },
              { icon: 'clock', value: `${contest.overall_time_limit}m`, label: 'Time limit' },
              { icon: 'alert', value: formatPenalty(contest.penalty_per_wrong_answer), label: 'Wrong answer' },
            ].map((s) => (
              <div key={s.label} className="bcard bcard-sm">
                <span className="bubble"><Icon name={s.icon} size={20} /></span>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </section>

          <section className="bcard is-filled bubble-left fade-in-up stagger-2" style={{ textAlign: 'center', padding: '3rem 1.75rem 2.2rem' }}>
            <span className="bubble"><Icon name={meta.icon} size={26} /></span>
            <h2 style={{ fontSize: '1.9rem' }}>{meta.label}</h2>
            <p className="bcard-text" style={{ maxWidth: 560, margin: '0 auto 1.75rem' }}>{meta.desc}</p>

            {contest.scheduled_start_time ? (
              <>
                <div className="timer-xl" style={{ marginBottom: '0.6rem' }}>{countdown}</div>
                <p className="bcard-text pulse-text">
                  {scheduledCountdown !== null && scheduledCountdown <= 0
                    ? (isHost ? 'Starting…' : 'Entering the arena…')
                    : isHost ? 'The contest starts automatically — keep this tab open.' : 'The contest begins soon.'}
                </p>
              </>
            ) : isHost ? (
              <>
                <p className="bcard-text" style={{ marginBottom: '1.25rem' }}>Share the invite link, then start when everyone is ready.</p>
                <button className="btn btn-primary btn-lg" onClick={handleHostStart}><Icon name="play" size={18} /> Start contest</button>
              </>
            ) : contest.mode === 'sudden_death' ? (
              <>
                <p className="bcard-text" style={{ marginBottom: '1.25rem' }}>The arena is ready. Enter the lobby to secure your spot.</p>
                <button className="btn btn-primary btn-lg" onClick={() => navigate(`/solve/${contest.id}/sudden-death`)}>Enter lobby <Icon name="arrow-right" size={18} /></button>
              </>
            ) : (
              <>
                <div className="spinner" style={{ margin: '0 auto 1rem', borderColor: 'color-mix(in srgb, var(--on-accent) 25%, transparent)', borderTopColor: 'var(--on-accent)' }} />
                <p className="bcard-text pulse-text">Waiting for the host to start the contest…</p>
              </>
            )}
          </section>

          {requestsPanel}
          {standings}
        </div>
        {dialogs}
      </div>
    );
  }

  /* ---------- Live ---------- */
  const isLateJoiner = !isHost && contest.mode !== 'sudden_death';
  return (
    <div className="container">
      {header}
      <div className="stack">
        {isLateJoiner && elapsedSeconds > 20 && (
          <div className="banner slide-in-right"><Icon name="bolt" size={18} /><span><strong>Contest in progress.</strong> Pick a problem and start solving.</span></div>
        )}

        {contest.mode === 'sudden_death' && (
          <section className="bcard is-filled bubble-left fade-in-scale" style={{ textAlign: 'center', padding: '3rem 1.75rem 2.2rem' }}>
            <span className="bubble"><Icon name="bolt" size={26} /></span>
            <h2 style={{ fontSize: '1.9rem' }}>Sudden death is live</h2>
            <p className="bcard-text" style={{ marginBottom: '1.5rem' }}>The match is under way. Jump into the arena to compete.</p>
            <button className="btn btn-primary btn-lg" onClick={() => navigate(`/solve/${contest.id}/sudden-death`)}>Enter arena <Icon name="arrow-right" size={18} /></button>
          </section>
        )}

        {requestsPanel}

        {contest.mode !== 'sudden_death' && (
          <section className="panel fade-in-up stagger-1">
            <div className="panel-head"><h3>Problems</h3><span className="muted" style={{ fontSize: '0.88rem' }}>{solvedIds.length} / {contest.questions.length} solved</span></div>
            <ul className="list">
              {contest.questions.map((q, idx) => {
                const isSolved = solvedIds.includes(q.id);
                let locked = false;
                if (contest.mode === 'timed' && !isSolved) {
                  const startedAt = parseInt(localStorage.getItem(`contest_${contest.id}_q_${q.id}_start`), 10);
                  locked = Number.isFinite(startedAt) && Date.now() - startedAt >= (q.time_limit || 0) * 1000;
                }
                return (
                  <li key={q.id} className="list-row">
                    <span className="avatar" style={isSolved ? { background: 'var(--success)', color: '#fff' } : undefined}>{isSolved ? <Icon name="check" size={18} stroke={2.4} /> : letter(idx)}</span>
                    <div className="list-main">
                      <div className="list-title">{q.title}</div>
                      <div className="list-meta">
                        <span>{q.points} pts</span>
                        {contest.mode === 'timed' && <><span className="dot" /><span>{q.time_limit}s limit</span></>}
                      </div>
                    </div>
                    {isSolved ? (
                      <Link to={`/solve/${contest.id}/${q.id}`} className="btn btn-success btn-sm">Review code</Link>
                    ) : locked ? (
                      <button className="btn btn-ghost btn-sm" disabled title="Your time on this problem has run out"><Icon name="lock" size={14} /> Locked</button>
                    ) : (
                      <Link to={`/solve/${contest.id}/${q.id}`} className="btn btn-primary btn-sm">Solve <Icon name="arrow-right" size={15} /></Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {standings}
      </div>
      {dialogs}
    </div>
  );
}
