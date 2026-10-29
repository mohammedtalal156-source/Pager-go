# Placeholders, unverified behaviour and remaining requirements

## Placeholders and conceptual elements

- **Voiceover is not recorded.** No voice-generation service is connected and no recordings were supplied. Both MP4s carry burned-in captions, music and SFX only. Drop recordings into `public/vo/…` (see `audio-script.md`) and re-render.
- **Product UI is a conceptual mock-up.** The POS screen, waiting page, loyalty card and AI menu are designed from the founder's description, not from real screenshots or recordings. The on-screen label "واجهة توضيحية · Conceptual UI" was removed from both videos at the founder's request (2026-10-28), so the mock-up status is no longer shown on screen. Replace with real screenshots when available, and keep this in mind before publishing.
- **Demo data is invented:** waiting number 247, items and prices in IQD, +10 points per order, balance 120 → 130, menu items. Change them in `UI` in `src/config.ts`.
- **Music and SFX are original synthesised placeholders.** They are licence-free but simple. A licensed track from a stock library can replace `public/audio/music-bed.wav`.

## Brand assets

- **Logo:** the official 512×512 JPEG on white is used as supplied, never redrawn. Because its "Pager Go" wordmark is navy, it is shown on a white plate over the navy background. It is upscaled to about 500 px, so it is slightly soft. A vector (SVG/PDF) or a ≥2000 px transparent PNG would give a sharper end card.
- **Mascot:** the 10 poses are cut directly from the official sheet; only the white background was removed (`scripts/extract_mascot.py`). Each cell is only ~300–450 px tall, so they are upscaled 2×. Original high-resolution renders (or the 3D source file) would remove the slight softness and allow real limb animation instead of whole-pose motion.
- The uniform label "شيفك SOUP" is part of the official artwork and is kept. Poses are never mirrored, so the Arabic label never reverses.

## Founder-reported behaviour, not independently verified

Shown in the ad as described by the founder; nothing here was tested against the live product:

- Orders are added automatically from the POS (the ad names no specific POS brand; exact integrations must be confirmed per restaurant).
- Customer scans a QR beside the cashier or on the receipt and sees a waiting page with the order number and status, without installing an app.
- States انتظار → جاهز → تم الاستلام; an authorised staff member marks the order ready; each branch has its own dashboard.
- Loyalty points per order; AI conversion of a menu photo into a digital menu.

Deliberately **not** shown or claimed:

- iPhone lock-screen Live Activities / live notifications (not verified technically).
- Offline web push or "works without internet". Web notifications need a supported browser, permission and connectivity; restaurant Wi-Fi for customers is not shown.
- Any specific reward tiers or free-meal promises.

## Digital Pager ad

- UI rebuilt from the founder's screenshots of the real merchant dashboard and customer flow; layouts are recreated, not pixel copies.
- Restaurant name "برگر" and tagline are demo data; confirm spelling (برگر or بركر) before airing.
- Lock-screen card and notification are shown with fine print about internet, notification permission and device differences.
- Voiceover is AI-generated (ElevenLabs voice "Farah"), regenerated 2026-10-29 on the paid Starter plan, which includes a commercial licence.

## Fonts

Cairo (SIL Open Font License) is installed from npm (`@fontsource-variable/cairo`) at `npm install`; no font files are committed or distributed with this project.

## Remaining requirements before a public release

1. Iraqi and MSA voiceover recordings (voice actor or a TTS service the brand has rights to use).
2. Founder sign-off that every on-screen flow matches the real product.
3. Real product screenshots, or explicit approval to air the conceptual UI.
4. High-resolution logo and mascot sources.
5. Optional: licensed music track.
