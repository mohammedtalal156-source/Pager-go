import React from 'react';
import {Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ASSETS, BRAND, orangeGradient, UI} from '../config';

const c = BRAND.colors;

/**
 * End card: the official logo is presented exactly as supplied, on its own white
 * plate (its navy "Pager Go" wordmark would vanish on navy), with a light sweep,
 * then the CTA button and the website.
 */
export const OutroCTA: React.FC<{logoAt: number; ctaAt: number; urlAt: number; tapAt: number; plateX?: number; plateY?: number; plate?: number; cta?: string}> = ({
  logoAt,
  ctaAt,
  urlAt,
  tapAt,
  plateX = 540,
  plateY = 820,
  plate = 600,
  cta: ctaText = UI.outro.cta,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logo = spring({frame: frame - logoAt, fps, config: {damping: 12, stiffness: 110}});
  const cta = spring({frame: frame - ctaAt, fps, config: {damping: 12}});
  const url = spring({frame: frame - urlAt, fps, config: {damping: 14}});
  const sweep = interpolate(frame, [logoAt + 14, logoAt + 40], [-0.4, 1.4], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const press = frame >= tapAt - 3 && frame < tapAt + 3 ? 0.94 : 1;
  const ring = spring({frame: frame - tapAt, fps, config: {damping: 20}});

  return (
    <div dir="rtl" style={{position: 'absolute', inset: 0, fontFamily: BRAND.font}}>
      {/* halo */}
      <div
        style={{
          position: 'absolute',
          left: plateX - 520,
          top: plateY - 520,
          width: 1040,
          height: 1040,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,122,0,0.45) 0%, rgba(255,122,0,0) 62%)',
          opacity: logo,
          transform: `scale(${0.6 + logo * 0.4 + Math.sin(frame / 20) * 0.02})`,
        }}
      />
      {/* logo plate */}
      <div
        style={{
          position: 'absolute',
          left: plateX - plate / 2,
          top: plateY - plate / 2,
          width: plate,
          height: plate,
          borderRadius: 72,
          background: 'white',
          overflow: 'hidden',
          boxShadow: '0 60px 140px rgba(0,0,0,0.55), 0 0 0 6px rgba(255,255,255,0.12)',
          opacity: interpolate(logo, [0, 0.2], [0, 1], {extrapolateRight: 'clamp'}),
          transform: `perspective(1600px) rotateY(${interpolate(logo, [0, 1], [70, 0])}deg) scale(${interpolate(logo, [0, 1], [0.6, 1])}) translateY(${Math.sin(frame / 22) * 6}px)`,
        }}
      >
        <Img src={staticFile(ASSETS.logo)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
        <div
          style={{
            position: 'absolute',
            top: -100,
            bottom: -100,
            width: 160,
            left: `${sweep * 100}%`,
            transform: 'rotate(18deg)',
            background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.75), rgba(255,255,255,0))',
            mixBlendMode: 'overlay',
          }}
        />
      </div>

      {/* CTA */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1170, display: 'flex', justifyContent: 'center'}}>
        <div style={{position: 'relative', transform: `scale(${cta * press})`, opacity: cta}}>
          {frame >= tapAt ? (
            <div style={{position: 'absolute', inset: -14 - ring * 30, borderRadius: 999, border: `4px solid ${c.orangeSoft}`, opacity: 1 - ring}} />
          ) : null}
          <div style={{padding: '22px 84px', borderRadius: 999, background: orangeGradient, color: 'white', fontSize: 64, fontWeight: 1000, boxShadow: '0 24px 60px rgba(255,90,0,0.55), inset 0 3px 0 rgba(255,255,255,0.35)'}}>{ctaText}</div>
        </div>
      </div>

      {/* URL */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1350, display: 'flex', justifyContent: 'center', opacity: url, transform: `translateY(${(1 - url) * 30}px)`}}>
        <div style={{direction: 'ltr', fontSize: 58, fontWeight: 900, color: 'white', letterSpacing: 1, padding: '10px 36px', borderRadius: 24, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.22)'}}>
          {BRAND.url}
        </div>
      </div>
    </div>
  );
};
