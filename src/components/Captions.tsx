import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {BRAND} from '../config';
import {KineticText} from './KineticText';

/**
 * Burned-in caption of the off-screen voiceover line, revealed word by word.
 * Sits in the upper safe area (below platform top bars), so the ad works on mute.
 * Split on spaces only, so each Arabic word keeps its letter joining.
 */
export const Captions: React.FC<{text: string; start?: number; end: number; highlightPrefixes?: string[]}> = ({text, start = 6, end, highlightPrefixes = []}) => {
  const frame = useCurrentFrame();
  // Keep the brand name on one line: "بيجر گو" is joined by a no-break space before splitting.
  const words = text.replaceAll(`${BRAND.nameAr.split(' ')[0]} `, `${BRAND.nameAr.split(' ')[0]}\u00A0`).split(/ +/).filter(Boolean); // ASCII space only: \s would also split the no-break space
  const highlight = words.filter((w) => highlightPrefixes.some((p) => w.startsWith(p)));
  const o = interpolate(frame, [end - 10, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 250, opacity: o, pointerEvents: 'none'}}>
      <KineticText words={words} start={start} stagger={3} fontSize={66} weight={900} maxWidth={900} highlight={highlight} lineHeight={1.45} />
    </AbsoluteFill>
  );
};
