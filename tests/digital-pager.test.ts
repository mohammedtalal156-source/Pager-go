import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DP_CAPTIONS, DP_SCENES, DP_SFX, DP_SYNC, DP_UI, DP_VIDEO} from '../src/digital-pager/config.ts';

test('Digital Pager is exactly 900 frames at 30 fps, 1080x1920', () => {
  assert.deepEqual([DP_VIDEO.width, DP_VIDEO.height, DP_VIDEO.fps, DP_VIDEO.durationInFrames], [1080, 1920, 30, 900]);
});

test('scenes match the brief: 0–4, 4–9, 9–14, 14–20, 20–26, 26–30 s', () => {
  const secs = DP_SCENES.map((s) => [s.id, s.from / 30, (s.from + s.duration) / 30]);
  assert.deepEqual(secs, [
    ['problem', 0, 4],
    ['cashier', 4, 9],
    ['scan', 9, 14],
    ['preparing', 14, 20],
    ['ready', 20, 26],
    ['outro', 26, 30],
  ]);
});

test('order 7 and the two statuses are used consistently', () => {
  assert.equal(DP_UI.orderNo, '7');
  assert.equal(DP_UI.preparing, 'قيد التحضير');
  assert.equal(DP_UI.ready, 'جاهز');
  assert.ok(DP_CAPTIONS.cashier.includes('7'));
});

test('sound cues land on the visual events they belong to', () => {
  const at = (sfx: string, frame: number) => DP_SFX.some((c) => c.sfx === sfx && c.frame === frame);
  assert.ok(at('pop', DP_SYNC.orderCreated), 'pop when order 7 appears');
  assert.ok(at('scan', DP_SYNC.qrLocked), 'scan beep when the QR locks');
  assert.ok(at('tap', DP_SYNC.staffTap), 'tap when staff presses جاهز');
  assert.ok(at('ready', DP_SYNC.lockReady), 'chime when the lock-screen card turns جاهز');
  assert.ok(at('logo', DP_SYNC.logo), 'hit on the logo');
});

test('no loyalty or AI-menu features, no universal-device claims', () => {
  const all = JSON.stringify({DP_CAPTIONS, DP_UI});
  for (const banned of ['نقاط', 'الولاء', 'الذكاء الاصطناعي', 'منيو', 'كل الأجهزة', 'بدون إنترنت', 'Live Activit']) {
    assert.ok(!all.includes(banned), banned);
  }
  assert.ok(DP_UI.finePrint.includes('اتصال'));
});
