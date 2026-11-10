"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

import { ParticleEngine } from "./particles";

/** One fullscreen canvas hosting the shared {@link ParticleEngine}. */
export function ParticleCanvas({ engineRef }: { engineRef: MutableRefObject<ParticleEngine | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new ParticleEngine();
    engine.attach(canvas);
    engineRef.current = engine;
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engine.detach();
      engineRef.current = null;
    };
  }, [engineRef]);

  return <canvas ref={canvasRef} className="fx-particle-canvas" aria-hidden="true" />;
}
