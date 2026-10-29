import '@fontsource-variable/cairo/wght.css';
import React from 'react';
import {Composition, continueRender, delayRender, Folder} from 'remotion';
import {Commercial} from './Commercial';
import {VIDEO} from './config';
import {DigitalPager} from './digital-pager/DigitalPager';
import {DP_VIDEO} from './digital-pager/config';
import {AiMenuAd} from './ai-menu/AiMenuAd';
import {AM_VIDEO} from './ai-menu/config';

// Block rendering until Cairo is actually loaded, so no frame falls back to a system font.
const fontHandle = delayRender('Loading Cairo');
Promise.all([document.fonts.load('900 60px "Cairo Variable"', 'بيجر گو'), document.fonts.load('700 40px "Cairo Variable"', 'Pager Go')])
  .then(() => document.fonts.ready)
  .then(() => continueRender(fontHandle))
  .catch(() => continueRender(fontHandle));

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="PagerGo">
      <Composition id="PagerGo-Iraqi" component={Commercial} durationInFrames={VIDEO.durationInFrames} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} defaultProps={{language: 'iraqi' as const}} />
      <Composition id="PagerGo-MSA" component={Commercial} durationInFrames={VIDEO.durationInFrames} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} defaultProps={{language: 'msa' as const}} />
    </Folder>
    <Folder name="DigitalPager">
      <Composition id="PagerGo-DigitalPager" component={DigitalPager} durationInFrames={DP_VIDEO.durationInFrames} fps={DP_VIDEO.fps} width={DP_VIDEO.width} height={DP_VIDEO.height} />
    </Folder>
    <Folder name="AiMenu">
      <Composition id="PagerGo-AiMenu" component={AiMenuAd} durationInFrames={AM_VIDEO.durationInFrames} fps={AM_VIDEO.fps} width={AM_VIDEO.width} height={AM_VIDEO.height} />
    </Folder>
  </>
);
