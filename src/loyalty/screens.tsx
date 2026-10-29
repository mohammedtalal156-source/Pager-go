import React from 'react';
import {Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ASSETS, BRAND} from '../config';
import {LY_DEMO, LY_UI} from './config';

// UI rebuilt from the founder's screenshots (29 Oct 2026): the customer's "بطاقة ولائي" on iPhone,
// the redeem sheets, the cashier's 6-digit code dialog and the merchant "نقاط الولاء" page.
// Proportions and copy follow the real screens; sizes are enlarged for a phone feed.

export const C = {
  navy: '#232A45',
  ink: '#1F2437',
  sub: '#6B7080',
  page: '#F4F5F9',
  line: '#E6E8EE',
  green: '#3E7A5E',
  greenSoft: '#E3F1EA',
  ringIdle: '#E7EAF0',
  orange: '#E2581F',
  orangeText: '#C0562A',
  peach: '#FDEFE5',
  sidebar: '#2E3036',
  dashBg: 'linear-gradient(160deg, #FBEDE4 0%, #F6F2EE 38%, #EFF0F4 100%)',
} as const;

const font = BRAND.font;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const MERCHANT_LOGO = 'loyalty/merchant-logo.png';

/** Text revealed one character at a time from `start`. */
export const typed = (text: string, frame: number, start: number, cps = 0.6) => text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));

/** Restaurant's own logo, cropped from the founder's screenshot of the card (Burger Box). */
export const MerchantLogo: React.FC<{size: number}> = ({size}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.22, overflow: 'hidden', boxShadow: '0 6px 16px rgba(0,0,0,0.15)', flexShrink: 0, background: '#F3B73F'}}>
    <Img src={staticFile(MERCHANT_LOGO)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
  </div>
);

/** Four-point sparkle, the decoration used on the real loyalty card. */
export const Sparkle: React.FC<{size: number; color?: string; style?: React.CSSProperties}> = ({size, color = '#FF8A1F', style}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{display: 'block', ...style}}>
    <path d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0 Z" fill={color} />
  </svg>
);

/** Chicken fingers in a box ("فنكر"), flat vector drawn here so no stock image is used. */
export const FingersArt: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{display: 'block'}}>
    {[
      [30, -14],
      [42, -5],
      [54, 4],
      [66, 13],
    ].map(([x, r], i) => (
      <g key={i} transform={`rotate(${r} ${x} 60)`}>
        <rect x={x - 7} y={12 + (i % 2) * 6} width="15" height="52" rx="7.5" fill={i % 2 ? '#D9932F' : '#E7A23E'} />
        <rect x={x - 3} y={18 + (i % 2) * 6} width="3" height="34" rx="1.5" fill="#F6C779" opacity="0.8" />
      </g>
    ))}
    <path d="M18 50 L82 50 L76 90 L24 90 Z" fill="#E2581F" />
    <path d="M18 50 L82 50 L80 58 L20 58 Z" fill="#B8431A" />
    <circle cx="50" cy="72" r="9" fill="white" opacity="0.9" />
    <path d="M45 72 L49 76 L56 68" stroke="#E2581F" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Dashed progress ring (as on the card) ───────────────────────────────────
