import React from 'react';
import {AbsoluteFill, Audio, getStaticFiles, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {BrandBackground, OrangeWipe} from '../components/BrandBackground';
import {Captions} from '../components/Captions';
import {MascotLayer} from '../components/MascotLayer';
import {OutroCTA} from '../components/OutroCTA';
import {Phone} from '../components/Phone';
import {ASSETS, BRAND, MUSIC, TRANSITION_FRAMES, VO_OFFSET} from '../config';
import {DP_CAPTIONS, DP_SCENES, DP_SFX, DP_SYNC, DP_UI, DP_VIDEO, DP_VO_FILES, DP_VO_START, type DpSceneId} from './config';
import {LockScreen, OldPager, ProblemChip, ScanScreen, TABLET_H, TABLET_W, TabletDashboard, WaitingPage7} from './screens';

const HIGHLIGHT = ['بيجر', 'QR', 'pagergo', '7', 'جاهز…'];
const dur = (id: DpSceneId) => DP_SCENES.find((s) => s.id === id)!.duration;
/** Scene-local frame of an absolute sync point, so visuals and sound cues share one source. */
const local = (id: DpSceneId, abs: number) => abs - DP_SCENES.find((s) => s.id === id)!.from;

/** Floating, slightly tilted tablet. (x, y) = centre. */
const FloatingTablet: React.FC<{x: number; y: number; scale: number; tilt?: number; children: React.ReactNode; enterAt?: number}> = ({x, y, scale, tilt = 10, children, enterAt = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - enterAt, fps, config: {damping: 15, stiffness: 90}});
  const float = Math.sin(frame / 24) * 8;
  return (
    <div style={{position: 'absolute', left: x - TABLET_W / 2, top: y - TABLET_H / 2, width: TABLET_W, height: TABLET_H, perspective: 2400, opacity: p}}>
      <div style={{transform: `translateY(${(1 - p) * 300 + float}px) scale(${scale * interpolate(p, [0, 1], [0.8, 1])}) rotateX(${tilt}deg) rotateY(${interpolate(p, [0, 1], [-25, -6])}deg)`, transformStyle: 'preserve-3d'}}>{children}</div>
    </div>
  );
};

// 0–4 s · the old pager problem
const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <BrandBackground glowY={55} particles={8} />
      <AbsoluteFill style={{background: 'radial-gradient(60% 40% at 50% 60%, rgba(255,40,30,0.18), transparent 70%)'}} />
      <OldPager x={330} y={1180} buzzFrom={10} rot={-8} scale={0.85} dead />
      <OldPager x={560} y={1020} buzzFrom={12} rot={4} />
      <OldPager x={780} y={1230} buzzFrom={30} rot={10} scale={0.8} />
      {DP_UI.oldPagerProblems.map((t, i) => (
        <ProblemChip key={t} text={t} x={[300, 760, 540][i]} y={[760, 800, 1440][i]} at={26 + i * 16} />
      ))}
      <AbsoluteFill style={{background: 'black', opacity: interpolate(frame, [100, 120], [0, 0.25], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}} />
      <Captions text={DP_CAPTIONS.problem} end={dur('problem')} highlightPrefixes={HIGHLIGHT} />
    </AbsoluteFill>
  );
};

// 4–9 s · cashier creates order 7 (+ QR) on the tablet
const Cashier: React.FC = () => (
  <AbsoluteFill>
    <BrandBackground glowY={48} />
    <FloatingTablet x={560} y={1070} scale={0.98}>
      <TabletDashboard createAt={local('cashier', DP_SYNC.orderCreated)} />
    </FloatingTablet>
    <MascotLayer poses={[{at: 0, pose: 'thumbs-up'}]} enter={84} height={360} x={150} y={1680} />
    <Captions text={DP_CAPTIONS.cashier} end={dur('cashier')} highlightPrefixes={HIGHLIGHT} />
  </AbsoluteFill>
);

// 9–14 s · customer scans the QR
const Scan: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ph = spring({frame: frame - 6, fps, config: {damping: 14, stiffness: 80}});
  return (
    <AbsoluteFill>
      <BrandBackground glowY={50} />
      <FloatingTablet x={400} y={930} scale={0.66} tilt={18} enterAt={-30}>
        <TabletDashboard createAt={-100} />
      </FloatingTablet>
      <Phone x={730} y={1250 + (1 - ph) * 700} scale={0.8} rotateX={18 - ph * 10} rotateY={-14} rotateZ={-6}>
        <ScanScreen lockAt={local('scan', DP_SYNC.qrLocked)} clipAt={local('scan', DP_SYNC.appClip)} openAt={local('scan', DP_SYNC.appClip) + 26} />
      </Phone>
      <MascotLayer poses={[{at: 0, pose: 'phone'}]} enter={40} height={420} x={200} y={1660} />
      <Captions text={DP_CAPTIONS.scan} end={dur('scan')} highlightPrefixes={HIGHLIGHT} />
    </AbsoluteFill>
  );
};

