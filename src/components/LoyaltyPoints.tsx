import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BRAND, orangeGradient, UI} from '../config';

const c = BRAND.colors;
const L = UI.loyalty;

/**
 * Loyalty card flies in, then point coins arc from the order into the card and
 * the balance counts up. Only "points per order" is shown — no reward tiers are
 * claimed because none were specified.
 */
export const LoyaltyPoints: React.FC<{start: number; coinsAt: number}> = ({start, coinsAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const card = spring({frame: frame - start, fps, config: {damping: 13, stiffness: 100}});
  const value = Math.round(interpolate(frame, [coinsAt + 14, coinsAt + 40], [L.from, L.to], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}));
  const bump = spring({frame: frame - coinsAt - 40, fps, config: {damping: 8, stiffness: 200}});
  const plus = spring({frame: frame - coinsAt - 36, fps, config: {damping: 14}});
  const tilt = interpolate(card, [0, 1], [-35, -8]) + Math.sin(frame / 30) * 2;

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: BRAND.font}}>
      {/* card */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          left: 540 - 380,
          top: 660,
          width: 760,
          height: 460,
          perspective: 1600,
          opacity: interpolate(card, [0, 0.25], [0, 1], {extrapolateRight: 'clamp'}),
          transform: `translateX(${(1 - card) * 700}px)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 44,
            padding: 44,
            background: `linear-gradient(140deg, ${c.navyLight} 0%, ${c.navyMid} 55%, #0b1438 100%)`,
            boxShadow: `0 60px 120px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.14), 0 0 ${60 * bump}px rgba(255,122,0,0.6)`,
            transform: `rotateY(${tilt}deg) rotateX(8deg) scale(${1 + 0.04 * Math.sin(bump * Math.PI)})`,
            overflow: 'hidden',
            color: 'white',
          }}
        >
          <div style={{position: 'absolute', left: -120, top: -160, width: 520, height: 520, borderRadius: '50%', background: orangeGradient, opacity: 0.85, filter: 'blur(2px)'}} />
          <div style={{position: 'absolute', left: -60 + ((frame * 6) % 1400) - 300, top: -100, width: 120, height: 800, transform: 'rotate(25deg)', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.18), rgba(255,255,255,0))'}} />
          <div style={{position: 'relative', fontSize: 40, fontWeight: 900}}>{L.title}</div>
          <div style={{position: 'relative', fontSize: 26, fontWeight: 700, opacity: 0.75, direction: 'ltr', textAlign: 'right'}}>{BRAND.name} · {BRAND.nameAr}</div>
          <div style={{position: 'relative', marginTop: 70, display: 'flex', alignItems: 'baseline', gap: 16}}>
            <div style={{fontSize: 170, fontWeight: 1000, lineHeight: 1, direction: 'ltr', transform: `scale(${1 + 0.08 * Math.sin(bump * Math.PI)})`, transformOrigin: '100% 80%'}}>{value}</div>
            <div style={{fontSize: 44, fontWeight: 800, opacity: 0.85}}>{L.label}</div>
          </div>
        </div>
      </div>

      {/* +10 chip */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          left: 660 - 140,
          top: 1180,
          width: 280,
          textAlign: 'center',
          fontSize: 56,
          fontWeight: 1000,
          color: 'white',
          padding: '10px 0',
          borderRadius: 999,
          background: orangeGradient,
          boxShadow: '0 20px 50px rgba(255,90,0,0.45)',
          opacity: plus,
          transform: `translateY(${(1 - plus) * 40}px) scale(${plus})`,
        }}
      >
        <bdi dir="ltr">+{L.perOrderPoints}</bdi> {L.pointsWord}
      </div>

      {/* coins arcing into the card */}
      {new Array(7).fill(0).map((_, i) => {
        const t = interpolate(frame, [coinsAt + i * 4, coinsAt + i * 4 + 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
        if (t <= 0 || t >= 1) return null;
        const sx = 900 - i * 30;
        const sy = 1520;
        const ex = 420 + i * 18;
        const ey = 860;
        const x = interpolate(t, [0, 1], [sx, ex]);
        const y = interpolate(t, [0, 1], [sy, ey]) - Math.sin(t * Math.PI) * 260;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - 32,
              top: y - 32,
              width: 64,
              height: 64,
              borderRadius: 32,
              background: 'radial-gradient(circle at 35% 30%, #FFE1A8, #FFB25B 45%, #FF7A00 100%)',
              boxShadow: '0 0 24px rgba(255,160,60,0.8), inset 0 -4px 0 rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              color: 'white',
              fontWeight: 900,
              transform: `rotateY(${t * 720}deg) scale(${1 - t * 0.4})`,
            }}
          >
            ★
          </div>
        );
      })}
    </div>
  );
};
