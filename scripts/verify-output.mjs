// Verifies rendered MP4s with ffprobe: 1080x1920, 30fps, 900 frames, ~30 s, H.264 + AAC stereo.
// Usage: node scripts/verify-output.mjs out/pagergo-30s-iraqi.mp4 [more.mp4 ...]
import {execFileSync} from 'node:child_process';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/verify-output.mjs <file.mp4> ...');
  process.exit(2);
}
let failed = false;
for (const file of files) {
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]).toString());
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const dur = Number(info.format.duration);
  const checks = [
    ['video stream is h264', v?.codec_name === 'h264'],
    ['1080x1920', v?.width === 1080 && v?.height === 1920],
    ['30 fps', v?.r_frame_rate === '30/1'],
    ['900 frames', Number(v?.nb_read_frames) === 900],
    ['duration 30 s (±0.1)', Math.abs(dur - 30) <= 0.1],
    ['audio stream is aac stereo', a?.codec_name === 'aac' && a?.channels === 2],
  ];
  console.log(`\n${file}`);
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failed = true;
  }
  console.log(`  info  ${v?.width}x${v?.height} ${v?.r_frame_rate} frames=${v?.nb_read_frames} duration=${dur.toFixed(3)}s audio=${a?.codec_name}/${a?.sample_rate}Hz/${a?.channels}ch`);
}
process.exit(failed ? 1 : 0);
