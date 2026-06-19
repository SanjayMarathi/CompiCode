import React from 'react';

export default function BackgroundAnimations() {
  const dots = [
    { top: '8%', left: '12%', delay: '0s' }, { top: '15%', right: '18%', delay: '1s' },
    { top: '35%', left: '8%', delay: '2s' }, { top: '50%', right: '10%', delay: '0.5s' },
    { top: '72%', left: '15%', delay: '1.5s' }, { top: '80%', right: '22%', delay: '3s' },
    { top: '25%', left: '85%', delay: '2.5s' }, { top: '60%', left: '5%', delay: '0.8s' },
    { top: '45%', right: '5%', delay: '1.8s' }, { top: '90%', left: '45%', delay: '3.5s' },
    { top: '20%', left: '50%', delay: '4s' }, { top: '65%', right: '30%', delay: '2.2s' },
  ];

  return (
    <div className="scene-3d" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Animated decorative lines */}
      {[10, 25, 75, 90].map((pos, i) => (
        <div key={`vl-${i}`} style={{
          position: 'absolute',
          left: `${pos}%`,
          top: '-10%',
          width: '1px',
          height: '120%',
          background: `linear-gradient(to bottom, transparent 0%, var(--line-color) ${20 + i * 5}%, var(--line-color) ${80 - i * 5}%, transparent 100%)`,
          animation: `drawLine 1.5s ease-out ${i * 0.2}s both`,
          transform: `translateZ(${-50 - i * 20}px)`
        }}></div>
      ))}

      {/* Diagonal lines with animation */}
      <div style={{ position: 'absolute', top: '-10%', left: '5%', width: '1px', height: '140%', background: 'linear-gradient(to bottom, transparent, var(--line-color), transparent)', transform: 'rotate(15deg) translateZ(-80px)', transformOrigin: 'top left', animation: 'fadeIn 2s ease-out 0.5s both' }}></div>
      <div style={{ position: 'absolute', top: '-10%', right: '8%', width: '1px', height: '140%', background: 'linear-gradient(to bottom, transparent, var(--line-color), transparent)', transform: 'rotate(-12deg) translateZ(-120px)', transformOrigin: 'top right', animation: 'fadeIn 2s ease-out 0.8s both' }}></div>

      {/* Animated pulsing dots */}
      {dots.map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--dot-color)',
          animation: `dotPulse 3s ease-in-out ${pos.delay} infinite`,
          transform: `translateZ(${Math.sin(i) * 50}px)`
        }}></div>
      ))}
    </div>
  );
}
