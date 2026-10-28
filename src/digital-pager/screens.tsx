import React from 'react';
import {Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ASSETS, BRAND, orangeGradient} from '../config';
import {QrCodeSvg} from './QrCodeSvg';
import {DP_UI} from './config';

const c = BRAND.colors;

// ── Old plastic coaster pager (the problem) ─────────────────────────────────
export const OldPager: React.FC<{x: number; y: number; buzzFrom?: number; dead?: boolean; scale?: number; rot?: number}> = ({x, y, buzzFrom = 0, dead, scale = 1, rot = 0}) => {
  const frame = useCurrentFrame();
  const buzzing = !dead && frame >= buzzFrom && Math.floor((frame - buzzFrom) / 10) % 2 === 0;
  const shake = buzzing ? Math.sin(frame * 2.6) * 6 : 0;
  const led = buzzing ? 1 : dead ? 0.08 : 0.35;
  return (
    <div style={{position: 'absolute', left: x - 170, top: y - 120, width: 340, height: 240, transform: `translateX(${shake}px) scale(${scale}) rotate(${rot}deg)`, filter: dead ? 'grayscale(0.7) brightness(0.7)' : undefined}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 60, background: 'linear-gradient(160deg, #3a3f4b, #16181d)', boxShadow: '0 40px 80px rgba(0,0,0,0.6), inset 0 3px 0 rgba(255,255,255,0.12)'}} />
      <div style={{position: 'absolute', inset: 18, borderRadius: 46, background: 'linear-gradient(160deg, #23262e, #0f1115)', border: '2px solid rgba(255,255,255,0.06)'}} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{position: 'absolute', top: 40, left: 70 + i * 44, width: 22, height: 22, borderRadius: 11, background: `rgba(255,60,40,${led})`, boxShadow: led > 0.5 ? '0 0 24px 6px rgba(255,60,40,0.7)' : undefined}} />
      ))}
      <div style={{position: 'absolute', bottom: 46, left: 0, right: 0, textAlign: 'center', fontFamily: 'monospace', fontSize: 54, fontWeight: 800, color: dead ? '#333' : '#ff5a3c', letterSpacing: 6, textShadow: dead ? undefined : '0 0 12px rgba(255,90,60,0.7)'}}>
        {dead ? '--' : '07'}
      </div>
    </div>
  );
};

// ── Merchant cashier dashboard (merchant.pagergo.pro, "وضع أمين الصندوق") ──
// Rebuilt from the founder's screen recording of the real dashboard: right column
// = current customer order number + QR + "طلب جديد"; left column = open orders,
// each with "جاهز", which turns into a green "استلم الطلب" and fires a toast.
export const TABLET_W = 760;
export const TABLET_H = 1080;
const RED = '#E2521F';
const GREEN = '#2F9D5C';

const Pill: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, background: 'rgba(255,255,255,0.85)', border: '1px solid #E9E2DA', fontSize: 17, fontWeight: 700, color: '#2B2B2B', padding: '8px 16px', ...style}}>{children}</div>
);

