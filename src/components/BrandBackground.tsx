import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {BRAND} from '../config';

const c = BRAND.colors;

/** Dark navy stage with an orange key glow, slow light rays, a technical grid and restrained particles. */
export const BrandBackground: React.FC<{glowX?: number; glowY?: number; particles?: number}> = ({glowX = 50, glowY = 45, particles = 16}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 60) * 4;
  return (
    <AbsoluteFill style={{background: `radial-gradient(120% 80% at ${glowX}% ${glowY}%, ${c.navyLight} 0%, ${c.navyMid} 38%, ${c.navy} 75%)`, overflow: 'hidden'}}>
      {/* technical grid */}
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(154,166,207,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(154,166,207,0.07) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          backgroundPosition: `0 ${frame * 0.6}px`,
          maskImage: 'radial-gradient(70% 55% at 50% 50%, black 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(70% 55% at 50% 50%, black 0%, transparent 100%)',
        }}
      />
      {/* orange key glow */}
      <AbsoluteFill style={{background: `radial-gradient(42% 26% at ${glowX + drift}% ${glowY}%, rgba(255,122,0,0.38), rgba(255,122,0,0) 70%)`}} />
      {/* light rays */}
      <div
        style={{
          position: 'absolute',
          left: -700,
          right: -700,
          top: -500,
          bottom: -500,
          background: `repeating-conic-gradient(from ${frame * 0.2}deg at 50% ${glowY}%, rgba(255,170,90,0.05) 0deg 5deg, rgba(255,170,90,0) 5deg 16deg)`,
          maskImage: `radial-gradient(circle at 50% ${glowY}%, black 0%, transparent 45%)`,
          WebkitMaskImage: `radial-gradient(circle at 50% ${glowY}%, black 0%, transparent 45%)`,
        }}
      />
      {new Array(particles).fill(0).map((_, i) => {
        const x = random(`px${i}`) * 1080;
        const size = 4 + random(`ps${i}`) * 14;
        const speed = 0.3 + random(`pv${i}`) * 0.9;
        const y = ((((random(`py${i}`) * 2100 - frame * speed) % 2100) + 2100) % 2100) - 90;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: i % 3 === 0 ? '#ffffff' : c.orangeSoft,
              opacity: 0.1 + random(`po${i}`) * 0.25,
              filter: `blur(${size > 12 ? 4 : 1}px)`,
            }}
          />
        );
      })}
      <AbsoluteFill style={{background: 'radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
    </AbsoluteFill>
  );
};

/** Orange diagonal wipe that straddles a cut (centre frame = the cut). RTL: sweeps right → left. */
export const OrangeWipe: React.FC<{at: number; length: number}> = ({at, length}) => {
  const frame = useCurrentFrame();
  const p = (frame - (at - length / 2)) / length;
  if (p < 0 || p > 1) return null;
  const x = 1500 - p * 3200;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          top: -400,
          bottom: -400,
          left: x,
          width: 1300,
          transform: 'skewX(-14deg)',
          background: `linear-gradient(90deg, rgba(255,78,27,0) 0%, ${c.orangeHot} 18%, ${c.orange} 50%, ${c.orangeSoft} 82%, rgba(255,178,91,0) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
