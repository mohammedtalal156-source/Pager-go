# Pager Go — "AI Menu" 30s ad

Composition `PagerGo-AiMenu` · 1080×1920 · 30 fps · 900 frames · final output `out/pagergo-ai-menu-30s.mp4`.
Source: `src/ai-menu/` (`config.ts` holds every timing, headline, VO line, UI label, colour and sound cue). Separate from the other ads; it shares only brand tokens, the logo, the music/SFX files, `Phone`, `BrandBackground`, `Captions` and the QR component.

The dashboard UI is rebuilt as animated React components from the founder's screenshots of merchant.pagergo.pro (29 Oct 2026): the "إنشاء المنيو من الصور" page, the "قائمة الطعام الإلكترونية" page with its 20 templates and colour options, and the "إضافة قسم" / "إضافة منتج" dialogs. No screenshot is used as an image.

## Storyboard

| Time | Frames | Scene | What happens |
|---|---|---|---|
| 0–4 s | 0–119 | Paper | Paper menu on a restaurant table; camera pushes in; a scan line turns it into a glowing digital menu (f64) |
| 4–9 s | 120–269 | Upload | Real AI page: tap اختيار صورة (f162), photo drops in (f190), tap إنشاء منيو إلكتروني (f214), AI scan, sections found (f258) |
| 9–14 s | 270–419 | Design | Menu builds item by item on a phone; 3D carousel of the 20 real templates lands on "6. طازج وطبيعي" (f352); colour أخضر نباتي → حمضي (f384) |
| 14–19 s | 420–569 | Manage | إضافة قسم "البرغر" (f470), إضافة منتج "برغر كلاسيك · 8,000" (f538), card appears in the preview |
| 19–24 s | 570–719 | Phone | 3D phone + table QR card; camera locks on the QR (f640), menu opens (f658) and scrolls |
| 24–30 s | 720–899 | Outro | Phone behind, official logo (f752), headline, sub-line, "ابدأ الآن" (tap f846), pagergo.pro |

Scenes cross-dissolve over 12 frames (`AM_XFADE`).

## Claims kept honest

- Only features visible in the screenshots are shown: upload 1–4 photos, AI menu creation, 20 templates, colour options, sections, products (photo, section, name, price IQD, description), preview, publish link and QR.
- The real AI page currently says "إنشاء واحد شهرياً" and, on the founder's account, "إنشاء المنيو غير متاح مؤقتاً". The ad shows the monthly line and a fine print: "يتطلب صورة واضحة للمنيو، ومراجعة النتيجة قبل النشر. حسب الاشتراك والتوفّر."
- Restaurant "بركر", its items and prices are demo data. The food pictures are vector drawings made in `art.tsx`, and the merchant badge is a drawn burger, not the restaurant's real logo.
- The QR encodes https://pagergo.pro (scannable); the card label shows `menu.pagergo.pro` only as the host name.

## Audio

Music bed and SFX are the project's own synthesised files (`scripts/generate_audio.py`), no third-party audio. Voiceover: female voice "Farah" (ElevenLabs, voice_id 4wf10lgibMnboGJGCLrP, paid plan), reading the MSA lines in `AM_VO` (the owner chose فصحى; the brief's Iraqi lines stay in `AM_VO_IRAQI`), one ElevenLabs v3 generation per line, converted to 48 kHz WAV in `public/vo/ai-menu/1-paper.wav … 6-outro.wav` (`AM_VO_FILES`). Each line starts 8 frames into its scene (line 1 at frame 6) and ends before the next cut; the music ducks while VO files are present.

## Commands

```bash
npm run preview:ai-menu   # 540x960 preview
npm run render:ai-menu    # final 1080x1920
node scripts/verify-output.mjs out/pagergo-ai-menu-30s.mp4
```