export const TabletDashboard: React.FC<{createAt: number; tapReadyAt?: number; cursorFrom?: number; showToast?: boolean}> = ({createAt, tapReadyAt, cursorFrom, showToast = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const created = frame >= createAt;
  const cardP = spring({frame: frame - createAt, fps, config: {damping: 14}});
  const ready = tapReadyAt !== undefined && frame >= tapReadyAt;
  const readyP = tapReadyAt === undefined ? 0 : spring({frame: frame - tapReadyAt, fps, config: {damping: 13}});

  // cursor: to "طلب جديد" (create) or to the order's "جاهز" button
  const tapAt = tapReadyAt ?? createAt - 6;
  const target = tapReadyAt !== undefined ? {x: 145, y: 219} : {x: 522, y: 750};
  const from = cursorFrom ?? tapAt - 30;
  const k = interpolate(frame, [from, tapAt - 4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cx = interpolate(k, [0, 1], [TABLET_W - 140, target.x]);
  const cy = interpolate(k, [0, 1], [TABLET_H - 60, target.y]) - Math.sin(k * Math.PI) * 80;
  const press = frame >= tapAt - 3 && frame < tapAt + 3 ? 0.9 : 1;
  const showCursor = frame >= from && frame < tapAt + 18;
  const newPress = tapReadyAt === undefined ? press : 1;
  const readyPress = tapReadyAt !== undefined ? press : 1;

  return (
    <div style={{position: 'relative', width: TABLET_W, height: TABLET_H, borderRadius: 54, padding: 22, background: 'linear-gradient(150deg, #3b3f4a, #15171d)', boxShadow: '0 70px 160px rgba(0,0,0,0.65), inset 0 0 0 2px rgba(255,255,255,0.16)', fontFamily: BRAND.font}}>
      <div dir="rtl" style={{position: 'relative', width: '100%', height: '100%', borderRadius: 34, overflow: 'hidden', background: 'linear-gradient(170deg, #FBEFE6 0%, #F6F1EC 40%, #EEEFF2 100%)'}}>
        {/* slim address bar */}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, background: '#1E2026', color: '#C9CBD2', fontSize: 17, fontWeight: 600, direction: 'ltr', gap: 8}}>
          <span style={{opacity: 0.7}}>🔒</span> merchant.pagergo.pro
        </div>
        {/* header */}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px 6px'}}>
          <div style={{fontSize: 21, fontWeight: 800, color: '#2B2B2B'}}>وضع أمين الصندوق</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={{width: 10, height: 10, borderRadius: 5, background: GREEN}} />
            <div style={{background: RED, color: 'white', fontSize: 16, fontWeight: 800, padding: '8px 16px', borderRadius: 12}}>إنهاء وضع أمين الصندوق</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: 16, padding: '10px 18px'}}>
          {/* right column: customer order number + QR + new order */}
          <div style={{flex: 1.12, background: 'rgba(255,255,255,0.7)', borderRadius: 26, padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, border: '1px solid rgba(0,0,0,0.04)'}}>
            {created ? (
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: cardP, transform: `scale(${interpolate(cardP, [0, 1], [0.8, 1])})`}}>
                <div style={{fontSize: 18, fontWeight: 700, color: '#555'}}>رقم طلب العميل</div>
                <div style={{fontSize: 120, fontWeight: 1000, lineHeight: 1, color: '#1F1F1F', direction: 'ltr'}}>{DP_UI.orderNo}</div>
                <div style={{fontSize: 16, fontWeight: 600, color: '#444', textAlign: 'center', lineHeight: 1.5}}>اطلب من العميل مسح رمز QR بكاميرا هاتفه لفتح طلبه وتفعيل التنبيه.</div>
                <div style={{background: 'white', padding: 12, borderRadius: 16}}>
                  <QrCodeSvg size={210} start={createAt + 4} />
                </div>
                <div style={{fontSize: 13, color: '#555', direction: 'ltr'}}>https://go.pagergo.pro/o/…</div>
                <Pill>🖨 إعادة طباعة الإيصال</Pill>
                <Pill>📱 ربط برمز انتظار العميل (0)</Pill>
              </div>
            ) : (
              <div style={{height: 520}} />
            )}
            <div style={{width: '100%', marginTop: 'auto', padding: '20px 0', borderRadius: 18, background: RED, color: 'white', fontSize: 30, fontWeight: 900, textAlign: 'center', transform: `scale(${newPress})`, boxShadow: '0 12px 26px rgba(226,82,31,0.35)'}}>+ طلب جديد</div>
            <div style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#333'}}>
              <span>طباعة الإيصال مع رمز QR</span>
              <div style={{width: 52, height: 30, borderRadius: 15, background: RED, position: 'relative'}}>
                <div style={{position: 'absolute', top: 3, left: 3, width: 24, height: 24, borderRadius: 12, background: 'white'}} />
              </div>
            </div>
          </div>
          {/* left column: search + open orders */}
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 12}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.8)', borderRadius: 16, padding: '12px 14px', fontSize: 16, fontWeight: 600, color: '#555'}}>
              <span>⌗ رقم الطلب أو مسح رمز QR</span>
              <span style={{opacity: 0.6}}>✕</span>
            </div>
            {created ? (
              <div style={{background: 'rgba(255,255,255,0.75)', borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, opacity: cardP, transform: `translateX(${(1 - cardP) * -80}px)`, boxShadow: ready ? `0 0 0 3px rgba(47,157,92,${0.6 * (1 - readyP) + 0.25})` : undefined}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                  <div style={{width: 46, fontSize: 52, fontWeight: 1000, textAlign: 'center', color: ready ? GREEN : '#1F1F1F', direction: 'ltr'}}>{DP_UI.orderNo}</div>
                  {ready ? <div style={{fontSize: 30, transform: `rotate(${Math.sin(frame) * 12 * (1 - readyP)}deg)`}}>🔔</div> : null}
                  <div
                    style={{
                      flex: 1,
                      padding: '16px 0',
                      borderRadius: 16,
                      textAlign: 'center',
                      fontSize: 24,
                      fontWeight: 900,
                      color: 'white',
                      background: ready ? GREEN : RED,
                      transform: `scale(${readyPress})`,
                    }}
                  >
                    {ready ? '🛍 استلم الطلب' : `✓ ${DP_UI.ready}`}
                  </div>
                </div>
                <Pill style={{fontSize: 16}}>▦ ربط العميل / QR الطلب</Pill>
              </div>
            ) : (
              <div style={{marginTop: 120, textAlign: 'center', color: '#333', fontSize: 20, fontWeight: 700}}>🧾<br />لا توجد طلبات مفتوحة</div>
            )}
          </div>
        </div>
        {/* toast */}
        {showToast && ready ? (
          <div style={{position: 'absolute', left: 60, right: 60, bottom: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 20px', borderRadius: 18, background: GREEN, color: 'white', fontSize: 22, fontWeight: 900, opacity: readyP, transform: `translateY(${(1 - readyP) * 40}px)`, boxShadow: '0 16px 30px rgba(47,157,92,0.4)'}}>
            <span style={{width: 30, height: 30, borderRadius: 15, background: 'white', color: GREEN, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20}}>✓</span>
            الطلب {DP_UI.orderNo} جاهز، وتم إرسال التنبيه
          </div>
        ) : null}
      </div>
      {showCursor ? (
        <svg width={72} height={72} viewBox="0 0 24 24" style={{position: 'absolute', left: cx + 22 - 32, top: cy + 22 - 9, transform: `scale(${press})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))'}}>
          <path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10h.5V8.5a1.5 1.5 0 0 1 3 0V10h.5V9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.6-2.2l-3-3.7a1.5 1.5 0 0 1 2.2-2L9 15V11z" fill="white" stroke={c.navy} strokeWidth={1.2} strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
};

// ── iPhone camera pointed at the dashboard: QR detected → App Clip card ─────
// Rebuilt from the founder's recording: the camera frames the dashboard's order 7
// and QR, iOS shows a yellow link chip, then the Pager Go App Clip card slides up.
export const ScanScreen: React.FC<{lockAt: number; clipAt: number; openAt: number}> = ({lockAt, clipAt, openAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const locked = frame >= lockAt;
  const lock = spring({frame: frame - lockAt, fps, config: {damping: 12}});
  const clip = spring({frame: frame - clipAt, fps, config: {damping: 16, stiffness: 120}});
  const beam = (frame % 36) / 36;
  const drift = Math.sin(frame / 9) * 6;
  const openPress = frame >= openAt - 3 && frame < openAt + 3 ? 0.9 : 1;
  const box = interpolate(lock, [0, 1], [290, 250]);
  const col = locked ? '#FFD60A' : 'rgba(255,255,255,0.85)';
  const corner = (pos: React.CSSProperties) => <div style={{position: 'absolute', width: 50, height: 50, borderColor: col, borderStyle: 'solid', borderWidth: 0, ...pos}} />;
  return (
    <div dir="rtl" style={{position: 'absolute', inset: 0, background: '#0b0b0d', fontFamily: BRAND.font, overflow: 'hidden'}}>
      {/* what the camera sees: the cashier screen with order 7 + QR */}
      <div style={{position: 'absolute', left: -40, right: -40, top: 90, bottom: 150, background: 'linear-gradient(170deg, #F4E7DD, #E6E6EA)', transform: `translate(${drift}px, ${drift * 0.6}px) rotate(-3deg) scale(${1.05 - lock * 0.04})`, filter: 'saturate(0.9)'}}>
        <div style={{position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', color: '#333'}}>
          <div style={{fontSize: 20, fontWeight: 700}}>رقم طلب العميل</div>
          <div style={{fontSize: 110, fontWeight: 1000, lineHeight: 1, direction: 'ltr'}}>{DP_UI.orderNo}</div>
          <div style={{fontSize: 15, fontWeight: 600, marginTop: 6, padding: '0 60px'}}>اطلب من العميل مسح رمز QR بكاميرا هاتفه لفتح طلبه وتفعيل التنبيه.</div>
        </div>
        <div style={{position: 'absolute', left: '50%', top: 330, transform: 'translateX(-50%)', background: 'white', padding: 12, borderRadius: 12}}>
          <QrCodeSvg size={190} />
        </div>
      </div>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(90% 70% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
      {/* reticle around the QR */}
      <div style={{position: 'absolute', left: '50%', top: 520, width: box, height: box, transform: 'translate(-50%, -50%)', opacity: 1 - clip}}>
        {corner({top: 0, right: 0, borderTopWidth: 6, borderRightWidth: 6, borderTopRightRadius: 18})}
        {corner({top: 0, left: 0, borderTopWidth: 6, borderLeftWidth: 6, borderTopLeftRadius: 18})}
        {corner({bottom: 0, right: 0, borderBottomWidth: 6, borderRightWidth: 6, borderBottomRightRadius: 18})}
        {corner({bottom: 0, left: 0, borderBottomWidth: 6, borderLeftWidth: 6, borderBottomLeftRadius: 18})}
        {!locked ? <div style={{position: 'absolute', left: 10, right: 10, top: beam * box, height: 4, borderRadius: 4, background: c.orange, boxShadow: '0 0 20px 6px rgba(255,122,0,0.5)'}} /> : null}
      </div>
      {/* iOS QR link chip */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 690, display: 'flex', justifyContent: 'center', opacity: lock * (1 - clip), transform: `scale(${0.8 + 0.2 * lock})`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr', background: '#FFD60A', color: '#1c1c1e', fontSize: 20, fontWeight: 800, padding: '8px 18px', borderRadius: 999}}>
          <span>⌘</span> {DP_UI.qrChip}
        </div>
      </div>
      {/* camera shutter row */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{width: 76, height: 76, borderRadius: 38, border: '5px solid white', boxSizing: 'border-box'}}><div style={{margin: 5, width: 56, height: 56, borderRadius: 28, background: 'white'}} /></div>
      </div>
      {/* App Clip card */}
      {frame >= clipAt ? (
        <div style={{position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: 38, overflow: 'hidden', background: '#1c1c1e', transform: `translateY(${(1 - clip) * 520}px)`, boxShadow: '0 -20px 50px rgba(0,0,0,0.5)'}}>
          <div style={{position: 'relative', height: 250, background: 'radial-gradient(120% 100% at 30% 30%, #F7C38A, #C9672A 60%, #6E2C12 100%)', overflow: 'hidden'}}>
            <Img src={staticFile(ASSETS.mascot['plates-cloche'])} style={{position: 'absolute', left: 6, bottom: -20, height: 250}} />
            <div style={{position: 'absolute', right: 18, top: 40, width: 150, height: 150, background: 'white', borderRadius: 26, padding: 6}}>
              <Img src={staticFile(ASSETS.logo)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
            </div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px 22px', color: 'white'}}>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 24, fontWeight: 900, whiteSpace: 'nowrap'}}>{DP_UI.appClipTitle}</div>
              <div style={{fontSize: 17, fontWeight: 600, opacity: 0.7}}>{DP_UI.appClipSub}</div>
            </div>
            <div style={{padding: '10px 26px', borderRadius: 999, background: '#0A84FF', fontSize: 22, fontWeight: 900, transform: `scale(${openPress})`}}>{DP_UI.appClipOpen}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ── Customer waiting page (rebuilt from the founder's screenshot) ───────────
// Logo, merchant card, "رقم طلبك" 7 in brand red, "قيد التحضير" pill and the
// real lock-screen hint. The app-download / loyalty button is left out on purpose.
export const WaitingPage7: React.FC<{start: number}> = ({start}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - start, fps, config: {damping: 16}});
  const num = spring({frame: frame - start - 8, fps, config: {damping: 10, stiffness: 120}});
  const bar = ((frame - start) % 60) / 60;
  return (
    <div dir="rtl" style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #FFF6F1 0%, #F7EEF0 60%, #F2EEF2 100%)', fontFamily: BRAND.font, opacity: interpolate(enter, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'})}}>
      <div style={{paddingTop: 62, display: 'flex', justifyContent: 'center'}}>
        <Img src={staticFile(ASSETS.logo)} style={{width: 120, height: 120, objectFit: 'contain', mixBlendMode: 'multiply'}} />
      </div>
      <div style={{margin: '4px 18px 0', background: 'rgba(255,255,255,0.8)', borderRadius: 30, padding: '20px 20px 24px', boxShadow: '0 14px 34px rgba(120,40,20,0.08)', transform: `translateY(${(1 - enter) * 40}px)`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <div style={{width: 62, height: 62, borderRadius: 31, background: '#F6C21C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32}}>🍔</div>
          <div>
            <div style={{fontSize: 24, fontWeight: 900, color: '#1f1f1f'}}>{DP_UI.merchantName}</div>
            <div style={{fontSize: 16, fontWeight: 600, color: '#777'}}>{DP_UI.merchantTagline}</div>
          </div>
        </div>
        <div style={{marginTop: 18, textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#666'}}>{DP_UI.yourOrder}</div>
        <div style={{textAlign: 'center', fontSize: 190, fontWeight: 1000, lineHeight: 1.05, color: '#D9431A', direction: 'ltr', transform: `scale(${interpolate(num, [0, 1], [0.6, 1])})`}}>{DP_UI.orderNo}</div>
        <div style={{display: 'flex', justifyContent: 'center', marginTop: 6}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '8px 22px', borderRadius: 999, background: '#F1ECEC', fontSize: 22, fontWeight: 900, color: '#333'}}>
            <span style={{display: 'inline-block', transform: `rotate(${frame * 6}deg)`}}>◷</span> {DP_UI.preparing}
          </div>
        </div>
        <div style={{marginTop: 18, fontSize: 16, fontWeight: 600, color: '#555', lineHeight: 1.7, textAlign: 'center'}}>{DP_UI.lockHint}</div>
        <div style={{marginTop: 12, height: 5, borderRadius: 3, background: '#F0E2DD', overflow: 'hidden', direction: 'ltr'}}>
          <div style={{marginLeft: `${bar * 100 - 30}%`, width: '30%', height: '100%', borderRadius: 3, background: '#E2521F'}} />
        </div>
      </div>
    </div>
  );
};

// ── iPhone lock screen with the Pager Go order card (hero) ──────────────────
// Rebuilt from the founder's lock-screen recording: mascot | merchant + order 7 |
// app icon + status pill. At `readyAt` the pill flips to "جاهز ✓" and the
// "طلبك جاهز" notification slides in underneath.
export const LockScreen: React.FC<{readyAt?: number; cardIn?: number}> = ({readyAt, cardIn = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ready = readyAt !== undefined && frame >= readyAt;
  const card = spring({frame: frame - cardIn, fps, config: {damping: 15}});
  const flip = readyAt === undefined ? 0 : spring({frame: frame - readyAt, fps, config: {damping: 11, stiffness: 150}});
  const notif = readyAt === undefined ? 0 : spring({frame: frame - readyAt - 8, fps, config: {damping: 14}});
  return (
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(90% 60% at 80% 60%, #5b5650 0%, #2a2724 45%, #0e0d0c 100%)', fontFamily: BRAND.font, color: 'white', overflow: 'hidden'}}>
      <div style={{position: 'absolute', right: -160, top: 260, width: 520, height: 900, borderRadius: '50%', background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.18), rgba(255,255,255,0) 60%)', transform: 'rotate(-20deg)'}} />
      <div dir="rtl" style={{position: 'absolute', top: 92, left: 0, right: 0, textAlign: 'center', fontSize: 24, fontWeight: 700, opacity: 0.85}}>{DP_UI.lockDate}</div>
      <div style={{position: 'absolute', top: 116, left: 0, right: 0, textAlign: 'center', fontSize: 136, fontWeight: 800, letterSpacing: -2, opacity: 0.9, fontFamily: '"SF Pro Rounded", "Cairo Variable", sans-serif'}}>{DP_UI.lockTime}</div>

      <div style={{position: 'absolute', left: 12, right: 12, bottom: ready ? 120 + 150 * notif : 120}}>
        {/* order card */}
        <div
          dir="rtl"
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 12,
            padding: 14,
            borderRadius: 30,
            background: 'rgba(20,20,22,0.78)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: ready ? `0 0 ${40 * (1 - flip) + 18}px rgba(52,199,89,0.5)` : '0 20px 40px rgba(0,0,0,0.4)',
            opacity: card,
            transform: `translateY(${(1 - card) * 120}px) scale(${ready ? 1 + 0.05 * Math.sin(flip * Math.PI) : 1})`,
          }}
        >
          <div style={{width: 92, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 8}}>
            <Img src={staticFile(ASSETS.mascot['closeup-bell'])} style={{height: 112, objectFit: 'contain'}} />
          </div>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{fontSize: 19, fontWeight: 800, opacity: 0.85}}>{DP_UI.merchantName}</div>
            <div style={{fontSize: 64, fontWeight: 1000, lineHeight: 1, direction: 'ltr'}}>{DP_UI.orderNo}</div>
            <div style={{fontSize: 16, fontWeight: 700, opacity: 0.7}}>{DP_UI.orderLabel}</div>
          </div>
          <div style={{width: 138, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8}}>
            <div style={{width: 52, height: 52, borderRadius: 13, background: 'white', padding: 3}}>
              <Img src={staticFile(ASSETS.logo)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
            </div>
            <div style={{position: 'relative', width: '100%', height: 40}}>
              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, fontSize: 18, fontWeight: 900, background: 'rgba(255,149,0,0.22)', color: '#FFB340', opacity: ready ? 1 - flip : 1, transform: `translateY(${ready ? -16 * flip : 0}px)`, whiteSpace: 'nowrap'}}>
                <span style={{width: 16, height: 16, borderRadius: 8, background: '#FF9F0A', display: 'inline-block'}} />
                {DP_UI.preparing}
              </div>
              {ready ? (
                <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, fontSize: 21, fontWeight: 1000, background: 'rgba(52,199,89,0.25)', color: '#5BE07F', opacity: flip, transform: `translateY(${16 * (1 - flip)}px) scale(${0.85 + 0.15 * flip})`}}>
                  {DP_UI.ready} ✓
                </div>
              ) : null}
            </div>
            <div style={{fontSize: 13, fontWeight: 700, opacity: ready ? 0.75 * flip : 0, whiteSpace: 'nowrap'}}>{DP_UI.readySub}</div>
          </div>
        </div>
      </div>
      {/* notification */}
      {ready ? (
        <div dir="rtl" style={{position: 'absolute', left: 12, right: 12, bottom: 112, display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 26, background: 'rgba(40,40,44,0.82)', border: '1px solid rgba(255,255,255,0.10)', opacity: notif, transform: `translateY(${(1 - notif) * 60}px)`}}>
          <div style={{width: 52, height: 52, borderRadius: 13, background: 'white', padding: 3, flexShrink: 0}}>
            <Img src={staticFile(ASSETS.logo)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
          </div>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 19, fontWeight: 900}}>
              <span>{DP_UI.notifTitle} · {DP_UI.merchantName}</span>
              <span style={{fontSize: 14, fontWeight: 600, opacity: 0.6}}>{DP_UI.notifTime}</span>
            </div>
            <div style={{fontSize: 16, fontWeight: 600, opacity: 0.85, lineHeight: 1.45}}>{DP_UI.notifBody}</div>
          </div>
        </div>
      ) : null}
      {/* flashlight / camera buttons + home indicator */}
      <div style={{position: 'absolute', bottom: 40, left: 40, width: 56, height: 56, borderRadius: 28, background: 'rgba(255,255,255,0.15)'}} />
      <div style={{position: 'absolute', bottom: 40, right: 40, width: 56, height: 56, borderRadius: 28, background: 'rgba(255,255,255,0.15)'}} />
      <div style={{position: 'absolute', bottom: 14, left: '50%', width: 150, marginLeft: -75, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.8)'}} />
    </div>
  );
};

/** Small floating problem chips for the opening scene. */
export const ProblemChip: React.FC<{text: string; x: number; y: number; at: number}> = ({text, x, y, at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - at, fps, config: {damping: 12}});
  const wob = Math.sin(frame / 10 + random(text) * 6) * 4;
  return (
    <div dir="rtl" style={{position: 'absolute', left: x, top: y + wob, transform: `translate(-50%, -50%) scale(${p})`, opacity: p, fontFamily: BRAND.font}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '12px 26px', borderRadius: 999, background: 'rgba(255,70,50,0.16)', border: '2px solid rgba(255,90,60,0.6)', color: 'white', fontSize: 36, fontWeight: 900, whiteSpace: 'nowrap'}}>
        <span style={{color: '#ff6a4d'}}>✕</span>
        {text}
      </div>
    </div>
  );
};
