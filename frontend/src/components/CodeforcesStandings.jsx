import React from 'react';

export default function CodeforcesStandings({ leaderboard, questions, title, evaluationMode }) {
  const formatTimeStr = (totalSeconds) => {
    if (!totalSeconds) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {title && <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{title}</h3>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', background: '#111' }}>
            <th style={{ padding: '1rem', textAlign: 'left', color: '#999', fontWeight: 500, width: '60px' }}>Rank</th>
            <th style={{ padding: '1rem', textAlign: 'left', color: '#999', fontWeight: 500 }}>Name</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500, width: '110px' }}>Score</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500, width: '110px' }}>Solved</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500, width: '110px' }}>Testcases</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500, width: '120px' }}>Finish Time</th>
            {(questions || []).map((q, i) => (
              <th key={q.id} style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500 }}>Q{i+1} ({q.points || 10})</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leaderboard.length === 0 ? (
            <tr><td colSpan={6 + (questions || []).length} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No submissions yet</td></tr>
          ) : leaderboard.map((l, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #222', background: idx % 2 === 0 ? '#1a1a1a' : '#1e1e1e' }}>
              <td style={{ padding: '1rem', color: idx < 3 ? 'var(--primary)' : '#fff', fontWeight: 700 }}>{idx + 1}</td>
              <td style={{ padding: '1rem' }}>
                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{l.username}</strong>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ color: evaluationMode === 'partial' ? 'var(--secondary)' : 'var(--primary)', fontWeight: 700, fontSize: '1.05rem' }}>
                  {l.score || 0} <span style={{fontSize:'0.75rem', fontWeight:500, color:'#888'}}>/ {l.total_points || 0} pts</span>
                </div>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ color: '#ccc', fontWeight: 600, fontSize: '0.95rem' }}>
                  {l.solved_count || 0} <span style={{fontSize:'0.75rem', fontWeight:500, color:'#888'}}>/ {l.total_questions || 0}</span>
                </div>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ color: '#ccc', fontWeight: 600, fontSize: '0.95rem' }}>
                  {l.total_testcases || 0} <span style={{fontSize:'0.75rem', fontWeight:500, color:'#888'}}>/ {l.max_testcases || 0}</span>
                </div>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center', color: '#aaa', fontFamily: 'Consolas, monospace' }}>
                <div style={{ color: '#fff' }}>{formatTimeStr(l.total_time || 0)}</div>
                {l.penalty > 0 && <div style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>+{l.penalty} penalty</div>}
              </td>
              {(questions || []).map((q) => {
                const stat = l.question_stats?.[String(q.id)];
                if (!stat) return <td key={q.id} style={{ padding: '1rem', textAlign: 'center', color: '#444' }}></td>;
                
                if (stat.solved || stat.testcases_passed > 0 || stat.wrong_count > 0) {
                  return (
                    <td key={q.id} style={{ padding: '1rem', textAlign: 'center' }}>
                      {stat.solved ? (
                        <div style={{ color: 'var(--success)', fontFamily: 'Consolas, monospace', marginBottom: '0.2rem' }}>
                          {formatTimeStr(stat.time_taken || 0)}
                        </div>
                      ) : stat.testcases_passed > 0 ? (
                        <div style={{ color: 'var(--secondary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                          {stat.testcases_passed}/{stat.total_testcases} TCs
                        </div>
                      ) : (
                        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                          -{stat.wrong_count}
                        </div>
                      )}
                      
                      {stat.solved && stat.total_testcases > 0 && (
                        <div style={{ color: 'rgba(0,255,0,0.6)', fontSize: '0.75rem', marginTop: '2px', fontWeight: 600 }}>{stat.total_testcases}/{stat.total_testcases} TCs</div>
                      )}
                      
                      {(stat.solved || stat.testcases_passed > 0) && stat.wrong_count > 0 && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, marginTop: '2px' }}>+{stat.wrong_count} fails</div>
                      )}
                    </td>
                  );
                }
                return <td key={q.id} style={{ padding: '1rem', textAlign: 'center', color: '#444' }}></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
