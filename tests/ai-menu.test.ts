// Run with: npm test   (Node 22+ strips TypeScript types natively)
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AM_DEMO, AM_HEADLINES, AM_OUTRO, AM_SCENES, AM_SFX, AM_SYNC, AM_UI, AM_VIDEO, AM_VO} from '../src/ai-menu/config.ts';

test('AI menu ad is 1080x1920, 30 fps, 30 s', () => {
  assert.deepEqual(AM_VIDEO, {width: 1080, height: 1920, fps: 30, durationInFrames: 900});
});

test('six contiguous scenes on the brief timings', () => {
  const expected = [
    ['paper', 0, 4],
    ['upload', 4, 9],
    ['design', 9, 14],
    ['manage', 14, 19],
    ['phone', 19, 24],
    ['outro', 24, 30],
  ];
  let cursor = 0;
  AM_SCENES.forEach((s, i) => {
    assert.equal(s.from, cursor);
    assert.deepEqual([s.id, s.from / 30, (s.from + s.duration) / 30], expected[i]);
    cursor += s.duration;
  });
  assert.equal(cursor, AM_VIDEO.durationInFrames);
});

test('every sync point has a sound cue on the same frame', () => {
  const frames = new Set(AM_SFX.map((c) => c.frame));
  for (const [name, f] of Object.entries(AM_SYNC)) assert.ok(frames.has(f), `${name} @ ${f} has no SFX cue`);
  for (const c of AM_SFX) assert.ok(c.frame >= 0 && c.frame < AM_VIDEO.durationInFrames);
});

test('sync points fall inside their scenes', () => {
  const sceneOf = (f: number) => AM_SCENES.find((s) => f >= s.from && f < s.from + s.duration)!.id;
  assert.equal(sceneOf(AM_SYNC.paperToDigital), 'paper');
  for (const k of ['pickPhoto', 'photoDrop', 'createTap', 'aiDone'] as const) assert.equal(sceneOf(AM_SYNC[k]), 'upload');
  for (const k of ['templatePick', 'colorSwap'] as const) assert.equal(sceneOf(AM_SYNC[k]), 'design');
  for (const k of ['sectionSave', 'productSave'] as const) assert.equal(sceneOf(AM_SYNC[k]), 'manage');
  for (const k of ['qrScan', 'menuOpen'] as const) assert.equal(sceneOf(AM_SYNC[k]), 'phone');
  for (const k of ['logo', 'ctaTap'] as const) assert.equal(sceneOf(AM_SYNC[k]), 'outro');
});

test('copy matches the brief and the real dashboard', () => {
  assert.equal(AM_HEADLINES.paper, 'منيو مطعمك بعده ورقي؟');
  assert.equal(AM_VO.outro, 'طوّر منيو مطعمك اليوم، ويا بيجر گو!');
  assert.deepEqual(AM_OUTRO, {headline: 'حوّل منيو مطعمك إلى تجربة رقمية ذكية', sub: 'المنيو الإلكتروني بالذكاء الاصطناعي من بيجر گو', cta: 'ابدأ الآن'});
  assert.equal(AM_UI.templates.length, 20);
  assert.equal(AM_UI.templates[AM_UI.pickedTemplate].name, 'طازج وطبيعي');
  assert.deepEqual(AM_UI.colorways.map((c) => c.name), ['أخضر نباتي', 'حمضي']);
  assert.equal(AM_UI.pickPhoto, 'اختيار صورة');
  assert.equal(AM_UI.createMenu, 'إنشاء منيو إلكتروني');
  assert.deepEqual(AM_DEMO.newProduct, {name: 'برغر كلاسيك', price: '8,000', desc: 'لحم مشوي مع الجبن والخضار الطازجة'});
  assert.equal(AM_DEMO.merchant, 'بركر');
});

test('brand name uses the Persian gaf (گ)', () => {
  for (const line of [...Object.values(AM_VO), ...Object.values(AM_HEADLINES), AM_OUTRO.sub]) {
    if (line.includes('بيجر')) assert.ok(line.includes('بيجر گو'), line);
  }
});
