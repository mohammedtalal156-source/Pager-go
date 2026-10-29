import React from 'react';
import {AbsoluteFill, Audio, Easing, getStaticFiles, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Cursor} from '../ai-menu/art';
import {useCursor} from '../ai-menu/screens';
import {BrandBackground} from '../components/BrandBackground';
import {Captions} from '../components/Captions';
import {MascotLayer} from '../components/MascotLayer';
import {Phone} from '../components/Phone';
import {ASSETS, BRAND, MUSIC, orangeGradient} from '../config';
import {LY_DEMO, LY_HEADLINES, LY_OUTRO, LY_SCENES, LY_SFX, LY_SYNC, LY_UI, LY_VIDEO, LY_VO_FILES, LY_VO_START, LY_XFADE, type LySceneId} from './config';
import {
  BROWSER_BAR,
  BROWSER_PAD,
  BrowserFrame,
  Burst,
  CASHIER_BTN,
  CASHIER_H,
  CASHIER_W,
  CashierDialog,
  Customer,
  DASH_H,
  DASH_TARGETS,
  DASH_W,
  type DashTab,
  DOOR,
  FlyingStars,
  GET_CODE_BTN,
  LoyaltyCardScreen,
  LoyaltyDashboard,
  PickupToast,
  REDEEM_BTN,
  RedeemSheet,
  RewardCard,
  RING,
  Sparkle,
  Storefront,
  Tap,
  typed,
} from './screens';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.45, 0, 0.2, 1);
const HIGHLIGHT = ['زبونك', 'ويروح', 'نقاط', 'جديدة', 'زيارة', 'للمكافأة', 'مكافآت', 'تتحول', 'النقاط', 'والمكافآت', 'تحدد'];
const scene = (id: LySceneId) => LY_SCENES.find((s) => s.id === id)!;
const dur = (id: LySceneId) => scene(id).duration;
/** Scene-local frame of an absolute sync point. */
const local = (id: LySceneId, abs: number) => abs - scene(id).from;

const Headline: React.FC<{id: LySceneId; end?: number}> = ({id, end}) => <Captions text={LY_HEADLINES[id]} start={6} end={end ?? dur(id)} highlightPrefixes={HIGHLIGHT} />;

/** Phone-screen pixel → composition pixel for an unrotated <Phone x y scale>. */
const onPhone = (p: {x: number; y: number}, x: number, y: number, scale: number) => ({x: x + (14 + p.x - 210) * scale, y: y + (14 + p.y - 435) * scale});

/** Number of stars that have landed: one every `gap` frames, the first `len` frames after `at`. */
const landed = (frame: number, at: number, count: number, gap = 6, len = 18) => new Array(count).fill(0).filter((_, i) => frame >= at + i * gap + len).length;

// 0–4 s · cartoon burger restaurant; customer leaves with the order; camera pushes to the door and holds
const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const leave = local('problem', LY_SYNC.customerLeaves);
  const hold = local('problem', LY_SYNC.doorHold);
  const cam = interpolate(frame, [0, hold], [0, 1], {...clamp, easing: ease});
  const walk = interpolate(frame, [leave, leave + 62], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const dim = interpolate(frame, [hold, hold + 18], [0, 0.35], clamp);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#0B1433'}}>
      <AbsoluteFill style={{transform: `scale(${1 + cam * 0.3}) translateY(${cam * -30}px)`, transformOrigin: `${DOOR.x}px 1150px`}}>
        <Storefront />
        <Customer x={DOOR.x + walk * 380} y={DOOR.y + walk * 380} scale={0.9 + walk * 0.9} walk={frame >= leave ? (frame - leave) / 22 : 0} opacity={interpolate(walk, [0.75, 0.95], [1, 0], clamp)} />
      </AbsoluteFill>
      {/* door holds: cool the frame, the shop stays empty */}
      <AbsoluteFill style={{background: 'radial-gradient(60% 40% at 50% 60%, rgba(10,18,48,0) 0%, rgba(10,18,48,0.9) 100%)', opacity: dim + 0.25}} />
      <MascotLayer poses={[{at: 0, pose: 'thinking'}]} enter={hold - 10} height={400} x={880} y={1900} from="right" />
      <Headline id="problem" />
    </AbsoluteFill>
  );
};