const SEG = 36;
export const DashedRing: React.FC<{size: number; fill: number; glow?: number}> = ({size, fill, glow = 0}) => {
  const r = 46;
  const pt = (a: number) => [50 + r * Math.cos((a * Math.PI) / 180), 50 + r * Math.sin((a * Math.PI) / 180)];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{position: 'absolute', inset: 0, overflow: 'visible', filter: glow > 0 ? `drop-shadow(0 0 ${8 * glow}px rgba(62,122,94,${0.8 * glow}))` : undefined}}>
      {new Array(SEG).fill(0).map((_, i) => {
        const a0 = -90 + i * (360 / SEG) + 1.6;
        const a1 = a0 + 360 / SEG - 4.4;
        const [x0, y0] = pt(a0);
        const [x1, y1] = pt(a1);
        const on = Math.max(0, Math.min(1, fill * SEG - i));
        return <path key={i} d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`} stroke={on > 0.5 ? C.green : C.ringIdle} strokeWidth={3.2} strokeLinecap="round" fill="none" />;
      })}
    </svg>
  );
};

// ── Customer phone: "بطاقة ولائي" ───────────────────────────────────────────
export const SCREEN_W = 392;
export const SCREEN_H = 842;
/** Ring centre inside the phone screen (used to aim the flying stars). */
export const RING = {x: 196, y: 372, size: 196} as const;
/** Redeem button inside the phone screen. */
export const REDEEM_BTN = {x: 74, y: 690} as const;
export const GET_CODE_BTN = {x: 196, y: 722} as const;

type CardProps = {
  points: number;
  fill: number;
  glow?: number;
  note: string;
  /** 0..1 reveal of the المكافآت section. */
  rewards?: number;
  /** Order numbers in the history, newest first, and the frame the newest one popped in. */
  history: number[];
  newAt?: number;
  pressRedeem?: boolean;
  /** Bumps the number when points change. */
  bumpAt?: number;
};

export const LoyaltyCardScreen: React.FC<CardProps> = ({points, fill, glow = 0, note, rewards = 0, history, newAt, pressRedeem, bumpAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bump = bumpAt === undefined ? 0 : Math.max(0, 1 - spring({frame: frame - bumpAt, fps, config: {damping: 9, stiffness: 200}})) * (frame >= bumpAt ? 1 : 0);
  const newP = newAt === undefined ? 1 : spring({frame: frame - newAt, fps, config: {damping: 14}});
  const histTop = 620 + rewards * 128;
  return (
    <div dir="rtl" style={{position: 'absolute', inset: 0, background: C.page, fontFamily: font, color: C.ink, overflow: 'hidden'}}>
      {/* sheet header */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 112, background: 'white'}}>
        <div style={{position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center', fontSize: 24, fontWeight: 900}}>{LY_UI.cardTitle}</div>
        <div style={{position: 'absolute', top: 52, left: 16, padding: '6px 18px', borderRadius: 999, border: `1.5px solid ${C.line}`, fontSize: 18, fontWeight: 800, background: '#FAFAFB'}}>{LY_UI.close}</div>
      </div>
      <div style={{position: 'absolute', top: 126, right: 26, fontSize: 17, fontWeight: 600, color: '#4A5068'}}>{LY_UI.allRestaurants} ›</div>
      {/* restaurant card */}
      <div style={{position: 'absolute', left: 16, right: 16, top: 162, height: 430, borderRadius: 30, background: 'white', border: `1.5px solid ${C.line}`}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 22}}>
          <MerchantLogo size={56} />
          <div style={{fontSize: 30, fontWeight: 900}}>{LY_DEMO.merchant}</div>
        </div>
        <div style={{position: 'absolute', left: RING.x - 16 - RING.size / 2, top: RING.y - 162 - RING.size / 2, width: RING.size, height: RING.size}}>
          <DashedRing size={RING.size} fill={fill} glow={glow} />
          <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{fontSize: 92, fontWeight: 900, lineHeight: 1, transform: `scale(${1 + bump * 0.35})`, color: glow > 0.5 ? C.green : C.ink, fontVariantNumeric: 'tabular-nums'}}>{points}</div>
            <div style={{fontSize: 19, color: C.sub, marginTop: 6}}>{LY_UI.pointsUnit}</div>
          </div>
        </div>
        <div style={{position: 'absolute', top: 314, left: 0, right: 0, textAlign: 'center', fontSize: 17, color: C.sub, fontWeight: 600}}>{note}</div>
        <div style={{position: 'absolute', top: 342, left: 0, right: 0, textAlign: 'center', fontSize: 15, color: C.sub}}>{LY_UI.perOrder}</div>
        <div style={{position: 'absolute', left: 26, right: 26, top: 368, height: 46, borderRadius: 14, background: '#EEF0F5', border: `1.5px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#2A3150'}}>{LY_UI.visitBtn}</div>
      </div>
      {/* rewards */}
      {rewards > 0.01 ? (
        <div style={{position: 'absolute', left: 16, right: 16, top: 612, opacity: rewards, transform: `translateY(${(1 - rewards) * 30}px)`}}>
          <div style={{fontSize: 24, fontWeight: 900, marginRight: 8}}>{LY_UI.rewardsTitle}</div>
          <div style={{position: 'relative', marginTop: 12, height: 76, borderRadius: 22, background: 'white', border: `1.5px solid ${C.line}`, overflow: 'hidden'}}>
            <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 82, background: C.peach, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{fontSize: 30, fontWeight: 900, color: C.orangeText, lineHeight: 1}}>{LY_DEMO.reward.points}</div>
              <div style={{fontSize: 14, color: C.sub}}>{LY_UI.pointsUnit}</div>
            </div>
            <div style={{position: 'absolute', right: 100, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 22, fontWeight: 800}}>{LY_DEMO.reward.name}</div>
            <div style={{position: 'absolute', left: 12, top: 14, width: 100, height: 48, borderRadius: 14, background: C.navy, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, transform: pressRedeem ? 'scale(0.92)' : undefined, boxShadow: pressRedeem ? '0 0 0 6px rgba(255,138,31,0.35)' : undefined}}>{LY_UI.redeemBtn}</div>
          </div>
        </div>
      ) : null}
      {/* history */}
      <div style={{position: 'absolute', left: 16, right: 16, top: histTop}}>
        <div style={{fontSize: 24, fontWeight: 900, marginRight: 8}}>{LY_UI.historyTitle}</div>
        <div style={{marginTop: 12, borderRadius: 22, background: 'white', border: `1.5px solid ${C.line}`, overflow: 'hidden'}}>
          {history.map((n, i) => {
            const p = i === 0 ? newP : 1;
            return (
              <div key={n} style={{height: 72 * p, opacity: p, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderTop: i ? `1px solid ${C.line}` : undefined, overflow: 'hidden'}}>
                <div>
                  <div style={{fontSize: 19, fontWeight: 800}}>
                    {LY_UI.order} {n}
                  </div>
                  <div style={{fontSize: 14, color: C.sub}}>{LY_UI.historyDate}</div>
                </div>
                <div style={{fontSize: 22, fontWeight: 900, color: C.green, direction: 'ltr'}}>+{LY_DEMO.pointsPerOrder}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** "تم استلام الطلب" toast that drops in at the top of the phone screen. */
export const PickupToast: React.FC<{at: number; order: number}> = ({at, order}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - at, fps, config: {damping: 13}});
  const out = interpolate(frame, [at + 46, at + 58], [0, 1], clamp);
  if (frame < at) return null;
  return (
    <div dir="rtl" style={{position: 'absolute', left: 14, right: 14, top: 58, zIndex: 20, transform: `translateY(${(1 - p) * -120 - out * 140}px)`, opacity: 1 - out, padding: '14px 18px', borderRadius: 22, background: 'rgba(255,255,255,0.97)', boxShadow: '0 14px 34px rgba(20,30,60,0.25)', fontFamily: font, display: 'flex', alignItems: 'center', gap: 12}}>
      <div style={{width: 44, height: 44, borderRadius: 22, background: C.green, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900}}>✓</div>
      <div style={{flex: 1}}>
        <div style={{fontSize: 19, fontWeight: 900, color: C.ink}}>
          {LY_UI.pickedUp} · {order}
        </div>
        <div style={{fontSize: 15, color: C.sub}}>{LY_DEMO.merchant}</div>
      </div>
      <div style={{fontSize: 24, fontWeight: 900, color: C.orange, direction: 'ltr'}}>+{LY_DEMO.pointsPerOrder}</div>
    </div>
  );
};

/** Bottom sheets: confirm the redeem, then show the (fake) code. */
export const RedeemSheet: React.FC<{openAt: number; codeAt: number; pressGetAt: number}> = ({openAt, codeAt, pressGetAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - openAt, fps, config: {damping: 16}});
  const isCode = frame >= codeAt;
  const c = spring({frame: frame - codeAt, fps, config: {damping: 15}});
  if (frame < openAt) return null;
  const press = frame >= pressGetAt - 2 && frame < pressGetAt + 4;
  const h = isCode ? 350 : 310;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, top: 112, background: 'rgba(130,136,160,0.55)', backdropFilter: 'blur(6px)', opacity: p}} />
      <div dir="rtl" style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: h, transform: `translateY(${(1 - p) * 100}%)`, background: 'white', borderRadius: '30px 30px 0 0', fontFamily: font, color: C.ink, padding: '0 22px', boxShadow: '0 -10px 40px rgba(0,0,0,0.15)'}}>
        <div style={{width: 60, height: 6, borderRadius: 3, background: C.line, margin: '14px auto 18px'}} />
        {!isCode ? (
          <>
            <div style={{fontSize: 26, fontWeight: 900}}>{LY_UI.confirmTitle}</div>
            <div style={{fontSize: 16, color: C.sub, marginTop: 10, lineHeight: 1.6}}>{LY_UI.confirmBody}</div>
            <div style={{marginTop: 18, height: 60, borderRadius: 18, background: C.navy, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, transform: press ? 'scale(0.95)' : undefined, boxShadow: press ? '0 0 0 6px rgba(255,138,31,0.35)' : undefined}}>{LY_UI.getCode}</div>
            <div style={{marginTop: 16, textAlign: 'center', fontSize: 19, fontWeight: 800, color: C.orangeText}}>{LY_UI.notNow}</div>
          </>
        ) : (
          <div style={{opacity: c, transform: `translateY(${(1 - c) * 20}px)`}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <div style={{fontSize: 26, fontWeight: 900}}>{LY_UI.codeTitle}</div>
              <div style={{fontSize: 14, fontWeight: 800, color: C.orangeText, background: C.peach, padding: '2px 10px', borderRadius: 999}}>{LY_DEMO.codeTag}</div>
            </div>
            <div style={{fontSize: 16, color: C.sub, marginTop: 8}}>{LY_UI.codeBody}</div>
            <div style={{display: 'flex', justifyContent: 'center', gap: 14, marginTop: 18, direction: 'ltr'}}>
              {[LY_DEMO.code.slice(0, 3), LY_DEMO.code.slice(3)].map((g, i) => (
                <div key={i} style={{width: 150, height: 96, borderRadius: 18, background: '#EFF1F6', border: `1.5px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, fontWeight: 900, letterSpacing: 6, transform: `scale(${spring({frame: frame - codeAt - 4 - i * 4, fps, config: {damping: 10}})})`}}>
                  {g}
                </div>
              ))}
            </div>
            <div style={{textAlign: 'center', fontSize: 16, color: C.sub, marginTop: 12}}>{LY_UI.codeValid}</div>
            <div style={{textAlign: 'center', fontSize: 18, fontWeight: 800, color: C.orangeText, marginTop: 10}}>{LY_UI.codeCancel}</div>
          </div>
        )}
      </div>
    </>
  );
};

/** Finger tap ripple for touches on the phone. (x, y) in the parent's pixels. */
export const Tap: React.FC<{x: number; y: number; at: number}> = ({x, y, at}) => {
  const frame = useCurrentFrame();
  const k = (frame - at + 8) / 22;
  if (k < 0 || k > 1) return null;
  const down = frame < at + 2;
  return (
    <div style={{position: 'absolute', left: x - 40, top: y - 40, width: 80, height: 80, zIndex: 40, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', inset: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', boxShadow: '0 4px 18px rgba(0,0,0,0.35)', opacity: down ? 1 : Math.max(0, 1 - (frame - at) / 8), transform: `scale(${down ? interpolate(k, [0, 0.36], [1.4, 1], clamp) : 1})`}} />
      {frame >= at ? <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid rgba(255,138,31,0.9)', opacity: 1 - (frame - at) / 14, transform: `scale(${0.6 + (frame - at) / 10})`}} /> : null}
    </div>
  );
};

// ── Browser frame (dashboard + cashier) ─────────────────────────────────────
export const BROWSER_BAR = 50;
export const BROWSER_PAD = 12;
export const BrowserFrame: React.FC<{width: number; height: number; children: React.ReactNode}> = ({width, height, children}) => (
  <div style={{position: 'relative', width, height, borderRadius: 34, padding: BROWSER_PAD, background: 'linear-gradient(150deg, #3b3f4a, #15171d)', boxShadow: '0 70px 160px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.16)', boxSizing: 'border-box'}}>
    <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 24, background: C.dashBg, overflow: 'hidden'}}>
      <div style={{display: 'flex', alignItems: 'center', height: BROWSER_BAR, background: '#1E2026', padding: '0 20px', gap: 10}}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />
        ))}
        <div style={{flex: 1, margin: '0 30px', height: 32, borderRadius: 16, background: '#2C2F37', color: '#C9CBD2', fontFamily: font, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr'}}>🔒 {LY_UI.url}</div>
      </div>
      <div style={{position: 'absolute', top: BROWSER_BAR, left: 0, right: 0, bottom: 0}}>{children}</div>
    </div>
  </div>
);

const Btn: React.FC<{children: React.ReactNode; color?: string; w?: number; h?: number; fs?: number; press?: boolean; outline?: boolean}> = ({children, color = C.orange, w, h = 60, fs = 22, press, outline}) => (
  <div style={{width: w, height: h, boxSizing: 'border-box', padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, fontFamily: font, fontSize: fs, fontWeight: 800, color: outline ? C.ink : 'white', background: outline ? 'white' : color, border: outline ? `1.5px solid ${C.line}` : 'none', transform: press ? 'scale(0.93)' : undefined, boxShadow: press ? '0 0 0 6px rgba(255,138,31,0.35)' : '0 6px 14px rgba(0,0,0,0.08)', whiteSpace: 'nowrap'}}>
    {children}
  </div>
);

// ── Cashier: "رمز نقاط الولاء من 6 أرقام" dialog ────────────────────────────
export const CASHIER_W = 980;
export const CASHIER_H = 720;
/** Button centres inside the browser content area (below the address bar). */
export const CASHIER_BTN = {verify: {x: 186, y: 362}, handOver: {x: 520, y: 532}} as const;

export const CashierDialog: React.FC<{typeFrom: number; verifyAt: number; handAt: number}> = ({typeFrom, verifyAt, handAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const digits = typed(LY_DEMO.code, frame, typeFrom, 0.34);
  const res = spring({frame: frame - verifyAt - 4, fps, config: {damping: 15}});
  const done = spring({frame: frame - handAt - 4, fps, config: {damping: 12}});
  const press = (at: number) => frame >= at - 2 && frame < at + 4;
  return (
    <div dir="rtl" style={{position: 'absolute', inset: 0, fontFamily: font, color: C.ink}}>
      {/* page behind */}
      <div style={{position: 'absolute', right: 36, top: 26, fontSize: 40, fontWeight: 900}}>{LY_UI.ordersTitle}</div>
      <div style={{position: 'absolute', left: 36, top: 30, display: 'flex', gap: 12}}>
        <Btn outline h={52} fs={19}>
          ★ رمز بطاقة الولاء
        </Btn>
      </div>
      <div style={{position: 'absolute', inset: 0, background: 'rgba(120,124,140,0.5)'}} />
      {/* dialog */}
      <div style={{position: 'absolute', left: 98, right: 98, top: 70, height: frame >= verifyAt + 4 ? 570 : 400, borderRadius: 34, background: '#F7F7F8', boxShadow: '0 30px 80px rgba(0,0,0,0.3)', padding: 32, boxSizing: 'border-box'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <div style={{width: 60, height: 60, borderRadius: 16, background: '#F5DED3', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{width: 32, height: 32, borderRadius: 16, background: C.orange, color: 'white', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>★</div>
          </div>
          <div style={{fontSize: 30, fontWeight: 800}}>{LY_UI.cashierTitle}</div>
        </div>
        <div style={{marginTop: 22, borderRadius: 24, background: 'white', padding: '22px 26px', boxShadow: '0 4px 14px rgba(0,0,0,0.04)'}}>
          <div style={{fontSize: 22, fontWeight: 800}}>{LY_UI.cashierTitle}</div>
          <div style={{fontSize: 17, color: C.sub, marginTop: 4, lineHeight: 1.5}}>{LY_UI.cashierBody}</div>
          <div style={{display: 'flex', gap: 14, marginTop: 18, alignItems: 'center'}}>
            <div style={{flex: 1, height: 70, borderRadius: 18, border: `2px solid ${frame >= typeFrom && frame < verifyAt ? C.orange : C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900, letterSpacing: 14, direction: 'ltr', color: digits ? C.ink : '#9AA0AE'}}>{digits || '0 0 0 0 0 0'}</div>
            <Btn h={70} w={112} fs={26} press={press(verifyAt)}>
              {LY_UI.verify}
            </Btn>
          </div>
          {frame >= verifyAt + 4 ? (
            <div style={{marginTop: 18, borderRadius: 20, background: '#F8E9E3', padding: '18px 22px', opacity: res, transform: `translateY(${(1 - res) * 20}px)`}}>
              <div style={{fontSize: 26, fontWeight: 900, color: C.orangeText}}>{LY_UI.rewardFound}</div>
              <div style={{fontSize: 17, color: C.sub}}>{LY_UI.rewardFor}</div>
              <div style={{display: 'flex', gap: 12, marginTop: 14}}>
                {frame < handAt + 4 ? (
                  <>
                    <div style={{flex: 1}}>
                      <Btn color={C.green} h={62} fs={24} press={press(handAt)}>
                        {LY_UI.handOver}
                      </Btn>
                    </div>
                    <Btn outline h={62} fs={20}>
                      {LY_UI.cancel}
                    </Btn>
                  </>
                ) : (
                  <div style={{flex: 1, height: 62, borderRadius: 16, background: C.greenSoft, color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 26, fontWeight: 900, transform: `scale(${0.85 + 0.15 * done})`}}>
                    <span style={{width: 40, height: 40, borderRadius: 20, background: C.green, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24}}>✓</span>
                    {LY_UI.delivered}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ── Merchant dashboard: "نقاط الولاء" ───────────────────────────────────────
export const DASH_W = 980;
export const DASH_H = 1180;
const SIDE_W = 210;
/** Content area width inside the browser. */
const CW = DASH_W - BROWSER_PAD * 2;
const MAIN_R = CW - SIDE_W - 36; // right edge of the main column
const TAB_W = 150;
export type DashTab = 0 | 1 | 2 | 3;
/** Click targets inside the browser content area. */
export const DASH_TARGETS = {
  tab: (i: number) => ({x: MAIN_R - TAB_W * i - TAB_W / 2, y: 214}),
  toggle: {x: 96, y: 668},
  pointsInput: {x: MAIN_R - 140, y: 778},
  save: {x: MAIN_R - 60, y: 920},
  addReward: {x: 146, y: 352},
  modalName: {x: 560, y: 452},
  modalPoints: {x: 560, y: 624},
  modalSave: {x: 236, y: 802},
} as const;

const Toggle: React.FC<{on: number}> = ({on}) => (
  <div style={{width: 76, height: 42, borderRadius: 21, background: on > 0.5 ? C.orange : '#C9CCD4', position: 'relative', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)'}}>
    <div style={{position: 'absolute', top: 5, left: 5 + (1 - on) * 34, width: 32, height: 32, borderRadius: 16, background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.25)'}} />
  </div>
);

const Field: React.FC<{label: string; value: string; focus?: boolean; h?: number; w?: number | string}> = ({label, value, focus, h = 70, w = '100%'}) => (
  <div style={{position: 'relative', width: w, height: h, borderRadius: 16, border: `2px solid ${focus ? C.orange : C.line}`, background: 'white', boxSizing: 'border-box', display: 'flex', alignItems: 'center', padding: '0 20px', fontSize: 23, fontWeight: 700}}>
    {value ? <div style={{position: 'absolute', top: -12, right: 16, padding: '0 6px', background: 'white', fontSize: 15, color: C.sub, fontWeight: 600}}>{label}</div> : null}
    <span style={{color: value ? C.ink : '#8C91A0', fontWeight: value ? 800 : 600}}>{value || label}</span>
    {focus ? <span style={{width: 2, height: 30, background: C.ink, marginRight: 2}} /> : null}
  </div>
);

const SampleBadge: React.FC = () => (
  <span style={{fontSize: 16, fontWeight: 800, color: C.orangeText, background: C.peach, border: '1.5px dashed #E9A27F', padding: '3px 12px', borderRadius: 999}}>{LY_UI.sample}</span>
);

const Empty: React.FC<{icon: string; text: string}> = ({icon, text}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top: 160, textAlign: 'center', color: C.ink}}>
    <div style={{fontSize: 56, opacity: 0.7}}>{icon}</div>
    <div style={{fontSize: 24, fontWeight: 800, marginTop: 6}}>{text}</div>
  </div>
);

type DashProps = {
  tab: DashTab;
  toggleOn: number;
  pointsText: string;
  pointsFocus: boolean;
  pressSave: boolean;
  /** Reward saved and listed. */
  rewardListed: number;
  modal: {p: number; name: string; points: string; nameFocus: boolean; pointsFocus: boolean; pressSave: boolean};
  pressAdd: boolean;
  /** 0..1 count-up of the sample stats (0 shows the real zero state). */
  stats: number;
  /** 0..1 fade of the list rows for العملاء / الحركات. */
  rows: number;
};

export const LoyaltyDashboard: React.FC<DashProps> = ({tab, toggleOn, pointsText, pointsFocus, pressSave, rewardListed, modal, pressAdd, stats, rows}) => {
  const mainW = CW - SIDE_W;
  return (
    <div dir="rtl" style={{position: 'absolute', inset: 0, fontFamily: font, color: C.ink}}>
      {/* sidebar */}
      <div style={{position: 'absolute', right: 10, top: 10, bottom: 10, width: SIDE_W - 20, borderRadius: 26, background: C.sidebar, padding: '22px 12px', boxSizing: 'border-box'}}>
        <div style={{width: 110, height: 110, borderRadius: 24, overflow: 'hidden', background: 'white', margin: '0 auto 26px'}}>
          <Img src={staticFile(ASSETS.logo)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
        </div>
        {LY_UI.sidebar.map((s, i) => (
          <div key={s} style={{height: 58, borderRadius: 16, marginBottom: 6, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap', background: i === 2 ? 'white' : 'transparent', color: i === 2 ? C.ink : 'white'}}>
            {i === 2 ? <span style={{width: 22, height: 22, borderRadius: 11, background: C.orange, color: 'white', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>★</span> : <span style={{width: 22, height: 22, borderRadius: 6, border: '2px solid rgba(255,255,255,0.6)'}} />}
            {s}
          </div>
        ))}
        <div style={{position: 'absolute', bottom: 24, right: 20, color: 'white', fontSize: 20, fontWeight: 800}}>{LY_DEMO.merchant}</div>
      </div>
      {/* main column */}
      <div style={{position: 'absolute', left: 0, top: 0, width: mainW, bottom: 0}}>
        <div style={{position: 'absolute', right: 36, top: 22, fontSize: 20, fontWeight: 700}}>{LY_DEMO.merchant}</div>
        <div style={{position: 'absolute', right: 36, top: 56, fontSize: 46, fontWeight: 900}}>{LY_UI.pageTitle}</div>
        <div style={{position: 'absolute', right: 36, left: 36, top: 128, fontSize: 18, color: C.sub, lineHeight: 1.4}}>{LY_UI.pageSub}</div>
        {/* tabs */}
        <div style={{position: 'absolute', right: 36, top: 184, display: 'flex', borderRadius: 999, border: `1.5px solid ${C.ink}`, overflow: 'hidden', background: 'white'}}>
          {LY_UI.tabs.map((t, i) => (
            <div key={t} style={{width: TAB_W, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, fontWeight: 800, color: i === tab ? C.orange : C.ink, background: i === tab ? C.peach : 'white', borderLeft: i < 3 ? `1.5px solid ${C.line}` : undefined}}>
              {t}
            </div>
          ))}
        </div>
        {/* panels */}
        <div style={{position: 'absolute', left: 36, right: 36, top: 272, bottom: 20}}>
          {tab === 0 ? (
            <>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14}}>
                {LY_UI.stats.map((s, i) => {
                  const v = Math.round(LY_DEMO.sampleStats[i] * stats);
                  const col = i === 1 ? C.green : i === 2 ? C.orangeText : C.ink;
                  return (
                    <div key={s} style={{height: 108, borderRadius: 20, background: 'white', padding: '14px 18px', boxSizing: 'border-box', boxShadow: '0 4px 14px rgba(0,0,0,0.04)'}}>
                      <div style={{fontSize: 17, color: C.sub, fontWeight: 600}}>{s}</div>
                      <div style={{fontSize: 40, fontWeight: 900, color: col, lineHeight: 1.3}}>{v}</div>
                    </div>
                  );
                })}
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: stats > 0 ? 1 : 0}}>
                  <SampleBadge />
                </div>
              </div>
              <div style={{marginTop: 22, borderRadius: 24, background: 'white', padding: '22px 26px', boxShadow: '0 4px 14px rgba(0,0,0,0.04)', height: 420, boxSizing: 'border-box', position: 'relative'}}>
                <div style={{fontSize: 24, fontWeight: 900}}>{LY_UI.settingsTitle}</div>
                <div style={{fontSize: 17, color: C.sub}}>{LY_UI.settingsNow}</div>
                <div style={{fontSize: 23, fontWeight: 900, marginTop: 16}}>{LY_UI.programOn}</div>
                <div style={{fontSize: 16, color: C.sub, marginTop: 2}}>{LY_UI.programOff}</div>
                <div style={{position: 'absolute', left: 24, top: 118}}>
                  <Toggle on={toggleOn} />
                </div>
                <div style={{marginTop: 22, width: 280}}>
                  <Field label={LY_UI.pointsField} value={pointsText} focus={pointsFocus} />
                </div>
                <div style={{fontSize: 17, color: C.ink, marginTop: 16}}>{LY_UI.autoLine}</div>
                <div style={{position: 'absolute', right: 26, bottom: 22}}>
                  <Btn w={120} press={pressSave}>
                    {LY_UI.save}
                  </Btn>
                </div>
              </div>
            </>
          ) : null}
          {tab === 1 ? (
            <>
              <div style={{fontSize: 17, color: C.sub}}>{LY_UI.rewardsHint}</div>
              <div style={{position: 'absolute', left: 0, top: 46}}>
                <Btn w={220} press={pressAdd}>
                  + {LY_UI.addReward}
                </Btn>
              </div>
              {rewardListed > 0.01 ? (
                <div style={{position: 'absolute', left: 0, right: 0, top: 136, height: 96, borderRadius: 22, background: 'white', boxShadow: '0 6px 18px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', opacity: rewardListed, transform: `scale(${0.9 + 0.1 * rewardListed})`}}>
                  <FingersArt size={70} />
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 26, fontWeight: 900}}>{LY_DEMO.reward.name}</div>
                    <div style={{fontSize: 17, color: C.green, fontWeight: 700}}>{LY_UI.rewardAvailable}</div>
                  </div>
                  <div style={{fontSize: 26, fontWeight: 900, color: C.orangeText, background: C.peach, padding: '8px 18px', borderRadius: 16}}>
                    {LY_DEMO.reward.points} {LY_UI.pointsUnit}
                  </div>
                </div>
              ) : (
                <Empty icon="🎁" text={LY_UI.noRewards} />
              )}
            </>
          ) : null}
          {tab === 2 ? (
            <>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{width: 440, height: 60, borderRadius: 16, border: `1.5px solid ${C.line}`, background: 'white', display: 'flex', alignItems: 'center', padding: '0 18px', fontSize: 19, color: C.sub}}>🔍 {LY_UI.customersSearch}</div>
                <SampleBadge />
              </div>
              {LY_DEMO.sampleCustomers.map((c, i) => (
                <div key={c.name} style={{marginTop: 14, height: 86, borderRadius: 20, background: 'white', display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', opacity: interpolate(rows, [i * 0.2, i * 0.2 + 0.4], [0, 1], clamp), transform: `translateX(${(1 - interpolate(rows, [i * 0.2, i * 0.2 + 0.4], [0, 1], clamp)) * -40}px)`}}>
                  <div style={{width: 52, height: 52, borderRadius: 26, background: '#E9ECF3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26}}>👤</div>
                  <div style={{flex: 1, fontSize: 23, fontWeight: 800}}>{c.name}</div>
                  <div style={{fontSize: 23, fontWeight: 900, color: C.green}}>
                    {c.points} {LY_UI.pointsUnit}
                  </div>
                </div>
              ))}
            </>
          ) : null}
          {tab === 3 ? (
            <>
              <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                <SampleBadge />
              </div>
              {LY_DEMO.sampleMoves.map((m, i) => (
                <div key={i} style={{marginTop: 14, height: 82, borderRadius: 20, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', opacity: interpolate(rows, [i * 0.2, i * 0.2 + 0.4], [0, 1], clamp)}}>
                  <div style={{fontSize: 23, fontWeight: 800}}>{m.label}</div>
                  <div style={{fontSize: 26, fontWeight: 900, color: m.delta.startsWith('+') ? C.green : C.orangeText, direction: 'ltr'}}>{m.delta}</div>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
      {/* add-reward modal */}
      {modal.p > 0.01 ? (
        <>
          <div style={{position: 'absolute', inset: 0, background: 'rgba(120,124,140,0.5)', opacity: modal.p}} />
          <div style={{position: 'absolute', left: 120, width: 640, top: 340, height: 520, borderRadius: 32, background: '#F7F7F8', boxShadow: '0 30px 80px rgba(0,0,0,0.3)', padding: '26px 32px', boxSizing: 'border-box', opacity: modal.p, transform: `scale(${0.9 + 0.1 * modal.p})`}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <div style={{width: 54, height: 54, borderRadius: 14, background: '#F5DED3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28}}>🎁</div>
              <div style={{fontSize: 30, fontWeight: 900}}>{LY_UI.addReward}</div>
            </div>
            <div style={{marginTop: 26}}>
              <Field label={LY_UI.rewardName} value={modal.name} focus={modal.nameFocus} />
            </div>
            <div style={{marginTop: 16}}>
              <Field label={LY_UI.rewardDesc} value="" h={70} />
            </div>
            <div style={{marginTop: 16}}>
              <Field label={LY_UI.rewardPoints} value={modal.points} focus={modal.pointsFocus} />
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16}}>
              <div style={{fontSize: 22, fontWeight: 800}}>{LY_UI.rewardAvailable}</div>
              <Toggle on={1} />
            </div>
            <div style={{position: 'absolute', left: 32, bottom: 26, display: 'flex', gap: 12, direction: 'ltr'}}>
              <Btn w={110} press={modal.pressSave}>
                {LY_UI.save}
              </Btn>
              <Btn outline w={110}>
                {LY_UI.cancel}
              </Btn>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

// ── 3D cartoon burger restaurant ────────────────────────────────────────────
/** Front door centre (bottom) in composition pixels. */
export const DOOR = {x: 540, y: 1390} as const;

export const Storefront: React.FC<{lightP?: number}> = ({lightP = 1}) => {
  const frame = useCurrentFrame();
  const flicker = 0.92 + 0.08 * Math.sin(frame / 7);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      {/* dusk sky */}
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0B1433 0%, #1D2A66 38%, #6B3E6E 62%, #E9864A 78%, #F6B06A 100%)'}} />
      {new Array(18).fill(0).map((_, i) => (
        <div key={i} style={{position: 'absolute', left: ((i * 137) % 1000) + 30, top: ((i * 89) % 520) + 40, width: 3, height: 3, borderRadius: 2, background: 'white', opacity: 0.3 + 0.4 * Math.abs(Math.sin(frame / 20 + i))}} />
      ))}
      {/* street */}
      <div style={{position: 'absolute', left: -600, right: -600, top: 1380, height: 1400, background: 'repeating-linear-gradient(90deg, #3B3F58 0px, #3B3F58 118px, #34384F 120px)', transform: 'perspective(900px) rotateX(64deg)', transformOrigin: 'top'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 1380, height: 540, background: 'linear-gradient(180deg, rgba(10,14,30,0) 0%, rgba(10,14,30,0.55) 100%)'}} />
      {/* warm light spill on the pavement */}
      <div style={{position: 'absolute', left: 140, width: 800, top: 1360, height: 300, background: 'radial-gradient(50% 50% at 50% 20%, rgba(255,196,110,0.55) 0%, rgba(255,196,110,0) 100%)', opacity: lightP * flicker}} />
      {/* building: side wall for depth */}
      <div style={{position: 'absolute', left: 960, top: 640, width: 120, height: 740, background: 'linear-gradient(90deg, #B98B5E, #8A6340)', transform: 'skewY(-14deg)', transformOrigin: 'left top'}} />
      {/* facade */}
      <div style={{position: 'absolute', left: 120, top: 640, width: 840, height: 740, background: 'linear-gradient(180deg, #F6E7CC 0%, #EBD3AE 100%)', borderRadius: '18px 18px 0 0', boxShadow: '0 40px 80px rgba(0,0,0,0.45), inset 0 -20px 40px rgba(120,70,20,0.2)'}} />
      {/* sign band */}
      <div style={{position: 'absolute', left: 150, top: 664, width: 780, height: 150, borderRadius: 26, background: 'linear-gradient(180deg, #24306A, #172153)', boxShadow: '0 14px 28px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28}}>
        <MerchantLogo size={112} />
        <div dir="rtl" style={{fontFamily: font, fontSize: 92, fontWeight: 900, color: 'white', textShadow: `0 0 ${24 * flicker}px rgba(255,190,90,0.85)`}}>{LY_DEMO.merchant}</div>
      </div>
      {/* awning */}
      <div style={{position: 'absolute', left: 110, top: 828, width: 860, height: 92, background: 'repeating-linear-gradient(90deg, #FF7A00 0px, #FF7A00 54px, #FFF4E6 54px, #FFF4E6 108px)', borderRadius: '10px 10px 0 0', transform: 'perspective(600px) rotateX(-28deg)', transformOrigin: 'top', boxShadow: '0 18px 24px rgba(0,0,0,0.3)'}} />
      <div style={{position: 'absolute', left: 110, top: 912, width: 860, height: 28, background: 'radial-gradient(circle at 27px 0, #FF7A00 26px, transparent 27px) 0 0 / 108px 28px repeat-x, radial-gradient(circle at 81px 0, #FFF4E6 26px, transparent 27px) 0 0 / 108px 28px repeat-x'}} />
      {/* windows with warm interior */}
      {[170, 650].map((x) => (
        <div key={x} style={{position: 'absolute', left: x, top: 980, width: 260, height: 330, borderRadius: 18, background: `linear-gradient(180deg, rgba(255,214,150,${0.95 * lightP}) 0%, rgba(255,170,90,${0.9 * lightP}) 100%)`, border: '10px solid #5A3A22', boxShadow: `0 0 ${60 * flicker * lightP}px rgba(255,180,90,0.6), inset 0 -30px 40px rgba(150,70,10,0.35)`, overflow: 'hidden'}}>
          {/* silhouettes of tables and lamps */}
          <div style={{position: 'absolute', left: 30, top: 0, width: 4, height: 70, background: '#5A3A22'}} />
          <div style={{position: 'absolute', left: 12, top: 66, width: 40, height: 26, borderRadius: '20px 20px 4px 4px', background: '#FFE7B5', boxShadow: '0 0 30px #FFD27A'}} />
          <div style={{position: 'absolute', left: 150, top: 0, width: 4, height: 50, background: '#5A3A22'}} />
          <div style={{position: 'absolute', left: 132, top: 46, width: 40, height: 26, borderRadius: '20px 20px 4px 4px', background: '#FFE7B5', boxShadow: '0 0 30px #FFD27A'}} />
          <div style={{position: 'absolute', left: 20, right: 20, bottom: 60, height: 14, borderRadius: 7, background: 'rgba(90,50,20,0.55)'}} />
          <div style={{position: 'absolute', left: 60, bottom: 0, width: 10, height: 60, background: 'rgba(90,50,20,0.55)'}} />
          <div style={{position: 'absolute', right: 60, bottom: 0, width: 10, height: 60, background: 'rgba(90,50,20,0.55)'}} />
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(125deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 40%)'}} />
        </div>
      ))}
      {/* door */}
      <div style={{position: 'absolute', left: DOOR.x - 80, top: 960, width: 160, height: DOOR.y - 960, borderRadius: '80px 80px 0 0', background: `linear-gradient(180deg, rgba(255,205,130,${lightP}) 0%, rgba(240,150,70,${lightP}) 100%)`, border: '12px solid #4A2E1A', borderBottom: 'none', boxShadow: `0 0 ${70 * lightP}px rgba(255,170,80,0.65)`}}>
        <div style={{position: 'absolute', left: 18, top: 170, width: 12, height: 44, borderRadius: 6, background: '#C8A060'}} />
      </div>
      {/* wall lamps */}
      {[430, 650].map((x) => (
        <div key={x} style={{position: 'absolute', left: x - 18, top: 950, width: 36, height: 36, borderRadius: 18, background: '#FFF1C9', boxShadow: `0 0 ${50 * flicker}px 20px rgba(255,200,110,0.5)`}} />
      ))}
    </div>
  );
};

/** Flat cartoon customer carrying a takeaway bag. (x, y) = feet centre. */
export const Customer: React.FC<{x: number; y: number; scale: number; walk: number; opacity?: number}> = ({x, y, scale, walk, opacity = 1}) => {
  const swing = Math.sin(walk * Math.PI * 2) * 18;
  const bob = Math.abs(Math.sin(walk * Math.PI * 2)) * 8;
  return (
    <div style={{position: 'absolute', left: x - 90, top: y - 380, width: 180, height: 380, transform: `scale(${scale}) translateY(${-bob}px)`, transformOrigin: '50% 100%', opacity}}>
      {/* shadow */}
      <div style={{position: 'absolute', left: 30, bottom: -10, width: 120, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', filter: 'blur(3px)'}} />
      {/* legs */}
      {[-1, 1].map((s) => (
        <div key={s} style={{position: 'absolute', left: 90 + s * 18 - 13, top: 250, width: 26, height: 124, borderRadius: 13, background: 'linear-gradient(90deg, #1C2546, #2A3566)', transform: `rotate(${s * swing}deg)`, transformOrigin: '50% 0'}}>
          <div style={{position: 'absolute', bottom: -6, left: -6, width: 40, height: 18, borderRadius: 9, background: '#F4F4F4'}} />
        </div>
      ))}
      {/* body (hoodie) */}
      <div style={{position: 'absolute', left: 38, top: 112, width: 104, height: 160, borderRadius: '46px 46px 26px 26px', background: 'linear-gradient(135deg, #3E7A5E 0%, #2C5C46 100%)', boxShadow: 'inset -10px -10px 20px rgba(0,0,0,0.2)'}} />
      {/* arm + bag */}
      <div style={{position: 'absolute', left: 128, top: 130, width: 24, height: 104, borderRadius: 12, background: '#2C5C46', transform: `rotate(${-8 - swing * 0.4}deg)`, transformOrigin: '50% 0'}}>
        <div style={{position: 'absolute', left: -20, top: 92, width: 74, height: 82, borderRadius: 8, background: 'linear-gradient(180deg, #D8A56A, #B9844B)', boxShadow: '0 6px 12px rgba(0,0,0,0.3)'}}>
          <div style={{position: 'absolute', left: 16, top: -16, width: 40, height: 24, border: '5px solid #A77440', borderBottom: 'none', borderRadius: '20px 20px 0 0'}} />
          <div style={{position: 'absolute', left: 21, top: 24, width: 32, height: 32, borderRadius: 8, background: '#F3B73F'}} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 28, top: 130, width: 24, height: 104, borderRadius: 12, background: '#2C5C46', transform: `rotate(${8 + swing * 0.4}deg)`, transformOrigin: '50% 0'}} />
      {/* head */}
      <div style={{position: 'absolute', left: 48, top: 18, width: 84, height: 96, borderRadius: '42px 42px 40px 40px', background: 'radial-gradient(circle at 40% 35%, #F2C9A0, #D9A272)'}} />
      <div style={{position: 'absolute', left: 44, top: 8, width: 92, height: 46, borderRadius: '46px 46px 16px 16px', background: '#2A1D16'}} />
      <div style={{position: 'absolute', left: 70, top: 62, width: 8, height: 10, borderRadius: 4, background: '#2A1D16'}} />
      <div style={{position: 'absolute', left: 102, top: 62, width: 8, height: 10, borderRadius: 4, background: '#2A1D16'}} />
      <div style={{position: 'absolute', left: 78, top: 84, width: 24, height: 10, borderRadius: '0 0 12px 12px', background: '#9C4A2C'}} />
    </div>
  );
};

/** Stars flying from `from` to `to` along an arc, one every `gap` frames; each fades as it lands. */
export const FlyingStars: React.FC<{from: {x: number; y: number}; to: {x: number; y: number}; at: number; count: number; gap?: number; len?: number; size?: number}> = ({from, to, at, count, gap = 8, len = 22, size = 54}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        const k = (frame - at - i * gap) / len;
        if (k < 0 || k > 1) return null;
        const e = 1 - Math.pow(1 - k, 2);
        const x = from.x + (to.x - from.x) * e + Math.sin(k * Math.PI) * (i % 2 ? 60 : -60);
        const y = from.y + (to.y - from.y) * e - Math.sin(k * Math.PI) * 120;
        const s = size * (1 - 0.4 * k);
        return (
          <React.Fragment key={i}>
            {/* motion trail */}
            {[0.06, 0.12].map((d, j) => {
              const kk = Math.max(0, k - d);
              const ee = 1 - Math.pow(1 - kk, 2);
              const tx = from.x + (to.x - from.x) * ee + Math.sin(kk * Math.PI) * (i % 2 ? 60 : -60);
              const ty = from.y + (to.y - from.y) * ee - Math.sin(kk * Math.PI) * 120;
              return <Sparkle key={j} size={s * 0.8} color="#FFB25B" style={{position: 'absolute', left: tx - s * 0.4, top: ty - s * 0.4, opacity: 0.35 - j * 0.15, filter: 'blur(3px)'}} />;
            })}
            <Sparkle size={s} style={{position: 'absolute', left: x - s / 2, top: y - s / 2, transform: `rotate(${k * 180}deg)`, filter: 'drop-shadow(0 0 12px rgba(255,138,31,0.9))'}} />
          </React.Fragment>
        );
      })}
    </>
  );
};

/** Celebration burst of orange sparkles around a point. */
export const Burst: React.FC<{x: number; y: number; at: number; count?: number; radius?: number}> = ({x, y, at, count = 12, radius = 220}) => {
  const frame = useCurrentFrame();
  const k = (frame - at) / 34;
  if (k < 0 || k > 1) return null;
  const e = 1 - Math.pow(1 - k, 3);
  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        const a = (i / count) * Math.PI * 2 + 0.3;
        const r = radius * e * (0.7 + 0.3 * ((i * 7) % 3));
        const s = (i % 3 === 0 ? 46 : 30) * (1 - k * 0.6);
        return <Sparkle key={i} size={s} color={i % 2 ? '#FF8A1F' : '#FFD27A'} style={{position: 'absolute', left: x + Math.cos(a) * r - s / 2, top: y + Math.sin(a) * r - s / 2, opacity: 1 - k, transform: `rotate(${k * 120}deg)`}} />;
      })}
    </>
  );
};

/** Floating reward card used in the outro. */
export const RewardCard: React.FC = () => (
  <div dir="rtl" style={{width: 300, borderRadius: 32, background: 'white', padding: 22, boxSizing: 'border-box', fontFamily: font, textAlign: 'center', boxShadow: '0 40px 90px rgba(0,0,0,0.45)'}}>
    <div style={{display: 'flex', justifyContent: 'center'}}>
      <FingersArt size={150} />
    </div>
    <div style={{fontSize: 32, fontWeight: 900, color: C.ink, marginTop: 4}}>{LY_DEMO.reward.name}</div>
    <div style={{display: 'inline-block', marginTop: 10, fontSize: 24, fontWeight: 900, color: C.orangeText, background: C.peach, padding: '6px 20px', borderRadius: 999}}>
      {LY_DEMO.reward.points} {LY_UI.pointsUnit}
    </div>
  </div>
);
