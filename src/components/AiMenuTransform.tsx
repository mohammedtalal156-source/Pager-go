import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BRAND, orangeGradient, UI} from '../config';

const c = BRAND.colors;
const M = UI.aiMenu;

/**
 * A photo of a paper menu is captured (flash), scanned by an "AI" beam, then
 * dissolves into organised digital menu cards that fly into a grid.
 */
export const AiMenuTransform: React.FC<{start: number; scanAt: number; cardsAt: number}> = ({start, scanAt, cardsAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const photo = spring({frame: frame - start, fps, config: {damping: 14}});
  const flash = interpolate(frame, [start + 10, start + 13, start + 22], [0, 0.85, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scanT = interpolate(frame, [scanAt, scanAt + 34], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad)});
  const dissolve = interpolate(frame, [cardsAt - 6, cardsAt + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const title = spring({frame: frame - cardsAt - 30, fps, config: {damping: 14}});

  return (
    <div dir="rtl" style={{position: 'absolute', inset: 0, fontFamily: BRAND.font}}>
      {/* paper menu photo */}
      <div
        style={{
          position: 'absolute',
          left: 540 - 260,
          top: 600,
          width: 520,
          padding: 18,
          paddingBottom: 54,
          background: 'white',
          borderRadius: 10,
          boxShadow: '0 50px 100px rgba(0,0,0,0.55)',
          opacity: (1 - dissolve) * interpolate(photo, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
          transform: `translateY(${(1 - photo) * 200}px) rotate(${interpolate(photo, [0, 1], [-14, -4])}deg) scale(${1 - dissolve * 0.25})`,
          filter: `blur(${dissolve * 8}px)`,
        }}
      >
        <div style={{position: 'relative', background: '#F4E9D3', padding: '28px 34px', minHeight: 560, overflow: 'hidden', fontFamily: 'serif'}}>
          <div style={{fontFamily: BRAND.font, fontSize: 40, fontWeight: 900, color: '#5B3A1E', textAlign: 'center', marginBottom: 18, borderBottom: '2px dashed #A07850', paddingBottom: 10}}>المنيو</div>
          {M.paper.map((l) => (
            <div key={l} style={{fontFamily: BRAND.font, fontSize: 30, fontWeight: 600, color: '#4A3020', lineHeight: 2, whiteSpace: 'nowrap', transform: 'rotate(-0.6deg)'}}>
              {l}
            </div>
          ))}
          {/* coffee stain + paper texture */}
          <div style={{position: 'absolute', left: 30, bottom: 30, width: 110, height: 110, borderRadius: '50%', border: '8px solid rgba(120,80,40,0.18)'}} />
          {/* AI scan beam */}
          {scanT > 0 && scanT < 1 ? (
            <div style={{position: 'absolute', left: 0, right: 0, top: `${scanT * 100}%`, height: 10, background: orangeGradient, boxShadow: '0 0 40px 16px rgba(255,122,0,0.55)'}} />
          ) : null}
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: `${scanT * 100}%`, background: 'rgba(255,122,0,0.10)'}} />
        </div>
        <div style={{position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 24, fontWeight: 800, color: '#6B7499', fontFamily: BRAND.font}}>📷 {M.photoLabel}</div>
      </div>

      {/* AI badge */}
      <div
        style={{
          position: 'absolute',
          left: 540 + 160,
          top: 560,
          width: 130,
          height: 130,
          borderRadius: 36,
          background: orangeGradient,
          color: 'white',
          fontSize: 58,
          fontWeight: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'ltr',
          boxShadow: '0 20px 60px rgba(255,90,0,0.6)',
          opacity: interpolate(frame, [scanAt - 8, scanAt, cardsAt + 4, cardsAt + 12], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          transform: `rotate(${Math.sin(frame / 5) * 6}deg) scale(${1 + 0.06 * Math.sin(frame / 3)})`,
        }}
      >
        ✦{M.aiLabel}
      </div>

      {/* digital menu */}
      <div style={{position: 'absolute', left: 90, right: 90, top: 560, textAlign: 'center', opacity: title, transform: `translateY(${(1 - title) * 30}px)`}}>
        <span style={{fontSize: 38, fontWeight: 900, color: 'white', padding: '8px 28px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.18)'}}>{M.digitalTitle}</span>
      </div>
      <div style={{position: 'absolute', left: 90, right: 90, top: 660, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26}}>
        {M.cards.map((card, i) => {
          const p = spring({frame: frame - cardsAt - i * 5, fps, config: {damping: 13, stiffness: 120}});
          // cards emerge from the photo's centre
          const col = i % 2;
          const row = Math.floor(i / 2);
          const fromX = (col === 0 ? -1 : 1) * -200;
          const fromY = 300 - row * 250;
          return (
            <div
              key={card.name}
              style={{
                height: 250,
                borderRadius: 30,
                background: 'white',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
                opacity: interpolate(p, [0, 0.2], [0, 1], {extrapolateRight: 'clamp'}),
                transform: `translate(${(1 - p) * fromX}px, ${(1 - p) * fromY}px) scale(${interpolate(p, [0, 1], [0.3, 1])}) rotate(${(1 - p) * (col ? 10 : -10)}deg)`,
              }}
            >
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{fontSize: 20, fontWeight: 800, color: c.orange, background: 'rgba(255,122,0,0.12)', padding: '4px 14px', borderRadius: 999}}>{card.cat}</span>
                <span style={{fontSize: 52}}>{card.icon}</span>
              </div>
              <div style={{fontSize: 38, fontWeight: 900, color: c.navy}}>{card.name}</div>
              <div style={{fontSize: 28, fontWeight: 800, color: '#6B7499'}}>
                <span style={{direction: 'ltr', unicodeBidi: 'isolate'}}>{card.price}</span> د.ع
              </div>
            </div>
          );
        })}
      </div>

      {/* camera flash */}
      <div style={{position: 'absolute', inset: 0, background: 'white', opacity: flash}} />
    </div>
  );
};
