import React, { useState } from 'react';

export default function CodeforcesStandings({ leaderboard, questions, title, evaluationMode, isHost, onKick, mode }) {
  const [searchQuery, setSearchQuery] = useState('');

  const formatTimeStr = (totalSeconds) => {
    if (!totalSeconds) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const filteredLeaderboard = leaderboard.filter(l => 
    l.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        {title ? <h3 style={{ margin: 0 }}>{title}</h3> : <div></div>}
        <input 
          type="text" 
          className="form-input" 
          placeholder="Search participant..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: '250px', padding: '0.3rem 0.8rem', fontSize: '0.9rem' }}
        />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, width: '60px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rank</th>
            <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, width: '110px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, width: '110px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solved</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, width: '110px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Testcases</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, width: '120px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Finish Time</th>
            {mode !== 'sudden_death' && (questions || []).map((q, i) => (
              <th key={q.id} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Q{i+1} ({q.points || 10})</th>
            ))}
            {isHost && <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, width: '80px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {filteredLeaderboard.length === 0 ? (
            <tr><td colSpan={6 + (mode !== 'sudden_death' ? (questions || []).length : 0) + (isHost ? 1 : 0)} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '2rem' }}>{leaderboard.length === 0 ? 'No submissions yet' : 'No matching participants'}</td></tr>
          ) : filteredLeaderboard.map((l, idx) => (
            <tr key={l.user_id || idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--panel-bg)' : 'var(--table-stripe)', transition: 'background 0.2s' }}>
              <td style={{ padding: '1rem', color: idx < 3 ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 700 }}>{idx + 1}</td>
              <td style={{ padding: '1rem' }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{l.username}</strong>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem' }}>
                  {l.score || 0} <span style={{fontSize:'0.75rem', fontWeight:500, color:'var(--text-tertiary)'}}>/ {l.total_points || 0} pts</span>
                </div>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                  {l.solved_count || 0} <span style={{fontSize:'0.75rem', fontWeight:500, color:'var(--text-tertiary)'}}>/ {l.total_questions || 0}</span>
                </div>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                  {l.total_testcases || 0} <span style={{fontSize:'0.75rem', fontWeight:500, color:'var(--text-tertiary)'}}>/ {l.max_testcases || 0}</span>
                </div>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center', fontFamily: 'Consolas, monospace' }}>
                <div style={{ color: 'var(--text-primary)' }}>{formatTimeStr(l.total_time || 0)}</div>
                {l.penalty > 0 && <div style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>+{l.penalty} penalty</div>}
              </td>
              {mode !== 'sudden_death' && (questions || []).map((q) => {
                const stat = l.question_stats?.[String(q.id)];
                if (!stat) return <td key={q.id} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}></td>;
                if (stat.solved || stat.testcases_passed > 0 || stat.wrong_count > 0) {
                  return (
                    <td key={q.id} style={{ padding: '1rem', textAlign: 'center' }}>
                      {stat.solved ? (
                        <div style={{ color: 'var(--success)', fontFamily: 'Consolas, monospace', marginBottom: '0.2rem' }}>{formatTimeStr(stat.time_taken || 0)}</div>
                      ) : stat.testcases_passed > 0 ? (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.2rem' }}>{stat.testcases_passed}/{stat.total_testcases} TCs</div>
                      ) : (
                        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>-{stat.wrong_count}</div>
                      )}
                      {stat.solved && stat.total_testcases > 0 && (
                        <div style={{ color: 'var(--success)', fontSize: '0.75rem', marginTop: '2px', fontWeight: 600, opacity: 0.7 }}>{stat.total_testcases}/{stat.total_testcases} TCs</div>
                      )}
                      {(stat.solved || stat.testcases_passed > 0) && stat.wrong_count > 0 && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, marginTop: '2px' }}>+{stat.wrong_count} fails</div>
                      )}
                    </td>
                  );
                }
                return <td key={q.id} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}></td>;
              })}
              {isHost && (
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <button className="btn btn-danger" onClick={() => onKick(l.user_id)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Kick</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
