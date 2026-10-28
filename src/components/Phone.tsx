import React from 'react';

export const PHONE_W = 420;
export const PHONE_H = 870;

type Props = {
  children: React.ReactNode;
  x: number;
  y: number;
  scale?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  /** extra translate for shake/vibrate */
  shakeX?: number;
  glow?: string;
};

/**
 * CSS-3D smartphone. A stack of offset layers fakes the device thickness so the
 * phone reads as a solid object while it turns; the screen is a normal DOM layer,
 * so Arabic UI inside it is shaped by the browser exactly like a real web page.
 * (x, y) is the phone centre in composition pixels.
 */
export const Phone: React.FC<Props> = ({children, x, y, scale = 1, rotateX = 0, rotateY = 0, rotateZ = 0, shakeX = 0, glow}) => {
  const depth = 10;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - PHONE_W / 2,
        top: y - PHONE_H / 2,
        width: PHONE_W,
        height: PHONE_H,
        perspective: 2200,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: `translateX(${shakeX}px) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
        }}
      >
        {new Array(depth).fill(0).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 66,
              background: i === depth - 1 ? '#2a2f3d' : `hsl(225, 12%, ${18 + i * 1.6}%)`,
              transform: `translateZ(${-(depth - i) * 2.2}px)`,
              boxShadow: i === 0 ? `0 60px 120px rgba(0,0,0,0.6)${glow ? `, 0 0 120px ${glow}` : ''}` : undefined,
            }}
          />
        ))}
        {/* body + bezel */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 66,
            background: 'linear-gradient(145deg, #4b5266 0%, #1b1f2b 40%, #0e1118 100%)',
            padding: 14,
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.18), inset 0 0 0 7px #05070c',
          }}
        >
          <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 54, overflow: 'hidden', background: '#fff'}}>
            {children}
            {/* dynamic island */}
            <div style={{position: 'absolute', top: 16, left: '50%', width: 120, height: 34, marginLeft: -60, borderRadius: 20, background: '#05070c'}} />
            {/* glass reflection */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(115deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.08) 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
