import QR from 'qrcode';
import React, {useMemo} from 'react';
import {interpolate, random, useCurrentFrame} from 'remotion';
import {BRAND} from '../config';

/** Real, scannable QR for pagergo.pro. With `start`, modules pop in deterministically. */
export const QrCodeSvg: React.FC<{size: number; start?: number; value?: string}> = ({size, start, value = BRAND.fullUrl}) => {
  const frame = useCurrentFrame();
  const qr = useMemo(() => QR.create(value, {errorCorrectionLevel: 'M'}), [value]);
  const n = qr.modules.size;
  const total = n + 4;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(x, y)) continue;
      const a = start === undefined ? 1 : interpolate(frame - start - random(`d${x}-${y}`) * 18, [0, 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      if (a <= 0) continue;
      rects.push(<rect key={`${x}-${y}`} x={x + 2 + (1 - a) * 0.5} y={y + 2 + (1 - a) * 0.5} width={1.02 * a} height={1.02 * a} />);
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges">
      <rect width={total} height={total} fill="#fff" />
      <g fill={BRAND.colors.navy}>{rects}</g>
    </svg>
  );
};
