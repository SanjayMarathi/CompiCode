import React from 'react';

const END_REASON = {
  time_up: 'Ended — time limit reached',
  host: 'Ended by the host',
  completed: 'Ended — all rounds played',
};

export default function StatusPill({ status, reason }) {
  const s = status || 'waiting';
  const cls = s === 'active' ? 'pill-active' : s === 'ended' ? 'pill-ended' : 'pill-waiting';
  const label = s === 'active' ? 'Live' : s === 'ended' ? 'Ended' : 'Waiting';
  return <span className={`pill ${cls}`} title={s === 'ended' ? END_REASON[reason] : undefined}>{label}</span>;
}
