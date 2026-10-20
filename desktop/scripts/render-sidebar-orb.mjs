/**
 * Static frame matching web AppLogo (AgentThinkingOrb): working @ 20px, light theme.
 * Uses the same MODE_DRAWS + resolvePreset path as thinking-orbs (t = 0.6 ≈ reduced motion).
 */
import { createCanvas } from '@napi-rs/canvas';
import { MODE_DRAWS, resolvePreset } from 'thinking-orbs';

/** @see web/src/components/app/shared/effects/agent-thinking-orb.tsx — light UI → dark ink */
const SIDEBAR_ORB_STATE = 'working';
const SIDEBAR_ORB_CSS_PX = 20;
/** thinking-orbs freezes at this t when prefers-reduced-motion */
const STATIC_FRAME_T = 0.6;

/** Light sidebar uses --background (light); dark sidebar uses dark canvas + light ink. */
const BACKGROUNDS = {
  light: '#ffffff',
  dark: '#090b10',
};

/**
 * @param {number} outPx Square output size (e.g. 1024 for app icon).
 * @param {'light' | 'dark'} uiTheme App theme (not OS); matches AgentThinkingOrb theme mapping.
 */
export function renderSidebarOrbPng(outPx, uiTheme = 'light') {
  const darkInkOnLightBg = uiTheme !== 'dark';
  const bg = uiTheme === 'dark' ? BACKGROUNDS.dark : BACKGROUNDS.light;

  const canvas = createCanvas(outPx, outPx);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, outPx, outPx);

  const { mode, opts } = resolvePreset(SIDEBAR_ORB_STATE, SIDEBAR_ORB_CSS_PX);
  const draw = MODE_DRAWS[mode];

  const pad = outPx * 0.14;
  const scale = (outPx - pad * 2) / SIDEBAR_ORB_CSS_PX;

  ctx.save();
  ctx.translate(pad, pad);
  ctx.scale(scale, scale);
  draw(ctx, SIDEBAR_ORB_CSS_PX, STATIC_FRAME_T, !darkInkOnLightBg, opts);
  ctx.restore();

  return canvas.toBuffer('image/png');
}
