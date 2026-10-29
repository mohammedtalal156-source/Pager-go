// ─────────────────────────────────────────────────────────────────────────────
// Pager Go — "AI Menu" commercial (paper menu photo → interactive e-menu).
// Separate from the other ads; shares only brand tokens and assets from ../config.
// No imports, so the tests can load it with plain Node. Every timing, text,
// colour and sound cue for this ad lives here.
// ─────────────────────────────────────────────────────────────────────────────

export const AM_VIDEO = {width: 1080, height: 1920, fps: 30, durationInFrames: 900} as const;

// 0–4 s, 4–9 s, 9–14 s, 14–19 s, 19–24 s, 24–30 s  →  120 + 150 + 150 + 150 + 150 + 180 = 900
export const AM_SCENES = [
  {id: 'paper', from: 0, duration: 120},
  {id: 'upload', from: 120, duration: 150},
  {id: 'design', from: 270, duration: 150},
  {id: 'manage', from: 420, duration: 150},
  {id: 'phone', from: 570, duration: 150},
  {id: 'outro', from: 720, duration: 180},
] as const;

export type AmSceneId = (typeof AM_SCENES)[number]['id'];

/** Frames each scene keeps running past its cut while the next one cross-dissolves in. */
export const AM_XFADE = 12;

/** On-screen headline per scene (from the brief). */
export const AM_HEADLINES: Record<AmSceneId, string> = {
  paper: 'منيو مطعمك بعده ورقي؟',
  upload: 'ارفع صورة المنيو… وخلي الذكاء الاصطناعي يشتغل!',
  design: 'تصاميم متعددة… على ذوق مطعمك',
  manage: 'أضف وعدّل منتجاتك بسهولة',
  phone: 'زبائنك يتصفحون المنيو بدون تحميل تطبيق',
  outro: 'حوّل منيو مطعمك إلى تجربة رقمية ذكية',
};

/** Voiceover script, one line per scene: Iraqi dialect from the brief, read by "Farah" on eleven_v4 with no audio tags (same voice and style as the Digital Pager ad). */
export const AM_VO: Record<AmSceneId, string> = {
  paper: 'بعدك تستخدم منيو ورقي بمطعمك؟',
  upload: 'بس ارفع صورة المنيو، وخلّي بيجر گو يحوّلها إلك!',
  design: 'واختار التصميم والألوان اللي تناسب هوية مطعمك.',
  manage: 'وتكدر تضيف أقسامك ووجباتك وأسعارك بكل سهولة.',
  phone: 'وزبونك يفتح المنيو مباشرة من موبايله!',
  outro: 'طوّر منيو مطعمك اليوم، ويا بيجر گو!',
};

/** Recorded voiceover, one file per scene in /public. Missing files are skipped; with any present the music ducks. */
export const AM_VO_FILES: Record<AmSceneId, string> = {
  paper: 'vo/ai-menu/1-paper.wav',
  upload: 'vo/ai-menu/2-upload.wav',
  design: 'vo/ai-menu/3-design.wav',
  manage: 'vo/ai-menu/4-manage.wav',
  phone: 'vo/ai-menu/5-phone.wav',
  outro: 'vo/ai-menu/6-outro.wav',
};

/** Absolute VO start frame per line where it differs from scene start + 8. */
export const AM_VO_START: Partial<Record<AmSceneId, number>> = {paper: 6};

/**
 * Labels copied from the founder's screenshots of merchant.pagergo.pro
 * (2026-10-29): "إنشاء المنيو من الصور" page and "قائمة الطعام الإلكترونية" page.
 */
