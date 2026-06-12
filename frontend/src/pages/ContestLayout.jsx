import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL, WS_URL, formatTime, formatPenalty } from '../config';
import CodeforcesStandings from '../components/CodeforcesStandings';

export default function ContestLayout({ userObj }) {
  const { linkCode } = useParams();
  const [contest, setContest] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [contestStarted, setContestStarted] = useState(false);
  const [solvedIds, setSolvedIds] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scheduledCountdown, setScheduledCountdown] = useState(null);
  const [participantStatus, setParticipantStatus] = useState(null);
  const [pendingParticipants, setPendingParticipants] = useState([]);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const navigate = useNavigate();

  const isHost = userObj && userObj.id !== undefined && contest && userObj.id === contest.host_id;

  const copyInviteLink = () => {
    const fullUrl = `${window.location.origin}/contest/${linkCode}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  useEffect(() => {
    const fetchContest = async () => {
      try {
        const res = await axios.get(`${API_URL}/contests/${linkCode}`);
        const data = res.data;
        if (data.status === 'active' && (data.mode === 'standard' || data.mode === 'timed')) {
          let start;
          if (data.server_elapsed_seconds !== undefined && data.server_elapsed_seconds !== null) {
            start = Date.now() - (data.server_elapsed_seconds * 1000);
          } else if (data.start_time) {
            start = new Date(data.start_time + 'Z').getTime();
          } else {
            const lsKey = `contest_${data.id}_start`;
            start = localStorage.getItem(lsKey) ? parseInt(localStorage.getItem(lsKey)) : Date.now();
          }
          const currentElapsed = Math.floor((Date.now() - start) / 1000);
          if (data.overall_time_limit && currentElapsed >= data.overall_time_limit * 60) {
            data.status = 'ended';
          }
        }
        setContest(data);
        if (data.status === 'active') setContestStarted(true);
        try {
          const joinRes = await axios.post(`${API_URL}/contests/${data.id}/join`);
          if (joinRes && joinRes.data) setParticipantStatus(joinRes.data.status);
        } catch(e) {
          const statusRes = await axios.get(`${API_URL}/contests/${data.id}/my-status`).catch(() => {});
          if (statusRes && statusRes.data) setParticipantStatus(statusRes.data.status);
        }
        fetchLeaderboard(data.id);
        fetchMySolved(data.id);
      } catch {
        alert('Contest not found');
      }
    };
    fetchContest();
  }, [linkCode]);

  useEffect(() => {
    if (!contest || contestStarted || contest.status === 'ended' || contest.mode === 'sudden_death') return;
    const isHost = userObj && userObj.id !== undefined && userObj.id === contest.host_id;
    if (isHost) return;
    const interval = setInterval(() => {
      axios.get(`${API_URL}/contests/${linkCode}`).then(res => {
        setContest(res.data);
        if (res.data.status === 'active') setContestStarted(true);
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [contest, contestStarted, linkCode, userObj]);

  // Auto-refresh leaderboard and check if contest ended every 3s
  useEffect(() => {
    if (!contest || contest.status === 'ended') return;
    const interval = setInterval(() => {
      fetchLeaderboard(contest.id);
      fetchMySolved(contest.id);
      
      // Also check if the host has ended the contest
      axios.get(`${API_URL}/contests/${linkCode}`).then(res => {
        if (res.data.status === 'ended') {
          setContest(res.data);
          setContestStarted(false);
        } else if (res.data.status === 'active' && !contestStarted) {
          setContest(res.data);
          setContestStarted(true);
        }
      }).catch(() => {});
      
      if (!isHost && participantStatus === 'pending') {
        axios.get(`${API_URL}/contests/${contest.id}/my-status`).then(res => {
          if (res.data.status === 'accepted') setParticipantStatus('accepted');
          else if (res.data.status === 'rejected') setParticipantStatus('rejected');
        }).catch(() => {});
      }
      if (isHost && contest.visibility === 'private') {
        axios.get(`${API_URL}/contests/${contest.id}/pending`).then(res => setPendingParticipants(res.data)).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [contest, contestStarted, linkCode, isHost, participantStatus]);

  // Global contest timer (for standard and timed modes overall)
  useEffect(() => {
    if (contest && contestStarted && (contest.mode === 'standard' || contest.mode === 'timed')) {
      let start;
      if (contest.mode === 'timed') {
        const lsKey = `contest_${contest.id}_start_individual`;
        if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, Date.now().toString());
        start = parseInt(localStorage.getItem(lsKey));
      } else {
        if (contest.server_elapsed_seconds !== undefined && contest.server_elapsed_seconds !== null) {
          start = Date.now() - (contest.server_elapsed_seconds * 1000);
        } else if (contest.start_time) {
          start = new Date(contest.start_time + 'Z').getTime();
        } else {
          const lsKey = `contest_${contest.id}_start`;
          if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, Date.now().toString());
          start = parseInt(localStorage.getItem(lsKey));
        }
      }
      
      const updateTimer = () => {
        const currentElapsed = Math.floor((Date.now() - start) / 1000);
        setElapsedSeconds(currentElapsed);
        if (contest.overall_time_limit && currentElapsed >= contest.overall_time_limit * 60) {
           if (contest.mode === 'timed') {
               setContest(prev => ({ ...prev, is_overall_time_up: true }));
           } else {
               setContest(prev => ({ ...prev, status: 'ended' }));
               setContestStarted(false);
           }
        }
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [contest, contestStarted]);

  const fetchLeaderboard = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/contests/${id}/leaderboard`);
      setLeaderboard(res.data);
    } catch {}
  };

  const fetchMySolved = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/contests/${id}/my-solved`);
      setSolvedIds(res.data.solved_question_ids || []);
    } catch {}
  };

  const handleHostStart = async () => {
    try {
      await axios.post(`${API_URL}/contests/${contest.id}/start`);
      if (contest.mode === 'sudden_death') {
        navigate(`/solve/${contest.id}/sudden-death`);
      } else {
        setContestStarted(true);
        await axios.post(`${API_URL}/contests/${contest.id}/open`);
      }
    } catch (err) {
      alert('Failed to start contest');
    }
  };

  const startStandard = async () => {
    try {
      await axios.post(`${API_URL}/contests/${contest.id}/open`);
      setContestStarted(true);
      setContest(prev => ({ ...prev, status: 'active' }));
    } catch(e) { alert('Failed to open contest'); }
  };

  useEffect(() => {
    if (contest && contest.status === 'waiting' && !contestStarted && contest.scheduled_start_time) {
      const startMs = new Date(contest.scheduled_start_time).getTime();
      const updateCountdown = () => {
        const diffMs = startMs - Date.now();
        if (diffMs <= 0) {
          if (isHost && !contestStarted) {
             handleHostStart();
          } else if (!isHost && !contestStarted && contest.mode === 'sudden_death') {
             navigate(`/solve/${contest.id}/sudden-death`);
          }
          setScheduledCountdown(0);
        } else {
          setScheduledCountdown(Math.floor(diffMs / 1000));
        }
      };
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [contest, contestStarted, isHost, navigate]);

  const endContest = async () => {
    try {
      await axios.post(`${API_URL}/contests/${contest.id}/end`);
      setContestStarted(false);
      setContest(prev => ({ ...prev, status: 'ended' }));
      setShowEndConfirm(false);
    } catch(e) { alert('Failed to end contest'); setShowEndConfirm(false); }
  };

  useEffect(() => {
    if (!contest || !userObj) return;
    const ws = new WebSocket(`${WS_URL}/ws/contest/${contest.id}`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'KICK_USER' && msg.user_id === userObj.id) {
          alert("You have been kicked from the contest by the host.");
          navigate('/dashboard');
        }
      } catch {}
    };
    return () => ws.close();
  }, [contest?.id, userObj?.id, navigate]);

  const handleAccept = async (uid) => {
    await axios.post(`${API_URL}/contests/${contest.id}/accept/${uid}`);
    setPendingParticipants(p => p.filter(x => x.id !== uid));
  };
  const handleReject = async (uid) => {
    await axios.post(`${API_URL}/contests/${contest.id}/reject/${uid}`);
    setPendingParticipants(p => p.filter(x => x.id !== uid));
  };
  const handleKick = async (uid) => {
    if (window.confirm('Are you sure you want to kick this user? Their submissions will be deleted.')) {
      await axios.delete(`${API_URL}/contests/${contest.id}/kick/${uid}`);
      fetchLeaderboard(contest.id);
    }
  };

  const handleParticipantEnter = () => {
    if (contest.mode === 'sudden_death') {
      navigate(`/solve/${contest.id}/sudden-death`);
    } else {
      // For standard/timed, just wait for status to become active
    }
  };

  if (!contest) return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="loader" style={{ marginBottom: '1rem', width: '50px', height: '50px', border: '5px solid rgba(255,123,0,0.3)', borderTop: '5px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <h2 className="pulse-text" style={{ color: 'var(--primary)' }}>Entering Arena...</h2>
    </div>
  );

  if (!isHost && participantStatus === 'pending') {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loader" style={{ marginBottom: '1rem', width: '50px', height: '50px', border: '5px solid rgba(255,123,0,0.3)', borderTop: '5px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <h2 className="pulse-text" style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Waiting for Approval...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>This is a private contest. Please wait for the host to accept your join request.</p>
      </div>
    );
  }

  if (!isHost && participantStatus === 'rejected') {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Your request to join this contest was rejected by the host.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>Return to Dashboard</button>
      </div>
    );
  }

  const MODE_META = {
    standard: { label: 'Standard', color: 'var(--primary)', desc: 'Solve all problems independently. Ranked by score then lowest penalty.' },
    sudden_death: { label: 'Sudden Death', color: '#ff7b00', desc: 'Everyone solves the same problem. First to pass claims the round; lobby advances together.' },
    timed: { label: 'Timed Mode', color: 'var(--secondary)', desc: 'Each problem has its own countdown. Once it expires that problem locks for you permanently.' },
  };
  const meta = MODE_META[contest.mode] || MODE_META.standard;

  if (contest.status === 'ended') {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '4rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px solid var(--danger)', marginTop: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '2.5rem', marginBottom: '1rem' }}>Contest Ended</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '2rem' }}>This contest has been terminated by the host. The final standings are locked.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.75rem 2rem' }}>Return to Dashboard</button>
        </div>
        <div className="glass-panel" style={{ width: '100%' }}>
          <h3 style={{ marginBottom: '1rem' }}>Final Standings</h3>
          <CodeforcesStandings leaderboard={leaderboard} questions={contest.questions} evaluationMode={contest.evaluation_mode} isHost={isHost} onKick={handleKick} mode={contest.mode} />
        </div>
      </div>
    );
  }

  // Show lobby waiting screen before contest is started
  if (!contestStarted) {
    return (
      <div className="container">
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>{contest.title} <span className="badge badge-yellow" style={{ marginLeft: '1rem' }}>{meta.label}</span></h1>
            {contest.host_name && (
              <div style={{ marginTop: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Hosted by <strong style={{ color: '#fff' }}>{contest.host_name}</strong>
                <span style={{ color: 'var(--success)', fontSize: '1rem' }}>✓</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Access Code: <strong style={{ color: '#fff', cursor: 'pointer', background: '#333', padding: '0.2rem 0.5rem', borderRadius: '4px', letterSpacing: '2px' }} onClick={() => navigator.clipboard.writeText(linkCode)} title="Click to copy">{linkCode}</strong>
              </p>
              <button className="btn btn-primary" onClick={copyInviteLink} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', background: linkCopied ? 'var(--success)' : 'var(--primary)', transition: 'background 0.2s' }}>
                {linkCopied ? '✓ Link Copied!' : '📋 Copy Invite Link'}
              </button>
            </div>
          </div>
          {isHost && <span style={{ fontSize: '0.8rem', background: 'rgba(255,123,0,0.15)', color: '#ff7b00', border: '1px solid #ff7b00', padding: '0.25rem 0.75rem', borderRadius: '4px' }}>HOST</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2.5rem 2rem' }}>
            <div style={{ borderLeft: `4px solid ${meta.color}`, paddingLeft: '1rem', marginBottom: '2rem' }}>
              <h2 style={{ color: meta.color, margin: '0 0 0.5rem' }}>{meta.label}</h2>
              <p style={{ color: '#aaa', margin: 0 }}>{meta.desc}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{contest.questions.length}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Problems</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{contest.overall_time_limit}m</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Time Limit</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{formatPenalty(contest.penalty_per_wrong_answer)}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>WA Penalty</div>
              </div>
            </div>

            {isHost ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>Share the invite link with participants. {contest.scheduled_start_time ? 'The contest will start automatically on time.' : 'Start the contest when everyone is ready.'}</p>
                
                {contest.scheduled_start_time ? (
                  <>
                    <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '1rem' }}>
                      {scheduledCountdown !== null && scheduledCountdown > 0 ? formatTime(scheduledCountdown) : '0:00'}
                    </div>
                    <h3 className="pulse-text" style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>
                      {scheduledCountdown !== null && scheduledCountdown <= 0 ? 'Starting automatically...' : 'Host: Contest starts automatically...'}
                    </h3>
                  </>
                ) : (
                  <button className="btn btn-danger" onClick={handleHostStart} style={{ padding: '0.9rem 3rem', fontSize: '1.1rem' }}>Start Contest</button>
                )}

                {contest.visibility === 'private' && (
                  <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', textAlign: 'left' }}>
                    <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Pending Participants ({pendingParticipants.length})</h3>
                    {pendingParticipants.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)' }}>No pending requests.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {pendingParticipants.map(p => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                            <strong style={{ color: '#fff' }}>{p.username}</strong>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-success" onClick={() => handleAccept(p.id)} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>Accept</button>
                              <button className="btn btn-danger" onClick={() => handleReject(p.id)} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>Reject</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : contest.scheduled_start_time ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '1rem' }}>
                  {scheduledCountdown !== null && scheduledCountdown > 0 ? formatTime(scheduledCountdown) : '0:00'}
                </div>
                <h3 className="pulse-text" style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>
                  {scheduledCountdown !== null && scheduledCountdown <= 0 ? 'Entering arena...' : 'Contest begins soon...'}
                </h3>
              </div>
            ) : contest.mode === 'sudden_death' ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>The arena is ready. Join the lobby to secure your spot.</p>
                <button className="btn btn-primary" onClick={handleParticipantEnter} style={{ padding: '0.9rem 3rem', fontSize: '1.1rem' }}>Enter Lobby</button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="loader" style={{ margin: '0 auto 1.5rem', width: '30px', height: '30px', border: '3px solid rgba(255,123,0,0.3)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <h3 className="pulse-text" style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Waiting for host to start the contest...</h3>
                <p style={{ color: '#aaa', fontSize: '0.9rem' }}>The arena will automatically open once the host begins.</p>
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ width: '100%' }}>
            <h3 style={{ marginBottom: '1rem' }}>Standings</h3>
            <CodeforcesStandings leaderboard={leaderboard} questions={contest.questions} evaluationMode={contest.evaluation_mode} isHost={isHost} onKick={handleKick} mode={contest.mode} />
          </div>
        </div>
      </div>
    );
  }



  // If the contest is active and user is NOT host, and they just joined late — show informational banner
  const isLateJoiner = contestStarted && contest.status === 'active' && !isHost;

  return (
    <div className="container">
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>{contest.title} <span className="badge badge-yellow" style={{ marginLeft: '1rem' }}>{meta.label}</span></h1>
          {contestStarted && (contest.mode === 'standard' || contest.mode === 'timed') && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Time Left:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--secondary)' }}>
                {formatTime(Math.max(0, contest.overall_time_limit * 60 - elapsedSeconds))}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Access Code: <strong style={{ color: '#fff', cursor: 'pointer', background: '#333', padding: '0.2rem 0.5rem', borderRadius: '4px' }} onClick={() => navigator.clipboard.writeText(linkCode)}>{linkCode}</strong></p>
            <button className="btn btn-primary" onClick={copyInviteLink} style={{ padding: '0.25rem 0.7rem', fontSize: '0.78rem', background: linkCopied ? 'var(--success)' : 'var(--primary)', transition: 'background 0.2s' }}>
              {linkCopied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>&larr; Dashboard</button>
          {isHost && contest.status === 'active' && (
            <button className="btn btn-danger" onClick={() => setShowEndConfirm(true)} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>End Contest</button>
          )}
          {isHost && contest.status === 'waiting' && (!contest.scheduled_start_time || (scheduledCountdown !== null && scheduledCountdown <= 0)) && (
            <button className="btn btn-primary" onClick={startStandard} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Start Contest</button>
          )}
        </div>
      </div>

      {/* Late joiner info banner */}
      {isLateJoiner && (
        <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.3)', borderRadius: '6px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem' }}>⚡</span>
          <p style={{ color: 'var(--secondary)', margin: 0, fontSize: '0.9rem' }}>Contest is already in progress. You can still participate — pick a problem and start solving!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {contest.mode !== 'sudden_death' && (
          <div>
            {contest.questions.map((q) => {
              const isSolved = solvedIds.includes(q.id);
              return (
                <div key={q.id} className="glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: isSolved ? '4px solid var(--success)' : '4px solid transparent' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <h3 style={{ margin: 0 }}>{q.title}</h3>
                      {isSolved && <span style={{ background: 'var(--success)', color: '#000', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', letterSpacing: '1px' }}>✓ SOLVED</span>}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Points: <span style={{ color: isSolved ? 'var(--success)' : 'var(--primary)' }}>{q.points}</span> {contest.mode === 'timed' && `| Time Limit: ${q.time_limit}s`}</p>
                  </div>
                  {isSolved ? (
                    <Link to={`/solve/${contest.id}/${q.id}`} style={{ padding: '0.5rem 1.5rem', background: 'rgba(0,200,0,0.1)', border: '1px solid var(--success)', borderRadius: '4px', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(0,200,0,0.2)'} onMouseLeave={e => e.currentTarget.style.background='rgba(0,200,0,0.1)'}>
                      ✓ Solved — Review
                    </Link>
                  ) : (
                    (() => {
                      let isLocked = false;
                      if (contest.mode === 'timed') {
                        const lsKey = `contest_${contest.id}_q_${q.id}_start`;
                        const startedAt = localStorage.getItem(lsKey);
                        if (!startedAt && contest.is_overall_time_up) {
                           isLocked = true;
                        }
                      }
                      if (isLocked) {
                        return <button className="btn btn-secondary" style={{ padding: '0.5rem 1.5rem', opacity: 0.5, cursor: 'not-allowed' }} title="Overall contest time is up. You can only finish questions you already started.">Locked</button>;
                      }
                      return <Link to={`/solve/${contest.id}/${q.id}`} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>Solve</Link>;
                    })()
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        <div className="glass-panel" style={{ width: '100%' }}>
          <h3 style={{ marginBottom: '1rem' }}>Standings</h3>
          <CodeforcesStandings leaderboard={leaderboard} questions={contest.questions} evaluationMode={contest.evaluation_mode} isHost={isHost} onKick={handleKick} mode={contest.mode} />
        </div>
      </div>

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
