/**
 * Drag-ghost physics — exact port of the original rAF spring
 * (`0xawjzm3yjpr1.js:35680-36060`, spec `03-animations-3d.md` §4.2).
 *
 *   velocity decay   exp(-dt / 118)
 *   follow          1 - exp(-dt / 42)
 *   rotateX         clamp(-0.0115 * vyPxPerSecond, -13, 13)
 *   rotateY         clamp( 0.0115 * vxPxPerSecond, -13, 13)
 *   rotateZ         clamp( 0.0075 * vxPxPerSecond,  -8,  8)
 *   perspective(980px) … scale(1.02)
 */

export const GHOST_VELOCITY_TAU_MS = 118;
export const GHOST_FOLLOW_TAU_MS = 42;
export const GHOST_VELOCITY_SMOOTHING_NEW = 0.55;
export const GHOST_VELOCITY_SMOOTHING_OLD = 0.45;

export interface GhostMotionState {
  active: boolean;
  reduceMotion: boolean;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  tiltX: number;
  tiltY: number;
  roll: number;
  lastPointerX: number;
  lastPointerY: number;
  lastPointerTs: number;
  lastFrameTs: number;
}

export function createGhostMotionState(): GhostMotionState {
  return {
    active: false,
    reduceMotion: false,
    targetX: -9999,
    targetY: -9999,
    velocityX: 0,
    velocityY: 0,
    tiltX: 0,
    tiltY: 0,
    roll: 0,
    lastPointerX: 0,
    lastPointerY: 0,
    lastPointerTs: 0,
    lastFrameTs: 0,
  };
}

export function resetGhostMotion(state: GhostMotionState): void {
  state.active = false;
  state.reduceMotion = false;
  state.targetX = -9999;
  state.targetY = -9999;
  state.velocityX = 0;
  state.velocityY = 0;
  state.tiltX = 0;
  state.tiltY = 0;
  state.roll = 0;
  state.lastPointerX = 0;
  state.lastPointerY = 0;
  state.lastPointerTs = 0;
  state.lastFrameTs = 0;
}

export interface GhostPointerSample {
  x: number;
  y: number;
  /** Event timeStamp (ms); non-finite/zero falls back to last + 16. */
  timestamp?: number;
}

/** Pointer sample step: EMA velocity 0.45 old / 0.55 new (px per ms). */
export function sampleGhostPointer(state: GhostMotionState, sample: GhostPointerSample): void {
  const raw = sample.timestamp ?? 0;
  const now = Number.isFinite(raw) && raw > 0 ? raw : state.lastPointerTs > 0 ? state.lastPointerTs + 16 : 0;
  if (state.lastPointerTs > 0 && now >= state.lastPointerTs) {
    const dt = Math.max(1, now - state.lastPointerTs);
    const vx = (sample.x - state.lastPointerX) / dt;
    const vy = (sample.y - state.lastPointerY) / dt;
    state.velocityX = GHOST_VELOCITY_SMOOTHING_OLD * state.velocityX + GHOST_VELOCITY_SMOOTHING_NEW * vx;
    state.velocityY = GHOST_VELOCITY_SMOOTHING_OLD * state.velocityY + GHOST_VELOCITY_SMOOTHING_NEW * vy;
  }
  state.targetX = sample.x;
  state.targetY = sample.y;
  state.lastPointerX = sample.x;
  state.lastPointerY = sample.y;
  state.lastPointerTs = now;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface GhostFrame {
  /** CSS transform for the fixed ghost element. */
  transform: string;
  /** Current roll in degrees (mirrored into `--card-counter-drag-roll`). */
  rollDeg: string;
}

/** Advance one rAF frame. */
export function stepGhostFrame(state: GhostMotionState, now: number): GhostFrame {
  if (state.lastFrameTs === 0) state.lastFrameTs = now;
  const dt = Math.max(1, now - state.lastFrameTs);
  state.lastFrameTs = now;

  if (state.reduceMotion) {
    return {
      transform: `translate3d(${state.targetX.toFixed(2)}px,${state.targetY.toFixed(2)}px,0) translate(-50%, -50%)`,
      rollDeg: "0deg",
    };
  }

  const decay = Math.exp(-dt / GHOST_VELOCITY_TAU_MS);
  state.velocityX *= decay;
  state.velocityY *= decay;
  const vx = 1000 * state.velocityX;
  const vy = 1000 * state.velocityY;
  const tiltXTarget = clamp(-0.0115 * vy, -13, 13);
  const tiltYTarget = clamp(0.0115 * vx, -13, 13);
  const rollTarget = clamp(0.0075 * vx, -8, 8);
  const follow = 1 - Math.exp(-dt / GHOST_FOLLOW_TAU_MS);
  state.tiltX += (tiltXTarget - state.tiltX) * follow;
  state.tiltY += (tiltYTarget - state.tiltY) * follow;
  state.roll += (rollTarget - state.roll) * follow;

  return {
    transform:
      `perspective(980px) translate3d(${state.targetX.toFixed(2)}px,${state.targetY.toFixed(2)}px,0) ` +
      `translate(-50%, -50%) rotateX(${state.tiltX.toFixed(2)}deg) rotateY(${state.tiltY.toFixed(2)}deg) ` +
      `rotateZ(${state.roll.toFixed(2)}deg) scale(1.02)`,
    rollDeg: `${state.roll.toFixed(2)}deg`,
  };
}
