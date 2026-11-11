/**
 * Dev/QA slow-motion switch. `?fxSpeed=0.25` (or `window.__fxSpeed = 0.25`) stretches every FX
 * duration, delay, timeline cursor and the particle clock uniformly (1 = normal, 0.25 = 4x slower).
 */
let fromUrl: number | null | undefined;

export function fxSpeed(): number {
  if (typeof window === "undefined") return 1;
  const w = (window as unknown as { __fxSpeed?: unknown }).__fxSpeed;
  let value = typeof w === "number" ? w : NaN;
  if (!Number.isFinite(value)) {
    if (fromUrl === undefined) {
      try {
        const raw = new URLSearchParams(window.location.search).get("fxSpeed");
        const n = raw === null ? NaN : Number(raw);
        fromUrl = Number.isFinite(n) && n > 0 ? n : null;
      } catch {
        fromUrl = null;
      }
    }
    value = fromUrl ?? 1;
  }
  return Math.min(4, Math.max(0.05, value));
}

/** Real milliseconds for a nominal duration. */
export const scaled = (ms: number): number => ms / fxSpeed();
