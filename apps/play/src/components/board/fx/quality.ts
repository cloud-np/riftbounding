/**
 * Device render tier shared by the particle engine and the arena backdrop.
 *
 * - "software": CPU rasteriser (SwiftShader / llvmpipe / "Software") -> minimal effects, static backdrop
 * - "medium":   integrated / unknown GPUs -> reduced particle budget and DPR
 * - "high":     discrete or Apple-class GPUs
 */
export type RenderTier = "high" | "medium" | "software";

const SOFTWARE_RE = /swiftshader|llvmpipe|software|softpipe|basic render|microsoft basic|mesa offscreen/i;
const INTEGRATED_RE = /intel|uhd|iris|hd graphics|mali|adreno|powervr|videocore|vivante/i;

export function classifyRenderer(renderer: string | null | undefined): RenderTier {
  if (!renderer) return "medium";
  if (SOFTWARE_RE.test(renderer)) return "software";
  if (INTEGRATED_RE.test(renderer)) return "medium";
  return "high";
}

let cached: RenderTier | null = null;
let cachedRenderer: string | null = null;

/** Probe once per page via a throwaway WebGL context (cheap, then lost immediately). */
export function renderTier(): RenderTier {
  if (cached) return cached;
  if (typeof document === "undefined") return "high";
  let tier: RenderTier = "medium";
  try {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("fxTier");
    if (forced === "high" || forced === "medium" || forced === "software") {
      cached = forced;
      return forced;
    }
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
      cachedRenderer = renderer;
      tier = classifyRenderer(renderer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } else {
      tier = "software";
    }
  } catch {
    tier = "medium";
  }
  cached = tier;
  return tier;
}

export function renderTierRenderer(): string | null {
  renderTier();
  return cachedRenderer;
}

/** Test hook. */
export function resetRenderTierForTests(): void {
  cached = null;
  cachedRenderer = null;
}
