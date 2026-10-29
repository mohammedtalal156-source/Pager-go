import React from 'react';
import {AbsoluteFill, Audio, Easing, getStaticFiles, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {BrandBackground} from '../components/BrandBackground';
import {Captions} from '../components/Captions';
import {Phone} from '../components/Phone';
import {ASSETS, BRAND, MUSIC, orangeGradient} from '../config';
import {QrCodeSvg} from '../digital-pager/QrCodeSvg';
import {Cursor} from './art';
import {AM_DEMO, AM_HEADLINES, AM_OUTRO, AM_SCENES, AM_SFX, AM_SYNC, AM_UI, AM_VIDEO, AM_VO_FILES, AM_VO_START, AM_XFADE, type AmSceneId} from './config';
import {
  AddProductModal,
  AddSectionModal,
  AI_PAGE_H,
  AI_PAGE_W,
  AiUploadPage,
  BrowserFrame,
  CameraView,
  ColorChips,
  CustomerMenu,
  DigitalMenuGhost,
  modalSave,
  PAPER_H,
  PAPER_W,
  PaperMenu,
  PRODUCT_MODAL_H,
  ProductsBar,
  PRODUCTS_BAR_BTN,
  SECTION_MODAL_H,
  TemplateCarousel,
  useCursor,
} from './screens';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.45, 0, 0.2, 1);
const HIGHLIGHT = ['ورقي', 'الذكاء', 'الاصطناعي', 'تصاميم', 'بسهولة', 'تطبيق', 'منيو', 'المنيو'];
const scene = (id: AmSceneId) => AM_SCENES.find((s) => s.id === id)!;
const dur = (id: AmSceneId) => scene(id).duration;
/** Scene-local frame of an absolute sync point. */
const local = (id: AmSceneId, abs: number) => abs - scene(id).from;

const Headline: React.FC<{id: AmSceneId}> = ({id}) => <Captions text={AM_HEADLINES[id]} start={6} end={dur(id)} highlightPrefixes={HIGHLIGHT} />;

/** Soft orange light sweep that drifts across a scene. */
const LightSweep: React.FC<{at: number; len?: number}> = ({at, len = 40}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + len], [-0.3, 1.3], clamp);
  if (p <= -0.3 || p >= 1.3) return null;
  return <AbsoluteFill style={{background: `linear-gradient(105deg, transparent ${p * 100 - 20}%, rgba(255,178,91,0.18) ${p * 100}%, transparent ${p * 100 + 20}%)`, pointerEvents: 'none'}} />;
};

