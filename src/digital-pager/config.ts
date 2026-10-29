// ─────────────────────────────────────────────────────────────────────────────
// Pager Go — "Digital Pager" commercial (order 7). Separate from the first ad;
// shares brand tokens and assets from ../config. No imports besides that file,
// so the tests can load it with plain Node.
// ─────────────────────────────────────────────────────────────────────────────

export const DP_VIDEO = {width: 1080, height: 1920, fps: 30, durationInFrames: 900} as const;

// 0–4 s, 4–9 s, 9–14 s, 14–20 s, 20–26 s, 26–30 s  →  120 + 150 + 150 + 180 + 180 + 120 = 900
export const DP_SCENES = [
  {id: 'problem', from: 0, duration: 120},
  {id: 'cashier', from: 120, duration: 150},
  {id: 'scan', from: 270, duration: 150},
  {id: 'preparing', from: 420, duration: 180},
  {id: 'ready', from: 600, duration: 180},
  {id: 'outro', from: 780, duration: 120},
] as const;

export type DpSceneId = (typeof DP_SCENES)[number]['id'];

/** Iraqi Arabic captions (also the VO script). */
export const DP_CAPTIONS: Record<DpSceneId, string> = {
  problem: 'البيجر القديم يضيع، يتعطل، وبطاريته تخلص…',
  cashier: 'الكاشير يسوي الطلب، ويطلع رقم 7 وكود QR',
  scan: 'الزبون يمسح الكود من موبايله، بدون تطبيق',
  preparing: 'ويشوف طلبه قيد التحضير، خطوة بخطوة',
  ready: 'الموظف يدوس جاهز… والزبون يعرف بنفس اللحظة!',
  outro: 'بيجر گو… البيجر الرقمي لمطعمك. pagergo.pro',
};

export const DP_UI = {
  orderNo: '7',
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  newOrder: 'طلب جديد',
  dashboardTitle: 'لوحة الطلبات',
  scanHint: 'امسح الكود لمتابعة طلبك',
  orderLabel: 'رقم الطلب',
  lockTime: '9:58',
  lockDate: 'الأربعاء 28 أكتوبر',
  // Customer-side copy as it appears in the founder's screen recordings.
  merchantName: 'برگر',
  merchantTagline: 'طلبك عندنا… وراحتك تهمنا',
  yourOrder: 'رقم طلبك',
  lockHint: 'يمكنك قفل الشاشة، يظهر الطلب على شاشة القفل وسيصلك التنبيه إذا كانت الإشعارات والصوت مفعّلين.',
  readySub: 'تفضّل لاستلام طلبك',
  notifTitle: 'طلبك جاهز ✓',
  notifBody: 'طلبك رقم 7 جاهز، يرجى استلامه من نقطة التسليم.',
  notifTime: 'الآن',
  appClipTitle: 'بيجر گو - Pager Go',
  appClipSub: 'تابع طلبك واعرف متى يصير جاهز',
  appClipOpen: 'فتح',
  qrChip: 'go.pagergo.pro',
  cta: 'جرّبه هسه',
  // Shown on the hero scene so the ad does not imply every phone or offline use.
  finePrint: 'يتطلب اتصال بالإنترنت وتفعيل الإشعارات، ويختلف العرض حسب الجهاز',
  oldPagerProblems: ['يضيع', 'يتعطل', 'بطاريته تخلص'],
} as const;

/** Absolute-frame sound cues. */
export const DP_SFX: {frame: number; sfx: 'whoosh' | 'pop' | 'scan' | 'tap' | 'ready' | 'logo'; volume: number}[] = [
  {frame: 20, sfx: 'pop', volume: 0.35},
  {frame: 112, sfx: 'whoosh', volume: 0.45},
  {frame: 168, sfx: 'tap', volume: 0.6},
  {frame: 176, sfx: 'pop', volume: 0.5},
  {frame: 262, sfx: 'whoosh', volume: 0.45},
  {frame: 342, sfx: 'scan', volume: 0.55},
  {frame: 372, sfx: 'whoosh', volume: 0.35},
  {frame: 398, sfx: 'tap', volume: 0.5},
  {frame: 412, sfx: 'whoosh', volume: 0.45},
  {frame: 556, sfx: 'tap', volume: 0.45},
  {frame: 592, sfx: 'whoosh', volume: 0.45},
  {frame: 660, sfx: 'tap', volume: 0.6},
  {frame: 670, sfx: 'ready', volume: 0.65},
  {frame: 772, sfx: 'whoosh', volume: 0.45},
  {frame: 796, sfx: 'logo', volume: 0.6},
  {frame: 852, sfx: 'tap', volume: 0.55},
];

/** Key moments (absolute frames) that sound must line up with; used by tests. */
export const DP_SYNC = {
  orderCreated: 176, // order 7 appears on the dashboard
  qrLocked: 342, //    phone locks onto the QR
  appClip: 372, //     App Clip card slides up
  phoneLocks: 556, //  customer locks the phone; card shows قيد التحضير
  staffTap: 660, //    staff taps جاهز
  lockReady: 670, //   lock-screen card switches to جاهز
  logo: 796,
} as const;

/** Recorded Iraqi voiceover, one file per scene in /public. Missing files are skipped; with any present the music ducks. */
export const DP_VO_FILES: Record<DpSceneId, string> = {
  problem: 'vo/digital-pager/1-problem.wav',
  cashier: 'vo/digital-pager/2-cashier.wav',
  scan: 'vo/digital-pager/3-scan.wav',
  preparing: 'vo/digital-pager/4-preparing.wav',
  ready: 'vo/digital-pager/5-ready.wav',
  outro: 'vo/digital-pager/6-outro.wav',
};

/** Absolute start frame per VO line where it differs from scene start + VO_OFFSET:
 * line 1 starts sooner and line 6 leads into the outro so both finish inside 30 s. */
export const DP_VO_START: Partial<Record<DpSceneId, number>> = {problem: 4, outro: 752};
