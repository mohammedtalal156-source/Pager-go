import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
// WebGL (React Three Fiber scenes) needs a GL backend in headless Chromium.
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(4);
// Use an already-installed Chrome/Chromium instead of downloading one (offline or locked-down networks):
//   REMOTION_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run render
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
