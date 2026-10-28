import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BRAND, orangeGradient, UI} from '../config';

const c = BRAND.colors;
const P = UI.pos;

/**
 * Cashier POS screen: items appear, "paid" is tapped, the order syncs to Pager Go
 * (no specific POS brand is named — integrations must be verified per restaurant),
 * then a glowing ticket with waiting number 247 lifts out toward the viewer.
 */
export const PosTicket: React.FC<{tapAt: number; ticketAt: number}> = ({tapAt, ticketAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 16}});
  const paid = frame >= tapAt;
  const tapP = spring({frame: frame - tapAt, fps, config: {damping: 12}});
  const tk = spring({frame: frame - ticketAt, fps, config: {damping: 13, stiffness: 90}});
  const posAway = interpolate(tk, [0, 1], [0, 1]);

  // number roll for the ticket: 200 → 247
  const roll = Math.round(interpolate(frame, [ticketAt + 4, ticketAt + 28], [200, 247], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}));

  return (
    <>
      {/* POS terminal */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          left: 540 - 380,
          top: 640,
          width: 760,
          perspective: 1800,
          opacity: interpolate(enter, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}) * (1 - posAway * 0.55),
          fontFamily: BRAND.font,
          transform: `translateY(${(1 - enter) * 120 + posAway * 160}px) scale(${1 - posAway * 0.12})`,
          filter: `blur(${posAway * 4}px)`,
        }}
      >
        <div style={{transform: 'rotateX(14deg)', transformOrigin: '50% 100%', borderRadius: 40, padding: 18, background: '#0E1430', boxShadow: '0 60px 120px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.12)'}}>
          <div style={{borderRadius: 26, background: '#F6F7FB', overflow: 'hidden'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 26px', background: 'white', borderBottom: '1px solid #E8EAF2'}}>
              <div style={{fontSize: 34, fontWeight: 900, color: c.navy}}>{P.title}</div>
              <div style={{fontSize: 24, fontWeight: 800, color: c.orange, background: 'rgba(255,122,0,0.12)', padding: '6px 16px', borderRadius: 999}}>{P.newOrder}</div>
            </div>
            <div style={{padding: '14px 26px', display: 'flex', flexDirection: 'column', gap: 10}}>
              {P.items.map((it, i) => {
                const a = spring({frame: frame - 6 - i * 6, fps, config: {damping: 15}});
                return (
                  <div key={it.name} style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 700, color: c.navy, opacity: a, transform: `translateX(${(1 - a) * 60}px)`}}>
                    <div style={{width: 46, height: 46, borderRadius: 12, background: c.navy, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24}}>{it.qty}×</div>
                    <div style={{flex: 1}}>{it.name}</div>
                    <div style={{direction: 'ltr', color: '#6B7499'}}>{it.price}</div>
                  </div>
                );
              })}
              <div style={{height: 1, background: '#E3E6F0', margin: '6px 0'}} />
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 34, fontWeight: 900, color: c.navy}}>
                <span>{P.total}</span>
                <span>{P.totalValue}</span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  padding: '18px 0',
                  borderRadius: 20,
                  textAlign: 'center',
                  fontSize: 32,
                  fontWeight: 900,
                  color: 'white',
                  background: paid ? c.green : orangeGradient,
                  transform: `scale(${frame >= tapAt - 3 && frame < tapAt + 3 ? 0.95 : 1})`,
                }}
              >
                {paid ? `${P.paid} ✓` : P.paid}
              </div>
              <div style={{height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 24, fontWeight: 800, color: c.green, opacity: paid ? tapP : 0}}>
                <span>⟳</span>
                {P.synced}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* glowing order ticket */}
      {frame >= ticketAt ? (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            left: 540 - 230,
            top: 760,
            width: 460,
            fontFamily: BRAND.font,
            transform: `translateY(${interpolate(tk, [0, 1], [260, -40])}px) scale(${interpolate(tk, [0, 1], [0.4, 1])}) rotate(${interpolate(tk, [0, 1], [8, -2])}deg)`,
            opacity: interpolate(tk, [0, 0.2], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          <div style={{position: 'absolute', inset: -60, borderRadius: 80, background: 'radial-gradient(circle, rgba(255,122,0,0.55), rgba(255,122,0,0) 70%)', filter: 'blur(10px)'}} />
          <div
            style={{
              position: 'relative',
              background: 'white',
              borderRadius: 30,
              padding: '34px 30px 40px',
              textAlign: 'center',
              boxShadow: `0 0 0 4px ${c.orange}, 0 40px 90px rgba(0,0,0,0.5), 0 0 80px rgba(255,122,0,0.6)`,
              // perforated bottom edge
              maskImage: 'radial-gradient(circle at 12px 100%, transparent 11px, black 12px)',
              WebkitMaskImage: 'radial-gradient(circle at 12px 100%, transparent 11px, black 12px)',
              maskSize: '24px 100%',
              WebkitMaskSize: '24px 100%',
            }}
          >
            <div style={{fontSize: 30, fontWeight: 800, color: '#6B7499'}}>{UI.ticket.label}</div>
            <div
              style={{
                fontSize: 210,
                fontWeight: 1000,
                lineHeight: 1.05,
                direction: 'ltr',
                backgroundImage: orangeGradient,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {roll}
            </div>
            <div style={{display: 'inline-block', marginTop: 6, fontSize: 30, fontWeight: 900, color: c.orange, background: 'rgba(255,122,0,0.12)', padding: '6px 24px', borderRadius: 999}}>{UI.waiting.states[0]}</div>
          </div>
        </div>
      ) : null}
    </>
  );
};
