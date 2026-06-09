import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { API_URL, WS_URL, boilerplates, formatTime } from '../config';
import CodeforcesStandings from '../components/CodeforcesStandings';

export default function SolvePlatform() {
  const { contestId, questionId } = useParams();
  const isSuddenDeath = questionId === 'sudden-death';
  
  const navigate = useNavigate();
  const [language, setLanguage] = useState('cpp');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [code, setCode] = useState(() => {
    const saved = localStorage.getItem(`code_${contestId}_${questionId}`);
    return saved !== null ? saved : boilerplates['cpp'];
  });
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('var(--text-secondary)');
  const [sandboxError, setSandboxError] = useState('');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [userObj, setUserObj] = useState(null);
  const [evalResults, setEvalResults] = useState(null);
  const [qData, setQData] = useState(null);
  const [alreadySolved, setAlreadySolved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [sdState, setSdState] = useState(null);
  const [sdGlobalTimer, setSdGlobalTimer] = useState(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [roundCountdown, setRoundCountdown] = useState(10);
  const [contestInfo, setContestInfo] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const ws = useRef(null);
  const roundCountdownRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_URL}/me`).then(res => setCurrentUser(res.data)).catch(() => {});
  }, []);

  // Reset state when questionId changes (critical for timed mode navigation)
  useEffect(() => {
    if (!isSuddenDeath) {
      setQData(null);
      setAlreadySolved(false);
      setStatus('');
      setStatusColor('var(--text-secondary)');
      setEvalResults(null);
      setIsSubmitting(false);
      setElapsedSeconds(0);
      
      // Load saved code for this specific question or use boilerplate
      const saved = localStorage.getItem(`code_${contestId}_${questionId}`);
      setCode(saved !== null ? saved : boilerplates[language]);
      
      fetchQuestionDetailed(questionId);
      // Check if already solved
      axios.get(`${API_URL}/contests/${contestId}/my-solved`).then(res => {
        if ((res.data.solved_question_ids || []).map(String).includes(String(questionId))) {
          setAlreadySolved(true);
          setStatus('Already Solved');
          setStatusColor('var(--success)');
        }
      }).catch(() => {});
    }
  }, [contestId, questionId]);

  useEffect(() => {
    // Both sudden death and regular need contest info
    const fetchInfo = () => {
      axios.get(`${API_URL}/contests/${contestId}/info`).then(res => {
        setContestInfo(res.data);
        if (res.data.status === 'ended') {
          navigate(`/contest/${contestId}`);
        }
      }).catch(() => {});
    };
    fetchInfo();
    const infoInterval = setInterval(fetchInfo, 5000);

    // Connect WebSocket for ALL modes to listen for CONTEST_ENDED
    ws.current = new WebSocket(`${WS_URL}/ws/contest/${contestId}`);
    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'CONTEST_ENDED') {
        navigate(`/contest/${contestId}`);
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

  const endContest = async () => {
    try {
      await axios.post(`${API_URL}/contests/${contestId}/end`);
      setShowEndConfirm(false);
      navigate(`/contest/${contestId}`);
    } catch(e) { alert('Failed to end contest'); setShowEndConfirm(false); }
  };

  // Elapsed time counter for standard/timed modes
  useEffect(() => {
    if (!isSuddenDeath && contestInfo) {
      if (contestInfo.mode === 'standard') {
        let start;
        if (contestInfo.server_elapsed_seconds !== undefined && contestInfo.server_elapsed_seconds !== null) {
          start = Date.now() - (contestInfo.server_elapsed_seconds * 1000);
        } else if (contestInfo.start_time) {
          start = new Date(contestInfo.start_time + 'Z').getTime();
        } else {
          // If start_time is null, try to read from localStorage to avoid resetting
          const lsKey = `contest_${contestId}_start`;
          if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, Date.now().toString());
          start = parseInt(localStorage.getItem(lsKey));
        }
        
        const updateTimer = () => {
          const currentElapsed = Math.floor((Date.now() - start) / 1000);
          setElapsedSeconds(currentElapsed);
          if (contestInfo.overall_time_limit && currentElapsed >= contestInfo.overall_time_limit * 60) {
            navigate(`/contest/${contestId}`);
          }
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
      } else if (contestInfo.mode === 'timed') {
        const questions = contestInfo.questions || [];
        const q = questions.find(x => String(x.id) === String(questionId));
        if (q) {
           const timeLimit = q.time_limit;
           const lsKey = `contest_${contestId}_q_${questionId}_start`;
           if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, Date.now().toString());
           const start = parseInt(localStorage.getItem(lsKey));
           // Calculate initial elapsed
           const initialElapsed = Math.floor((Date.now() - start) / 1000);
           if (initialElapsed >= timeLimit) {
             setElapsedSeconds(timeLimit);
             setStatus('Time Up! Locked');
             setStatusColor('var(--danger)');
             setAlreadySolved(true);
           } else {
             setElapsedSeconds(initialElapsed);
           }
           const interval = setInterval(() => {
             const elapsed = Math.floor((Date.now() - start) / 1000);
             if (elapsed >= timeLimit) {
                 setElapsedSeconds(timeLimit);
                 setStatus('Time Up! Locked');
                 setStatusColor('var(--danger)');
                 setAlreadySolved(true);
                 clearInterval(interval);
             } else {
                 setElapsedSeconds(elapsed);
             }
           }, 1000);
           return () => clearInterval(interval);
        }
      }
    }
  }, [isSuddenDeath, contestInfo, questionId, contestId]);

  useEffect(() => {
    if (isSuddenDeath && sdState && sdState.state === 'WAITING_TO_START') {
      axios.get(`${API_URL}/contests/${contestId}/leaderboard`).then(res => setFinalLeaderboard(res.data));
      const interval = setInterval(() => {
        axios.get(`${API_URL}/contests/${contestId}/leaderboard`).then(res => setFinalLeaderboard(res.data));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isSuddenDeath, sdState?.state, contestId]);

  useEffect(() => {
    if (isSuddenDeath && sdState) {
      if (sdState.state === 'CONTEST_OVER' || sdState.state === 'ROUND_OVER') {
        axios.get(`${API_URL}/contests/${contestId}/leaderboard`).then(res => setFinalLeaderboard(res.data));
      }
      // Start round countdown when ROUND_OVER
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
  }, [sdState, contestId, isSuddenDeath]);

  const fetchQuestionDetailed = async (qid) => {
    try {
      const resp = await axios.get(`${API_URL}/questions/${qid}`);
      setQData(resp.data);
    } catch {}
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    setCode(boilerplates[lang]);
  };

  const executeSubmission = async () => {
    if (alreadySolved || isSubmitting) return;
    setIsSubmitting(true);
    setStatus('');
    setStatusColor('var(--text-secondary)');
    setEvalResults(null);
    try {
      const activeQ = qData ? qData.id : questionId;
      const res = await axios.post(`${API_URL}/submit`, {
        code, language, question_id: String(activeQ), contest_id: String(contestId)
      });
      if (res.data.already_solved) {
        setStatus('Already Solved!');
        setStatusColor('var(--success)');
        setAlreadySolved(true);
      } else if (res.data.error) {
        setStatus(res.data.error);
        setStatusColor('var(--danger)');
      } else {
        setEvalResults(res.data.results);
        if (res.data.passed) {
          setStatus('Accepted ✔');
          setStatusColor('var(--success)');
          setAlreadySolved(true);
        } else {
          setStatus('Wrong Answer');
          setStatusColor('var(--danger)');
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Submission failed. Please try again.';
      setStatus(detail);
      setStatusColor('var(--danger)');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isSuddenDeath && sdState && sdState.state === 'WAITING_TO_START') {
    return <div className="sudden-death-overlay">
      <h1 className="pulse-text" style={{ fontSize: '3rem', color: '#ff7b00', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Waiting for Match Start</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1rem' }}>The host will initiate the match shortly.</p>
      {finalLeaderboard.length > 0 && (
        <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', textAlign: 'left' }}>
          <CodeforcesStandings leaderboard={finalLeaderboard} questions={contestInfo?.questions} title="Current Standings" />
        </div>
      )}
    </div>;
  }

  if (isSuddenDeath && sdState && sdState.state === 'ROUND_OVER') {
    return <div className="sudden-death-overlay" style={{ background: '#1c1c1c', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', width: '100%', maxWidth: '900px' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '2.5rem', margin: 0 }}>Round {sdState.current_q_idx + 1} Complete</h1>
          <p style={{ color: '#00ff41', fontWeight: 600, margin: '0.25rem 0 0', fontSize: '1.1rem' }}>Winner: {sdState.winner || 'No winner'}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Next round in <strong style={{ color: 'var(--primary)' }}>{roundCountdown}s</strong></div>
        </div>
      </div>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', textAlign: 'left' }}>
        <CodeforcesStandings leaderboard={finalLeaderboard} questions={contestInfo?.questions} title="Standings" />
      </div>
    </div>;
  }

  if (isSuddenDeath && sdState && sdState.state === 'CONTEST_OVER') {
    return <div className="sudden-death-overlay" style={{ background: '#111', padding: '2rem' }}>
      <h1 style={{ color: 'var(--primary)', fontSize: '4rem', marginBottom: '0.5rem' }}>Match Over</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Final results below</p>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', textAlign: 'left', marginBottom: '1.5rem' }}>
        <CodeforcesStandings leaderboard={finalLeaderboard} questions={contestInfo?.questions} title="Final Standings" />
      </div>
      <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ padding: '0.75rem 2rem' }}>Return to Dashboard</button>
    </div>;
  }

  // Build the navigation list for timed mode (to show all problems with navigation)
  const timedQuestions = (!isSuddenDeath && contestInfo && contestInfo.mode === 'timed' && contestInfo.questions) ? contestInfo.questions : [];
  const isHost = currentUser && contestInfo && currentUser.id === contestInfo.host_id;

  return (
    <div className="solve-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '0.4rem 0.8rem' }}>&larr; Back</button>
          {isHost && (
            <button className="btn btn-danger" onClick={() => setShowEndConfirm(true)} style={{ padding: '0.4rem 0.8rem' }}>End Contest</button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isSuddenDeath && sdGlobalTimer !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Round Time:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#ff7b00', background: 'var(--panel-bg)', padding: '0.2rem 1rem', borderRadius: '4px', border: '1px solid #ff7b00' }}>
                {formatTime(sdGlobalTimer)}
              </span>
            </div>
          )}
          {!isSuddenDeath && contestInfo && contestInfo.mode === 'standard' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Time Left:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--secondary)', background: 'var(--panel-bg)', padding: '0.2rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                {formatTime(Math.max(0, contestInfo.overall_time_limit * 60 - elapsedSeconds))}
              </span>
            </div>
          )}
          {!isSuddenDeath && contestInfo && contestInfo.mode === 'timed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Time Left:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--danger)', background: 'var(--panel-bg)', padding: '0.2rem 1rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                {(() => {
                  const questions = contestInfo.questions || [];
                  const q = questions.find(x => String(x.id) === String(questionId));
                  if (!q) return '0:00';
                  return formatTime(Math.max(0, q.time_limit - elapsedSeconds));
                })()}
              </span>
            </div>
          )}
          {isSuddenDeath && <span className="badge badge-orange">SUDDEN DEATH - ROUND {sdState ? sdState.current_q_idx + 1 : 1}</span>}
        </div>
      </div>

      {/* Timed mode: show problem navigation tabs */}
      {timedQuestions.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem 0' }}>
          {timedQuestions.map((tq, idx) => {
            const isActive = String(tq.id) === String(questionId);
            return (
              <Link
                key={tq.id}
                to={`/solve/${contestId}/${tq.id}`}
                className="btn"
                style={{
                  padding: '0.4rem 1rem',
                  fontSize: '0.85rem',
                  background: isActive ? 'var(--primary)' : '#3e3e3e',
                  color: '#fff',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  transition: 'all 0.15s'
                }}
              >
                Q{idx + 1}: {tq.title}
              </Link>
            );
          })}
        </div>
      )}
      
      <div className="problem-title">
        <h1 style={{ margin: 0 }}>{qData ? qData.title : 'Loading Problem...'}</h1>
        <span className="badge badge-yellow" style={{ marginLeft: '1rem' }}>Problem</span>
      </div>
      
      <div className="problem-desc">
        <p style={{ whiteSpace: 'pre-line' }}>{qData ? qData.description : 'Please wait.'}</p>

        {qData && qData.test_cases.slice(0, 2).map((tc, idx) => (
          <div key={idx} className="example-block" style={{ marginTop: '1.5rem' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--primary)' }}>Example {idx + 1}:</strong>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Input:</span>
              <pre style={{ marginTop: '0.25rem', background: '#111', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333' }}>{tc.input}</pre>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Output:</span>
              <pre style={{ marginTop: '0.25rem', background: '#111', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333' }}>{tc.expected}</pre>
            </div>
          </div>
        ))}
      </div>
      
      <div className={isFullscreen ? 'editor-fullscreen' : 'editor-wrapper'} style={isFullscreen ? {position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: 'var(--editor-bg)', display: 'flex', flexDirection: 'column'} : {}}>
        <div className="editor-toolbar">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select className="form-input" value={language} onChange={handleLanguageChange} style={{ width: 'auto', background: '#333', border: '1px solid #444', color: '#ccc', padding: '0.4rem 1rem', borderRadius: '4px' }}>
              <option value="cpp">C++</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
            <button className="btn btn-secondary" onClick={() => setIsFullscreen(!isFullscreen)} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', background: 'transparent', border: '1px solid var(--border-color)' }}>
              {isFullscreen ? 'Exit Fullscreen' : 'Maximize Editor'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', color: statusColor || 'var(--text-secondary)', marginRight: '1.5rem', fontWeight: 700 }}>
              {status}
            </span>
            <button
              className={`btn ${alreadySolved ? 'btn-secondary' : 'btn-primary'}`}
              onClick={executeSubmission}
              disabled={alreadySolved || isSubmitting}
              style={{ padding: '0.5rem 2.5rem', borderRadius: '0', opacity: (alreadySolved || isSubmitting) ? 0.6 : 1, cursor: (alreadySolved || isSubmitting) ? 'not-allowed' : 'pointer' }}
            >
              {alreadySolved ? '✓ Solved' : isSubmitting ? 'Evaluating...' : 'Submit'}
            </button>
          </div>
        </div>
        <div style={{ height: '400px', background: 'var(--editor-bg)' }}>
          <Editor
            height="100%"
            theme="vs-dark"
            language={language === 'cpp' ? 'cpp' : language}
            value={code}
            onChange={(val) => { setCode(val); localStorage.setItem(`code_${contestId}_${questionId}`, val); }}
            options={{
              minimap: { enabled: false },
              fontSize: 15,
              wordWrap: 'on',
              padding: { top: 16 }
            }}
          />
        </div>
      </div>
      
      {!isFullscreen && (
        <div className="testcase-panel">
          <div className="testcase-header">
             Console Output
          </div>
          <div className="testcase-body">
            {!evalResults && !isSubmitting && <div style={{ color: '#555' }}>You must hit submit to check your code against all hidden testcases...</div>}
            {isSubmitting && !evalResults && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                <div style={{ width: '24px', height: '24px', border: '3px solid rgba(255,123,0,0.3)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }}></div>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Evaluating your submission...</span>
              </div>
            )}
            {evalResults && evalResults.map((res, i) => {
              // Show error if it exists, otherwise actual output. Don't hide tracebacks entirely because users need to debug.
              let outputToDisplay = res.error ? res.error : (res.actual || 'No output');
              
              return (
                <div key={i} className="test-block" style={{ borderLeft: `4px solid ${res.passed ? 'var(--success)' : 'var(--danger)'}` }}>
                  <div style={{ fontWeight: 700, color: res.passed ? 'var(--success)' : 'var(--danger)', marginBottom: '0.8rem', fontSize: '0.9rem' }}>
                    Testcase {i + 1} {res.passed ? 'Accepted' : (res.error ? 'Compilation/Runtime Error' : 'Wrong Answer')}
                  </div>
                  <div style={{ color: '#ccc', fontFamily: 'Consolas, monospace', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#888' }}>Input:</span> <span style={{ background: '#111', padding: '1px 4px' }}>{res.input}</span></div>
                    <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#888' }}>Expected:</span> <span style={{ background: '#111', padding: '1px 4px' }}>{res.expected}</span></div>
                    <div><span style={{ color: res.error ? 'var(--danger)' : '#888' }}>{res.error ? 'Error Details:' : 'Actual:'}</span> <pre style={{ marginTop: '0.25rem', background: '#111', padding: '0.5rem', borderRadius: '4px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{outputToDisplay}</pre></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showEndConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#1e1e1e', border: '1px solid var(--border-color)', borderRadius: '8px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden', animation: 'fadeInUp 0.2s ease-out' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,123,0,0.1)' }}>
              <h3 style={{ margin: 0, color: 'var(--danger)', fontSize: '1.1rem' }}>End Contest</h3>
            </div>
            <div style={{ padding: '1.5rem', color: '#fff', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Are you sure you want to end this contest for everyone?
            </div>
            <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
              <button className="btn btn-secondary" onClick={() => setShowEndConfirm(false)} style={{ padding: '0.4rem 1.5rem' }}>Cancel</button>
              <button className="btn btn-danger" onClick={endContest} style={{ padding: '0.4rem 1.5rem' }}>End Contest</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
