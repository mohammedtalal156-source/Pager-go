import React from 'react';
import {AbsoluteFill, Audio, getStaticFiles, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {AiMenuTransform} from './components/AiMenuTransform';
import {BrandBackground, ConceptualTag, OrangeWipe} from './components/BrandBackground';
import {Captions} from './components/Captions';
import {LoyaltyPoints} from './components/LoyaltyPoints';
import {MascotLayer} from './components/MascotLayer';
import {OutroCTA} from './components/OutroCTA';
import {Phone} from './components/Phone';
import {PhoneWaitingScreen} from './components/PhoneWaitingScreen';
import {PosTicket} from './components/PosTicket';
import {QrReveal} from './components/QrReveal';
import {ASSETS, BRAND, type Language, MUSIC, orangeGradient, SCENES, type SceneId, SFX_CUES, TRANSITION_FRAMES, UI, VO_FILES, VO_OFFSET, VOICEOVER, VIDEO} from './config';

export type CommercialProps = {language: Language};

const scene = (id: SceneId) => SCENES.find((s) => s.id === id)!;
const HIGHLIGHT = ['بيجر', 'QR', 'pagergo'];

// ── Scene 1 · 0–5 s · POS order → ticket 247
const ScenePos: React.FC<{caption: string}> = ({caption}) => {
  const d = scene('pos').duration;
  return (
    <AbsoluteFill>
      <BrandBackground glowY={52} />
      <PosTicket tapAt={38} ticketAt={62} />
      <Captions text={caption} end={d} highlightPrefixes={HIGHLIGHT} />
      <ConceptualTag text={UI.conceptualTag} />
    </AbsoluteFill>
  );
};

// ── Scene 2 · 5–11 s · mascot points at QR, waiting page 247 → Ready
const SceneQr: React.FC<{caption: string}> = ({caption}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const d = scene('qr').duration;
  const phoneIn = spring({frame: frame - 40, fps, config: {damping: 14, stiffness: 90}});
  const readyAt = 122;
  const shake = frame >= readyAt && frame < readyAt + 14 ? Math.sin(frame * 3.2) * 7 : 0;
  const chipA = spring({frame: frame - 70, fps, config: {damping: 14}});
  const chipB = spring({frame: frame - readyAt - 6, fps, config: {damping: 14}});
  const chip = (text: string, p: number, color: string) => (
    <div style={{position: 'absolute', left: 770 - 200, width: 400, top: 548, display: 'flex', justifyContent: 'center', opacity: p, transform: `translateY(${(1 - p) * 20}px)`}}>
      <div dir="rtl" style={{fontFamily: BRAND.font, fontSize: 28, fontWeight: 900, color: 'white', padding: '8px 22px', borderRadius: 999, background: color, boxShadow: '0 12px 30px rgba(0,0,0,0.35)'}}>
        {text}
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      <BrandBackground glowX={40} glowY={50} />
      <QrReveal start={0} scanFrom={24} lockAt={50} size={290} x={300} y={830} />
      <Phone x={770} y={1010} scale={0.84 * interpolate(phoneIn, [0, 1], [0.7, 1])} rotateY={interpolate(phoneIn, [0, 1], [-60, -12]) + Math.sin(frame / 25) * 3} rotateX={4} shakeX={shake + (1 - phoneIn) * 600} glow={frame >= readyAt ? 'rgba(34,197,94,0.45)' : 'rgba(255,122,0,0.3)'}>
        <PhoneWaitingScreen start={54} readyAt={readyAt} />
      </Phone>
      {frame < readyAt + 6 ? chip(`✓ ${UI.qr.noApp}`, chipA * (1 - chipB), 'rgba(255,255,255,0.14)') : null}
      {frame >= readyAt ? chip(UI.waiting.staffUpdate, chipB, BRAND.colors.green) : null}
      <MascotLayer poses={[{at: 0, pose: 'thumbs-up'}, {at: 34, pose: 'phone'}]} enter={10} height={470} x={270} y={1600} />
      <Captions text={caption} end={d} highlightPrefixes={HIGHLIGHT} />
      <ConceptualTag text={UI.conceptualTag} />
    </AbsoluteFill>
  );
};

// ── Scene 3 · 11–17 s · loyalty card + points
const SceneLoyalty: React.FC<{caption: string}> = ({caption}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const d = scene('loyalty').duration;
  const mini = spring({frame: frame - 30, fps, config: {damping: 14}});
  return (
    <AbsoluteFill>
      <BrandBackground glowY={46} />
      <LoyaltyPoints start={6} coinsAt={50} />
      {/* mini ticket 247: the order the points come from */}
      <div
        style={{
          position: 'absolute',
          left: 880 - 95,
          top: 1500 - 70,
          width: 190,
          padding: '12px 0',
          borderRadius: 22,
          background: 'white',
          textAlign: 'center',
          fontFamily: BRAND.font,
          boxShadow: `0 0 0 3px ${BRAND.colors.orange}, 0 20px 50px rgba(0,0,0,0.45)`,
          opacity: mini,
          transform: `scale(${mini}) rotate(-4deg)`,
        }}
      >
        <div style={{fontSize: 70, fontWeight: 1000, lineHeight: 1, backgroundImage: orangeGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>{UI.ticket.number}</div>
        <div dir="rtl" style={{fontSize: 22, fontWeight: 800, color: BRAND.colors.green}}>{UI.waiting.states[2]} ✓</div>
      </div>
      <MascotLayer poses={[{at: 0, pose: 'thumbs-up'}]} enter={14} height={560} x={250} y={1600} wiggleFrom={90} wiggleTo={130} />
      <Captions text={caption} end={d} highlightPrefixes={HIGHLIGHT} />
      <ConceptualTag text={UI.conceptualTag} />
    </AbsoluteFill>
  );
};

// ── Scene 4 · 17–24 s · paper menu photo → AI → digital menu cards
const SceneAiMenu: React.FC<{caption: string}> = ({caption}) => {
  const d = scene('aiMenu').duration;
  return (
    <AbsoluteFill>
      <BrandBackground glowY={50} />
      <AiMenuTransform start={20} scanAt={62} cardsAt={100} />
      <MascotLayer poses={[{at: 0, pose: 'menu-bell'}]} enter={4} exitAt={88} height={430} x={230} y={1640} wiggleFrom={40} wiggleTo={70} />
      <Captions text={caption} end={d} highlightPrefixes={HIGHLIGHT} />
      <ConceptualTag text={UI.conceptualTag} />
    </AbsoluteFill>
  );
};

// ── Scene 5 · 24–30 s · mascot next to the official logo, CTA + website
const SceneOutro: React.FC<{caption: string}> = ({caption}) => {
  const d = scene('outro').duration;
  return (
    <AbsoluteFill>
      <BrandBackground glowX={45} glowY={42} particles={22} />
      <OutroCTA logoAt={22} ctaAt={60} urlAt={74} tapAt={86} plateX={400} plateY={800} plate={500} />
      <MascotLayer poses={[{at: 0, pose: 'juggling'}, {at: 78, pose: 'thumbs-up'}]} enter={8} height={540} x={850} y={1100} from="right" />
      <Captions text={caption} end={d + 30} highlightPrefixes={HIGHLIGHT} />
    </AbsoluteFill>
  );
};

const SCENE_COMPONENTS: Record<SceneId, React.FC<{caption: string}>> = {
  pos: ScenePos,
  qr: SceneQr,
  loyalty: SceneLoyalty,
  aiMenu: SceneAiMenu,
  outro: SceneOutro,
};

/** Music bed, SFX, and (if the files exist in /public) recorded voiceover with ducking. */
const Soundtrack: React.FC<{language: Language}> = ({language}) => {
  const files = new Set(getStaticFiles().map((f) => f.name));
  const voLines = SCENES.map((s) => ({scene: s, file: VO_FILES[language][s.id]})).filter((v) => files.has(v.file));
  const hasVo = voLines.length > 0;
  return (
    <>
      <Audio
        src={staticFile(ASSETS.music)}
        volume={(f) => interpolate(f, [0, 10, VIDEO.durationInFrames - 30, VIDEO.durationInFrames], [0, hasVo ? MUSIC.duckedVolume : MUSIC.volume, hasVo ? MUSIC.duckedVolume : MUSIC.volume, 0], {extrapolateRight: 'clamp'})}
      />
      {SFX_CUES.map((cue, i) => (
        <Sequence key={i} from={cue.frame} durationInFrames={90} layout="none">
          <Audio src={staticFile(ASSETS.sfx[cue.sfx])} volume={cue.volume} />
        </Sequence>
      ))}
      {voLines.map((v) => (
        <Sequence key={v.file} from={v.scene.from + VO_OFFSET} layout="none">
          <Audio src={staticFile(v.file)} />
        </Sequence>
      ))}
    </>
  );
};

export const Commercial: React.FC<CommercialProps> = ({language}) => {
  return (
    <AbsoluteFill style={{backgroundColor: BRAND.colors.navy}}>
      {SCENES.map((s) => {
        const C = SCENE_COMPONENTS[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}>
            <C caption={VOICEOVER[language][s.id]} />
          </Sequence>
        );
      })}
      {SCENES.slice(1).map((s) => (
        <OrangeWipe key={s.id} at={s.from} length={TRANSITION_FRAMES} />
      ))}
      <Soundtrack language={language} />
    </AbsoluteFill>
  );
};