// 4–8 s · 3D phone opens the real loyalty card; order picked up → 4 stars fly into the ring → 0 → 4
const Earn: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pickAt = local('earn', LY_SYNC.pickedUp1);
  const starsAt = pickAt + 10;
  const n = landed(frame, starsAt, 4);
  const ph = spring({frame: frame - 2, fps, config: {damping: 16, stiffness: 90}});
  const PX = 540;
  const PY = 1150;
  const S = 1.12;
  const fill = interpolate(n, [0, 4], [0, 0.5]);
  const chip = spring({frame: frame - pickAt - 4, fps, config: {damping: 15}});
  return (
    <AbsoluteFill>
      <BrandBackground glowY={58} />
      <Phone x={PX} y={PY + (1 - ph) * 700} scale={S} rotateX={interpolate(ph, [0, 1], [24, 4])} rotateY={interpolate(ph, [0, 1], [-38, 0]) + Math.sin(frame / 40) * 3} glow="rgba(255,122,0,0.3)">
        <LoyaltyCardScreen points={n} fill={fill} note={LY_UI.perOrder} history={n > 0 ? [1] : []} newAt={starsAt + 18} bumpAt={n > 0 ? starsAt + (n - 1) * 6 + 18 : undefined} />
        <PickupToast at={pickAt} order={1} />
      </Phone>
      <FlyingStars from={onPhone({x: 340, y: 100}, PX, PY, S)} to={onPhone(RING, PX, PY, S)} at={starsAt} count={4} gap={6} len={18} />
      <div dir="rtl" style={{position: 'absolute', left: 0, right: 0, top: 1720, display: 'flex', justifyContent: 'center', opacity: chip, transform: `translateY(${(1 - chip) * 30}px)`}}>
        <div style={{padding: '12px 28px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.25)', fontFamily: BRAND.font, fontSize: 30, fontWeight: 800, color: 'white'}}>✓ {LY_UI.autoAdded}</div>
      </div>
      <div dir="rtl" style={{position: 'absolute', top: 1810, left: 70, right: 70, textAlign: 'center', fontFamily: BRAND.font, fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.7)', opacity: chip}}>
        {LY_DEMO.finePrint}
      </div>
      <Headline id="earn" />
    </AbsoluteFill>
  );
};

