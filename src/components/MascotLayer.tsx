import React from 'react';
import {Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ASSETS, type Pose, POSE_SIZE} from '../config';

// Poses cut directly from the official mascot sheet (public/brand/mascot-sheet-original.png).
// Only the white background was removed; the character art itself is untouched.
// Never mirror these images: it would reverse the Arabic label on the uniform.
// The mascot is silent: it only gestures and reacts, the narrator is off-screen.

type Props = {
  /** Pose timeline: the last entry whose `at` <= frame is shown. */
  poses: {at: number; pose: Pose}[];
  /** Frame the mascot springs in. */
  enter?: number;
  exitAt?: number;
  /** Rendered height in px of the pose image. Width follows the pose aspect. */
  height: number;
  /** Bottom-centre anchor, in composition px. */
  x: number;
  y: number;
  shadow?: boolean;
  /** Gentle wiggle, e.g. while ringing the bell. */
  wiggleFrom?: number;
  wiggleTo?: number;
  from?: 'bottom' | 'left' | 'right' | 'scale';
};

/**
 * Animated wrapper around the official mascot cut-outs:
 * spring entrance with squash & stretch, idle breathing/bob, pose swaps with a pop,
 * optional wiggle, and a soft contact shadow.
 */
export const MascotLayer: React.FC<Props> = ({poses, enter = 0, exitAt, height, x, y, shadow = true, wiggleFrom, wiggleTo, from = 'bottom'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const current = [...poses].reverse().find((p) => frame >= p.at) ?? poses[0];
  const [pw, ph] = POSE_SIZE[current.pose];
  const width = (pw / ph) * height;

  const inP = spring({frame: frame - enter, fps, config: {damping: 11, stiffness: 120, mass: 0.9}});
  const outP = exitAt === undefined ? 0 : spring({frame: frame - exitAt, fps, config: {damping: 20, stiffness: 160}});

  // squash & stretch around the landing
  const land = spring({frame: frame - enter - 9, fps, config: {damping: 7, stiffness: 220}});
  const squash = 1 + 0.08 * Math.sin(land * Math.PI) * (1 - land * 0.5);

  // pop on pose switch
  const switchAt = current.at;
  const popP = poses.indexOf(current) > 0 ? spring({frame: frame - switchAt, fps, config: {damping: 9, stiffness: 260}}) : 1;
  const pop = interpolate(popP, [0, 1], [0.9, 1]);

  const t = frame / fps;
  const breathe = 1 + 0.012 * Math.sin(t * Math.PI * 1.4);
  const bob = Math.sin(t * Math.PI * 1.1) * 6;

  let wig = 0;
  if (wiggleFrom !== undefined && wiggleTo !== undefined && frame >= wiggleFrom && frame <= wiggleTo) {
    const k = (frame - wiggleFrom) / (wiggleTo - wiggleFrom);
    wig = Math.sin((frame - wiggleFrom) * 1.3) * 4 * Math.sin(k * Math.PI);
  }

  let tx = 0;
  let ty = 0;
  let sc = 1;
  if (from === 'bottom') ty = interpolate(inP, [0, 1], [height * 0.9, 0]);
  if (from === 'left') tx = interpolate(inP, [0, 1], [-900, 0]);
  if (from === 'right') tx = interpolate(inP, [0, 1], [900, 0]);
  if (from === 'scale') sc = inP;
  ty += outP * height * 1.2;

  const visible = frame >= enter - 1;
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - height,
        width,
        height,
        transformOrigin: '50% 100%',
        transform: `translate(${tx}px, ${ty + bob}px) scale(${sc * pop}) rotate(${wig}deg)`,
        opacity: interpolate(inP, [0, 0.2], [0, 1], {extrapolateRight: 'clamp'}) * (1 - outP),
      }}
    >
      {shadow ? (
        <div
          style={{
            position: 'absolute',
            left: width * 0.18,
            right: width * 0.18,
            bottom: -height * 0.03 - bob,
            height: height * 0.07,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55), rgba(0,0,0,0) 70%)',
            transform: `scaleX(${1 - bob / 60})`,
          }}
        />
      ) : null}
      <Img
        src={staticFile(ASSETS.mascot[current.pose])}
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: '50% 100%',
          transform: `scale(${breathe * (2 - squash)}, ${breathe * squash})`,
          filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.35))',
        }}
      />
    </div>
  );
};