// 0–4 s · paper menu on a restaurant table → turns digital
const Paper: React.FC = () => {
  const frame = useCurrentFrame();
  const t = local('paper', AM_SYNC.paperToDigital);
  const zoom = interpolate(frame, [0, 100], [0, 1], {...clamp, easing: ease});
  const scan = interpolate(frame, [t, t + 34], [0, 1], {...clamp, easing: ease});
  const toNavy = interpolate(frame, [t + 10, t + 50], [0, 1], clamp);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {/* restaurant: warm wood, bokeh lights */}
      <AbsoluteFill style={{background: 'radial-gradient(120% 70% at 50% 30%, #5A3A22 0%, #2B1A0E 55%, #120A05 100%)'}} />
      {new Array(14).fill(0).map((_, i) => {
        const s = 60 + random(`b${i}`) * 140;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: random(`bx${i}`) * 1080 - s / 2 + Math.sin(frame / 40 + i) * 10,
              top: random(`by${i}`) * 700 - s / 2,
              width: s,
              height: s,
              borderRadius: '50%',
              background: i % 3 ? 'rgba(255,190,110,0.35)' : 'rgba(255,240,210,0.3)',
              filter: 'blur(18px)',
            }}
          />
        );
      })}
      {/* table plane */}
      <div style={{position: 'absolute', left: -400, right: -400, top: 900, height: 1400, background: 'repeating-linear-gradient(90deg, #6B4325 0px, #7A4D2B 60px, #633D21 130px)', transform: 'perspective(1200px) rotateX(62deg)', transformOrigin: 'top', boxShadow: 'inset 0 200px 200px rgba(0,0,0,0.5)'}} />
      <AbsoluteFill style={{background: BRAND.colors.navy, opacity: toNavy * 0.92}} />
      <AbsoluteFill style={{opacity: toNavy}}>
        <BrandBackground glowY={58} particles={14} />
      </AbsoluteFill>
      {/* camera pushes in on the menu; it rises from the table toward the lens */}
      <div style={{position: 'absolute', left: 540 - PAPER_W / 2, top: 1130 - PAPER_H / 2, width: PAPER_W, height: PAPER_H, perspective: 1600}}>
        <div style={{position: 'relative', width: PAPER_W, height: PAPER_H, transform: `translateY(${interpolate(zoom, [0, 1], [260, 0])}px) scale(${interpolate(zoom, [0, 1], [0.95, 1.4])}) rotateX(${interpolate(zoom, [0, 1], [58, 6])}deg) rotateZ(${interpolate(zoom, [0, 1], [-8, 0])}deg)`, boxShadow: '0 60px 120px rgba(0,0,0,0.6)', borderRadius: 10}}>
          <div style={{position: 'absolute', inset: 0, clipPath: `inset(${scan * 100}% 0 0 0)`}}>
            <PaperMenu />
          </div>
          <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 0 ${(1 - scan) * 100}% 0)`}}>
            <DigitalMenuGhost />
          </div>
          {scan > 0 && scan < 1 ? (
            <>
              <div style={{position: 'absolute', left: -40, right: -40, top: `${scan * 100}%`, height: 8, marginTop: -4, background: '#FFD9A8', boxShadow: '0 0 40px 16px rgba(255,122,0,0.85)', borderRadius: 4}} />
              {new Array(16).fill(0).map((_, i) => {
                const life = (frame - t - i * 1.5) / 18;
                if (life < 0 || life > 1) return null;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: random(`sp${i}`) * PAPER_W,
                      top: `calc(${scan * 100}% - ${life * 120}px)`,
                      width: 6 + random(`ss${i}`) * 8,
                      height: 6 + random(`ss${i}`) * 8,
                      borderRadius: 3,
                      background: i % 2 ? '#FFB25B' : '#ffffff',
                      opacity: 1 - life,
                      boxShadow: '0 0 12px rgba(255,140,40,0.9)',
                    }}
                  />
                );
              })}
            </>
          ) : null}
        </div>
      </div>
      <Headline id="paper" />
    </AbsoluteFill>
  );
};

// 4–9 s · real "إنشاء المنيو من الصور" page: pick photo → create → AI processing
const Upload: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - 2, fps, config: {damping: 18, stiffness: 80}});
  const W = AI_PAGE_W + 24;
  const H = AI_PAGE_H + 50 + 24;
  const fine = interpolate(frame, [local('upload', AM_SYNC.aiDone) - 10, local('upload', AM_SYNC.aiDone)], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <BrandBackground glowY={56} />
      <div style={{position: 'absolute', left: 540 - W / 2, top: 1130 - H / 2, perspective: 2200}}>
        <div style={{transform: `translateY(${(1 - p) * 220 + Math.sin(frame / 30) * 6}px) scale(${interpolate(p, [0, 1], [0.86, 0.98])}) rotateX(${interpolate(p, [0, 1], [18, 4])}deg) rotateY(${interpolate(frame, [0, 150], [-6, 4])}deg)`, opacity: p}}>
          <BrowserFrame width={W} height={H}>
            <AiUploadPage pickAt={local('upload', AM_SYNC.pickPhoto)} dropAt={local('upload', AM_SYNC.photoDrop)} createAt={local('upload', AM_SYNC.createTap)} doneAt={local('upload', AM_SYNC.aiDone)} />
          </BrowserFrame>
        </div>
      </div>
      <div dir="rtl" style={{position: 'absolute', top: 1720, left: 70, right: 70, textAlign: 'center', fontFamily: BRAND.font, fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.72)', opacity: fine}}>
        {AM_DEMO.aiFinePrint}
      </div>
      <Headline id="upload" />
    </AbsoluteFill>
  );
};

// 9–14 s · menu builds itself; 3D carousel of the 20 real templates; colour swap
const Design: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pickAt = local('design', AM_SYNC.templatePick);
  const swapAt = local('design', AM_SYNC.colorSwap);
  const ph = spring({frame: frame - 2, fps, config: {damping: 16}});
  const car = spring({frame: frame - 26, fps, config: {damping: 18}});
  const pos = interpolate(frame, [30, pickAt - 4], [0, AM_UI.pickedTemplate], {...clamp, easing: ease});
  const mix = interpolate(frame, [swapAt, swapAt + 14], [0, 1], clamp);
  const cur = useCursor(
    [
      {x: 540, y: 735, at: pickAt},
      {x: 760, y: 905, at: swapAt},
    ],
    pickAt - 22,
  );
  return (
    <AbsoluteFill>
      <BrandBackground glowY={62} />
      <div style={{position: 'absolute', top: 600, left: 0, opacity: car, transform: `translateY(${(1 - car) * 60}px)`}}>
        <TemplateCarousel pos={pos} selected={frame >= pickAt} />
      </div>
      <div style={{position: 'absolute', top: 870, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: interpolate(frame, [pickAt - 10, pickAt + 2], [0, 1], clamp)}}>
        <ColorChips active={frame >= swapAt ? 1 : 0} />
      </div>
      <Phone x={540} y={1460 + (1 - ph) * 500} scale={0.78} rotateX={14} rotateY={Math.sin(frame / 40) * 6} glow={`rgba(255,122,0,${0.2 + 0.2 * mix})`}>
        <CustomerMenu revealFrom={6} stagger={4} colorMix={mix} />
      </Phone>
      {cur.visible && frame < swapAt + 14 ? <Cursor x={cur.x} y={cur.y} press={cur.press} /> : null}
      <LightSweep at={swapAt} />
      <Headline id="design" />
    </AbsoluteFill>
  );
};

// 14–19 s · add section "البرغر" → add product "برغر كلاسيك" → card in the menu
const Manage: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const secSave = local('manage', AM_SYNC.sectionSave);
  const prodSave = local('manage', AM_SYNC.productSave);
  const secOpen = 14;
  const prodTap = secSave + 14;
  const prodOpen = prodTap + 4;
  const barP = spring({frame: frame - 2, fps, config: {damping: 16}});
  const secP = spring({frame: frame - secOpen, fps, config: {damping: 15}}) - spring({frame: frame - secSave - 4, fps, config: {damping: 15}});
  const prodP = spring({frame: frame - prodOpen, fps, config: {damping: 15}}) - spring({frame: frame - prodSave - 4, fps, config: {damping: 15}});
  const phoneP = spring({frame: frame - prodSave - 6, fps, config: {damping: 15}});
  // modal centre (x 540, y 1060) → save button in composition pixels
  const modalTop = (h: number) => 1060 - h / 2;
  const secBtn = modalSave(SECTION_MODAL_H);
  const prodBtn = modalSave(PRODUCT_MODAL_H);
  const barTop = 470;
  const cur = useCursor(
    [
      {x: 70 + PRODUCTS_BAR_BTN.section.x, y: barTop + PRODUCTS_BAR_BTN.section.y, at: 10},
      {x: 130 + secBtn.x, y: modalTop(SECTION_MODAL_H) + secBtn.y, at: secSave},
      {x: 70 + PRODUCTS_BAR_BTN.product.x, y: barTop + PRODUCTS_BAR_BTN.product.y, at: prodTap},
      {x: 130 + prodBtn.x, y: modalTop(PRODUCT_MODAL_H) + prodBtn.y, at: prodSave},
    ],
    0,
  );
  return (
    <AbsoluteFill>
      <BrandBackground glowY={52} />
      <div style={{position: 'absolute', left: 70, top: barTop, opacity: barP * (1 - phoneP), transform: `translateY(${(1 - barP) * 60}px)`}}>
        <ProductsBar count={frame >= prodSave ? 1 : 0} pressSection={frame >= 8 && frame < 14} pressProduct={frame >= prodTap - 2 && frame < prodTap + 4} />
      </div>
      <AbsoluteFill style={{background: 'rgba(5,8,20,0.5)', opacity: Math.max(secP, prodP)}} />
      {secP > 0.01 ? (
        <div style={{position: 'absolute', left: 130, top: modalTop(SECTION_MODAL_H), opacity: secP, transform: `scale(${0.9 + 0.1 * secP})`}}>
          <AddSectionModal typeFrom={secOpen + 8} saveAt={secSave} />
        </div>
      ) : null}
      {prodP > 0.01 ? (
        <div style={{position: 'absolute', left: 130, top: modalTop(PRODUCT_MODAL_H), opacity: prodP, transform: `scale(${0.9 + 0.1 * prodP})`}}>
          <AddProductModal photoAt={prodOpen + 8} sectionAt={prodOpen + 14} nameFrom={prodOpen + 18} priceFrom={prodOpen + 32} descFrom={prodOpen + 40} saveAt={prodSave} />
        </div>
      ) : null}
      {phoneP > 0.01 ? (
        <Phone x={540} y={1130 + (1 - phoneP) * 600} scale={0.95} rotateX={6} rotateY={-10 + phoneP * 8} glow="rgba(255,122,0,0.35)">
          <CustomerMenu onlyNew highlightFrom={prodSave + 12} colorMix={1} banner />
        </Phone>
      ) : null}
      {cur.visible && frame < prodSave + 10 ? <Cursor x={cur.x} y={cur.y} press={cur.press} /> : null}
      <Headline id="manage" />
    </AbsoluteFill>
  );
};

// 19–24 s · 3D phone, QR card, scan → menu opens on the customer's phone
const PhoneScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lockAt = local('phone', AM_SYNC.qrScan);
  const openAt = local('phone', AM_SYNC.menuOpen);
  const ph = spring({frame: frame - 2, fps, config: {damping: 16}});
  const qr = spring({frame: frame - 12, fps, config: {damping: 14}});
  const orbit = interpolate(frame, [0, 150], [-18, 12], {...clamp, easing: ease});
  const open = spring({frame: frame - openAt, fps, config: {damping: 16}});
  const scroll = interpolate(frame, [openAt + 26, 150], [0, 260], {...clamp, easing: ease});
  const beam = interpolate(frame, [lockAt - 16, lockAt], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <BrandBackground glowX={58} glowY={55} />
      {/* QR table card */}
      <div style={{position: 'absolute', left: 70, top: 900, width: 300, perspective: 1400, opacity: qr}}>
        <div dir="rtl" style={{transform: `translateY(${(1 - qr) * 80}px) rotateY(${18 + orbit * 0.4}deg) rotateZ(-4deg)`, background: 'white', borderRadius: 30, padding: 22, boxShadow: '0 40px 90px rgba(0,0,0,0.5)', fontFamily: BRAND.font, textAlign: 'center'}}>
          <div style={{fontSize: 26, fontWeight: 900, color: '#22242A'}}>امسح لعرض المنيو</div>
          <div style={{margin: '12px auto', width: 220, boxShadow: beam > 0 && frame < lockAt + 10 ? `0 0 0 6px rgba(255,210,63,${beam})` : undefined}}>
            <QrCodeSvg size={220} />
          </div>
          <div style={{fontSize: 20, fontWeight: 800, color: '#E2581F', direction: 'ltr'}}>{AM_DEMO.menuHost}</div>
        </div>
      </div>
      {beam > 0 && frame < lockAt + 6 ? <div style={{position: 'absolute', left: 360, top: 1130, width: 240 * beam, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, rgba(255,210,63,0), #FFD23F)', boxShadow: '0 0 20px rgba(255,210,63,0.8)'}} /> : null}
      <Phone x={700} y={1180 + (1 - ph) * 600} scale={1.0} rotateX={8} rotateY={orbit} rotateZ={2} glow={frame >= openAt ? 'rgba(255,122,0,0.4)' : undefined}>
        <CameraView lockAt={lockAt}>
          <div style={{position: 'absolute', left: 96, top: 270, width: 200, height: 200, filter: 'blur(0.6px)', opacity: 0.92, transform: `rotate(${frame < lockAt ? Math.sin(frame / 9) * 3 : 0}deg)`}}>
            <QrCodeSvg size={200} />
          </div>
          {frame >= lockAt + 2 ? (
            <div style={{position: 'absolute', left: 60, right: 60, top: 560, padding: '14px 18px', borderRadius: 18, background: 'rgba(255,255,255,0.92)', fontFamily: BRAND.font, fontSize: 20, fontWeight: 800, color: '#22242A', textAlign: 'center', direction: 'ltr', transform: `scale(${spring({frame: frame - lockAt - 2, fps, config: {damping: 13}})})`}}>
              🔗 {AM_DEMO.menuHost}
            </div>
          ) : null}
        </CameraView>
        {frame >= openAt ? (
          <div style={{position: 'absolute', inset: 0, transform: `translateY(${(1 - open) * 100}%)`, borderRadius: 40, overflow: 'hidden'}}>
            <CustomerMenu colorMix={1} scroll={scroll} highlightFrom={openAt + 10} />
          </div>
        ) : null}
      </Phone>
      <Headline id="phone" />
    </AbsoluteFill>
  );
};

// 24–30 s · logo, phone behind, headline, CTA, website
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logoAt = local('outro', AM_SYNC.logo);
  const tapAt = local('outro', AM_SYNC.ctaTap);
  const logo = spring({frame: frame - logoAt, fps, config: {damping: 13, stiffness: 100}});
  const ph = spring({frame: frame - 4, fps, config: {damping: 18}});
  const h1 = spring({frame: frame - logoAt - 14, fps, config: {damping: 16}});
  const h2 = spring({frame: frame - logoAt - 26, fps, config: {damping: 16}});
  const cta = spring({frame: frame - logoAt - 40, fps, config: {damping: 12}});
  const url = spring({frame: frame - logoAt - 52, fps, config: {damping: 14}});
  const sweep = interpolate(frame, [logoAt + 14, logoAt + 44], [-0.4, 1.4], clamp);
  const press = frame >= tapAt - 3 && frame < tapAt + 3 ? 0.94 : 1;
  const ring = spring({frame: frame - tapAt, fps, config: {damping: 20}});
  const fadeOut = interpolate(frame, [dur('outro') - 8, dur('outro')], [1, 0.0], clamp);
  return (
    <AbsoluteFill style={{opacity: 0.08 + 0.92 * fadeOut}}>
      <BrandBackground glowX={50} glowY={34} particles={20} />
      {/* phone with the menu, behind the logo */}
      <div style={{opacity: 0.55 * ph, filter: 'blur(1.5px)'}}>
        <Phone x={540} y={640 + (1 - ph) * 300} scale={0.95} rotateX={22} rotateY={Math.sin(frame / 40) * 10} rotateZ={-6}>
          <CustomerMenu colorMix={1} scroll={interpolate(frame, [0, 180], [40, 200])} />
        </Phone>
      </div>
      <AbsoluteFill style={{background: 'radial-gradient(50% 30% at 50% 34%, rgba(10,18,48,0) 0%, rgba(10,18,48,0.75) 100%)'}} />
      {/* halo + official logo on its white plate (never redrawn) */}
      <div style={{position: 'absolute', left: 540 - 480, top: 600 - 480, width: 960, height: 960, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,122,0,0.45) 0%, rgba(255,122,0,0) 62%)', opacity: logo, transform: `scale(${0.6 + logo * 0.4 + Math.sin(frame / 20) * 0.02})`}} />
      <div style={{position: 'absolute', left: 540 - 200, top: 600 - 200, width: 400, height: 400, borderRadius: 64, background: 'white', overflow: 'hidden', boxShadow: '0 60px 140px rgba(0,0,0,0.55), 0 0 0 6px rgba(255,255,255,0.12)', opacity: interpolate(logo, [0, 0.2], [0, 1], clamp), transform: `perspective(1600px) rotateY(${interpolate(logo, [0, 1], [70, 0])}deg) scale(${interpolate(logo, [0, 1], [0.6, 1])}) translateY(${Math.sin(frame / 22) * 5}px)`}}>
        <Img src={staticFile(ASSETS.logo)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
        <div style={{position: 'absolute', top: -100, bottom: -100, width: 140, left: `${sweep * 100}%`, transform: 'rotate(18deg)', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.75), rgba(255,255,255,0))', mixBlendMode: 'overlay'}} />
      </div>
      <div dir="rtl" style={{position: 'absolute', left: 60, right: 60, top: 870, textAlign: 'center', fontFamily: BRAND.font, color: 'white'}}>
        <div style={{fontSize: 70, fontWeight: 900, lineHeight: 1.35, opacity: h1, transform: `translateY(${(1 - h1) * 40}px)`}}>{AM_OUTRO.headline}</div>
        <div style={{fontSize: 38, fontWeight: 800, color: BRAND.colors.orangeSoft, marginTop: 18, opacity: h2, transform: `translateY(${(1 - h2) * 30}px)`}}>{AM_OUTRO.sub}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1310, display: 'flex', justifyContent: 'center'}}>
        <div style={{position: 'relative', transform: `scale(${cta * press})`, opacity: cta}}>
          {frame >= tapAt ? <div style={{position: 'absolute', inset: -14 - ring * 30, borderRadius: 999, border: `4px solid ${BRAND.colors.orangeSoft}`, opacity: 1 - ring}} /> : null}
          <div style={{padding: '22px 90px', borderRadius: 999, background: orangeGradient, color: 'white', fontFamily: BRAND.font, fontSize: 64, fontWeight: 1000, boxShadow: '0 24px 60px rgba(255,90,0,0.55), inset 0 3px 0 rgba(255,255,255,0.35)'}}>{AM_OUTRO.cta}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1490, display: 'flex', justifyContent: 'center', opacity: url, transform: `translateY(${(1 - url) * 30}px)`}}>
        <div style={{direction: 'ltr', fontFamily: BRAND.font, fontSize: 58, fontWeight: 900, color: 'white', letterSpacing: 1, padding: '10px 36px', borderRadius: 24, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.22)'}}>{BRAND.url}</div>
      </div>
    </AbsoluteFill>
  );
};

const SCENES: Record<AmSceneId, React.FC> = {paper: Paper, upload: Upload, design: Design, manage: Manage, phone: PhoneScene, outro: Outro};

/** Each scene after the first dissolves in over AM_XFADE frames with a slight push, on top of the previous one. */
const SceneIn: React.FC<{children: React.ReactNode; first: boolean}> = ({children, first}) => {
  const frame = useCurrentFrame();
  if (first) return <>{children}</>;
  const p = interpolate(frame, [0, AM_XFADE], [0, 1], {...clamp, easing: ease});
  return <AbsoluteFill style={{opacity: p, transform: `scale(${1.04 - 0.04 * p})`, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined}}>{children}</AbsoluteFill>;
};

export const AiMenuAd: React.FC = () => {
  const files = new Set(getStaticFiles().map((f) => f.name));
  const voLines = AM_SCENES.map((s) => ({scene: s, file: AM_VO_FILES[s.id]})).filter((v) => files.has(v.file));
  const music = voLines.length > 0 ? MUSIC.duckedVolume : MUSIC.volume;
  return (
    <AbsoluteFill style={{backgroundColor: BRAND.colors.navy}}>
      {AM_SCENES.map((s, i) => {
        const C = SCENES[s.id];
        const last = i === AM_SCENES.length - 1;
        // Each scene keeps playing AM_XFADE frames past its cut while the next one dissolves in on top.
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.duration + (last ? 0 : AM_XFADE)} name={s.id}>
            <SceneIn first={i === 0}>
              <C />
            </SceneIn>
          </Sequence>
        );
      })}
      <Audio src={staticFile(ASSETS.music)} volume={(f) => interpolate(f, [0, 10, AM_VIDEO.durationInFrames - 30, AM_VIDEO.durationInFrames], [0, music, music, 0], {extrapolateRight: 'clamp'})} />
      {AM_SFX.map((cue, i) => (
        <Sequence key={i} from={cue.frame} durationInFrames={90} layout="none">
          <Audio src={staticFile(ASSETS.sfx[cue.sfx])} volume={cue.volume} />
        </Sequence>
      ))}
      {voLines.map((v) => (
        <Sequence key={v.file} from={AM_VO_START[v.scene.id] ?? v.scene.from + 8} layout="none">
          <Audio src={staticFile(v.file)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