// 8–13 s · same customer walks back in; second order → 4 → 8; ring completes green; celebration
const Return: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const walkEnd = 50;
  const walk = interpolate(frame, [0, walkEnd], [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
  const dive = interpolate(frame, [walkEnd - 6, walkEnd + 12], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const pickAt = local('return', LY_SYNC.pickedUp2);
  const starsAt = pickAt + 10;
  const doneAt = local('return', LY_SYNC.points8);
  const n = landed(frame, starsAt, 4);
  const ph = spring({frame: frame - walkEnd, fps, config: {damping: 16}});
  const glow = spring({frame: frame - doneAt, fps, config: {damping: 12}});
  const rew = spring({frame: frame - doneAt - 10, fps, config: {damping: 16}});
  const PX = 540;
  const PY = 1150;
  const S = 1.12;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <BrandBackground glowY={56} particles={18} />
      {frame < walkEnd + 14 ? (
        <AbsoluteFill style={{transform: `scale(${1 + dive * 2.2})`, transformOrigin: `${DOOR.x}px 1250px`, opacity: 1 - interpolate(dive, [0.6, 1], [0, 1], clamp)}}>
          <Storefront />
          <Customer x={DOOR.x + walk * 380} y={DOOR.y + walk * 380} scale={0.9 + walk * 0.9} walk={frame / 22} opacity={interpolate(walk, [0, 0.08], [0.6, 1], clamp)} />
          <AbsoluteFill style={{background: 'radial-gradient(60% 40% at 50% 60%, rgba(10,18,48,0) 0%, rgba(10,18,48,0.7) 100%)'}} />
        </AbsoluteFill>
      ) : null}
      {frame >= walkEnd ? (
        <>
          <Phone x={PX} y={PY + (1 - ph) * 500} scale={S * (0.9 + 0.1 * ph)} rotateX={4} rotateY={interpolate(ph, [0, 1], [30, 0]) + Math.sin(frame / 40) * 3} glow={`rgba(62,180,120,${0.15 + 0.35 * glow})`}>
            <LoyaltyCardScreen points={4 + n} fill={interpolate(n, [0, 4], [0.5, 1])} glow={glow} note={frame >= doneAt ? LY_UI.canRedeem : LY_UI.perOrder} rewards={rew} history={n > 0 ? [2, 1] : [1]} newAt={starsAt + 18} bumpAt={n > 0 ? starsAt + (n - 1) * 6 + 18 : undefined} />
            <PickupToast at={pickAt} order={2} />
          </Phone>
          <FlyingStars from={onPhone({x: 340, y: 100}, PX, PY, S)} to={onPhone(RING, PX, PY, S)} at={starsAt} count={4} gap={6} len={18} />
          <Burst {...onPhone(RING, PX, PY, S)} at={doneAt} count={14} radius={300} />
          <MascotLayer poses={[{at: 0, pose: 'thumbs-up'}]} enter={doneAt + 4} height={360} x={170} y={1900} from="left" />
        </>
      ) : null}
      <Headline id="return" />
    </AbsoluteFill>
  );
};

// 13–18 s · استبدل → confirm → fake 6-digit code → camera moves to the cashier → تحقق → سلّم المكافأة
const Redeem: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tapAt = local('redeem', LY_SYNC.tapRedeem);
  const getAt = local('redeem', LY_SYNC.tapGetCode);
  const codeAt = local('redeem', LY_SYNC.codeShown);
  const camAt = local('redeem', LY_SYNC.cashierIn);
  const verifyAt = local('redeem', LY_SYNC.verify);
  const handAt = local('redeem', LY_SYNC.handOver);
  const cam = spring({frame: frame - camAt, fps, config: {damping: 18, stiffness: 70}});
  const PX = interpolate(cam, [0, 1], [540, 250]);
  const PY = interpolate(cam, [0, 1], [1150, 1520]);
  const S = interpolate(cam, [0, 1], [1.12, 0.5]);
  const BX = 50;
  const BY = 540;
  const origin = {x: BX + BROWSER_PAD, y: BY + BROWSER_PAD + BROWSER_BAR};
  const cur = useCursor(
    [
      {x: origin.x + CASHIER_BTN.verify.x, y: origin.y + CASHIER_BTN.verify.y, at: verifyAt},
      {x: origin.x + CASHIER_BTN.handOver.x, y: origin.y + CASHIER_BTN.handOver.y, at: handAt},
    ],
    verifyAt - 14,
  );
  const tap1 = onPhone(REDEEM_BTN, 540, 1150, 1.12);
  const tap2 = onPhone(GET_CODE_BTN, 540, 1150, 1.12);
  return (
    <AbsoluteFill>
      <BrandBackground glowX={interpolate(cam, [0, 1], [50, 60])} glowY={52} />
      <Phone x={PX} y={PY} scale={S} rotateX={4} rotateY={cam * 14 + Math.sin(frame / 40) * 2} glow="rgba(255,122,0,0.3)">
        <LoyaltyCardScreen points={8} fill={1} glow={1} note={LY_UI.canRedeem} rewards={1} history={[2, 1]} pressRedeem={frame >= tapAt - 2 && frame < tapAt + 4} />
        <RedeemSheet openAt={tapAt + 4} codeAt={codeAt} pressGetAt={getAt} />
      </Phone>
      {cam < 0.05 ? (
        <>
          <Tap {...tap1} at={tapAt} />
          <Tap {...tap2} at={getAt} />
        </>
      ) : null}
      {frame >= camAt ? (
        <div style={{position: 'absolute', left: BX, top: BY, opacity: cam, transform: `translateX(${(1 - cam) * 700}px) perspective(2200px) rotateY(${(1 - cam) * -24}deg)`}}>
          <BrowserFrame width={CASHIER_W} height={CASHIER_H}>
            <CashierDialog typeFrom={camAt + 14} verifyAt={verifyAt} handAt={handAt} />
          </BrowserFrame>
        </div>
      ) : null}
      {cur.visible && frame < handAt + 12 ? <Cursor x={cur.x} y={cur.y} press={cur.press} /> : null}
      <Burst x={origin.x + CASHIER_BTN.handOver.x} y={origin.y + CASHIER_BTN.handOver.y} at={handAt + 4} count={10} radius={200} />
      <Headline id="redeem" />
    </AbsoluteFill>
  );
};

