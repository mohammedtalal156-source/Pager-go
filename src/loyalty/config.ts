// ─────────────────────────────────────────────────────────────────────────────
// Pager Go — "Loyalty program" commercial (earn points on pickup → redeem a reward).
// Separate from the other ads; shares only brand tokens and assets from ../config.
// No imports, so the tests can load it with plain Node. Every timing, text,
// colour and sound cue for this ad lives here.
// ─────────────────────────────────────────────────────────────────────────────

export const LY_VIDEO = {width: 1080, height: 1920, fps: 30, durationInFrames: 900} as const;

// 0–4 s, 4–8 s, 8–13 s, 13–18 s, 18–24 s, 24–30 s  →  120 + 120 + 150 + 150 + 180 + 180 = 900
export const LY_SCENES = [
  {id: 'problem', from: 0, duration: 120},
  {id: 'earn', from: 120, duration: 120},
  {id: 'return', from: 240, duration: 150},
  {id: 'redeem', from: 390, duration: 150},
  {id: 'dashboard', from: 540, duration: 180},
  {id: 'outro', from: 720, duration: 180},
] as const;

export type LySceneId = (typeof LY_SCENES)[number]['id'];

/** Frames each scene keeps running past its cut while the next one cross-dissolves in. */
export const LY_XFADE = 12;

/** On-screen headline per scene (from the brief). */
export const LY_HEADLINES: Record<LySceneId, string> = {
  problem: 'زبونك يشتري… ويروح؟',
  earn: 'كل طلب… نقاط جديدة!',
  return: 'كل زيارة تقرّب زبونك للمكافأة',
  redeem: 'نقاطه تتحول إلى مكافآت!',
  dashboard: 'إنت تحدد النقاط والمكافآت',
  outro: 'خلّي زبائنك يرجعون إلك!',
};

/** Voiceover script from the brief (Iraqi dialect), read by "Farah" on eleven_v4 with plain text (same voice and style as the other ads). */
export const LY_VO: Record<LySceneId, string> = {
  problem: 'زبونك يشتري منك مرة… شلون تخليه يرجع؟',
  earn: 'ويا بيجر گو، كل طلب يستلمه الزبون يجمعله نقاط!',
  return: 'وكل ما يرجع ويطلب، يقرب أكثر للمكافأة!',
  redeem: 'ويستبدل نقاطه بمكافأة من مطعمك!',
  dashboard: 'وإنت تتحكم بالنقاط والمكافآت، كلها من لوحة وحدة!',
  outro: 'خلّي زبائنك يرجعون إلك… ويا برنامج الولاء من بيجر گو!',
};

/** Recorded voiceover, one file per scene in /public. Missing files are skipped; with any present the music ducks. */
export const LY_VO_FILES: Record<LySceneId, string> = {
  problem: 'vo/loyalty/1-problem.wav',
  earn: 'vo/loyalty/2-earn.wav',
  return: 'vo/loyalty/3-return.wav',
  redeem: 'vo/loyalty/4-redeem.wav',
  dashboard: 'vo/loyalty/5-dashboard.wav',
  outro: 'vo/loyalty/6-outro.wav',
};

/** Absolute VO start frame per line (lengths after trimming: 3.39, 4.02, 3.41, 2.68, 4.15, 4.63 s). */
export const LY_VO_START: Record<LySceneId, number> = {problem: 6, earn: 121, return: 250, redeem: 398, dashboard: 548, outro: 742};

