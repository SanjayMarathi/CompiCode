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

export const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
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
