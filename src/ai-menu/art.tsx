import React from 'react';

// Flat vector food illustrations for the demo menu. Drawn here (not stock photos)
// so the ad carries no third-party image licence.
export type FoodKind = 'burger' | 'chicken' | 'fries' | 'juice';

const Burger: React.FC<{patty: string; cheese?: boolean}> = ({patty, cheese = true}) => (
  <>
    {/* bottom bun */}
    <path d="M18 66 Q18 78 30 78 L70 78 Q82 78 82 66 Z" fill="#D98A3A" />
    {/* patty */}
    <rect x="15" y="54" width="70" height="13" rx="6.5" fill={patty} />
    {/* cheese */}
    {cheese ? <path d="M16 54 L84 54 L76 61 L68 55 L58 62 L48 55 L38 62 L28 55 L20 60 Z" fill="#FFC531" /> : null}
    {/* lettuce */}
    <path d="M14 51 Q20 45 26 51 Q32 45 38 51 Q44 45 50 51 Q56 45 62 51 Q68 45 74 51 Q80 45 86 51 L86 54 L14 54 Z" fill="#5DBB46" />
    {/* tomato */}
    <rect x="20" y="46" width="60" height="6" rx="3" fill="#E5412D" />
    {/* top bun */}
    <path d="M16 46 Q16 18 50 18 Q84 18 84 46 Z" fill="#E89A45" />
    <path d="M22 40 Q24 24 44 21" stroke="#F6C27E" strokeWidth="3" fill="none" strokeLinecap="round" />
    {[
      [36, 28],
      [50, 25],
      [62, 31],
      [44, 35],
      [70, 38],
      [28, 37],
    ].map(([x, y], i) => (
      <ellipse key={i} cx={x} cy={y} rx="2.4" ry="1.4" fill="#FFF1D6" transform={`rotate(${i * 25} ${x} ${y})`} />
    ))}
  </>
);

const Fries: React.FC = () => (
  <>
    {[24, 31, 38, 45, 52, 59, 66, 73].map((x, i) => (
      <rect key={i} x={x} y={14 + (i % 3) * 6} width="6" height="46" rx="2" fill={i % 2 ? '#FFD34D' : '#F7BE2F'} transform={`rotate(${(i - 3.5) * 3} ${x} 60)`} />
    ))}
    <path d="M22 44 L78 44 L72 84 L28 84 Z" fill="#E5412D" />
    <path d="M22 44 L78 44 L76 52 L24 52 Z" fill="#C7311F" />
    <circle cx="50" cy="66" r="9" fill="#FFF" opacity="0.9" />
    <path d="M45 66 L50 61 L55 66 L50 71 Z" fill="#E5412D" />
  </>
);

const Juice: React.FC = () => (
  <>
    <rect x="56" y="8" width="5" height="40" rx="2" fill="#2F9D5C" transform="rotate(12 58 28)" />
    <path d="M30 26 L70 26 L65 86 L35 86 Z" fill="#FFFFFF" opacity="0.85" />
    <path d="M32 40 L68 40 L64.5 84 L35.5 84 Z" fill="#FF9A1F" />
    <path d="M36 44 L44 44 L41 80 L38 80 Z" fill="#FFC56B" opacity="0.8" />
    <circle cx="70" cy="28" r="10" fill="#FFB02E" />
    <circle cx="70" cy="28" r="6.5" fill="#FFD27A" />
  </>
);

export const FoodArt: React.FC<{kind: FoodKind; size: number; plate?: string; round?: boolean}> = ({kind, size, plate = '#FFF4E8', round = true}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{display: 'block'}}>
    {round ? <circle cx="50" cy="50" r="50" fill={plate} /> : <rect width="100" height="100" fill={plate} />}
    <g transform="translate(6 6) scale(0.88)">
      {kind === 'burger' ? <Burger patty="#6B3A1F" /> : null}
      {kind === 'chicken' ? <Burger patty="#D9932F" cheese={false} /> : null}
      {kind === 'fries' ? <Fries /> : null}
      {kind === 'juice' ? <Juice /> : null}
    </g>
  </svg>
);

/** Round merchant badge for the demo restaurant (a drawn burger, not the restaurant's real logo). */
export const MerchantBadge: React.FC<{size: number}> = ({size}) => (
  <div style={{width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #FFC94A, #F2A516)', boxShadow: '0 8px 20px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
    <FoodArt kind="burger" size={size * 0.78} plate="transparent" />
  </div>
);

/** Mouse pointer. (x, y) is the tip. */
export const Cursor: React.FC<{x: number; y: number; press?: boolean; scale?: number}> = ({x, y, press, scale = 1.5}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `scale(${(press ? 0.86 : 1) * scale})`, transformOrigin: '0 0', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))', zIndex: 50}}>
    <svg width="34" height="44" viewBox="0 0 34 44">
      <path d="M2 2 L2 36 L11 28 L17 42 L23 39 L17 26 L30 26 Z" fill="#fff" stroke="#111" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
    {press ? <div style={{position: 'absolute', left: -16, top: -16, width: 36, height: 36, borderRadius: 18, border: '3px solid rgba(255,122,0,0.85)'}} /> : null}
  </div>
);