export const AM_UI = {
  url: 'merchant.pagergo.pro/dashboard',
  // AI page
  aiPageTitle: 'إنشاء المنيو من الصور',
  aiHero: 'من الورق إلى منيو تفاعلي',
  aiHeroSub: 'ارفع 1–4 صور واضحة، أنشئ المنيو ثم راجعه وانشره.',
  aiPhotosLabel: 'صور المنيو',
  pickPhoto: 'اختيار صورة',
  createMenu: 'إنشاء منيو إلكتروني',
  aiModel: 'Pager Go AI Model',
  aiQuota: 'إنشاء واحد شهرياً، مع محاولة ثانية إذا فشلت الأولى.',
  aiWorking: 'جاري قراءة المنيو…',
  aiFound: 'تم استخراج الأقسام والمنتجات',
  // Menu page
  menuTitle: 'قائمة الطعام الإلكترونية',
  menuSub: 'اختر تصميماً، رتّب أقسامك ومنتجاتك، وانشر الرابط ورمز QR.',
  publish: 'انشر قائمة الطعام',
  unpublished: 'غير منشور',
  published: 'منشور',
  aiBar: 'Pager Go AI Model — إنشاء المنيو من الصور',
  design: 'التصميم',
  colorsLabel: 'الألوان:',
  saveDesign: 'احفظ التصميم',
  products: 'المنتجات',
  addSection: 'إضافة قسم',
  addProduct: 'إضافة منتج',
  sectionName: 'اسم القسم',
  section: 'القسم',
  noSection: 'بلا قسم',
  pickProductPhoto: 'اختيار صورة المنتج',
  productName: 'اسم المنتج',
  price: 'السعر (IQD)',
  description: 'الوصف (اختياري)',
  save: 'حفظ',
  cancel: 'إلغاء',
  preview: 'معاينة',
  previewBanner: 'معاينة: هذا ما سيراه الزبائن بعد النشر',
  sidebar: ['الطلبات', 'قائمة الطعام', 'نقاط الولاء', 'الاشتراك', 'التقارير', 'الموظفون', 'الإعدادات'],
  // 20 templates exactly as listed on the menu page
  templates: [
    {name: 'قائمة كلاسيكية', desc: 'صفوف أسماء وأسعار مثل القائمة الورقية الأنيقة.'},
    {name: 'استوديو الصور', desc: 'شبكة بطاقات تبدأ بالصورة للمطاعم ذات الصور الجميلة.'},
    {name: 'الضيافة الليلية', desc: 'غلاف واسع ومقاطع هادئة بإيقاع فاخر.'},
    {name: 'المقهى الدافئ', desc: 'بطاقات أفقية ناعمة بملمس ورقي دافئ.'},
    {name: 'سريع وجريء', desc: 'عناوين ثقيلة وأشكال هندسية وأسعار كبيرة.'},
    {name: 'طازج وطبيعي', desc: 'مساحات بيضاء وصور دائرية بتكوين مفتوح.'},
    {name: 'حكاية المطبخ', desc: 'شرائط عناوين وإطارات مستوحاة من صفحات الوصفات.'},
    {name: 'مجلة الطعام', desc: 'كتل تحريرية متفاوتة الأحجام بنمط ثابت.'},
    {name: 'زجاج عصري', desc: 'لوحات شبه شفافة فوق تدرجات هادئة.'},
    {name: 'دليل سريع', desc: 'بحث وصفوف مدمجة تتوسع للتفاصيل؛ للقوائم الطويلة.'},
    {name: 'أتيليه', desc: 'تحرير فاخر وصور بأحجام متناوبة.'},
    {name: 'كثبان', desc: 'أقواس ناعمة وألوان الرمال الدافئة.'},
    {name: 'حديقة', desc: 'تكوين نباتي هادئ وصور مستديرة.'},
    {name: 'كيوتو', desc: 'خطوط دقيقة ومساحات يابانية هادئة.'},
    {name: 'تراس', desc: 'بلاطات متوسطة وأزرق منعش.'},
    {name: 'مخمل', desc: 'خلفية ليلية ولمسات وردية مترفة.'},
    {name: 'بوب', desc: 'بطاقات مرحة وأرقام وأسعار جريئة.'},
    {name: 'ساحل', desc: 'أفق بحري وصور بانورامية واسعة.'},
    {name: 'مونوليث', desc: 'تباين معماري وبطاقات كبيرة هندسية.'},
    {name: 'سوربيه', desc: 'ألوان فواكه ناعمة وبطاقات متداخلة.'},
  ],
  /** Index (0-based) of the template the carousel lands on: "6. طازج وطبيعي". */
  pickedTemplate: 5,
  /** The two colour options shown for that template. */
  colorways: [
    {name: 'أخضر نباتي', accent: '#2F6B3A', soft: '#E7F1E4', ink: '#1F3A24'},
    {name: 'حمضي', accent: '#E0861A', soft: '#FDF0DC', ink: '#5A3307'},
  ],
} as const;

