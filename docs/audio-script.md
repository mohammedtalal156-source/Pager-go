# Pager Go — audio script and timings

Narrator: off-screen, warm and friendly, medium pace. The mascot never speaks.
Each line starts 8 frames (≈0.27 s) after its scene starts (`VO_OFFSET` in `src/config.ts`) and must finish before the next scene. Target length is in the last column.

## Iraqi Arabic (PagerGo-Iraqi)

| Scene | Starts | Window | Line | Target |
|---|---|---|---|---|
| 1 POS | 0.27 s | 0–5 s | من يستلم مطعمك الطلب… بيجر گو يرتّب الانتظار! | ≤ 4.3 s |
| 2 QR | 5.27 s | 5–11 s | الزبون يمسح QR ويتابع طلبه، بدون ما ينزّل تطبيق! | ≤ 5.3 s |
| 3 Loyalty | 11.27 s | 11–17 s | ومع نقاط الولاء، تخلي زبائنك يتحمسون يرجعون! | ≤ 5.3 s |
| 4 AI menu | 17.27 s | 17–24 s | وصورة منيوك؟ الذكاء الاصطناعي يحوّلها لمنيو إلكتروني! | ≤ 6.3 s |
| 5 Outro | 24.27 s | 24–30 s | بيجر گو… تجربة أذكى لمطعمك. اشترك الآن على pagergo.pro | ≤ 5.2 s |

## Modern Standard Arabic (PagerGo-MSA)

| Scene | Starts | Window | Line | Target |
|---|---|---|---|---|
| 1 POS | 0.27 s | 0–5 s | مع كل طلب جديد، ينظّم بيجر گو انتظار زبائنك. | ≤ 4.3 s |
| 2 QR | 5.27 s | 5–11 s | يمسح الزبون رمز QR ويتابع طلبه دون تحميل تطبيق. | ≤ 5.3 s |
| 3 Loyalty | 11.27 s | 11–17 s | ومع نقاط الولاء، شجّع زبائنك على العودة. | ≤ 5.3 s |
| 4 AI menu | 17.27 s | 17–24 s | وصورة قائمة الطعام تتحوّل بالذكاء الاصطناعي إلى قائمة رقمية. | ≤ 6.3 s |
| 5 Outro | 24.27 s | 24–30 s | بيجر گو… تجربة أذكى لمطعمك. اشترك الآن عبر pagergo.pro. | ≤ 5.2 s |

Pronunciation notes: "بيجر گو" = *pay-jer go* (hard g). "QR" read as *كيو آر*. "pagergo.pro" read as *بيجر گو دوت برو*.

## Delivering the recorded voiceover

Record one WAV per line (48 kHz, mono or stereo, peaks around −3 dBFS, no music) and name them:

```
public/vo/iraqi/1-pos.wav  2-qr.wav  3-loyalty.wav  4-ai-menu.wav  5-outro.wav
public/vo/msa/1-pos.wav    2-qr.wav  3-loyalty.wav  4-ai-menu.wav  5-outro.wav
```

The composition detects them automatically, places each at its scene start + 8 frames, and ducks the music from 0.55 to 0.22. Then re-render.

## Music and SFX

All music and SFX in `public/audio/` were synthesised from scratch by `scripts/generate_audio.py` (oscillators and noise, no samples), so there is no third-party licence to clear. Music: 112 BPM, A minor → F → C → G, pad and bass from 0 s, plucks and drums enter at 5 s, snare lift at 17 s, fade out over the last 1.2 s.

| Frame | Time | Sound |
|---|---|---|
| 38 | 1.27 s | tap (pay) |
| 62 | 2.07 s | pop (ticket) |
| 78 | 2.60 s | whoosh (ticket lifts) |
| 142 | 4.73 s | whoosh (cut) |
| 200 | 6.67 s | scan beep (QR lock) |
| 272 | 9.07 s | ready chime + buzz |
| 322 | 10.73 s | whoosh (cut) |
| 392 / 402 / 412 | 13.1–13.7 s | pops (points) |
| 502 | 16.73 s | whoosh (cut) |
| 572 | 19.07 s | scan (AI) |
| 612 / 624 / 636 | 20.4–21.2 s | pops (menu cards) |
| 712 | 23.73 s | whoosh (cut) |
| 742 | 24.73 s | logo hit |
| 806 | 26.87 s | tap (CTA) |
