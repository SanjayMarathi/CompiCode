import axios from 'axios';

export const normalizeUrl = (url) => (url || '').replace(/\/+$/, '');
const configuredApiUrl = normalizeUrl(import.meta.env.VITE_API_URL);
const configuredWsUrl = normalizeUrl(import.meta.env.VITE_WS_URL);
const devApiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const defaultApiUrl = import.meta.env.DEV ? `http://${devApiHost}:8000` : '';

export const API_URL = configuredApiUrl || defaultApiUrl;

export const deriveWsUrlFromApi = (apiUrl) => {
  if (!apiUrl) {
    return window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`;
  }
  if (apiUrl.startsWith('https://')) return `wss://${apiUrl.slice(8)}`;
  if (apiUrl.startsWith('http://')) return `ws://${apiUrl.slice(7)}`;
  return apiUrl;
};
export const WS_URL = configuredWsUrl || deriveWsUrlFromApi(API_URL);

export const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

export const boilerplates = {
  python: '',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n\t// your code goes here\n\n}',
  java: 'import java.util.*;\nimport java.lang.*;\nimport java.io.*;\n\nclass Codechef\n{\n\tpublic static void main (String[] args) throws java.lang.Exception\n\t{\n\t\t// your code goes here\n\n\t}\n}'
};

export const formatTime = (totalSeconds) => {
  const t = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = s < 10 ? `0${s}` : `${s}`;
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${ss}`;
  return `${m}:${ss}`;
};

/** Firestore timestamps written by the API are naive-UTC ISO strings; treat them as UTC. */
export const parseUtc = (iso) => {
  if (!iso) return null;
  const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const timeAgo = (iso) => {
  const d = parseUtc(iso);
  if (!d) return '';
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
};

export const MODE_META = {
  standard: {
    label: 'Standard',
    icon: 'list',
    short: 'Solve everything, your pace',
    desc: 'Players solve all problems independently inside one global time limit. Ranked by score, then lowest penalty time.',
  },
  sudden_death: {
    label: 'Sudden Death',
    icon: 'bolt',
    short: 'One problem, first to pass wins',
    desc: 'Everyone is on the same problem. The first to pass every test claims the round and the whole lobby advances together.',
  },
  timed: {
    label: 'Timed',
    icon: 'timer',
    short: 'Every problem has its own clock',
    desc: 'Each problem has an independent countdown. When it expires, that problem locks for you permanently.',
  },
};

export const END_REASON_TEXT = {
  time_up: 'The time limit was reached. Final standings are locked.',
  host: 'The host ended this contest. Final standings are locked.',
  completed: 'Every round has been played. Final standings are locked.',
};

/**
 * Display penalty value without showing "-0" when penalty is 0.
 * Returns the formatted string like "0", "-5", "-10" etc.
 */
export const formatPenalty = (val) => {
  const num = Number(val) || 0;
  if (num === 0) return '0';
  return `-${num}`;
};
