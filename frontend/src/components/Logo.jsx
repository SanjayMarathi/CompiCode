import React from 'react';

/** Two-tone wordmark: sky blue "Compi" + orange "Code". */
export default function Logo({ size = '1.7rem' }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <span className="logo-compi">Compi</span><span className="logo-code">Code</span>
    </span>
  );
}