// 18–24 s · merchant dashboard "نقاط الولاء": switch on, points per order, add reward, customers, moves, stats
const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = (abs: number) => local('dashboard', abs);
  const toggleAt = L(LY_SYNC.toggleOn);
  const saveAt = L(LY_SYNC.pointsSave);
  const tabRewards = L(LY_SYNC.tabRewards);
  const addAt = L(LY_SYNC.addReward);
  const rSave = L(LY_SYNC.rewardSave);
  const tabCust = L(LY_SYNC.tabCustomers);
  const tabMoves = L(LY_SYNC.tabMoves);
  const tabOver = L(LY_SYNC.tabOverview);
  const ptsAt = toggleAt + 8;
  const nameFrom = addAt + 10;
  const ptsRewardAt = rSave - 12;
  const enter = spring({frame: frame - 2, fps, config: {damping: 18, stiffness: 80}});
  const tab: DashTab = frame >= tabOver ? 0 : frame >= tabMoves ? 3 : frame >= tabCust ? 2 : frame >= tabRewards ? 1 : 0;
  const modalP = spring({frame: frame - addAt - 4, fps, config: {damping: 15}}) - spring({frame: frame - rSave - 4, fps, config: {damping: 15}});
  const press = (at: number) => frame >= at - 2 && frame < at + 4;
  const BX = 50;
  const BY = 520;
  const o = {x: BX + BROWSER_PAD, y: BY + BROWSER_PAD + BROWSER_BAR};
  const T = DASH_TARGETS;
  const cur = useCursor(
    [
      {x: o.x + T.toggle.x, y: o.y + T.toggle.y, at: toggleAt},
      {x: o.x + T.pointsInput.x, y: o.y + T.pointsInput.y, at: ptsAt},
      {x: o.x + T.save.x, y: o.y + T.save.y, at: saveAt},
      {x: o.x + T.tab(1).x, y: o.y + T.tab(1).y, at: tabRewards},
      {x: o.x + T.addReward.x, y: o.y + T.addReward.y, at: addAt},
      {x: o.x + T.modalName.x, y: o.y + T.modalName.y, at: nameFrom},
      {x: o.x + T.modalPoints.x, y: o.y + T.modalPoints.y, at: ptsRewardAt},
      {x: o.x + T.modalSave.x, y: o.y + T.modalSave.y, at: rSave},
      {x: o.x + T.tab(2).x, y: o.y + T.tab(2).y, at: tabCust},
      {x: o.x + T.tab(3).x, y: o.y + T.tab(3).y, at: tabMoves},
      {x: o.x + T.tab(0).x, y: o.y + T.tab(0).y, at: tabOver},
    ],
    6,
  );
  return (
    <AbsoluteFill>
      <BrandBackground glowY={50} />
      <div style={{position: 'absolute', left: BX, top: BY, opacity: enter, transform: `translateY(${(1 - enter) * 260}px) perspective(2400px) rotateX(${(1 - enter) * 22}deg) scale(${0.85 + 0.15 * enter})`, transformOrigin: '50% 0'}}>
        <BrowserFrame width={DASH_W} height={DASH_H}>
          <LoyaltyDashboard
            tab={tab}
            toggleOn={spring({frame: frame - toggleAt, fps, config: {damping: 14}})}
            pointsText={frame >= ptsAt + 4 ? String(LY_DEMO.pointsPerOrder) : ''}
            pointsFocus={frame >= ptsAt && frame < saveAt}
            pressSave={press(saveAt)}
            pressAdd={press(addAt)}
            rewardListed={spring({frame: frame - rSave - 6, fps, config: {damping: 14}})}
            modal={{
              p: Math.max(0, modalP),
              name: typed(LY_DEMO.reward.name, frame, nameFrom + 2, 0.7),
              points: frame >= ptsRewardAt + 3 ? String(LY_DEMO.reward.points) : '',
              nameFocus: frame >= nameFrom && frame < ptsRewardAt,
              pointsFocus: frame >= ptsRewardAt && frame < rSave,
              pressSave: press(rSave),
            }}
            stats={frame >= tabOver ? interpolate(frame, [tabOver + 2, tabOver + 16], [0, 1], clamp) : 0}
            rows={interpolate(frame, [tab === 2 ? tabCust + 2 : tabMoves + 2, (tab === 2 ? tabCust : tabMoves) + 14], [0, 1], clamp)}
          />
        </BrowserFrame>
      </div>
      {cur.visible && frame < tabOver + 10 ? <Cursor x={cur.x} y={cur.y} press={cur.press} /> : null}
      <Headline id="dashboard" />
    </AbsoluteFill>
  );
};

