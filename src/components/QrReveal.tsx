import QR from 'qrcode';
import React, {useMemo} from 'react';
import {interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BRAND, UI} from '../config';

const c = BRAND.colors;

/**
 * A real, scannable QR (pagergo.pro) on a counter stand. Modules pop in in a
 * deterministic random order, then a scan beam sweeps and the frame locks green.
 */
export const QrReveal: React.FC<{start: number; scanFrom: number; lockAt: number; size?: number; x: number; y: number}> = ({start, scanFrom, lockAt, size = 360, x, y}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const qr = useMemo(() => QR.create(BRAND.fullUrl, {errorCorrectionLevel: 'M'}), []);
  const n = qr.modules.size;
  const quiet = 2;
  const total = n + quiet * 2;
  const stand = spring({frame: frame - start, fps, config: {damping: 14}});
  const locked = frame >= lockAt;
  const lockP = spring({frame: frame - lockAt, fps, config: {damping: 10}});
  const scanning = frame >= scanFrom && !locked;
  const beam = ((frame - scanFrom) % 30) / 30;

  const rects: React.ReactNode[] = [];
  for (let yy = 0; yy < n; yy++) {
    for (let xx = 0; xx < n; xx++) {
      if (!qr.modules.get(xx, yy)) continue;
      const delay = random(`q${xx}-${yy}`) * 22;
      const a = interpolate(frame - start - 6 - delay, [0, 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      if (a <= 0) continue;
      rects.push(<rect key={`${xx}-${yy}`} x={xx + quiet + (1 - a) * 0.5} y={yy + quiet + (1 - a) * 0.5} width={1.02 * a} height={1.02 * a} />);
    }
  }

  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        left: x - (size + 60) / 2,
        top: y - size / 2,
        width: size + 60,
        fontFamily: BRAND.font,
        opacity: stand,
        transform: `translateY(${(1 - stand) * 120}px) rotateZ(${interpolate(stand, [0, 1], [-6, -3])}deg) scale(${1 + 0.04 * Math.sin(lockP * Math.PI)})`,
      }}
    >
      <div style={{background: 'white', borderRadius: 34, padding: 30, boxShadow: `0 40px 90px rgba(0,0,0,0.5), 0 0 0 ${locked ? 6 : 0}px ${c.green}`}}>
        <div style={{position: 'relative', width: size, height: size}}>
          <svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges">
            <g fill={c.navy}>{rects}</g>
          </svg>
          {scanning ? (
            <div style={{position: 'absolute', left: -10, right: -10, top: beam * size, height: 6, borderRadius: 6, background: c.orange, boxShadow: '0 0 30px 10px rgba(255,122,0,0.55)'}} />
          ) : null}
        </div>
        <div style={{marginTop: 18, textAlign: 'center', fontSize: 34, fontWeight: 900, color: c.navy}}>{UI.qr.standLabel}</div>
        <div style={{textAlign: 'center', fontSize: 26, fontWeight: 800, color: c.orange, direction: 'ltr'}}>{BRAND.url}</div>
      </div>
      {/* stand foot */}
      <div style={{margin: '0 auto', width: '60%', height: 26, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, background: 'linear-gradient(#d9dce6, #aeb3c4)'}} />
    </div>
  );
};
