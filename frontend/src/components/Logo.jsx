import React from 'react';
import Icon from './Icon';

/** Two-tone wordmark (sky blue + orange) with a small bubble mark. */
export default function Logo({ size = '1.7rem', mark = true }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      {mark && <span className="logo-mark" aria-hidden="true"><Icon name="code" size="0.62em" stroke={2.8} /></span>}
      <span className="logo-compi">Compi</span><span className="logo-code">Code</span>
    </span>
  );
}
