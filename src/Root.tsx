import '@fontsource-variable/cairo/wght.css';
import React from 'react';
import {Composition, continueRender, delayRender, Folder} from 'remotion';
import {Commercial} from './Commercial';
import {VIDEO} from './config';

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
  </>
);
