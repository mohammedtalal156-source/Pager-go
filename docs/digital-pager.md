# Pager Go — "Digital Pager" 30s ad (order 7)

Composition `PagerGo-DigitalPager` · 1080×1920 · 30 fps · 900 frames · output `out/pagergo-digital-pager-30s.mp4`.
Source: `src/digital-pager/` (`config.ts` holds every timing, caption, label and sound cue). Separate from the first ad; it shares only brand tokens and assets.

The UI is rebuilt as animated components from the founder's own screenshots of merchant.pagergo.pro (cashier mode) and the customer flow (camera QR scan, App Clip card, waiting page, lock-screen card). No screenshot is shown as a static image.

## Storyboard

| Time | Frames | Scene | What happens |
|---|---|---|---|
| 0–4 s | 0–119 | Problem | Old buzzing pagers; chips: يضيع · يتعطل · بطاريته تخلص |
| 4–9 s | 120–269 | Cashier | Tablet in cashier mode; tap "+ طلب جديد" → order 7 card + QR appear (f176) |
| 9–14 s | 270–419 | Scan | Phone camera locks on the QR (f342); App Clip card slides up (f372) and opens |
| 14–20 s | 420–599 | Preparing | Waiting page: merchant, رقم طلبك 7, قيد التحضير; phone locks (f556) → lock-screen card shows قيد التحضير |
| 20–26 s | 600–779 | Ready (hero) | Staff taps جاهز (f660); lock-screen card flips to جاهز ✓ and the notification arrives (f670); fine print on connectivity |
| 26–30 s | 780–899 | Outro | Mascot, logo (f796), CTA "جرّبه هسه", pagergo.pro |

## Captions (Iraqi Arabic, also the VO script)

| Scene | Text |
|---|---|
| Problem | البيجر القديم يضيع، يتعطل، وبطاريته تخلص… |
| Cashier | الكاشير يسوي الطلب، ويطلع رقم 7 وكود QR |
| Scan | الزبون يمسح الكود من موبايله، بدون تطبيق |
| Preparing | ويشوف طلبه قيد التحضير، خطوة بخطوة |
| Ready | الموظف يدوس جاهز… والزبون يعرف بنفس اللحظة! |
| Outro | بيجر گو… البيجر الرقمي لمطعمك. pagergo.pro |

## Voiceover

Female AI voice "Farah" (ElevenLabs Starter plan, commercial licence; chosen by the user). Source mp3s were trimmed of silence and converted to 48 kHz WAV in `public/vo/digital-pager/` (`DP_VO_FILES`). Line 1 is sped up 1.15x and starts at frame 4; line 6 is sped up 1.05x and starts at frame 752 (`DP_VO_START`) so both finish inside their windows. With any VO file present the music ducks from 0.55 to 0.22. The mascot stays silent.

Outputs: `out/pagergo-digital-pager-30s.mp4` (music and SFX only, rendered before the VO existed) and `out/pagergo-digital-pager-30s-vo.mp4` (with VO). `npm run render:digital-pager` now renders the VO version.

## Sound

Original synthesised music and SFX (same files as the first ad). Cues are listed in `DP_SFX`; the tests check that each key moment in `DP_SYNC` (order created, QR lock, App Clip, phone locks, staff tap, lock-screen ready, logo) has a cue on the same frame, and the scenes read the same `DP_SYNC` values for their animation.

## Claims kept out

- No loyalty points, AI menu or app-download button.
- Fine print on the hero scene: يتطلب اتصال بالإنترنت وتفعيل الإشعارات، ويختلف العرض حسب الجهاز. The ad does not claim every iPhone or offline notifications.
- The restaurant name "برگر" and its tagline are demo data from the screenshots.

## Commands

```bash
npm run preview:digital-pager   # 540x960 preview
npm run render:digital-pager    # final 1080x1920 with voiceover
npm run verify
```
