import React from 'react';
import {Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ASSETS, BRAND, orangeGradient, UI} from '../config';

const c = BRAND.colors;
const W = UI.waiting;

/**
 * Order state stepper: انتظار → جاهز → تم الاستلام.
 * `readyP` (0..1) animates the Waiting → Ready transition.
 */
export const OrderStatusTransition: React.FC<{ready: boolean; readyP: number}> = ({ready, readyP}) => {
  const frame = useCurrentFrame();
  const active = ready ? 1 : 0;
  return (
    <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', margin: '26px 26px 0', position: 'relative'}}>
      <div style={{position: 'absolute', top: 20, left: 40, right: 40, height: 6, borderRadius: 3, background: '#E3E6F0'}} />
      <div style={{position: 'absolute', top: 20, right: 40, height: 6, borderRadius: 3, width: `${interpolate(readyP, [0, 1], [0, 50])}%`, background: c.green}} />
      {W.states.map((s, i) => {
        const done = i < active || (ready && i === active);
        const isActive = i === active;
        const col = done ? c.green : isActive ? c.orange : '#C5CADB';
        return (
          <div key={s} style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 110, gap: 8}}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                background: done || isActive ? col : 'white',
                border: `4px solid ${col}`,
                color: 'white',
                fontSize: 24,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isActive && !ready ? `0 0 0 ${7 + 4 * Math.sin(frame / 4)}px rgba(255,122,0,0.18)` : undefined,
              }}
            >
              {done ? '✓' : ''}
            </div>
            <div style={{whiteSpace: 'nowrap', fontSize: 22, fontWeight: done || isActive ? 900 : 700, color: done || isActive ? c.navy : '#9AA0B8'}}>{s}</div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * The customer's waiting page (web page opened from the QR, no app install).
 * Shows waiting number 247 and its status; flips to Ready at `readyAt`.
 * It is a conceptual mock-up until real product screenshots are supplied.
 */
export const PhoneWaitingScreen: React.FC<{start: number; readyAt: number}> = ({start, readyAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - start, fps, config: {damping: 16}});
  const ready = frame >= readyAt;
  const readyP = spring({frame: frame - readyAt, fps, config: {damping: 11, stiffness: 140}});

  return (
    <div
      dir="rtl"
      lang="ar"
      style={{
        position: 'absolute',
        inset: 0,
        fontFamily: BRAND.font,
        background: '#F6F7FB',
        opacity: interpolate(enter, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
      }}
    >
      {/* header with the official logo on its native white */}
      <div style={{paddingTop: 66, display: 'flex', justifyContent: 'center', background: 'white', paddingBottom: 6}}>
        <Img src={staticFile(ASSETS.logo)} style={{width: 150, height: 150, objectFit: 'contain'}} />
      </div>

      <div
        style={{
          margin: '6px 22px 0',
          borderRadius: 34,
          padding: '22px 20px 30px',
          textAlign: 'center',
          color: 'white',
          background: ready ? `linear-gradient(135deg, ${c.greenSoft}, ${c.green})` : orangeGradient,
          boxShadow: ready ? '0 20px 40px rgba(34,197,94,0.35)' : '0 20px 40px rgba(255,122,0,0.35)',
          transform: `scale(${ready ? 1 + 0.07 * Math.sin(readyP * Math.PI) : 1})`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{fontSize: 24, fontWeight: 800, opacity: 0.95}}>{W.order}</div>
        <div style={{fontSize: 150, fontWeight: 1000, lineHeight: 1.05, direction: 'ltr', textShadow: '0 6px 20px rgba(0,0,0,0.15)'}}>{UI.ticket.number}</div>
        <div style={{display: 'inline-block', marginTop: 4, padding: '6px 26px', borderRadius: 999, background: 'rgba(255,255,255,0.25)', fontSize: 34, fontWeight: 900}}>{ready ? W.states[1] : W.states[0]}</div>
      </div>

      <div style={{marginTop: 22, textAlign: 'center'}}>
        <div style={{fontSize: ready ? 36 : 30, fontWeight: 900, color: ready ? c.green : c.navy}}>{ready ? W.readyTitle : W.waitingTitle}</div>
        {ready ? <div style={{fontSize: 22, fontWeight: 700, color: '#6B7499', opacity: readyP}}>{W.readySub}</div> : <div style={{fontSize: 22, height: 31}} />}
      </div>

      <OrderStatusTransition ready={ready} readyP={ready ? readyP : 0} />

      {ready ? (
        <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          {new Array(16).fill(0).map((_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const d = readyP * 210;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 196 + Math.cos(a) * d,
                  top: 360 + Math.sin(a) * d,
                  width: 14,
                  height: 14,
                  borderRadius: i % 2 ? 7 : 3,
                  background: i % 3 === 0 ? c.orange : i % 3 === 1 ? c.green : '#FFD166',
                  opacity: 1 - readyP * 0.9,
                  transform: `rotate(${i * 40 + readyP * 180}deg)`,
                }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