// 24–30 s · restaurant + phone + floating reward; camera pulls back; official logo, headline, CTA, website
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logoAt = local('outro', LY_SYNC.logo);
  const tapAt = local('outro', LY_SYNC.ctaTap);
  const pull = interpolate(frame, [0, logoAt], [0, 1], {...clamp, easing: ease});
  const away = interpolate(frame, [logoAt - 22, logoAt + 4], [0, 1], clamp);
  const ph = spring({frame: frame - 2, fps, config: {damping: 16}});
  const card = spring({frame: frame - 10, fps, config: {damping: 13}});
  const logo = spring({frame: frame - logoAt, fps, config: {damping: 13, stiffness: 100}});
  const h1 = spring({frame: frame - logoAt - 12, fps, config: {damping: 16}});
  const h2 = spring({frame: frame - logoAt - 24, fps, config: {damping: 16}});
  const cta = spring({frame: frame - logoAt - 38, fps, config: {damping: 12}});
  const url = spring({frame: frame - logoAt - 50, fps, config: {damping: 14}});
  const sweep = interpolate(frame, [logoAt + 14, logoAt + 44], [-0.4, 1.4], clamp);
  const press = frame >= tapAt - 3 && frame < tapAt + 3 ? 0.94 : 1;
  const ring = spring({frame: frame - tapAt, fps, config: {damping: 20}});
  const fadeOut = interpolate(frame, [dur('outro') - 8, dur('outro')], [1, 0], clamp);
  return (
    <AbsoluteFill style={{opacity: 0.08 + 0.92 * fadeOut, background: BRAND.colors.navy}}>
      {/* the hero shot: restaurant behind, phone + reward in front; camera pulls back, then it all fades */}
      <AbsoluteFill style={{opacity: 1 - away, transform: `scale(${1.25 - pull * 0.25})`}}>
        <AbsoluteFill style={{filter: 'blur(5px)', transform: 'scale(1.05)'}}>
          <Storefront />
        </AbsoluteFill>
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(10,18,48,0.35) 0%, rgba(10,18,48,0.75) 100%)'}} />
        <Phone x={380} y={1240 + (1 - ph) * 600} scale={0.85} rotateX={6} rotateY={16 + Math.sin(frame / 30) * 4} rotateZ={-4} glow="rgba(62,180,120,0.45)">
          <LoyaltyCardScreen points={8} fill={1} glow={1} note={LY_UI.canRedeem} rewards={1} history={[2, 1]} />
        </Phone>
        <div style={{position: 'absolute', left: 640, top: 900, opacity: card, transform: `translateY(${(1 - card) * 200 + Math.sin(frame / 18) * 14}px) perspective(1400px) rotateY(${-18 + Math.sin(frame / 26) * 6}deg) rotateZ(5deg)`}}>
          <RewardCard />
        </div>
        {new Array(8).fill(0).map((_, i) => {
          const a = frame / 30 + (i / 8) * Math.PI * 2;
          const s = i % 2 ? 34 : 54;
          return <Sparkle key={i} size={s} color={i % 3 ? '#FF8A1F' : '#FFD27A'} style={{position: 'absolute', left: 790 + Math.cos(a) * 240 - s / 2, top: 1100 + Math.sin(a) * 300 - s / 2, opacity: card * (0.6 + 0.4 * Math.sin(frame / 8 + i)), transform: `rotate(${frame * 2 + i * 40}deg)`}} />;
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{opacity: away}}>
        <BrandBackground glowX={50} glowY={34} particles={20} />
      </AbsoluteFill>
      {/* halo + official logo on its white plate (never redrawn) */}
      <div style={{position: 'absolute', left: 540 - 480, top: 560 - 480, width: 960, height: 960, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,122,0,0.45) 0%, rgba(255,122,0,0) 62%)', opacity: logo, transform: `scale(${0.6 + logo * 0.4 + Math.sin(frame / 20) * 0.02})`}} />
      <div style={{position: 'absolute', left: 540 - 190, top: 560 - 190, width: 380, height: 380, borderRadius: 64, background: 'white', overflow: 'hidden', boxShadow: '0 60px 140px rgba(0,0,0,0.55), 0 0 0 6px rgba(255,255,255,0.12)', opacity: interpolate(logo, [0, 0.2], [0, 1], clamp), transform: `perspective(1600px) rotateY(${interpolate(logo, [0, 1], [70, 0])}deg) scale(${interpolate(logo, [0, 1], [0.6, 1])}) translateY(${Math.sin(frame / 22) * 5}px)`}}>
        <Img src={staticFile(ASSETS.logo)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
        <div style={{position: 'absolute', top: -100, bottom: -100, width: 140, left: `${sweep * 100}%`, transform: 'rotate(18deg)', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.75), rgba(255,255,255,0))', mixBlendMode: 'overlay'}} />
      </div>
      <div dir="rtl" style={{position: 'absolute', left: 50, right: 50, top: 820, textAlign: 'center', fontFamily: BRAND.font, color: 'white'}}>
        <div style={{fontSize: 84, fontWeight: 900, lineHeight: 1.3, opacity: h1, transform: `translateY(${(1 - h1) * 40}px)`}}>{LY_OUTRO.headline}</div>
        <div style={{fontSize: 44, fontWeight: 800, color: BRAND.colors.orangeSoft, marginTop: 14, opacity: h2, transform: `translateY(${(1 - h2) * 30}px)`}}>{LY_OUTRO.sub}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1240, display: 'flex', justifyContent: 'center'}}>
        <div style={{position: 'relative', transform: `scale(${cta * press})`, opacity: cta}}>
          {frame >= tapAt ? <div style={{position: 'absolute', inset: -14 - ring * 30, borderRadius: 999, border: `4px solid ${BRAND.colors.orangeSoft}`, opacity: 1 - ring}} /> : null}
          <div dir="rtl" style={{padding: '24px 64px', borderRadius: 999, background: orangeGradient, color: 'white', fontFamily: BRAND.font, fontSize: 54, fontWeight: 1000, whiteSpace: 'nowrap', boxShadow: '0 24px 60px rgba(255,90,0,0.55), inset 0 3px 0 rgba(255,255,255,0.35)'}}>{LY_OUTRO.cta}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1440, display: 'flex', justifyContent: 'center', opacity: url, transform: `translateY(${(1 - url) * 30}px)`}}>
        <div style={{direction: 'ltr', fontFamily: BRAND.font, fontSize: 58, fontWeight: 900, color: 'white', letterSpacing: 1, padding: '10px 36px', borderRadius: 24, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.22)'}}>{BRAND.url}</div>
      </div>
    </AbsoluteFill>
  );
};

