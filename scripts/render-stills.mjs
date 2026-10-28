// Renders one review still per scene for both languages into out/stills/.
// Extra CLI flags are passed through to `remotion still`.
import {execFileSync} from 'node:child_process';

const frames = {pos: 100, qr: 300, loyalty: 440, aiMenu: 680, outro: 870};
const extra = process.argv.slice(2);
for (const comp of ['PagerGo-Iraqi', 'PagerGo-MSA']) {
  for (const [scene, frame] of Object.entries(frames)) {
    const out = `out/stills/${comp}-${scene}.jpg`;
    execFileSync('npx', ['remotion', 'still', 'src/index.ts', comp, out, `--frame=${frame}`, '--image-format=jpeg', '--log=error', ...extra], {stdio: 'inherit'});
    console.log('wrote', out);
  }
}
