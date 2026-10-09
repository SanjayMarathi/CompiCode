import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { API_URL, WS_URL, boilerplates, formatTime } from '../config';
import CodeforcesStandings from '../components/CodeforcesStandings';
import ConfirmModal from '../components/ConfirmModal';
import Icon from '../components/Icon';
import { defineArenaThemes, monacoThemeName, onEditorMount, useDocumentTheme, EDITOR_OPTIONS } from '../monacoTheme';

const HIDDEN_FROM = 2; // the first two testcases are shown to the player

/* ---------- Judge verdict ---------- */
function Verdict({ results }) {
  // Open on the first failing case that has details to show; hidden cases have none.
  const firstFail = results.findIndex(r => !r.passed);
  const firstVisibleFail = results.findIndex((r, i) => !r.passed && i < HIDDEN_FROM);
  const [sel, setSel] = useState(firstVisibleFail !== -1 ? firstVisibleFail : Math.max(firstFail, 0));

  const passedN = results.filter(r => r.passed).length;
  const allPass = passedN === results.length;
  const hasError = results.some(r => r.error);
  const title = allPass ? 'Accepted' : hasError ? 'Execution error' : 'Wrong answer';
  const cur = results[sel];
  const hidden = sel >= HIDDEN_FROM;

  return (
    <div className={`verdict ${allPass ? 'ok' : 'bad'} fade-in-scale`}>
      <div className="verdict-head">
        <span className="verdict-badge"><Icon name={allPass ? 'check' : 'x'} size={28} stroke={2.4} /></span>
        <div>
          <div className="verdict-title">{title}</div>
          <div className="verdict-sub">{passedN} of {results.length} testcases passed</div>
        </div>
      </div>

      <div className="case-strip" aria-hidden="true">
        {results.map((r, i) => <span key={i} className={`case-dot ${r.passed ? 'pass' : 'fail'}`} />)}
      </div>

      <div className="case-tabs" role="tablist">
        {results.map((r, i) => (
          <button key={i} role="tab" aria-selected={sel === i} className={`case-tab ${sel === i ? 'is-on' : ''}`} onClick={() => setSel(i)}>
            {i >= HIDDEN_FROM && <Icon name="lock" size={12} />}
            Case {i + 1}
            <span className={r.passed ? 'ok' : 'no'}><Icon name={r.passed ? 'check' : 'x'} size={13} stroke={2.6} /></span>
          </button>
        ))}
      </div>

      {cur && (
        hidden ? (
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            <Icon name="lock" size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Case {sel + 1} is a hidden testcase — it {cur.passed ? 'passed' : 'failed'}, but its data is not shown.
          </p>
        ) : (
          <div className="stack" style={{ gap: '1rem' }}>
            <div className="case-grid">
              <div><span className="io-label">Input</span><pre className="io-block">{cur.input || '(empty)'}</pre></div>
              <div><span className="io-label">Expected</span><pre className="io-block">{cur.expected}</pre></div>
              {!cur.error && <div><span className="io-label">Your output</span><pre className="io-block">{cur.actual || '(no output)'}</pre></div>}
            </div>
            {cur.error && (
              <div>
                <span className="io-label">Compiler / runtime message</span>
                <pre className="err-block" style={{ marginTop: '0.3rem' }}>{cur.error}</pre>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

function TimerChip({ label, value, low }) {
  return <span className={`timer-chip ${low ? 'low' : ''}`}><span className="tl">{label}</span>{value}</span>;
}

export default function SolvePlatform() {
  const { contestId, questionId } = useParams();
  const isSuddenDeath = questionId === 'sudden-death';
  const theme = useDocumentTheme();

  const navigate = useNavigate();
  const [language, setLanguage] = useState('cpp');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [code, setCode] = useState(() => {
    const saved = localStorage.getItem(`code_${contestId}_${questionId}`);
    return saved !== null ? saved : boilerplates['cpp'];
  });
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState('neutral'); // neutral | ok | bad
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [evalResults, setEvalResults] = useState(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [qData, setQData] = useState(null);
  const [alreadySolved, setAlreadySolved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sdState, setSdState] = useState(null);
  const [sdGlobalTimer, setSdGlobalTimer] = useState(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`leaderboard_cache_${contestId}`)) || []; } catch { return []; }
  });
  const [roundCountdown, setRoundCountdown] = useState(10);
  const [contestInfo, setContestInfo] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // contest clock
  const [questionElapsed, setQuestionElapsed] = useState(null); // timed mode: this problem's clock
  const [currentUser, setCurrentUser] = useState(null);
  const solvedRef = useRef(false);
  const ws = useRef(null);
  const roundCountdownRef = useRef(null);
  const currentUserRef = useRef(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    axios.get(`${API_URL}/me`).then(res => setCurrentUser(res.data)).catch(() => {});
  }, []);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  useEffect(() => {
    if (!isSuddenDeath) {
      setQData(null);
      setAlreadySolved(false);
      setStatus('');
      setStatusTone('neutral');
      setEvalResults(null);
      setIsSubmitting(false);
      setQuestionElapsed(null);
      solvedRef.current = false;

      const saved = localStorage.getItem(`code_${contestId}_${questionId}`);
      setCode(saved !== null ? saved : boilerplates[language]);

      fetchQuestionDetailed(questionId);
      axios.get(`${API_URL}/contests/${contestId}/my-solved`).then(res => {
        if ((res.data.solved_question_ids || []).map(String).includes(String(questionId))) {
          solvedRef.current = true;
          setAlreadySolved(true);
          setStatus('Already solved');
          setStatusTone('ok');
        }
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, questionId]);

  useEffect(() => {
    const fetchInfo = () => {
      axios.get(`${API_URL}/contests/${contestId}/info`).then(res => {
        setContestInfo(res.data);
        // Sudden death shows its own "Match over" screen when it finishes naturally.
        if (res.data.status === 'ended' && !isSuddenDeath) navigate(`/contest/${contestId}`);
      }).catch((err) => {
        if (err.response?.status === 404 && !deletingRef.current) {
          deletingRef.current = true;
          alert('This contest was deleted by its host.');
          navigate('/dashboard');
        }
      });
    };
    fetchInfo();
    const infoInterval = setInterval(fetchInfo, 5000);

    ws.current = new WebSocket(`${WS_URL}/ws/contest/${contestId}`);
    ws.current.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      const me = currentUserRef.current;
      if (msg.type === 'CONTEST_ENDED') {
        navigate(`/contest/${contestId}`);
      } else if (msg.type === 'CONTEST_DELETED') {
        if (!deletingRef.current) {
          deletingRef.current = true;
          alert('This contest was deleted by its host.');
          navigate('/dashboard');
        }
      } else if (msg.type === 'KICK_USER' && me && msg.user_id === me.id) {
        alert('You have been kicked from the contest by the host.');
        navigate('/dashboard');
      } else if (isSuddenDeath) {
        if (msg.type === 'SYNC_STATE') {
          setSdState(msg.data);
          setSdGlobalTimer(prev => prev === null ? msg.data.sync_timer : prev);
        } else if (msg.type === 'TIMER_TICK') {
          setSdGlobalTimer(msg.data);
        }
      }
    };

    return () => {
      clearInterval(infoInterval);
      if (ws.current) ws.current.close();
      if (roundCountdownRef.current) clearInterval(roundCountdownRef.current);
    };
  }, [contestId, isSuddenDeath, navigate]);

  // Esc leaves the maximised editor.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const endContest = async () => {
    try {
      deletingRef.current = true;
      await axios.post(`${API_URL}/contests/${contestId}/end`);
      setShowEndConfirm(false);
      navigate(`/contest/${contestId}`);
    } catch (e) {
      deletingRef.current = false;
      alert(e.response?.data?.detail || 'Failed to end contest');
      setShowEndConfirm(false);
    }
  };

  const refreshLeaderboard = () => axios.get(`${API_URL}/contests/${contestId}/leaderboard`).then(res => {
    setFinalLeaderboard(res.data);
    try { localStorage.setItem(`leaderboard_cache_${contestId}`, JSON.stringify(res.data)); } catch { /* ignore */ }
  }).catch(() => {});

  const confirmKick = async () => {
    const target = kickTarget;
    setKickTarget(null);
    if (!target) return;
    try {
      await axios.delete(`${API_URL}/contests/${contestId}/kick/${target.id}`);
      refreshLeaderboard();
    } catch (e) { alert(e.response?.data?.detail || 'Failed to kick participant'); }
  };

  // Contest clock for standard + timed. It is shared by every problem, so it must not restart per problem.
  useEffect(() => {
    if (isSuddenDeath || !contestInfo || (contestInfo.mode !== 'standard' && contestInfo.mode !== 'timed')) return;
    let start;
    if (contestInfo.server_elapsed_seconds !== undefined && contestInfo.server_elapsed_seconds !== null) {
      start = Date.now() - (contestInfo.server_elapsed_seconds * 1000);
    } else if (contestInfo.start_time) {
      start = new Date(contestInfo.start_time + 'Z').getTime();
    } else {
      const lsKey = `contest_${contestId}_start`;
      if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, Date.now().toString());
      start = parseInt(localStorage.getItem(lsKey));
    }

    const updateTimer = () => {
      const currentElapsed = Math.floor((Date.now() - start) / 1000);
      setElapsedSeconds(currentElapsed);
      // In timed mode the limit only closes the window for opening problems; the server ends the contest.
      if (contestInfo.mode === 'standard' && contestInfo.overall_time_limit && currentElapsed >= contestInfo.overall_time_limit * 60) {
        navigate(`/contest/${contestId}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuddenDeath, contestInfo, contestId]);

  // Timed mode: the server starts this problem's own countdown the first time it is opened.
  const contestMode = contestInfo?.mode;
  useEffect(() => {
    if (isSuddenDeath || contestMode !== 'timed') return;
    let alive = true;
    let interval;
    const lock = (message) => {
      setStatus(message);
      setStatusTone('bad');
      setAlreadySolved(true);
    };
    axios.post(`${API_URL}/contests/${contestId}/questions/${questionId}/start`).then(({ data }) => {
      if (!alive) return;
      const limit = data.time_limit;
      if (data.locked) {
        setQuestionElapsed(limit);
        if (!solvedRef.current) lock('Locked: Contest Time ran out before you opened this problem');
        return;
      }
      const start = Date.now() - data.elapsed_seconds * 1000;
      const tick = () => {
        const elapsed = Math.min(limit, Math.floor((Date.now() - start) / 1000));
        setQuestionElapsed(elapsed);
        return elapsed >= limit;
      };
      if (tick()) {
        if (!solvedRef.current) lock('Time is up — locked');
        return;
      }
      interval = setInterval(() => {
        if (solvedRef.current) { clearInterval(interval); return; }
        if (tick()) {
          clearInterval(interval);
          lock('Time is up — auto-submitting');
          if (executeSubmissionRef.current) executeSubmissionRef.current(null, true);
        }
      }, 1000);
    }).catch((err) => {
      if (alive) lock(err.response?.data?.detail || "Could not start this problem's timer. Reload to try again.");
    });
    return () => { alive = false; clearInterval(interval); };
  }, [isSuddenDeath, contestMode, contestId, questionId]);

  useEffect(() => {
    if (isSuddenDeath && sdState && sdState.state === 'WAITING_TO_START') {
      refreshLeaderboard();
      const interval = setInterval(refreshLeaderboard, 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuddenDeath, sdState?.state, contestId]);

  useEffect(() => {
    if (isSuddenDeath && sdState) {
      if (sdState.state === 'CONTEST_OVER' || sdState.state === 'ROUND_OVER') refreshLeaderboard();
      if (sdState.state === 'ROUND_OVER') {
        setRoundCountdown(10);
        if (roundCountdownRef.current) clearInterval(roundCountdownRef.current);
        roundCountdownRef.current = setInterval(() => {
          setRoundCountdown(prev => {
            if (prev <= 1) { clearInterval(roundCountdownRef.current); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        if (roundCountdownRef.current) clearInterval(roundCountdownRef.current);
      }
      if (sdState.active_question_id) {
        fetchQuestionDetailed(sdState.active_question_id);
        setAlreadySolved(false);
        setStatus('');
        setEvalResults(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdState, contestId, isSuddenDeath]);

  const fetchQuestionDetailed = async (qid) => {
    try {
      const resp = await axios.get(`${API_URL}/questions/${qid}`);
      setQData(resp.data);
    } catch { /* keep the previous problem on screen */ }
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    setCode(boilerplates[lang]);
  };

  const executeSubmissionRef = useRef();
  useEffect(() => {
    executeSubmissionRef.current = executeSubmission;
  });

  const executeSubmission = async (e, isAutoSubmit = false) => {
    if ((alreadySolved && !isAutoSubmit) || isSubmitting) return;
    setIsSubmitting(true);
    setStatus('');
    setStatusTone('neutral');
    setEvalResults(null);
    try {
      const activeQ = qData ? qData.id : questionId;
      const res = await axios.post(`${API_URL}/submit`, {
        code, language, question_id: String(activeQ), contest_id: String(contestId)
      });
      if (res.data.already_solved) {
        solvedRef.current = true;
        setStatus('Already solved');
        setStatusTone('ok');
        setAlreadySolved(true);
      } else if (res.data.error) {
        setStatus(res.data.error);
        setStatusTone('bad');
      } else {
        setEvalResults(res.data.results);
        setSubmitCount(c => c + 1);
        if (res.data.passed) {
          solvedRef.current = true;
          setStatus('Accepted');
          setStatusTone('ok');
          setAlreadySolved(true);
        } else {
          setStatus(res.data.results.some(r => r.error) ? 'Execution error' : 'Wrong answer');
          setStatusTone('bad');
        }
      }
    } catch (err) {
      setStatus(err.response?.data?.detail || 'Submission failed. Please try again.');
      setStatusTone('bad');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHost = !!(currentUser && contestInfo && currentUser.id === contestInfo.host_id);
  const standingsFor = (title) => (
    <div className="panel fade-in-up" style={{ width: '100%', maxWidth: 940, textAlign: 'left' }}>
      <CodeforcesStandings leaderboard={finalLeaderboard} questions={contestInfo?.questions} title={title} mode="sudden_death" isHost={isHost} meId={currentUser?.id} onKick={(id, name) => setKickTarget({ id, name })} />
    </div>
  );
  const kickModal = (
    <ConfirmModal open={!!kickTarget} tone="danger" title="Kick participant" confirmLabel="Kick" onConfirm={confirmKick} onCancel={() => setKickTarget(null)}>
      Remove <strong style={{ color: 'var(--text-primary)' }}>{kickTarget?.name}</strong> from the contest? All of their submissions will be deleted.
    </ConfirmModal>
  );

  /* ---------- Sudden death: full-screen states ---------- */
  if (isSuddenDeath && sdState && sdState.state === 'WAITING_TO_START') {
    return (
      <div className="center-screen fade-in" style={{ justifyContent: 'flex-start', paddingTop: '4rem' }}>
        <div className="bcard" style={{ '--cx': '50%', width: '100%', maxWidth: 560, textAlign: 'center', padding: '3rem 2rem 2rem', marginBottom: '2.5rem' }}>
          <span className="bubble"><Icon name="hourglass" size={26} /></span>
          <h1 className="pulse-text" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)' }}>Waiting for match start</h1>
          <p className="bcard-text">The host will start the match shortly. Stay on this page.</p>
        </div>
        {finalLeaderboard.length > 0 && standingsFor('Players in the lobby')}
        {kickModal}
      </div>
    );
  }

  if (isSuddenDeath && sdState && sdState.state === 'ROUND_OVER') {
    return (
      <div className="center-screen fade-in" style={{ justifyContent: 'flex-start', paddingTop: '3rem' }}>
        <div className="flex-between" style={{ width: '100%', maxWidth: 940, marginBottom: '1.75rem', textAlign: 'left' }}>
          <div className="display-stack sm slide-in-left">
            <span className="eyebrow">Round {sdState.current_q_idx + 1} complete</span>
            <span className="d-xl" style={{ fontSize: 'clamp(2rem, 6vw, 3.6rem)' }}>{sdState.winner ? sdState.winner : 'No winner'}</span>
            <span className="d-mid" style={{ margin: '0.3em 0 0' }}>{sdState.winner ? 'takes the round' : 'time ran out'}</span>
          </div>
          <div className="bcard bcard-sm" style={{ textAlign: 'center', minWidth: 170 }}>
            <span className="bubble"><Icon name="timer" size={20} /></span>
            <div className="stat-value">{roundCountdown}s</div>
            <div className="stat-label">Next round</div>
          </div>
        </div>
        {standingsFor('Standings')}
        {kickModal}
      </div>
    );
  }

  if (isSuddenDeath && sdState && sdState.state === 'CONTEST_OVER') {
    return (
      <div className="center-screen fade-in" style={{ justifyContent: 'flex-start', paddingTop: '3rem' }}>
        <div className="display-stack" style={{ alignItems: 'center', marginBottom: '2rem' }}>
          <span className="eyebrow">Final results</span>
          <span className="d-xl" style={{ margin: 0 }}>Match over</span>
        </div>
        <div style={{ width: '100%', maxWidth: 940, marginBottom: '1.5rem' }}>{standingsFor('Final standings')}</div>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        {kickModal}
      </div>
    );
  }

  /* ---------- Problem + editor ---------- */
  const timedQuestions = (!isSuddenDeath && contestInfo && contestInfo.mode === 'timed' && contestInfo.questions) ? contestInfo.questions : [];
  const activeContestQ = contestInfo?.questions?.find(x => String(x.id) === String(qData?.id || questionId));
  const overallRemaining = contestInfo?.overall_time_limit ? Math.max(0, contestInfo.overall_time_limit * 60 - elapsedSeconds) : 0;
  const timedQ = timedQuestions.find(x => String(x.id) === String(questionId));
  const timedRemaining = timedQ && questionElapsed !== null ? Math.max(0, timedQ.time_limit - questionElapsed) : null;
  const passedCount = evalResults ? evalResults.filter(r => r.passed).length : 0;

  const statusEl = status && (
    <span className="submit-state" style={{ color: statusTone === 'ok' ? 'var(--success)' : statusTone === 'bad' ? 'var(--danger)' : 'var(--text-secondary)' }}>
      {statusTone !== 'neutral' && <Icon name={statusTone === 'ok' ? 'check' : 'x'} size={16} stroke={2.6} />}
      {status}
    </span>
  );

  return (
    <div className="solve-container">
      <div className="flex-between fade-in">
        <div className="flex">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}><Icon name="arrow-left" size={16} /> Back</button>
          {isHost && <button className="btn btn-danger btn-sm" onClick={() => setShowEndConfirm(true)}>End contest</button>}
        </div>
        <div className="flex" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isSuddenDeath && sdGlobalTimer !== null && <TimerChip label="Contest time" value={formatTime(sdGlobalTimer)} low={sdGlobalTimer <= 60} />}
          {!isSuddenDeath && contestInfo && contestInfo.mode === 'standard' && <TimerChip label="Time left" value={formatTime(overallRemaining)} low={overallRemaining <= 60} />}
          {!isSuddenDeath && contestInfo && contestInfo.mode === 'timed' && (
            <>
              {contestInfo.overall_time_limit ? <TimerChip label="Contest Time" value={overallRemaining > 0 ? formatTime(overallRemaining) : 'Closed'} low={overallRemaining <= 60} /> : null}
              <TimerChip label="Problem Time" value={timedRemaining === null ? '–:––' : formatTime(timedRemaining)} low={timedRemaining !== null && timedRemaining <= 30} />
            </>
          )}
          {isSuddenDeath && <span className="badge badge-solid"><Icon name="bolt" size={12} /> Round {sdState ? sdState.current_q_idx + 1 : 1}</span>}
        </div>
      </div>

      {timedQuestions.length > 0 && (
        <div className="flex fade-in-up" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {timedQuestions.map((tq, idx) => (
            <Link key={tq.id} to={`/solve/${contestId}/${tq.id}`} className={`case-tab ${String(tq.id) === String(questionId) ? 'is-on' : ''}`}>
              {String.fromCharCode(65 + idx)}. {tq.title}
            </Link>
          ))}
        </div>
      )}

      <section className="panel fade-in-up">
        <div className="problem-title">
          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)' }}>{qData ? qData.title : 'Loading problem…'}</h1>
          {activeContestQ?.points ? <span className="badge badge-outline">{activeContestQ.points} pts</span> : null}
        </div>
        <div className="problem-desc">
          <div className="problem-body">
            {qData ? (
              qData.description.split('\n').map((line, i) => {
                if (line.trim().startsWith('###')) return <strong key={i}>{line.replace('###', '').trim()}</strong>;
                return <React.Fragment key={i}>{line}{'\n'}</React.Fragment>;
              })
            ) : 'Please wait…'}
          </div>

          {qData && qData.test_cases.slice(0, HIDDEN_FROM).map((tc, idx) => (
            <div key={idx} className="example-block">
              <div className="example-title">Example {idx + 1}</div>
              <div className="case-grid">
                <div><span className="io-label">Input</span><pre className="io-block">{tc.input}</pre></div>
                <div><span className="io-label">Output</span><pre className="io-block">{tc.expected}</pre></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={isFullscreen ? 'editor-fullscreen' : 'editor-wrapper fade-in-up'}>
        <div className="editor-toolbar">
          <div className="flex">
            <select className="form-input" value={language} onChange={handleLanguageChange} style={{ width: 'auto', padding: '0.35rem 2.2rem 0.35rem 0.8rem' }} aria-label="Language">
              <option value="cpp">C++</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => setIsFullscreen(!isFullscreen)}>
              <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={15} /> {isFullscreen ? 'Exit (Esc)' : 'Maximize'}
            </button>
          </div>
          <div className="flex" style={{ gap: '1rem' }}>
            {statusEl}
            <button className={`btn ${alreadySolved ? 'btn-secondary' : 'btn-primary'}`} onClick={executeSubmission} disabled={alreadySolved || isSubmitting}>
              {alreadySolved ? <><Icon name="check" size={16} stroke={2.4} /> Solved</> : isSubmitting ? 'Judging…' : <><Icon name="play" size={14} /> Submit</>}
            </button>
          </div>
        </div>
        <div style={{ height: isFullscreen ? undefined : 420, flex: isFullscreen ? 1 : undefined, minHeight: 0, background: 'var(--editor-bg)' }}>
          <Editor
            height="100%"
            theme={monacoThemeName(theme)}
            beforeMount={defineArenaThemes}
            onMount={onEditorMount}
            language={language === 'cpp' ? 'cpp' : language}
            value={code}
            onChange={(val) => { setCode(val); localStorage.setItem(`code_${contestId}_${questionId}`, val); }}
            options={{ ...EDITOR_OPTIONS, fontSize: 14, wordWrap: 'on', padding: { top: 16 }, renderLineHighlight: 'line' }}
          />
        </div>
      </div>

      {!isFullscreen && (
        <section className="testcase-panel fade-in-up stagger-2">
          <div className="testcase-header">
            <span>Judge</span>
            {evalResults && <span className="mono" style={{ fontSize: '0.85rem', letterSpacing: 0, color: passedCount === evalResults.length ? 'var(--success)' : 'var(--text-secondary)' }}>{passedCount} / {evalResults.length} passed</span>}
          </div>
          <div className="testcase-body">
            {isSubmitting && (
              <div className="flex fade-in" style={{ padding: '0.5rem 0' }}>
                <div className="spinner sm" />
                <span style={{ fontWeight: 700 }}>Running your code against the testcases…</span>
              </div>
            )}
            {!isSubmitting && !evalResults && (
              statusTone === 'bad' && status ? (
                <div className="banner danger"><Icon name="alert" size={18} /><span>{status}</span></div>
              ) : (
                <p className="faint">Submit your solution to run it against every testcase, including hidden ones.</p>
              )
            )}
            {!isSubmitting && evalResults && <Verdict key={submitCount} results={evalResults} />}
            <p className="faint" style={{ fontSize: '0.8rem', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name="eye" size={13} /> Submitted code is visible to the contest host.
            </p>
          </div>
        </section>
      )}

      <ConfirmModal open={showEndConfirm} tone="danger" title="End contest" confirmLabel="End for everyone" onConfirm={endContest} onCancel={() => setShowEndConfirm(false)}>
        This ends the contest for every participant immediately. Standings are locked and no more submissions are accepted.
      </ConfirmModal>
      {kickModal}
    </div>
  );
}