const SCENES: Record<LySceneId, React.FC> = {problem: Problem, earn: Earn, return: Return, redeem: Redeem, dashboard: Dashboard, outro: Outro};

/** Each scene after the first dissolves in over LY_XFADE frames with a slight push, on top of the previous one. */
const SceneIn: React.FC<{children: React.ReactNode; first: boolean}> = ({children, first}) => {
  const frame = useCurrentFrame();
  if (first) return <>{children}</>;
  const p = interpolate(frame, [0, LY_XFADE], [0, 1], {...clamp, easing: ease});
  return <AbsoluteFill style={{opacity: p, transform: `scale(${1.04 - 0.04 * p})`, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined}}>{children}</AbsoluteFill>;
};

export const LoyaltyAd: React.FC = () => {
  const files = new Set(getStaticFiles().map((f) => f.name));
  const voLines = LY_SCENES.map((s) => ({id: s.id, file: LY_VO_FILES[s.id]})).filter((v) => files.has(v.file));
  const music = voLines.length > 0 ? MUSIC.duckedVolume : MUSIC.volume;
  return (
    <AbsoluteFill style={{backgroundColor: BRAND.colors.navy}}>
      {LY_SCENES.map((s, i) => {
        const C = SCENES[s.id];
        const last = i === LY_SCENES.length - 1;
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.duration + (last ? 0 : LY_XFADE)} name={s.id}>
            <SceneIn first={i === 0}>
              <C />
            </SceneIn>
          </Sequence>
        );
      })}
      <Audio src={staticFile(ASSETS.music)} volume={(f) => interpolate(f, [0, 10, LY_VIDEO.durationInFrames - 30, LY_VIDEO.durationInFrames], [0, music, music, 0], {extrapolateRight: 'clamp'})} />
      {LY_SFX.map((cue, i) => (
        <Sequence key={i} from={cue.frame} durationInFrames={90} layout="none">
          <Audio src={staticFile(ASSETS.sfx[cue.sfx])} volume={cue.volume} />
        </Sequence>
      ))}
      {voLines.map((v) => (
        <Sequence key={v.file} from={LY_VO_START[v.id]} layout="none">
          <Audio src={staticFile(v.file)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