/** Labels copied from the founder's screenshots (29 Oct 2026): customer loyalty card on iPhone and merchant.pagergo.pro. */
export const LY_UI = {
  // customer phone
  cardTitle: 'بطاقة ولائي',
  close: 'إغلاق',
  allRestaurants: 'كل مطاعمي',
  pointsUnit: 'نقطة',
  perOrder: '4 نقاط لكل طلب تستلمه',
  canRedeem: 'تكدر تستبدل «فنكر مجاني» هسه',
  visitBtn: 'نقاط زيارتي بدون طلب',
  rewardsTitle: 'المكافآت',
  historyTitle: 'السجل',
  order: 'طلب رقم',
  historyDate: '29 تشرين الأول',
  redeemBtn: 'استبدل',
  pickedUp: 'تم استلام الطلب',
  autoAdded: 'نقاطك تنضاف تلقائياً بعد استلام الطلب.',
  confirmTitle: 'استبدال «فنكر مجاني»',
  confirmBody: 'نحجز 8 نقاط من رصيدك (8) ونطلعلك كود تعرضه للكاشير. إذا ما استخدمته خلال 10 دقائق ترجع النقاط.',
  getCode: 'طلّع الكود',
  notNow: 'مو هسه',
  codeTitle: 'كود «فنكر مجاني»',
  codeBody: 'اعرض الكود للكاشير. يسلّمك المكافأة بعد ما يدخله.',
  codeValid: 'صالح 9:59',
  codeCancel: 'ألغِ الكود وارجع النقاط',
  // cashier
  cashierTitle: 'رمز نقاط الولاء من 6 أرقام',
  cashierBody: 'هذا الرمز خاص بنقاط الولاء والمكافآت فقط. لربط الطلب بالعميل استخدم QR الطلب أو رمز الانتظار.',
  verify: 'تحقق',
  rewardFound: 'مكافأة: فنكر مجاني',
  rewardFor: 'للعميل بطاقة الجهاز',
  handOver: 'سلّم المكافأة',
  cancel: 'إلغاء',
  delivered: 'تم تسليم المكافأة',
  ordersTitle: 'الطلبات',
  // dashboard
  url: 'merchant.pagergo.pro/dashboard',
  pageTitle: 'نقاط الولاء',
  pageSub: 'يجمع العميل النقاط عبر رمز QR الخاص بالطلب، ويستبدلها بالمكافآت التي تحددها.',
  tabs: ['نظرة عامة', 'المكافآت', 'العملاء', 'الحركات'],
  sidebar: ['الطلبات', 'قائمة الطعام', 'نقاط الولاء', 'الاشتراك', 'التقارير', 'الموظفون', 'الإعدادات'],
  stats: ['الأعضاء', 'النقاط المضافة', 'نقاط استُبدلت', 'رصيد العملاء', 'طلبات تتضمن نقاطاً'],
  settingsTitle: 'إعدادات البرنامج',
  settingsNow: 'الآن: 4 نقاط لكل طلب تستلمه',
  programOn: 'البرنامج مفعّل',
  programOff: 'عند إيقاف البرنامج، يحتفظ العملاء بنقاطهم دون اكتساب نقاط جديدة.',
  pointsField: 'نقاط لكل طلب مستلم',
  autoLine: 'تُربط بطاقة الجهاز بالطلب تلقائياً، وتُضاف النقاط عند التسليم.',
  save: 'حفظ',
  rewardsHint: 'يختار العميل المكافأة من هاتفه، ثم يعرض الرمز للكاشير.',
  addReward: 'إضافة مكافأة',
  noRewards: 'لا توجد مكافآت حتى الآن',
  rewardName: 'اسم المكافأة',
  rewardDesc: 'وصف (اختياري)',
  rewardPoints: 'النقاط المطلوبة',
  rewardAvailable: 'متاحة للعملاء',
  customersSearch: 'البحث بالأرقام الأخيرة من رقم الهاتف',
  sample: 'بيانات تجريبية',
} as const;

/**
 * Demo data. Merchant spelled as in the screenshots (بركر, Burger Box); 4 points per picked-up order
 * and "فنكر مجاني" for 8 points are the settings shown there. The redeem code is a made-up
 * placeholder, never the real code from the screenshots, and every dashboard number is sample data.
 */
export const LY_DEMO = {
  merchant: 'بركر',
  pointsPerOrder: 4,
  reward: {name: 'فنكر مجاني', points: 8},
  /** Clearly fake 6-digit code (not a valid code). */
  code: '123456',
  codeTag: 'رمز تجريبي',
  /** Sample overview numbers, labelled "بيانات تجريبية" on screen. Consistent: 24 added − 8 redeemed = 16 balance. */
  sampleStats: [3, 24, 8, 16, 6],
  sampleCustomers: [
    {name: 'زبون تجريبي ١', points: 8},
    {name: 'زبون تجريبي ٢', points: 4},
    {name: 'زبون تجريبي ٣', points: 4},
  ],
  sampleMoves: [
    {label: 'طلب رقم 2', delta: '+4'},
    {label: 'فنكر مجاني', delta: '−8'},
    {label: 'طلب رقم 1', delta: '+4'},
  ],
  /** Fine print shown in scene 2 so the example settings are not read as fixed rules. */
  finePrint: 'مثال توضيحي: كل مطعم يحدد عدد النقاط والمكافآت.',
} as const;

