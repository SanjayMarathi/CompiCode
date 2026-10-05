import React from 'react';

// A believable C++ solution, tokenised into monochrome weights.
const CODE = [
  '#include <bits/stdc++.h>',
  'using namespace std;',
  '',
  '// binary search on the answer',
  'bool ok(vector<long long>& a, long long d, int k) {',
  '    int used = 1; long long last = a[0];',
  '    for (int i = 1; i < (int)a.size(); i++) {',
  '        if (a[i] - last >= d) { used++; last = a[i]; }',
  '    }',
  '    return used >= k;',
  '}',
  '',
  'int main() {',
  '    ios::sync_with_stdio(false);',
  '    cin.tie(nullptr);',
  '    int n, k; cin >> n >> k;',
  '    vector<long long> a(n);',
  '    for (auto &x : a) cin >> x;',
  '    sort(a.begin(), a.end());',
  '    long long lo = 0, hi = 1e9;',
  '    while (lo < hi) {',
  '        long long mid = (lo + hi + 1) / 2;',
  '        if (ok(a, mid, k)) lo = mid; else hi = mid - 1;',
  '    }',
  '    cout << lo << "\\n";',
  '}',
];

const TOKEN = /(#include\s*<[^>]+>)|(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d[\d.e]*\b)|(\b(?:int|long|auto|for|while|if|else|return|using|namespace|bool|void|const)\b)|(\b(?:vector|cin|cout|ios|sort|string)\b)/g;

function highlight(line) {
  const out = [];
  let last = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const cls = m[1] ? 'p' : m[2] ? 'c' : m[3] ? 's' : m[4] ? 'n' : m[5] ? 'k' : 't';
    out.push(<span key={m.index} className={cls}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

const STANDINGS = [
  ['1', 'k_nova', '400', ['00:07', '00:19', '00:41', '01:02']],
  ['2', 'bitwise_ana', '400', ['00:11', '00:25', '00:58', '01:14']],
  ['3', 'dp_dreamer', '300', ['00:09', '00:31', '01:05', '+2']],
  ['4', 'segtree_sam', '300', ['00:14', '00:44', '01:20', '—']],
  ['5', 'mod_1e9', '200', ['00:21', '00:52', '+1', '—']],
  ['6', 'lazy_prop', '200', ['00:18', '01:09', '—', '—']],
  ['7', 'xor_fox', '100', ['00:26', '+3', '—', '—']],
];

/**
 * Faint, blurred-by-distance product screens drifting behind every page:
 * the editor, live standings, a judge verdict and a contest lobby.
 */
export default function BackgroundAnimations() {
  return (
    <>
    <div className="backdrop-glow" aria-hidden="true" />
    <div className="backdrop" aria-hidden="true">
      <div className="mock" style={{ '--mock-t': 'rotate(-3deg)', top: '27vh', left: '-5vw', width: 540 }}>
        <div className="mock-bar">
          <span className="mock-dot" /><span className="mock-dot" /><span className="mock-dot" />
          <span className="mock-tab">solution.cpp</span><span className="mock-tab off">input.txt</span>
        </div>
        <div className="mock-code">
          <div className="mock-ln">{CODE.map((_, i) => <div key={i}>{i + 1}</div>)}</div>
          <div className="mock-src">{CODE.map((l, i) => <div key={i}>{l === '' ? ' ' : highlight(l)}</div>)}</div>
        </div>
      </div>

      <div className="mock" style={{ '--mock-t': 'rotate(2.5deg)', top: '4vh', right: '-4vw', width: 500 }}>
        <div className="mock-bar">
          <span className="mock-dot" /><span className="mock-dot" /><span className="mock-dot" />
          <span style={{ marginLeft: 10 }}>Standings — Weekly Round #12</span>
        </div>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Score</th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead>
          <tbody>
            {STANDINGS.map(([r, n, s, qs]) => (
              <tr key={r}>
                <td>{r}</td><td>{n}</td><td>{s}</td>
                {qs.map((q, i) => <td key={i} className={q.startsWith('+') ? 'bad' : q === '—' ? '' : 'ok'}>{q}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mock hide-md" style={{ '--mock-t': 'rotate(2deg)', bottom: '6vh', left: '3vw', width: 380 }}>
        <div className="mock-bar">
          <span className="mock-dot" /><span className="mock-dot" /><span className="mock-dot" />
          <span style={{ marginLeft: 10 }}>Submission #4821</span>
        </div>
        <div className="mock-pad">
          <div className="flex" style={{ gap: 10 }}>
            <span className="mock-case" style={{ width: 34, height: 34, borderRadius: '50%', fontSize: 16 }}>✓</span>
            <div><div className="mock-title" style={{ color: 'var(--mock-blue)' }}>Accepted</div><div>14 / 14 testcases · 62 ms · 3.1 MB</div></div>
          </div>
          <div style={{ marginTop: 12 }}>
            {Array.from({ length: 14 }, (_, i) => <span key={i} className="mock-case">{i + 1}</span>)}
          </div>
        </div>
      </div>

      <div className="mock hide-md" style={{ '--mock-t': 'rotate(-2deg)', bottom: '8vh', right: '2vw', width: 410 }}>
        <div className="mock-bar">
          <span className="mock-dot" /><span className="mock-dot" /><span className="mock-dot" />
          <span style={{ marginLeft: 10 }}>Contest lobby</span>
        </div>
        <div className="mock-pad">
          <div className="flex-between" style={{ gap: 8 }}>
            <div className="mock-title">Weekly Round #12</div>
            <span className="mock-chip ok">● LIVE</span>
          </div>
          <div className="mock-bar-track"><div className="mock-bar-fill" style={{ width: '62%' }} /></div>
          <div className="flex-between"><span>Time left</span><span className="mock-timer">01:08:42</span></div>
          {[['A', 'Two Sum Again', '100', true], ['B', 'Segment Walk', '200', true], ['C', 'Modular Maze', '300', false], ['D', 'Last Stand', '400', false]].map(([k, t, p, d]) => (
            <div className="mock-row" key={k}><span>{k}. {t}</span><span className={d ? 'ok' : ''}>{d ? '✓ solved' : `${p} pts`}</span></div>
          ))}
        </div>
      </div>

      <div className="mock hide-sm" style={{ '--mock-t': 'rotate(1.5deg)', top: '56vh', left: '34vw', width: 190 }}>
        <div className="mock-pad" style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, letterSpacing: '0.16em', fontSize: 9 }}>ROUND 3 · SUDDEN DEATH</div>
          <div className="mock-timer">00:42</div>
        </div>
      </div>
    </div>
    </>
  );
}
