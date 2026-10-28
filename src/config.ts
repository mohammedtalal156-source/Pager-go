// ─────────────────────────────────────────────────────────────────────────────
// Pager Go | بيجر گو — central production config.
// Edit colours, copy, timings, asset paths, voiceover and URLs here only.
// This file has no imports so the test suite can load it with plain Node.
// ─────────────────────────────────────────────────────────────────────────────

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 900, // 30 s
} as const;

export const BRAND = {
  name: 'Pager Go',
  nameAr: 'بيجر گو',
  url: 'pagergo.pro',
  fullUrl: 'https://pagergo.pro',
  colors: {
    orange: '#FF7A00',
    orangeHot: '#FF4E1B',
    orangeSoft: '#FFB25B',
    navy: '#0A1230',
    navyMid: '#121D46',
    navyLight: '#1E2B63',
    white: '#FFFFFF',
    muted: '#9AA6CF',
    green: '#22C55E',
    greenSoft: '#86EFAC',
  },
  // Cairo (SIL OFL) is installed from npm (@fontsource-variable/cairo); no font files are shipped in this repo.
  font: '"Cairo Variable", "Noto Sans Arabic", sans-serif',
} as const;

export const orangeGradient = `linear-gradient(135deg, ${BRAND.colors.orangeSoft} 0%, ${BRAND.colors.orange} 45%, ${BRAND.colors.orangeHot} 100%)`;

/** Paths are relative to /public. */
export const ASSETS = {
  logo: 'brand/pagergo-logo.jpeg', // official logo supplied by the founder (512x512 JPEG on white)
  mascotSheet: 'brand/mascot-sheet-original.png', // official mascot sheet, untouched
  mascot: {
    'menu-bell': 'mascot/menu-bell.png',
    'thumbs-up': 'mascot/thumbs-up.png',
    'bench-menu': 'mascot/bench-menu.png',
    'bench-sit': 'mascot/bench-sit.png',
    'closeup-smile': 'mascot/closeup-smile.png',
    'plates-cloche': 'mascot/plates-cloche.png',
    juggling: 'mascot/juggling.png',
    phone: 'mascot/phone.png',
    thinking: 'mascot/thinking.png',
    'closeup-bell': 'mascot/closeup-bell.png',
  },
  music: 'audio/music-bed.wav',
  sfx: {
    whoosh: 'audio/sfx-whoosh.wav',
    pop: 'audio/sfx-pop.wav',
    scan: 'audio/sfx-scan.wav',
    tap: 'audio/sfx-tap.wav',
    ready: 'audio/sfx-ready.wav',
    logo: 'audio/sfx-logo.wav',
  },
} as const;

export type Pose = keyof typeof ASSETS.mascot;

/** Pixel size of each cut-out (used to keep aspect ratio). */
export const POSE_SIZE: Record<Pose, [number, number]> = {
  'menu-bell': [782, 692],
  'thumbs-up': [488, 688],
  'bench-menu': [654, 714],
  'bench-sit': [554, 648],
  'closeup-smile': [682, 878],
  'plates-cloche': [724, 754],
  juggling: [586, 806],
  phone: [646, 746],
  thinking: [492, 760],
  'closeup-bell': [682, 914],
};

// ── Timeline (frames). Contiguous, no gaps: 150 + 180 + 180 + 210 + 180 = 900.
export const SCENES = [
  {id: 'pos', from: 0, duration: 150}, //       0–149   0–5 s
  {id: 'qr', from: 150, duration: 180}, //     150–329   5–11 s
  {id: 'loyalty', from: 330, duration: 180}, // 330–509  11–17 s
  {id: 'aiMenu', from: 510, duration: 210}, //  510–719  17–24 s
  {id: 'outro', from: 720, duration: 180}, //   720–899  24–30 s
] as const;

export type SceneId = (typeof SCENES)[number]['id'];
export const TRANSITION_FRAMES = 16; // length of the orange wipe that straddles each cut

// ── Voiceover / captions. Off-screen narrator; the mascot never speaks.
export type Language = 'iraqi' | 'msa';

export const VOICEOVER: Record<Language, Record<SceneId, string>> = {
  iraqi: {
    pos: 'من يستلم مطعمك الطلب… بيجر گو يرتّب الانتظار!',
    qr: 'الزبون يمسح QR ويتابع طلبه، بدون ما ينزّل تطبيق!',
    loyalty: 'ومع نقاط الولاء، تخلي زبائنك يتحمسون يرجعون!',
    aiMenu: 'وصورة منيوك؟ الذكاء الاصطناعي يحوّلها لمنيو إلكتروني!',
    outro: 'بيجر گو… تجربة أذكى لمطعمك. اشترك الآن على pagergo.pro',
  },
  msa: {
    pos: 'مع كل طلب جديد، ينظّم بيجر گو انتظار زبائنك.',
    qr: 'يمسح الزبون رمز QR ويتابع طلبه دون تحميل تطبيق.',
    loyalty: 'ومع نقاط الولاء، شجّع زبائنك على العودة.',
    aiMenu: 'وصورة قائمة الطعام تتحوّل بالذكاء الاصطناعي إلى قائمة رقمية.',
    outro: 'بيجر گو… تجربة أذكى لمطعمك. اشترك الآن عبر pagergo.pro.',
  },
};

