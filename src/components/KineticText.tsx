import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BRAND, orangeGradient} from '../config';

const colors = BRAND.colors;
const FONT = BRAND.font;

type Props = {
  words: string[];
  start?: number;
  stagger?: number;
  fontSize?: number;
  weight?: number;
  color?: string;
  highlight?: string[];
  lineHeight?: number;
  maxWidth?: number;
  exitAt?: number;
  style?: React.CSSProperties;
};

/**
 * Word-by-word kinetic headline for Arabic.
 * Each word stays a single DOM text node, so Arabic letter joining is never broken;
 * the container is dir="rtl" so the first word lands on the right.
 */
export const KineticText: React.FC<Props> = ({
  words,
  start = 0,
  stagger = 4,
  fontSize = 92,
  weight = 900,
  color = colors.white,
  highlight = [],
  lineHeight = 1.25,
  maxWidth = 960,
  exitAt,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const exit = exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div
      dir="rtl"
      lang="ar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: fontSize * 0.28,
        maxWidth,
        fontFamily: FONT,
        fontSize,
        fontWeight: weight,
        lineHeight,
        color,
        opacity: 1 - exit,
        transform: `translateY(${-40 * exit}px)`,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const p = spring({frame: frame - start - i * stagger, fps, config: {damping: 13, stiffness: 140, mass: 0.7}});
        const blur = interpolate(p, [0, 1], [10, 0]);
        const isHi = highlight.includes(w);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: interpolate(p, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'}),
              transform: `translateY(${interpolate(p, [0, 1], [60, 0])}px) scale(${interpolate(p, [0, 1], [0.85, 1])})`,
              filter: `blur(${blur}px)`,
              textShadow: isHi ? undefined : '0 8px 30px rgba(0,0,0,0.45)',
              ...(isHi
                ? {
                    backgroundImage: orangeGradient,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    filter: `blur(${blur}px) drop-shadow(0 8px 24px rgba(255,122,0,0.45))`,
                  }
                : {}),
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