// 14–20 s · waiting page: order 7 · قيد التحضير
const Preparing: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ph = spring({frame, fps, config: {damping: 15}});
  const lockAt = local('preparing', DP_SYNC.phoneLocks);
  return (
    <AbsoluteFill>
      <BrandBackground glowX={55} glowY={52} />
      <Phone x={600} y={1040} scale={1.0 * interpolate(ph, [0, 1], [0.85, 1])} rotateY={-16 + Math.sin(frame / 30) * 4} rotateX={4} glow="rgba(255,122,0,0.3)">
        <WaitingPage7 start={6} />
        <AbsoluteFill style={{opacity: interpolate(frame, [lockAt, lockAt + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
          {frame >= lockAt ? <LockScreen cardIn={lockAt + 4} /> : null}
        </AbsoluteFill>
      </Phone>
      <MascotLayer poses={[{at: 0, pose: 'thinking'}]} enter={30} height={440} x={190} y={1640} />
      <Captions text={DP_CAPTIONS.preparing} end={dur('preparing')} highlightPrefixes={HIGHLIGHT} />
    </AbsoluteFill>
  );
};

// 20–26 s · HERO: staff taps جاهز → lock-screen card switches to جاهز
const Ready: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tapAt = local('ready', DP_SYNC.staffTap);
  const readyAt = local('ready', DP_SYNC.lockReady);
  const ph = spring({frame: frame - 8, fps, config: {damping: 15}});
  const beam = interpolate(frame, [tapAt, readyAt], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const shake = frame >= readyAt && frame < readyAt + 14 ? Math.sin(frame * 3.1) * 7 : 0;
  const fine = interpolate(frame, [readyAt + 20, readyAt + 32], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill>
      <BrandBackground glowY={60} />
      <FloatingTablet x={270} y={1080} scale={0.5} tilt={8} enterAt={-20}>
        <TabletDashboard createAt={-200} tapReadyAt={tapAt} cursorFrom={22} />
      </FloatingTablet>
      {/* signal from the dashboard to the phone */}
      {beam > 0 && beam < 1 ? (
        <div style={{position: 'absolute', left: 450 + beam * 60, top: 1060, width: 90, height: 12, borderRadius: 6, background: `linear-gradient(90deg, ${BRAND.colors.orangeSoft}, ${BRAND.colors.green})`, boxShadow: '0 0 30px 10px rgba(34,197,94,0.45)'}} />
      ) : null}
      <Phone x={780} y={1060} scale={1.12 * interpolate(ph, [0, 1], [0.8, 1])} rotateX={6} rotateY={Math.sin(frame / 30) * 3} shakeX={shake} glow={frame >= readyAt ? 'rgba(34,197,94,0.5)' : 'rgba(255,122,0,0.25)'}>
        <LockScreen readyAt={readyAt} cardIn={14} />
      </Phone>
      <div dir="rtl" style={{position: 'absolute', top: 1640, left: 60, right: 60, textAlign: 'center', fontFamily: BRAND.font, fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.7)', opacity: fine}}>
        {DP_UI.finePrint}
      </div>
      <Captions text={DP_CAPTIONS.ready} end={dur('ready')} highlightPrefixes={HIGHLIGHT} />
    </AbsoluteFill>
  );
};

// 26–30 s · mascot, logo, CTA, website
const Outro: React.FC = () => (
  <AbsoluteFill>
    <BrandBackground glowX={45} glowY={42} particles={20} />
    <OutroCTA logoAt={local('outro', DP_SYNC.logo)} ctaAt={44} urlAt={54} tapAt={72} plateX={400} plateY={800} plate={500} cta={DP_UI.cta} />
    <MascotLayer poses={[{at: 0, pose: 'juggling'}, {at: 60, pose: 'thumbs-up'}]} enter={4} height={540} x={850} y={1100} from="right" />
    <Captions text={DP_CAPTIONS.outro} end={dur('outro') + 30} highlightPrefixes={HIGHLIGHT} />
  </AbsoluteFill>
);

const SCENES: Record<DpSceneId, React.FC> = {problem: Problem, cashier: Cashier, scan: Scan, preparing: Preparing, ready: Ready, outro: Outro};

export const DigitalPager: React.FC = () => {
  const files = new Set(getStaticFiles().map((f) => f.name));
  const voLines = DP_SCENES.map((s) => ({scene: s, file: DP_VO_FILES[s.id]})).filter((v) => files.has(v.file));
  const music = voLines.length > 0 ? MUSIC.duckedVolume : MUSIC.volume;
  return (
  <AbsoluteFill style={{backgroundColor: BRAND.colors.navy}}>
    {DP_SCENES.map((s) => {
      const C = SCENES[s.id];
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}>
          <C />
        </Sequence>
      );
    })}
    {DP_SCENES.slice(1).map((s) => (
      <OrangeWipe key={s.id} at={s.from} length={TRANSITION_FRAMES} />
    ))}
    <Audio src={staticFile(ASSETS.music)} volume={(f) => interpolate(f, [0, 10, DP_VIDEO.durationInFrames - 30, DP_VIDEO.durationInFrames], [0, music, music, 0], {extrapolateRight: 'clamp'})} />
    {DP_SFX.map((cue, i) => (
      <Sequence key={i} from={cue.frame} durationInFrames={90} layout="none">
        <Audio src={staticFile(ASSETS.sfx[cue.sfx])} volume={cue.volume} />
      </Sequence>
    ))}
    {voLines.map((v) => (
      <Sequence key={v.file} from={DP_VO_START[v.scene.id] ?? v.scene.from + VO_OFFSET} layout="none">
        <Audio src={staticFile(v.file)} />
      </Sequence>
    ))}
  </AbsoluteFill>
  );
};
