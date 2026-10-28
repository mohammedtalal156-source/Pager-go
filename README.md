# Pager Go | بيجر گو — Motion Studio

Remotion + React + TypeScript project for the 30-second vertical Pager Go commercial (1080×1920, 30 fps, 900 frames), in two versions with identical visuals:

| Composition | Captions / VO | Output |
|---|---|---|
| `PagerGo-Iraqi` | Iraqi Arabic | `out/pagergo-30s-iraqi.mp4` |
| `PagerGo-MSA` | Modern Standard Arabic | `out/pagergo-30s-msa.mp4` |

Docs: [storyboard and shot list](docs/storyboard.md) · [audio script and timings](docs/audio-script.md) · [placeholders and limits](docs/limitations.md)

## Install (macOS)

```bash
# 1. Node 20+ (22 recommended) and FFmpeg
brew install node ffmpeg
# 2. Dependencies (also installs the Cairo font package and Remotion's headless Chrome on first render)
cd pagergo-commercial
npm install
```

Optional, only to regenerate assets: Python 3 with `pip install numpy` (audio) and `pip install "rembg[cpu]" pillow` (mascot cut-outs).

## Preview

```bash
npm run dev
```

Opens Remotion Studio in the browser. Pick `PagerGo-Iraqi` or `PagerGo-MSA` in the sidebar, scrub the timeline, and play with sound.

## Render

```bash
npm run render         # both versions
npm run render:iraqi   # one version
npm run render:msa
npm run verify         # ffprobe checks: 1080x1920, 30 fps, 900 frames, 30 s, AAC stereo
npm run stills         # one review JPEG per scene per language in out/stills/
```

A render takes about 3–4 minutes per version on a 4-core machine. If Remotion cannot download its headless Chrome (offline or locked-down network), point it at an installed Chrome/Chromium: `REMOTION_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run render`.

## Tests

```bash
npm test        # timeline, assets, exact VO text, brand spelling, banned claims
npm run typecheck
```

## Editing

Everything editable lives in **`src/config.ts`**:

- `BRAND` colours, font, name, URL
- `SCENES` frame ranges (must stay contiguous and sum to 900; the tests enforce this)
- `VOICEOVER` lines per language (also used as captions)
- `UI` on-screen labels and demo data (order 247, items, points, menu cards, CTA)
- `ASSETS` paths, `SFX_CUES`, `MUSIC` volumes, `VO_FILES`

### Replacing official assets

- **Logo:** put the new file in `public/brand/` and set `ASSETS.logo`. A transparent PNG works on the white plate as-is.
- **Mascot:** re-run `python scripts/extract_mascot.py <sheet.png>` with a higher-resolution sheet, or drop individual transparent PNGs into `public/mascot/` with the same names and update `POSE_SIZE`.
- **Voiceover:** add WAVs at the paths in `VO_FILES` (see `docs/audio-script.md`). They are picked up automatically and the music ducks under them.
- **Music:** replace `public/audio/music-bed.wav` with a licensed 30 s track.

## Structure

```
src/
  config.ts            central config (no imports, loaded by tests)
  Root.tsx             compositions + font loading
  Commercial.tsx       5 scenes, wipes, soundtrack
  components/
    BrandBackground    navy stage, glow, grid, particles, OrangeWipe
    MascotLayer        official mascot cut-outs: spring entrance, squash & stretch, idle, pose swaps
    PosTicket          cashier POS + glowing ticket 247
    QrReveal           real scannable QR (pagergo.pro) with assemble + scan
    Phone              CSS-3D smartphone shell
    PhoneWaitingScreen waiting page + OrderStatusTransition (انتظار → جاهز → تم الاستلام)
    LoyaltyPoints      loyalty card, flying points, counter
    AiMenuTransform    paper menu photo → AI scan → digital menu cards
    OutroCTA           official logo, CTA, URL
    Captions/KineticText  word-by-word Arabic RTL captions
public/
  brand/               official logo + original mascot sheet
  mascot/              10 cut-out poses
  audio/               original synthesised music + SFX
scripts/               generate_audio.py, extract_mascot.py, verify-output.mjs, render-stills.mjs
tests/                 config.test.ts
```

## Technical choices

- Pure Remotion CSS/SVG animation driven by `useCurrentFrame()`, `interpolate()` and `spring()`. Three.js / React Three Fiber were tried and dropped: CSS 3D gives the same depth for phones and cards, keeps Arabic UI as real browser-shaped text, and renders reliably without a GPU.
- Arabic text is split only on spaces, so letters always join correctly; containers are `dir="rtl"`, Latin fragments (QR, pagergo.pro, numbers) are bidi-isolated.
- No network requests during render: all assets are local; the font comes from `node_modules`.
