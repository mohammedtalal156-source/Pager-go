import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BRAND} from '../config';
import {Cursor, FoodArt, type FoodKind, MerchantBadge} from './art';
import {AM_DEMO, AM_UI} from './config';

// UI rebuilt from the founder's screenshots of merchant.pagergo.pro (2026-10-29).
// Proportions and copy follow the real pages; sizes are enlarged for a phone feed.

export const D = {
  orange: '#E2581F',
  orangePale: '#F2B79C',
  peach: '#FCEBDF',
  border: '#ECE6E0',
  ink: '#22242A',
  sub: '#6B6F7A',
  sidebar: '#2E3036',
  navyBanner: '#1E2A5E',
  pageBg: 'linear-gradient(160deg, #FBEDE4 0%, #F6F2EE 38%, #EFF0F4 100%)',
} as const;

const font = BRAND.font;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Linear blend between two #RRGGBB colours. */
export const mixHex = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};

/** Text revealed one character at a time from `start`, `cps` characters per frame. */
export const typed = (text: string, frame: number, start: number, cps = 0.6) => text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));

// ── Paper menu (scene 1 and the photo the owner uploads) ────────────────────
export const PAPER_W = 520;
export const PAPER_H = 720;

export const PaperMenu: React.FC = () => (
  <div
    dir="rtl"
    style={{
      width: PAPER_W,
      height: PAPER_H,
      fontFamily: font,
      color: '#3B2A1A',
      background: 'radial-gradient(120% 90% at 30% 20%, #FFF8EA 0%, #F5E8CF 70%, #EAD8B8 100%)',
      borderRadius: 10,
      padding: '40px 44px',
      boxSizing: 'border-box',
      boxShadow: 'inset 0 0 60px rgba(120,80,30,0.22)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div style={{position: 'absolute', inset: 14, border: '2px solid rgba(90,60,30,0.35)', borderRadius: 6}} />
    <div style={{textAlign: 'center', fontSize: 58, fontWeight: 900, letterSpacing: 2}}>{AM_DEMO.merchant}</div>
    <div style={{textAlign: 'center', fontSize: 24, fontWeight: 700, opacity: 0.7, marginTop: -6}}>قائمة الطعام</div>
    {AM_DEMO.sections.map((s) => (
      <div key={s.name} style={{marginTop: 26}}>
        <div style={{fontSize: 30, fontWeight: 900, borderBottom: '2px solid rgba(90,60,30,0.35)', paddingBottom: 4, marginBottom: 8}}>{s.name}</div>
        {s.items.map((it) => (
          <div key={it.name} style={{display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 26, fontWeight: 700, margin: '6px 0'}}>
            <span>{it.name}</span>
            <span style={{flex: 1, borderBottom: '3px dotted rgba(90,60,30,0.45)', transform: 'translateY(-6px)'}} />
            <span style={{direction: 'ltr'}}>{it.price}</span>
          </div>
        ))}
      </div>
    ))}
    {/* coffee ring + crease: it is an old printed menu */}
    <div style={{position: 'absolute', left: 40, bottom: 50, width: 120, height: 120, borderRadius: '50%', border: '6px solid rgba(120,70,20,0.12)'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: PAPER_H / 2, height: 2, background: 'rgba(90,60,30,0.12)'}} />
  </div>
);

/** The digital twin of the paper menu: glass panel, glowing rows. */
export const DigitalMenuGhost: React.FC = () => (
  <div
    dir="rtl"
    style={{
      width: PAPER_W,
      height: PAPER_H,
      fontFamily: font,
      color: 'white',
      background: 'linear-gradient(160deg, rgba(30,43,99,0.92), rgba(10,18,48,0.92))',
      borderRadius: 26,
      padding: '40px 40px',
      boxSizing: 'border-box',
      boxShadow: '0 0 0 2px rgba(255,178,91,0.7), 0 0 80px rgba(255,122,0,0.5)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div style={{display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center'}}>
      <MerchantBadge size={64} />
      <div style={{fontSize: 50, fontWeight: 900}}>{AM_DEMO.merchant}</div>
    </div>
    {AM_DEMO.sections.map((s) => (
      <div key={s.name} style={{marginTop: 18}}>
        <div style={{display: 'inline-block', fontSize: 22, fontWeight: 800, padding: '4px 16px', borderRadius: 999, background: 'rgba(255,122,0,0.25)', color: '#FFB25B'}}>{s.name}</div>
        {s.items.map((it) => (
          <div key={it.name} style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, padding: '8px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)'}}>
            <FoodArt kind={it.art as FoodKind} size={50} plate="rgba(255,255,255,0.9)" />
            <div style={{flex: 1, fontSize: 24, fontWeight: 800}}>{it.name}</div>
            <div style={{fontSize: 22, fontWeight: 800, color: '#FFB25B'}}>
              {it.price} {AM_DEMO.currency}
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

// ── Browser window around the merchant dashboard ────────────────────────────
export const BrowserFrame: React.FC<{width: number; height: number; children: React.ReactNode}> = ({width, height, children}) => (
  <div style={{position: 'relative', width, height, borderRadius: 34, padding: 12, background: 'linear-gradient(150deg, #3b3f4a, #15171d)', boxShadow: '0 70px 160px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.16)', boxSizing: 'border-box'}}>
    <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 24, background: D.pageBg}}>
      <div style={{display: 'flex', alignItems: 'center', height: 50, background: '#1E2026', borderRadius: '24px 24px 0 0', padding: '0 20px', gap: 10}}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />
        ))}
        <div style={{flex: 1, margin: '0 30px', height: 32, borderRadius: 16, background: '#2C2F37', color: '#C9CBD2', fontFamily: font, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr'}}>🔒 {AM_UI.url}</div>
      </div>
      <div style={{position: 'absolute', top: 50, left: 0, right: 0, bottom: 0, borderRadius: '0 0 24px 24px'}}>{children}</div>
    </div>
  </div>
);

const Btn: React.FC<{children: React.ReactNode; primary?: boolean; disabled?: boolean; w?: number; h?: number; fs?: number; press?: boolean; glow?: number}> = ({children, primary, disabled, w, h = 76, fs = 28, press, glow = 0}) => (
  <div
    style={{
      width: w,
      height: h,
      boxSizing: 'border-box',
      padding: '0 26px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: 18,
      fontFamily: font,
      fontSize: fs,
      fontWeight: 800,
      color: primary ? 'white' : D.ink,
      background: primary ? (disabled ? D.orangePale : D.orange) : 'white',
      border: primary ? 'none' : `2px solid ${D.border}`,
      boxShadow: glow > 0 ? `0 0 ${40 * glow}px ${10 * glow}px rgba(255,122,0,0.45)` : '0 6px 14px rgba(0,0,0,0.06)',
      transform: press ? 'scale(0.94)' : undefined,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

/** Animated pointer path: from `from` to `to`, arriving 4 frames before `at`. */
export const useCursor = (pts: {x: number; y: number; at: number}[], start: number) => {
  const frame = useCurrentFrame();
  let x = pts[0].x;
  let y = pts[0].y;
  let prevAt = start;
  let prev = {x: pts[0].x + 160, y: pts[0].y + 220};
  for (const p of pts) {
    if (frame >= prevAt) {
      const k = interpolate(frame, [Math.min(prevAt, p.at - 6), p.at - 4], [0, 1], {...clamp, easing: (t) => 1 - Math.pow(1 - t, 3)});
      x = prev.x + (p.x - prev.x) * k;
      y = prev.y + (p.y - prev.y) * k - Math.sin(k * Math.PI) * 30;
    }
    prev = p;
    prevAt = p.at + 6;
  }
  const press = pts.some((p) => frame >= p.at - 2 && frame < p.at + 4);
  return {x, y, press, visible: frame >= start};
};

// ── Scene 2: "إنشاء المنيو من الصور" page ───────────────────────────────────
export const AI_PAGE_W = 940;
export const AI_PAGE_H = 940;
export const AI_TARGETS = {pick: {x: 790, y: 404}, create: {x: 520, y: 404}, thumb: {x: 760, y: 610}} as const;

export const AiUploadPage: React.FC<{pickAt: number; dropAt: number; createAt: number; doneAt: number}> = ({pickAt, dropAt, createAt, doneAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dropped = frame >= dropAt;
  const working = frame >= createAt && frame < doneAt;
  const done = frame >= doneAt;
  const cur = useCursor(
    [
      {x: AI_TARGETS.pick.x, y: AI_TARGETS.pick.y, at: pickAt},
      {x: AI_TARGETS.create.x, y: AI_TARGETS.create.y, at: createAt},
    ],
    pickAt - 26,
  );
  // flying photo: from bottom-left outside the window into the thumbnail slot
  const fly = spring({frame: frame - (pickAt + 6), fps, config: {damping: 16, stiffness: 70}, durationInFrames: dropAt - pickAt - 6});
  const thumbW = 190;
  const thumbH = (thumbW * 720) / 520;
  const fx = interpolate(fly, [0, 1], [-260, AI_TARGETS.thumb.x - thumbW / 2]);
  const fy = interpolate(fly, [0, 1], [1050, AI_TARGETS.thumb.y - thumbH / 2]);
  const fs = interpolate(fly, [0, 1], [2.1, 1]);
  const fr = interpolate(fly, [0, 1], [-14, -3]);
  const scan = ((frame - createAt) % 26) / 26;
  const doneP = spring({frame: frame - doneAt, fps, config: {damping: 14}});
  const glow = frame >= dropAt ? interpolate(frame, [dropAt, dropAt + 8, createAt], [0, 1, 0.6], clamp) : 0;

  return (
    <div dir="rtl" style={{position: 'relative', width: AI_PAGE_W, height: AI_PAGE_H, fontFamily: font, color: D.ink}}>
      {/* page title bar */}
      <div style={{height: 86, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, borderBottom: `1px solid ${D.border}`, position: 'relative'}}>
        {AM_UI.aiPageTitle}
        <div style={{position: 'absolute', left: 30, fontSize: 36, fontWeight: 400, direction: 'ltr'}}>→</div>
      </div>
      <div style={{position: 'absolute', right: 44, top: 124, fontSize: 46, fontWeight: 900}}>{AM_UI.aiHero}</div>
      <div style={{position: 'absolute', right: 44, top: 192, fontSize: 24, fontWeight: 600, color: D.sub}}>{AM_UI.aiHeroSub}</div>
      {/* card */}
      <div style={{position: 'absolute', left: 30, right: 30, top: 258, height: 640, background: 'rgba(255,255,255,0.88)', borderRadius: 34, boxShadow: '0 20px 50px rgba(0,0,0,0.06)', border: `1px solid ${D.border}`}}>
        <div style={{position: 'absolute', right: 40, top: 40, fontSize: 26, fontWeight: 700}}>{AM_UI.aiPhotosLabel}</div>
        <div style={{position: 'absolute', right: 40, top: 108}}>
          <Btn w={220} press={cur.press && frame < pickAt + 4}>
            {AM_UI.pickPhoto}
          </Btn>
        </div>
        <div style={{position: 'absolute', right: 280, top: 108}}>
          <Btn primary disabled={!dropped} w={300} press={cur.press && frame >= createAt - 4} glow={glow}>
            {AM_UI.createMenu}
          </Btn>
        </div>
        {/* drop zone */}
        <div style={{position: 'absolute', left: 40, right: 40, top: 214, height: 270, borderRadius: 24, border: `3px dashed ${dropped ? 'rgba(226,88,31,0.5)' : D.border}`, background: dropped ? 'rgba(252,235,223,0.5)' : 'transparent'}} />
        {/* AI status, left side of drop zone */}
        {frame >= createAt ? (
          <div style={{position: 'absolute', left: 80, top: 290, width: 420, display: 'flex', flexDirection: 'column', gap: 14}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, fontWeight: 800, color: done ? '#2F9D5C' : D.orange}}>
              {done ? (
                <div style={{width: 38, height: 38, borderRadius: 19, background: '#2F9D5C', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, transform: `scale(${doneP})`}}>✓</div>
              ) : (
                <div style={{width: 34, height: 34, borderRadius: 17, border: `5px solid ${D.orangePale}`, borderTopColor: D.orange, transform: `rotate(${frame * 18}deg)`}} />
              )}
              {done ? AM_UI.aiFound : AM_UI.aiWorking}
            </div>
            {done ? (
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 10}}>
                {AM_DEMO.sections.map((s, i) => (
                  <div key={s.name} style={{fontSize: 22, fontWeight: 800, padding: '6px 16px', borderRadius: 999, background: D.peach, color: D.orange, opacity: interpolate(frame, [doneAt + 4 + i * 4, doneAt + 10 + i * 4], [0, 1], clamp)}}>
                    {s.name}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{height: 10, borderRadius: 5, background: D.peach, overflow: 'hidden'}}>
                <div style={{width: `${interpolate(frame, [createAt, doneAt], [5, 100], clamp)}%`, height: '100%', background: `linear-gradient(90deg, ${D.orange}, #FFB25B)`}} />
              </div>
            )}
          </div>
        ) : null}
        <div style={{position: 'absolute', right: 40, top: 520, fontSize: 25, fontWeight: 900, direction: 'ltr'}}>{AM_UI.aiModel}</div>
        <div style={{position: 'absolute', right: 40, top: 566, fontSize: 22, fontWeight: 600, color: D.sub}}>{AM_UI.aiQuota}</div>
      </div>

      {/* the photographed paper menu: flies in, then becomes the thumbnail */}
      {frame >= pickAt + 6 ? (
        <div style={{position: 'absolute', left: fx, top: fy, width: thumbW, height: thumbH, transform: `rotate(${fr}deg) scale(${fs})`, transformOrigin: 'center', borderRadius: 10, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.35)', border: '5px solid white', direction: 'ltr'}}>
          <div style={{transform: `scale(${thumbW / 520})`, transformOrigin: '0 0'}}>
            <PaperMenu />
          </div>
          {working ? (
            <>
              <div style={{position: 'absolute', left: 0, right: 0, top: `${scan * 100}%`, height: 8, background: '#FFB25B', boxShadow: '0 0 24px 10px rgba(255,122,0,0.75)'}} />
              <div style={{position: 'absolute', inset: 0, background: 'rgba(255,122,0,0.12)'}} />
            </>
          ) : null}
        </div>
      ) : null}
      {/* light streaks out of the photo while AI works */}
      {working
        ? [0, 1, 2, 3, 4].map((i) => {
            const t = ((frame - createAt + i * 6) % 30) / 30;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: AI_TARGETS.thumb.x - 120 - t * 360,
                  top: AI_TARGETS.thumb.y - 90 + i * 45,
                  width: 140,
                  height: 4,
                  borderRadius: 2,
                  background: 'linear-gradient(90deg, rgba(255,122,0,0), #FF7A00, rgba(255,178,91,0))',
                  opacity: Math.sin(t * Math.PI),
                  boxShadow: '0 0 12px rgba(255,122,0,0.8)',
                }}
              />
            );
          })
        : null}
      {cur.visible && frame < createAt + 14 ? <Cursor x={cur.x} y={cur.y} press={cur.press} /> : null}
    </div>
  );
};

// ── Customer menu (phone screen and dashboard preview) ──────────────────────
export const MENU_W = 392;

type MenuProps = {
  /** 0 = first colourway (أخضر نباتي), 1 = second (حمضي). */
  colorMix?: number;
  /** Frame at which items start to build in, one after another. Omit to show all at once. */
  revealFrom?: number;
  stagger?: number;
  /** Highlight the "برغر كلاسيك" card (just added). */
  highlightFrom?: number;
  /** Show only these items (for the "just added" state). */
  onlyNew?: boolean;
  scroll?: number;
  banner?: boolean;
};

export const CustomerMenu: React.FC<MenuProps> = ({colorMix = 0, revealFrom, stagger = 5, highlightFrom, onlyNew, scroll = 0, banner = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [a, b] = AM_UI.colorways;
  const accent = mixHex(a.accent, b.accent, colorMix);
  const soft = mixHex(a.soft, b.soft, colorMix);
  const ink = mixHex(a.ink, b.ink, colorMix);
  let idx = 0;
  const pop = () => {
    const i = idx++;
    if (revealFrom === undefined) return {opacity: 1, transform: 'none'};
    const p = spring({frame: frame - revealFrom - i * stagger, fps, config: {damping: 14, stiffness: 120}});
    return {opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${0.92 + p * 0.08})`};
  };
  const sections = onlyNew ? [{name: AM_DEMO.newSection, items: [AM_DEMO.sections[0].items[0]]}] : AM_DEMO.sections;
  const hl = highlightFrom === undefined ? 0 : spring({frame: frame - highlightFrom, fps, config: {damping: 12}});
  return (
    <div dir="rtl" style={{position: 'absolute', inset: 0, background: 'white', fontFamily: font, color: ink, overflow: 'hidden'}}>
      <div style={{transform: `translateY(${-scroll}px)`}}>
        {banner ? <div style={{background: D.navyBanner, color: 'white', fontSize: 17, fontWeight: 800, textAlign: 'center', padding: '62px 10px 12px'}}>{AM_UI.previewBanner}</div> : <div style={{height: 64}} />}
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 22, ...pop()}}>
          <MerchantBadge size={96} />
          <div style={{fontSize: 52, fontWeight: 900, color: accent, marginTop: 4, lineHeight: 1.2}}>{AM_DEMO.merchant}</div>
          <svg width="150" height="16" viewBox="0 0 150 16">
            <path d="M2 10 Q40 0 75 9 T148 6" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        {/* section chips */}
        <div style={{display: 'flex', gap: 8, padding: '18px 18px 6px', justifyContent: 'center', ...pop()}}>
          {sections.map((s, i) => (
            <div key={s.name} style={{fontSize: 17, fontWeight: 800, padding: '6px 14px', borderRadius: 999, background: i === 0 ? accent : soft, color: i === 0 ? 'white' : ink}}>
              {s.name}
            </div>
          ))}
        </div>
        {sections.map((s) => (
          <div key={s.name} style={{padding: '8px 18px 0'}}>
            <div style={{fontSize: 24, fontWeight: 900, margin: '10px 4px 8px', ...pop()}}>{s.name}</div>
            {s.items.map((it, j) => {
              const isNew = it.name === AM_DEMO.newProduct.name && j === 0;
              return (
                <div
                  key={it.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: 12,
                    marginBottom: 12,
                    borderRadius: 22,
                    background: soft,
                    boxShadow: isNew && hl > 0 ? `0 0 0 ${3 * hl}px ${accent}, 0 14px 34px rgba(0,0,0,${0.18 * hl})` : '0 4px 10px rgba(0,0,0,0.04)',
                    ...pop(),
                  }}
                >
                  <div style={{borderRadius: '50%', overflow: 'hidden', flexShrink: 0, boxShadow: '0 6px 14px rgba(0,0,0,0.12)'}}>
                    <FoodArt kind={it.art as FoodKind} size={86} plate="#FFFFFF" />
                  </div>
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontSize: 22, fontWeight: 900, lineHeight: 1.3}}>{it.name}</div>
                    <div style={{fontSize: 14, fontWeight: 600, opacity: 0.7, lineHeight: 1.4}}>{it.desc}</div>
                    <div style={{fontSize: 20, fontWeight: 900, color: accent, marginTop: 2}}>
                      {it.price} {AM_DEMO.currency}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Scene 3: template cards + colours ───────────────────────────────────────
export const TemplateCard: React.FC<{i: number; selected?: boolean}> = ({i, selected}) => {
  const t = AM_UI.templates[i];
  return (
    <div
      dir="rtl"
      style={{
        width: 330,
        height: 170,
        boxSizing: 'border-box',
        padding: '22px 24px',
        borderRadius: 24,
        fontFamily: font,
        background: selected ? D.peach : 'white',
        border: selected ? `3px solid ${D.orange}` : `2px solid ${D.border}`,
        boxShadow: selected ? '0 24px 60px rgba(226,88,31,0.35)' : '0 16px 40px rgba(0,0,0,0.25)',
        color: D.ink,
      }}
    >
      <div style={{fontSize: 30, fontWeight: 900}}>
        {i + 1}. {t.name}
      </div>
      <div style={{fontSize: 19, fontWeight: 600, color: D.sub, marginTop: 6, lineHeight: 1.45}}>{t.desc}</div>
    </div>
  );
};

/** 3D ring of the 20 real templates; `pos` = fractional index facing the camera. */
export const TemplateCarousel: React.FC<{pos: number; selected: boolean}> = ({pos, selected}) => {
  const R = 760;
  const step = 24;
  return (
    <div style={{position: 'relative', width: 1080, height: 260, perspective: 1800}}>
      <div style={{position: 'absolute', left: 540, top: 130, transformStyle: 'preserve-3d', transform: `translateZ(${-R}px)`}}>
        {AM_UI.templates.map((_, i) => {
          const ang = (pos - i) * step;
          if (Math.abs(ang) > 70) return null;
          const front = Math.abs(i - pos) < 0.5;
          return (
            <div key={i} style={{position: 'absolute', left: -165, top: -85, transform: `rotateY(${ang}deg) translateZ(${R}px)`, opacity: interpolate(Math.abs(ang), [0, 70], [1, 0.25])}}>
              <TemplateCard i={i} selected={front && selected} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ColorChips: React.FC<{active: 0 | 1}> = ({active}) => (
  <div dir="rtl" style={{display: 'flex', alignItems: 'center', gap: 18, fontFamily: font}}>
    <div style={{fontSize: 30, fontWeight: 800, color: 'white'}}>{AM_UI.colorsLabel}</div>
    {AM_UI.colorways.map((c, i) => (
      <div
        key={c.name}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 28,
          fontWeight: 800,
          padding: '14px 26px',
          borderRadius: 18,
          background: i === active ? D.peach : 'white',
          border: i === active ? `3px solid ${D.orange}` : `2px solid ${D.border}`,
          color: D.ink,
        }}
      >
        <div style={{width: 26, height: 26, borderRadius: 13, background: c.accent}} />
        {c.name}
        {i === active ? <span style={{color: D.orange}}>✓</span> : null}
      </div>
    ))}
  </div>
);

// ── Scene 4: products panel + modals ────────────────────────────────────────
export const ProductsBar: React.FC<{count: number; pressSection?: boolean; pressProduct?: boolean}> = ({count, pressSection, pressProduct}) => (
  <div dir="rtl" style={{width: 940, boxSizing: 'border-box', padding: '28px 34px', borderRadius: 30, background: 'rgba(255,255,255,0.95)', fontFamily: font, color: D.ink, boxShadow: '0 30px 80px rgba(0,0,0,0.35)'}}>
    <div style={{fontSize: 36, fontWeight: 900}}>
      {AM_UI.products} ({count})
    </div>
    <div style={{fontSize: 21, fontWeight: 600, color: D.sub, marginTop: 4}}>نظّم قائمة الطعام في أقسام وأضف المنتجات إلى كل قسم.</div>
    <div style={{display: 'flex', gap: 16, marginTop: 20}}>
      <Btn w={230} press={pressSection}>
        ▭ {AM_UI.addSection}
      </Btn>
      <Btn primary w={250} press={pressProduct}>
        + {AM_UI.addProduct}
      </Btn>
    </div>
  </div>
);
export const PRODUCTS_BAR_BTN = {section: {x: 940 - 34 - 115, y: 214}, product: {x: 940 - 34 - 230 - 16 - 125, y: 214}} as const;

const Field: React.FC<{label: string; value: string; focus?: boolean; h?: number; caret?: boolean; placeholder?: boolean}> = ({label, value, focus, h = 84, caret, placeholder}) => (
  <div style={{position: 'relative', height: h, borderRadius: 18, border: focus ? `3px solid ${D.orange}` : `2px solid ${D.border}`, background: 'white', display: 'flex', alignItems: h > 100 ? 'flex-start' : 'center', padding: h > 100 ? '22px 24px' : '0 24px', boxSizing: 'border-box', fontSize: 28, fontWeight: 700}}>
    {value || focus ? (
      <div style={{position: 'absolute', top: -14, right: 20, background: 'white', padding: '0 8px', fontSize: 17, fontWeight: 700, color: D.sub}}>{label}</div>
    ) : null}
    {value ? <span style={{lineHeight: 1.4}}>{value}</span> : placeholder !== false && !focus ? <span style={{color: D.sub}}>{label}</span> : null}
    {caret ? <span style={{width: 3, height: 34, background: D.ink, marginRight: 4}} /> : null}
  </div>
);

const Modal: React.FC<{title: string; icon?: boolean; children: React.ReactNode; pressSave?: boolean}> = ({title, icon, children, pressSave}) => (
  <div dir="rtl" style={{width: 820, boxSizing: 'border-box', padding: '36px 40px', borderRadius: 34, background: '#F7F6F4', fontFamily: font, color: D.ink, boxShadow: '0 50px 140px rgba(0,0,0,0.55)'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 30}}>
      {icon ? <div style={{width: 58, height: 58, borderRadius: 16, background: D.peach, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.orange, fontSize: 30, fontWeight: 900}}>≡</div> : null}
      <div style={{fontSize: 38, fontWeight: 900}}>{title}</div>
    </div>
    <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>{children}</div>
    <div style={{display: 'flex', gap: 14, marginTop: 30, justifyContent: 'flex-end'}}>
      <Btn w={120} h={70}>
        {AM_UI.cancel}
      </Btn>
      <Btn primary w={120} h={70} press={pressSave}>
        {AM_UI.save}
      </Btn>
    </div>
  </div>
);
/** Save button centre inside a modal of height h (buttons are bottom-left in RTL). */
export const modalSave = (h: number) => ({x: 40 + 60, y: h - 36 - 35});

export const AddSectionModal: React.FC<{typeFrom: number; saveAt: number}> = ({typeFrom, saveAt}) => {
  const frame = useCurrentFrame();
  const v = typed(AM_DEMO.newSection, frame, typeFrom, 0.4);
  return (
    <Modal title={AM_UI.addSection} pressSave={frame >= saveAt - 2 && frame < saveAt + 4}>
      <Field label={AM_UI.sectionName} value={v} focus h={120} caret={frame < saveAt && Math.floor(frame / 8) % 2 === 0} />
    </Modal>
  );
};
export const SECTION_MODAL_H = 36 + 58 + 30 + 120 + 30 + 70 + 36;

export const AddProductModal: React.FC<{photoAt: number; sectionAt: number; nameFrom: number; priceFrom: number; descFrom: number; saveAt: number}> = ({photoAt, sectionAt, nameFrom, priceFrom, descFrom, saveAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = AM_DEMO.newProduct;
  const photo = spring({frame: frame - photoAt, fps, config: {damping: 12}});
  const focus = frame < priceFrom ? 'name' : frame < descFrom ? 'price' : 'desc';
  return (
    <Modal title={AM_UI.addProduct} icon pressSave={frame >= saveAt - 2 && frame < saveAt + 4}>
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, height: 110}}>
        {frame >= photoAt ? (
          <div style={{transform: `scale(${photo})`, borderRadius: 24, overflow: 'hidden', boxShadow: '0 10px 24px rgba(0,0,0,0.18)'}}>
            <FoodArt kind="burger" size={110} plate="#FFF4E8" round={false} />
          </div>
        ) : null}
        <Btn h={70} fs={24}>
          ◎ {AM_UI.pickProductPhoto}
        </Btn>
      </div>
      <Field label={AM_UI.section} value={frame >= sectionAt ? AM_DEMO.newSection : AM_UI.noSection} h={80} />
      <Field label={AM_UI.productName} value={typed(p.name, frame, nameFrom, 0.8)} focus={focus === 'name'} h={80} />
      <Field label={AM_UI.price} value={typed(p.price, frame, priceFrom, 0.6)} focus={focus === 'price'} h={80} />
      <Field label={AM_UI.description} value={typed(p.desc, frame, descFrom, 5)} focus={focus === 'desc'} h={110} />
    </Modal>
  );
};
export const PRODUCT_MODAL_H = 36 + 58 + 30 + 110 + 80 * 3 + 110 + 22 * 4 + 30 + 70 + 36;

// ── Scene 5: phone camera scanning the table QR ─────────────────────────────
export const CameraView: React.FC<{lockAt: number; children?: React.ReactNode}> = ({lockAt, children}) => {
  const frame = useCurrentFrame();
  const locked = frame >= lockAt;
  const s = locked ? interpolate(frame, [lockAt, lockAt + 6], [1.15, 1], clamp) : 1 + Math.sin(frame / 6) * 0.03;
  return (
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(90% 60% at 50% 45%, #6B4A2E 0%, #2A1B10 70%, #120C07 100%)', overflow: 'hidden'}}>
      {children}
      <div style={{position: 'absolute', left: 76, top: 250, width: 240, height: 240, transform: `scale(${s})`}}>
        {[0, 1, 2, 3].map((k) => (
          <div
            key={k}
            style={{
              position: 'absolute',
              width: 50,
              height: 50,
              [k < 2 ? 'top' : 'bottom']: 0,
              [k % 2 === 0 ? 'left' : 'right']: 0,
              borderColor: locked ? '#FFD23F' : 'rgba(255,255,255,0.9)',
              borderStyle: 'solid',
              borderWidth: `${k < 2 ? 6 : 0}px ${k % 2 === 1 ? 6 : 0}px ${k >= 2 ? 6 : 0}px ${k % 2 === 0 ? 6 : 0}px`,
              borderRadius: 10,
            } as React.CSSProperties}
          />
        ))}
      </div>
      {!locked ? <div style={{position: 'absolute', left: 90, width: 212, top: 260 + ((frame * 6) % 220), height: 4, background: '#FF7A00', boxShadow: '0 0 18px 6px rgba(255,122,0,0.6)'}} /> : null}
    </div>
  );
};