/**
 * Demo restaurant data. Merchant name spelled as in the screenshots (بركر, Burger Box).
 * Items and prices are illustrative, not the restaurant's real menu.
 */
export const AM_DEMO = {
  merchant: 'بركر',
  currency: 'د.ع',
  sections: [
    {
      name: 'البرغر',
      items: [
        {name: 'برغر كلاسيك', price: '8,000', desc: 'لحم مشوي مع الجبن والخضار الطازجة', art: 'burger'},
        {name: 'برغر دجاج', price: '7,000', desc: 'صدر دجاج مقرمش مع الخس والصوص', art: 'chicken'},
      ],
    },
    {name: 'المقبلات', items: [{name: 'بطاطا', price: '2,000', desc: 'بطاطا مقلية ذهبية', art: 'fries'}]},
    {name: 'المشروبات', items: [{name: 'عصير برتقال', price: '1,500', desc: 'برتقال طازج', art: 'juice'}]},
  ],
  /** Product added on screen in scene 4 (from the brief). */
  newSection: 'البرغر',
  newProduct: {name: 'برغر كلاسيك', price: '8,000', desc: 'لحم مشوي مع الجبن والخضار الطازجة'},
  menuHost: 'menu.pagergo.pro',
  /** Fine print shown on scene 2 so the ad does not oversell the AI feature. */
  aiFinePrint: 'يتطلب صورة واضحة للمنيو، ومراجعة النتيجة قبل النشر. حسب الاشتراك والتوفّر.',
} as const;

export const AM_OUTRO = {
  headline: 'حوّل منيو مطعمك إلى تجربة رقمية ذكية',
  sub: 'المنيو الإلكتروني بالذكاء الاصطناعي من بيجر گو',
  cta: 'ابدأ الآن',
} as const;

/** Key moments (absolute frames) that sound must line up with; used by the scenes and the tests. */
export const AM_SYNC = {
  paperToDigital: 64, // scan line starts turning the paper menu digital
  pickPhoto: 162, //     cursor taps اختيار صورة
  photoDrop: 190, //     menu photo lands in the upload area
  createTap: 214, //     cursor taps إنشاء منيو إلكتروني
  aiDone: 258, //        AI found sections and products
  templatePick: 352, //  carousel lands on طازج وطبيعي
  colorSwap: 384, //     colour switches to حمضي
  sectionSave: 470, //   section "البرغر" saved
  productSave: 538, //   product saved
  qrScan: 640, //        phone locks onto QR
  menuOpen: 658, //      menu opens on the phone
  logo: 752,
  ctaTap: 846,
} as const;

/** Absolute-frame sound cues. */
export const AM_SFX: {frame: number; sfx: 'whoosh' | 'pop' | 'scan' | 'tap' | 'ready' | 'logo'; volume: number}[] = [
  {frame: 64, sfx: 'scan', volume: 0.5},
  {frame: 112, sfx: 'whoosh', volume: 0.4},
  {frame: 162, sfx: 'tap', volume: 0.55},
  {frame: 190, sfx: 'pop', volume: 0.45},
  {frame: 214, sfx: 'tap', volume: 0.55},
  {frame: 222, sfx: 'scan', volume: 0.45},
  {frame: 258, sfx: 'ready', volume: 0.5},
  {frame: 264, sfx: 'whoosh', volume: 0.4},
  {frame: 290, sfx: 'pop', volume: 0.3},
  {frame: 300, sfx: 'pop', volume: 0.3},
  {frame: 310, sfx: 'pop', volume: 0.3},
  {frame: 352, sfx: 'tap', volume: 0.5},
  {frame: 384, sfx: 'tap', volume: 0.5},
  {frame: 414, sfx: 'whoosh', volume: 0.4},
  {frame: 470, sfx: 'tap', volume: 0.5},
  {frame: 538, sfx: 'tap', volume: 0.5},
  {frame: 546, sfx: 'pop', volume: 0.45},
  {frame: 564, sfx: 'whoosh', volume: 0.4},
  {frame: 640, sfx: 'scan', volume: 0.5},
  {frame: 658, sfx: 'ready', volume: 0.45},
  {frame: 714, sfx: 'whoosh', volume: 0.4},
  {frame: 752, sfx: 'logo', volume: 0.6},
  {frame: 846, sfx: 'tap', volume: 0.55},
];
