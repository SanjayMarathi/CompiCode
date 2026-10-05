import React from 'react';

// Minimal stroke icon set (24x24 grid). Everything inherits `currentColor`.
const PATHS = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.8 6.8 0 0 0 9.7 9.7z" />,
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8z" />,
  timer: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5" /></>,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4 6.5h.01M4 12h.01M4 17.5h.01" strokeWidth="3" /></>,
  trophy: <><path d="M8 21h8M12 17v4M7 3.5h10V9a5 5 0 0 1-10 0V3.5z" /><path d="M17 5h3v1.5A3.5 3.5 0 0 1 17 10M7 5H4v1.5A3.5 3.5 0 0 0 7 10" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.3c2.2.7 3.5 2.6 3.5 5.7" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></>,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4.5l-4 15" />,
  terminal: <><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><path d="m7 9.5 3 2.5-3 2.5M13 15h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3 1.8" /></>,
  hourglass: <path d="M6.5 2.5h11M6.5 21.5h11M7.5 2.5c0 5 4.5 6 4.5 9.5s-4.5 4.5-4.5 9.5M16.5 2.5c0 5-4.5 6-4.5 9.5s4.5 4.5 4.5 9.5" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H16" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  logout: <path d="M9 4.5H6A2.5 2.5 0 0 0 3.5 7v10A2.5 2.5 0 0 0 6 19.5h3M16 8l4 4-4 4M20 12H9" />,
  shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3z" />,
  play: <path d="M7.5 4.5v15l12-7.5-12-7.5z" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16 7l3 3" /></>,
  'arrow-right': <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  'arrow-left': <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />,
  maximize: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  minimize: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  alert: <><path d="M12 3.5 2.5 20h19L12 3.5z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  book: <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5v-17zM5 19.5A2.5 2.5 0 0 1 7.5 17H19" />,
  cpu: <><rect x="6.5" y="6.5" width="11" height="11" rx="2" /><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" /></>,
};

export default function Icon({ name, size = 20, stroke = 1.8, className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {PATHS[name] || null}
    </svg>
  );
}
