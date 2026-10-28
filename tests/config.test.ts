// Run with: npm test   (Node 22+ strips TypeScript types natively)
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {ASSETS, BRAND, POSE_SIZE, SCENES, SFX_CUES, UI, VIDEO, VOICEOVER} from '../src/config.ts';

const pub = (p: string) => join(import.meta.dirname, '..', 'public', p);

test('video spec is 1080x1920, 30fps, 900 frames', () => {
  assert.equal(VIDEO.width, 1080);
  assert.equal(VIDEO.height, 1920);
  assert.equal(VIDEO.fps, 30);
  assert.equal(VIDEO.durationInFrames, 900);
});

test('scenes are contiguous, gap-free and match the storyboard', () => {
  const expected = [
    ['pos', 0, 149],
    ['qr', 150, 329],
    ['loyalty', 330, 509],
    ['aiMenu', 510, 719],
    ['outro', 720, 899],
  ];
  let cursor = 0;
  SCENES.forEach((s, i) => {
    assert.equal(s.from, cursor, `${s.id} starts right after the previous scene`);
    assert.deepEqual([s.id, s.from, s.from + s.duration - 1], expected[i]);
    cursor += s.duration;
  });
  assert.equal(cursor, VIDEO.durationInFrames);
});

test('every referenced asset exists in /public', () => {
  const paths = [ASSETS.logo, ASSETS.mascotSheet, ASSETS.music, ...Object.values(ASSETS.mascot), ...Object.values(ASSETS.sfx)];
  for (const p of paths) assert.ok(existsSync(pub(p)), `missing asset: ${p}`);
});

test('mascot pose sizes match the PNG headers', () => {
  for (const [pose, [w, h]] of Object.entries(POSE_SIZE)) {
    const buf = readFileSync(pub(ASSETS.mascot[pose as keyof typeof ASSETS.mascot]));
    assert.equal(buf.readUInt32BE(16), w, `${pose} width`);
    assert.equal(buf.readUInt32BE(20), h, `${pose} height`);
  }
});

test('Iraqi voiceover lines match the approved brief exactly', () => {
  assert.deepEqual(VOICEOVER.iraqi, {
    pos: 'من يستلم مطعمك الطلب… بيجر گو يرتّب الانتظار!',
    qr: 'الزبون يمسح QR ويتابع طلبه، بدون ما ينزّل تطبيق!',
    loyalty: 'ومع نقاط الولاء، تخلي زبائنك يتحمسون يرجعون!',
    aiMenu: 'وصورة منيوك؟ الذكاء الاصطناعي يحوّلها لمنيو إلكتروني!',
    outro: 'بيجر گو… تجربة أذكى لمطعمك. اشترك الآن على pagergo.pro',
  });
});

test('MSA voiceover lines match the approved brief exactly', () => {
  assert.deepEqual(VOICEOVER.msa, {
    pos: 'مع كل طلب جديد، ينظّم بيجر گو انتظار زبائنك.',
    qr: 'يمسح الزبون رمز QR ويتابع طلبه دون تحميل تطبيق.',
    loyalty: 'ومع نقاط الولاء، شجّع زبائنك على العودة.',
    aiMenu: 'وصورة قائمة الطعام تتحوّل بالذكاء الاصطناعي إلى قائمة رقمية.',
    outro: 'بيجر گو… تجربة أذكى لمطعمك. اشترك الآن عبر pagergo.pro.',
  });
});

test('brand name uses the Persian gaf (گ U+06AF), never a substitute', () => {
  assert.equal(BRAND.nameAr, 'بيجر گو');
  for (const lang of Object.values(VOICEOVER)) {
    for (const line of Object.values(lang)) {
      if (line.includes('بيجر')) assert.ok(line.includes('بيجر گو'), line);
      assert.ok(!line.includes('بيجر كو') && !line.includes('بيجر جو'), line);
    }
  }
});

test('order states and waiting number follow the founder-described flow', () => {
  assert.deepEqual([...UI.waiting.states], ['انتظار', 'جاهز', 'تم الاستلام']);
  assert.match(UI.ticket.number, /^\d{3}$/);
  assert.equal(UI.ticket.number, '247');
});

test('no unverified claims in on-screen or spoken copy', () => {
  const all = JSON.stringify({UI, VOICEOVER});
  for (const banned of ['Live Activit', 'شاشة القفل', 'بدون إنترنت', 'بدون انترنت', 'offline', 'Foodics', 'Square']) {
    assert.ok(!all.includes(banned), `copy must not claim: ${banned}`);
  }
});

test('SFX cues fall inside the timeline', () => {
  for (const c of SFX_CUES) assert.ok(c.frame >= 0 && c.frame < VIDEO.durationInFrames, `cue at ${c.frame}`);
});
