// Run with: npm test   (Node 22+ strips TypeScript types natively)
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {test} from 'node:test';
import {LY_DEMO, LY_HEADLINES, LY_OUTRO, LY_SCENES, LY_SFX, LY_SYNC, LY_UI, LY_VIDEO, LY_VO, LY_VO_FILES, LY_VO_START} from '../src/loyalty/config.ts';

test('loyalty ad is 1080x1920, 30 fps, 30 s', () => {
  assert.deepEqual(LY_VIDEO, {width: 1080, height: 1920, fps: 30, durationInFrames: 900});
});

test('six contiguous scenes on the brief timings', () => {
  const expected = [
    ['problem', 0, 4],
    ['earn', 4, 8],
    ['return', 8, 13],
    ['redeem', 13, 18],
    ['dashboard', 18, 24],
    ['outro', 24, 30],
  ];
  let cursor = 0;
  LY_SCENES.forEach((s, i) => {
    assert.equal(s.from, cursor);
    assert.deepEqual([s.id, s.from / 30, (s.from + s.duration) / 30], expected[i]);
    cursor += s.duration;
  });
  assert.equal(cursor, LY_VIDEO.durationInFrames);
});

test('every sync point has a sound cue on the same frame', () => {
  const frames = new Set(LY_SFX.map((c) => c.frame));
  for (const [name, f] of Object.entries(LY_SYNC)) assert.ok(frames.has(f), `${name} @ ${f} has no SFX cue`);
  for (const c of LY_SFX) assert.ok(c.frame >= 0 && c.frame < LY_VIDEO.durationInFrames);
});

test('sync points fall inside their scenes', () => {
  const sceneOf = (f: number) => LY_SCENES.find((s) => f >= s.from && f < s.from + s.duration)!.id;
  for (const k of ['customerLeaves', 'doorHold'] as const) assert.equal(sceneOf(LY_SYNC[k]), 'problem');
  for (const k of ['pickedUp1', 'points4'] as const) assert.equal(sceneOf(LY_SYNC[k]), 'earn');
  for (const k of ['walkIn', 'pickedUp2', 'points8'] as const) assert.equal(sceneOf(LY_SYNC[k]), 'return');
  for (const k of ['tapRedeem', 'tapGetCode', 'codeShown', 'cashierIn', 'verify', 'handOver'] as const) assert.equal(sceneOf(LY_SYNC[k]), 'redeem');
  for (const k of ['toggleOn', 'pointsSave', 'tabRewards', 'addReward', 'rewardSave', 'tabCustomers', 'tabMoves', 'tabOverview'] as const) assert.equal(sceneOf(LY_SYNC[k]), 'dashboard');
  for (const k of ['logo', 'ctaTap'] as const) assert.equal(sceneOf(LY_SYNC[k]), 'outro');
});

test('points come after pickup, and the reward is handed over only after the code is verified', () => {
  assert.ok(LY_SYNC.pickedUp1 < LY_SYNC.points4);
  assert.ok(LY_SYNC.pickedUp2 < LY_SYNC.points8);
  assert.ok(LY_SYNC.tapRedeem < LY_SYNC.tapGetCode && LY_SYNC.tapGetCode <= LY_SYNC.codeShown);
  assert.ok(LY_SYNC.codeShown < LY_SYNC.verify && LY_SYNC.verify < LY_SYNC.handOver);
});

test('copy matches the brief and the real screens', () => {
  assert.equal(LY_HEADLINES.problem, 'زبونك يشتري… ويروح؟');
  assert.equal(LY_VO.outro, 'خلّي زبائنك يرجعون إلك… ويا برنامج الولاء من بيجر گو!');
  assert.deepEqual(LY_OUTRO, {headline: 'خلّي زبائنك يرجعون إلك!', sub: 'برنامج الولاء من بيجر گو', cta: 'فعّل برنامج الولاء لمطعمك'});
  assert.equal(LY_DEMO.merchant, 'بركر');
  assert.equal(LY_DEMO.pointsPerOrder, 4);
  assert.deepEqual(LY_DEMO.reward, {name: 'فنكر مجاني', points: 8});
  assert.deepEqual(LY_UI.tabs, ['نظرة عامة', 'المكافآت', 'العملاء', 'الحركات']);
  assert.equal(LY_UI.redeemBtn, 'استبدل');
  assert.equal(LY_UI.verify, 'تحقق');
  assert.equal(LY_UI.handOver, 'سلّم المكافأة');
});

test('no real code, account or customer data', () => {
  assert.match(LY_DEMO.code, /^\d{6}$/);
  const all = JSON.stringify({LY_UI, LY_DEMO, LY_HEADLINES, LY_VO, LY_OUTRO});
  assert.ok(!all.includes('094440'), 'real redeem code from the screenshots must not appear');
  assert.ok(!/mohammedtalal|@/i.test(all), 'no account usernames or emails');
  assert.ok(LY_DEMO.sampleCustomers.every((c) => c.name.includes('تجريبي')));
  const [members, added, redeemed, balance] = LY_DEMO.sampleStats;
  assert.equal(added - redeemed, balance);
  assert.equal(members, LY_DEMO.sampleCustomers.length);
});

test('brand name uses the Persian gaf (گ)', () => {
  for (const line of [...Object.values(LY_VO), ...Object.values(LY_HEADLINES), LY_OUTRO.sub]) {
    if (line.includes('بيجر')) assert.ok(line.includes('بيجر گو'), line);
  }
});

test('voiceover files exist and start in order', () => {
  let prev = -1;
  for (const s of LY_SCENES) {
    assert.ok(existsSync(new URL(`../public/${LY_VO_FILES[s.id]}`, import.meta.url)), LY_VO_FILES[s.id]);
    assert.ok(LY_VO_START[s.id] > prev);
    prev = LY_VO_START[s.id];
  }
});