export const LY_OUTRO = {
  headline: 'خلّي زبائنك يرجعون إلك!',
  sub: 'برنامج الولاء من بيجر گو',
  cta: 'فعّل برنامج الولاء لمطعمك',
} as const;

/** Key moments (absolute frames) that sound must line up with; used by the scenes and the tests. */
export const LY_SYNC = {
  customerLeaves: 14, //  customer walks out with the bag
  doorHold: 92, //        camera stops on the door
  pickedUp1: 150, //      order 1 picked up
  points4: 196, //        4th star lands → 4 points
  walkIn: 246, //         same customer walks back in
  pickedUp2: 306, //      order 2 picked up
  points8: 352, //        4th star lands → 8 points, ring complete
  tapRedeem: 410, //      taps استبدل
  tapGetCode: 438, //     taps طلّع الكود
  codeShown: 444, //      fake code appears
  cashierIn: 468, //      camera moves to the cashier
  verify: 500, //         cashier taps تحقق
  handOver: 522, //       cashier taps سلّم المكافأة
  toggleOn: 556, //       program switched on
  pointsSave: 584, //     4 points per order saved
  tabRewards: 598,
  addReward: 610,
  rewardSave: 652, //     reward "فنكر مجاني · 8" saved
  tabCustomers: 666,
  tabMoves: 684,
  tabOverview: 700,
  logo: 772,
  ctaTap: 862,
} as const;

/** Absolute-frame sound cues. */
export const LY_SFX: {frame: number; sfx: 'whoosh' | 'pop' | 'scan' | 'tap' | 'ready' | 'logo'; volume: number}[] = [
  {frame: 14, sfx: 'pop', volume: 0.3},
  {frame: 92, sfx: 'whoosh', volume: 0.35},
  {frame: 114, sfx: 'whoosh', volume: 0.4},
  {frame: 150, sfx: 'ready', volume: 0.45},
  {frame: 178, sfx: 'pop', volume: 0.35},
  {frame: 184, sfx: 'pop', volume: 0.35},
  {frame: 190, sfx: 'pop', volume: 0.35},
  {frame: 196, sfx: 'pop', volume: 0.5},
  {frame: 236, sfx: 'whoosh', volume: 0.4},
  {frame: 246, sfx: 'whoosh', volume: 0.3},
  {frame: 306, sfx: 'ready', volume: 0.45},
  {frame: 334, sfx: 'pop', volume: 0.35},
  {frame: 340, sfx: 'pop', volume: 0.35},
  {frame: 346, sfx: 'pop', volume: 0.35},
  {frame: 352, sfx: 'logo', volume: 0.45},
  {frame: 384, sfx: 'whoosh', volume: 0.4},
  {frame: 410, sfx: 'tap', volume: 0.55},
  {frame: 438, sfx: 'tap', volume: 0.55},
  {frame: 444, sfx: 'pop', volume: 0.45},
  {frame: 468, sfx: 'whoosh', volume: 0.4},
  {frame: 500, sfx: 'tap', volume: 0.55},
  {frame: 504, sfx: 'scan', volume: 0.4},
  {frame: 522, sfx: 'tap', volume: 0.55},
  {frame: 526, sfx: 'ready', volume: 0.5},
  {frame: 534, sfx: 'whoosh', volume: 0.4},
  {frame: 556, sfx: 'tap', volume: 0.5},
  {frame: 584, sfx: 'tap', volume: 0.5},
  {frame: 598, sfx: 'tap', volume: 0.45},
  {frame: 610, sfx: 'tap', volume: 0.5},
  {frame: 652, sfx: 'tap', volume: 0.5},
  {frame: 656, sfx: 'pop', volume: 0.4},
  {frame: 666, sfx: 'tap', volume: 0.45},
  {frame: 684, sfx: 'tap', volume: 0.45},
  {frame: 700, sfx: 'tap', volume: 0.45},
  {frame: 714, sfx: 'whoosh', volume: 0.4},
  {frame: 772, sfx: 'logo', volume: 0.6},
  {frame: 862, sfx: 'tap', volume: 0.55},
];
