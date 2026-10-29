# Pager Go — "Loyalty program" 30s ad

Composition `PagerGo-Loyalty` · 1080×1920 · 30 fps · 900 frames · final output `out/pagergo-loyalty-30s.mp4`.
Source: `src/loyalty/` (`config.ts` holds every timing, headline, VO line, UI label, demo value and sound cue). Separate from the other ads; it shares only brand tokens, the logo, the mascot cut-outs, the music/SFX files, `Phone`, `BrandBackground`, `Captions`, `MascotLayer`, and the cursor from the AI-menu ad.

The UI is rebuilt as animated React components from the founder's screenshots (29 Oct 2026): the customer's "بطاقة ولائي" on iPhone (card list, ring with 4 and 8 points, rewards row, history), the "استبدال «فنكر مجاني»" and code sheets, the cashier's "رمز نقاط الولاء من 6 أرقام" dialog with "سلّم المكافأة", and the merchant "نقاط الولاء" page (overview, settings, rewards, add-reward dialog, customers, moves). No screenshot is used as an image. The restaurant's own logo (Burger Box) is cropped from the card screenshot into `public/loyalty/merchant-logo.png`.

## Storyboard

| Time | Frames | Scene | What happens |
|---|---|---|---|
| 0–4 s | 0–119 | Problem | Cartoon burger restaurant "بركر" at dusk; customer walks out with the bag (f14); camera pushes to the door and holds (f92); mascot (thinking) |
| 4–8 s | 120–239 | Earn | 3D phone turns in on the loyalty card; "تم استلام الطلب" (f150); four stars fly into the ring, 0 → 4 (f196); chip "نقاطك تنضاف تلقائياً بعد استلام الطلب." |
| 8–13 s | 240–389 | Return | Same customer walks back into the shop, camera dives through the door; order 2 picked up (f306); 4 → 8, ring completes green (f352); burst; mascot thumbs-up; reward row appears |
| 13–18 s | 390–539 | Redeem | Tap استبدل (f410) → confirm sheet → طلّع الكود (f438) → fake code 123 456 tagged "رمز تجريبي" (f444); camera moves to the cashier (f468); code typed, تحقق (f500), reward found, سلّم المكافأة (f522), delivered |
| 18–24 s | 540–719 | Dashboard | نقاط الولاء page: switch on (f556), 4 points per order saved (f584), المكافآت tab, إضافة مكافأة "فنكر مجاني · 8" saved (f652), العملاء, الحركات, نظرة عامة stats count up |
| 24–30 s | 720–899 | Outro | Restaurant behind, phone with the card and a floating "فنكر مجاني" card with sparkles; camera pulls back; official logo (f772), headline, sub-line, "فعّل برنامج الولاء لمطعمك" (tap f862), pagergo.pro |

Scenes cross-dissolve over 12 frames (`LY_XFADE`).

## Claims and data kept honest

- Points are added only after the order is picked up (toast first, then stars), and the reward is handed over only after the cashier verifies the code. The tests enforce this order.
- 4 points per order and "فنكر مجاني" for 8 points are the settings in the screenshots; scene 2 carries the fine print "مثال توضيحي: كل مطعم يحدد عدد النقاط والمكافآت." and scene 5 shows the owner setting both.
- The redeem code is the made-up `123456` labelled "رمز تجريبي"; the real code from the screenshots never appears. No account username, email or URL slug is shown.
- The real dashboard shows zeros; the ad starts from zeros and the numbers that count up later (3 members, 24 added, 8 redeemed, 16 balance, 6 orders), the customers ("زبون تجريبي ١…٣") and the moves are sample data, each labelled "بيانات تجريبية".
- The restaurant, the customer and the chicken-fingers drawing are cartoon art made in `screens.tsx`; the mascot images are the official cut-outs, never mirrored.

## Audio

Music bed and SFX are the project's own synthesised files (`scripts/generate_audio.py`). Voiceover: female voice "Farah" (ElevenLabs, voice_id 4wf10lgibMnboGJGCLrP, paid Starter plan, commercial use), reading the brief's Iraqi lines in `LY_VO` on model eleven_v4 with plain text and no audio tags (same voice and style as the other ads). Silence trimmed, converted to 48 kHz WAV in `public/vo/loyalty/1-problem.wav … 6-outro.wav`; start frames in `LY_VO_START`. The brief asked for a young male Iraqi voice; Farah is used to match the approved ads and can be swapped by replacing the six WAVs.

## Commands

```bash
npm run preview:loyalty   # 540x960 preview
npm run render:loyalty    # final 1080x1920
node scripts/verify-output.mjs out/pagergo-loyalty-30s.mp4
```
