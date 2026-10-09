import React, { useState } from 'react';
import Icon from './Icon';

const formatTimeStr = (totalSeconds) => {
  if (!totalSeconds) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

export default function CodeforcesStandings({ leaderboard, questions, title, isHost, onKick, onInspect, mode, meId }) {
  const [searchQuery, setSearchQuery] = useState('');

  const showQuestionCols = mode !== 'sudden_death';
  const qs = showQuestionCols ? (questions || []) : [];
  const colCount = 6 + qs.length + (isHost ? 1 : 0);

  const needle = searchQuery.trim().toLowerCase();
  // Rank comes from the full leaderboard so searching never renumbers people.
  const rows = leaderboard
    .map((l, i) => ({ l, rank: i + 1 }))
    .filter(({ l }) => !needle || l.username.toLowerCase().includes(needle));

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        {title ? <h3 style={{ margin: 0 }}>{title}</h3> : <span />}
        <div className="search-field" style={{ maxWidth: 250 }}>
          <span className="icon"><Icon name="search" size={15} /></span>
          <input type="text" className="form-input" placeholder="Find participant" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 64 }}>Rank</th>
              <th className="left">Name</th>
              <th>Score</th>
              <th>Solved</th>
              <th>Tests</th>
              <th>Time</th>
              {qs.map((q, i) => <th key={q.id} title={q.title}>Q{i + 1} <span className="num-sub">({q.points || 10})</span></th>)}
              {isHost && <th style={{ width: 70 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={colCount} className="empty-state" style={{ padding: '2rem' }}>{leaderboard.length === 0 ? 'No participants yet' : 'No matching participants'}</td></tr>
            ) : rows.map(({ l, rank }) => (
              <tr key={l.user_id || rank} className={meId && l.user_id === meId ? 'is-me' : ''}>
                <td><span className={`rank ${rank <= 3 ? `top r${rank}` : ''}`}>{rank}</span></td>
                <td className="left">
                  {onInspect ? (
                    <button className="name-link" onClick={() => onInspect(l.user_id)} title={`View ${l.username}'s submissions`}>{l.username}</button>
                  ) : (
                    <strong style={{ fontSize: '0.95rem' }}>{l.username}</strong>
                  )}
                </td>
                <td>
                  <span className="num-strong" style={l.score < 0 ? { color: 'var(--danger)' } : undefined}>{l.score || 0}</span> <span className="num-sub">/ {l.total_points || 0}</span>
                  {l.penalty > 0 && (
                    <div className="cell-bad" style={{ fontSize: '0.72rem' }} title={`${l.points_earned ?? 0} points earned, ${l.penalty} lost to wrong answers`}>−{l.penalty} WA</div>
                  )}
                </td>
                <td>
                  <span className="num-strong">{l.solved_count || 0}</span> <span className="num-sub">/ {l.total_questions || 0}</span>
                </td>
                <td>
                  <span className="num-strong">{l.total_testcases || 0}</span> <span className="num-sub">/ {l.max_testcases || 0}</span>
                </td>
                <td className="mono" style={{ fontSize: '0.85rem' }}>
                  <div>{formatTimeStr(l.total_time || 0)}</div>
                </td>
                {qs.map((q) => {
                  const s = l.question_stats?.[String(q.id)];
                  if (!s || !(s.solved || s.testcases_passed > 0 || s.wrong_count > 0)) return <td key={q.id} className="faint">·</td>;
                  const wrongLabel = `${s.wrong_count} WA${s.penalty > 0 ? ` · −${s.penalty}` : ''}`;
                  return (
                    <td key={q.id} title={s.wrong_count > 0 ? `${s.wrong_count} wrong ${s.wrong_count === 1 ? 'answer' : 'answers'}, −${s.penalty || 0} points` : undefined}>
                      {s.solved ? (
                        <div className="cell-ok">{formatTimeStr(s.time_taken || 0)}</div>
                      ) : s.testcases_passed > 0 ? (
                        <div className="num-strong" style={{ fontSize: '0.85rem' }}>{s.testcases_passed}/{s.total_testcases}</div>
                      ) : (
                        <div className="cell-bad">{wrongLabel}</div>
                      )}
                      {(s.solved || s.testcases_passed > 0) && s.wrong_count > 0 && <div className="cell-bad" style={{ fontSize: '0.7rem' }}>{wrongLabel}</div>}
                    </td>
                  );
                })}
                {isHost && (
                  <td>
                    {l.user_id !== meId && (
                      <button className="btn btn-danger btn-icon btn-sm" title={`Kick ${l.username}`} aria-label={`Kick ${l.username}`} onClick={() => onKick(l.user_id, l.username)}>
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
