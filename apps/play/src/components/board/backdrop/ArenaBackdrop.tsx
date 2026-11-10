"use client";

/**
 * Living arena backdrop: a slow arcane nebula + rune circles + drifting motes rendered by a tiny
 * three.js fragment shader at reduced resolution. A pure-CSS gradient sits underneath and is the
 * whole backdrop when WebGL is unavailable, the tab is hidden, or the shader has not loaded yet.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { useAnimationLevel } from "../theme/motion";

const ArenaBackdropCanvas = dynamic(() => import("./ArenaBackdropCanvas"), {
  ssr: false,
  loading: () => null,
});

let webglProbe: boolean | undefined;

function probeWebgl(): boolean {
  if (typeof document === "undefined") return false;
  if (webglProbe !== undefined) return webglProbe;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ?? (canvas.getContext("webgl") as WebGLRenderingContext | null);
    webglProbe = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}

export function ArenaBackdrop() {
  const level = useAnimationLevel();
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    setWebgl(probeWebgl());
  }, []);

  return (
    <div
      aria-hidden="true"
      data-arena-backdrop={webgl ? "webgl" : "css"}
      data-arena-motion={level}
      className="arena-backdrop pointer-events-none absolute inset-0 -z-1 overflow-hidden rounded-[inherit]"
    >
      <div className="arena-backdrop-gradient absolute inset-0" />
      {webgl ? <ArenaBackdropCanvas animationLevel={level} /> : null}
      <div className="arena-backdrop-vignette absolute inset-0" />
    </div>
  );
}

export default ArenaBackdrop;
