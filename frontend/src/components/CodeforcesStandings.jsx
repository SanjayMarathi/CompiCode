import React from 'react';

export default function CodeforcesStandings({ leaderboard, questions, title }) {
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
            <th style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500, width: '80px' }}>Score</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500, width: '120px' }}>Finish Time</th>
            {(questions || []).map((q, i) => (
              <th key={q.id} style={{ padding: '1rem', textAlign: 'center', color: '#999', fontWeight: 500 }}>Q{i+1} ({q.points || 10})</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leaderboard.length === 0 ? (
            <tr><td colSpan={4 + (questions || []).length} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No submissions yet</td></tr>
          ) : leaderboard.map((l, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #222', background: idx % 2 === 0 ? '#1a1a1a' : '#1e1e1e' }}>
              <td style={{ padding: '1rem', color: idx < 3 ? 'var(--primary)' : '#fff', fontWeight: 700 }}>{idx + 1}</td>
              <td style={{ padding: '1rem' }}>
                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{l.username}</strong>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center', color: '#fff', fontWeight: 600 }}>{l.solved_count ?? l.solved_question_ids?.length ?? 0}</td>
              <td style={{ padding: '1rem', textAlign: 'center', color: '#aaa', fontFamily: 'Consolas, monospace' }}>{formatTimeStr(l.penalty * 60)}</td>
              {(questions || []).map((q) => {
                const stat = l.question_stats?.[String(q.id)];
                if (!stat) return <td key={q.id} style={{ padding: '1rem', textAlign: 'center', color: '#444' }}></td>;
                if (stat.solved) return (
                  <td key={q.id} style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ color: 'var(--success)', fontFamily: 'Consolas, monospace', marginBottom: '0.2rem' }}>
                      {formatTimeStr(stat.time_taken || 0)}
                    </div>
                    {stat.wrong_count > 0 && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>+{stat.wrong_count} fails</div>}
                  </td>
                );
                if (stat.wrong_count > 0) return (
                  <td key={q.id} style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>-{stat.wrong_count}</div>
                  </td>
                );
                return <td key={q.id} style={{ padding: '1rem', textAlign: 'center', color: '#444' }}></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