/**
 * Optional recorded voiceover per line (relative to /public). Drop the WAV/MP3 in
 * and it plays automatically; missing files are skipped and the music is not ducked.
 * `offset` = frames after the scene start where the line begins.
 */
export const VO_FILES: Record<Language, Record<SceneId, string>> = {
  iraqi: {pos: 'vo/iraqi/1-pos.wav', qr: 'vo/iraqi/2-qr.wav', loyalty: 'vo/iraqi/3-loyalty.wav', aiMenu: 'vo/iraqi/4-ai-menu.wav', outro: 'vo/iraqi/5-outro.wav'},
  msa: {pos: 'vo/msa/1-pos.wav', qr: 'vo/msa/2-qr.wav', loyalty: 'vo/msa/3-loyalty.wav', aiMenu: 'vo/msa/4-ai-menu.wav', outro: 'vo/msa/5-outro.wav'},
};
export const VO_OFFSET = 8;

// ── On-screen UI labels. Shared by both language versions (visuals are identical).
export const UI = {
  conceptualTag: 'واجهة توضيحية · Conceptual UI',
  pos: {
    title: 'الكاشير',
    newOrder: 'طلب جديد',
    items: [
      {name: 'شاورما عربي', qty: 2, price: '8,000'},
      {name: 'لبن', qty: 2, price: '2,000'},
      {name: 'بطاطا', qty: 1, price: '2,000'},
    ],
    total: 'المجموع',
    totalValue: '12,000 د.ع',
    paid: 'تم الدفع',
    synced: 'أُضيف تلقائياً إلى بيجر گو',
  },
  ticket: {
    label: 'رقم الانتظار',
    number: '247',
  },
  qr: {
    standLabel: 'امسح وتابع طلبك',
    noApp: 'بدون تطبيق',
  },
  waiting: {
    order: 'رقم طلبك',
    states: ['انتظار', 'جاهز', 'تم الاستلام'],
    waitingTitle: 'طلبك قيد الانتظار',
    readyTitle: 'طلبك جاهز!',
    readySub: 'تفضّل استلمه من الكاشير',
    staffUpdate: 'تم التحديث من لوحة الفرع',
  },
  loyalty: {
    title: 'نقاط الولاء',
    perOrderPoints: 10,
    pointsWord: 'نقاط',
    from: 120,
    to: 130,
    label: 'نقطة',
  },
  aiMenu: {
    photoLabel: 'صورة المنيو',
    aiLabel: 'AI',
    digitalTitle: 'المنيو الإلكتروني',
    paper: ['شوربة عدس ........ 2,000', 'تشريب لحم ........ 9,000', 'كباب ........ 8,000', 'دولمة ........ 7,000', 'شاي ........ 500'],
    cards: [
      {icon: '🍲', cat: 'شوربات', name: 'شوربة عدس', price: '2,000'},
      {icon: '🥘', cat: 'أطباق رئيسية', name: 'تشريب لحم', price: '9,000'},
      {icon: '🍢', cat: 'مشويات', name: 'كباب', price: '8,000'},
      {icon: '🫑', cat: 'أطباق رئيسية', name: 'دولمة', price: '7,000'},
      {icon: '🍵', cat: 'مشروبات', name: 'شاي', price: '500'},
      {icon: '🥙', cat: 'سندويچات', name: 'شاورما', price: '4,000'},
    ],
  },
  outro: {
    cta: 'اشترك الآن',
  },
} as const;

// ── Sound design cues, absolute frames.
export const SFX_CUES: {frame: number; sfx: keyof typeof ASSETS.sfx; volume: number}[] = [
  {frame: 38, sfx: 'tap', volume: 0.6},
  {frame: 62, sfx: 'pop', volume: 0.5},
  {frame: 78, sfx: 'whoosh', volume: 0.5},
  {frame: 142, sfx: 'whoosh', volume: 0.45},
  {frame: 200, sfx: 'scan', volume: 0.5},
  {frame: 272, sfx: 'ready', volume: 0.6},
  {frame: 322, sfx: 'whoosh', volume: 0.45},
  {frame: 392, sfx: 'pop', volume: 0.45},
  {frame: 402, sfx: 'pop', volume: 0.45},
  {frame: 412, sfx: 'pop', volume: 0.45},
  {frame: 502, sfx: 'whoosh', volume: 0.45},
  {frame: 572, sfx: 'scan', volume: 0.5},
  {frame: 612, sfx: 'pop', volume: 0.4},
  {frame: 624, sfx: 'pop', volume: 0.4},
  {frame: 636, sfx: 'pop', volume: 0.4},
  {frame: 712, sfx: 'whoosh', volume: 0.45},
  {frame: 742, sfx: 'logo', volume: 0.6},
  {frame: 806, sfx: 'tap', volume: 0.6},
];

export const MUSIC = {volume: 0.55, duckedVolume: 0.22};
