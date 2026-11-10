"use client";

/**
 * Fullscreen-triangle fragment shader (fbm nebula, gold rune rings, motes). Rendered at <= 0.75
 * DPR scale, capped at ~40 fps, paused while the tab is hidden, frozen when animation is "off".
 */
import { useEffect, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";

import type { AnimationLevel } from "../settings/settings-values";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uPointer;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ring(float d, float r, float w) { return smoothstep(w, 0.0, abs(d - r)); }

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 par = uPointer * 0.02;
  float t = uTime;

  // Nebula
  vec2 q = p * 1.6 + par * 1.5;
  float n1 = fbm(q + vec2(t * 0.020, -t * 0.012));
  float n2 = fbm(q * 1.7 - vec2(t * 0.015, t * 0.010) + n1 * 1.4);
  vec3 deep = vec3(0.016, 0.040, 0.085);
  vec3 teal = vec3(0.030, 0.290, 0.350);
  vec3 indigo = vec3(0.130, 0.150, 0.400);
  vec3 col = deep;
  col = mix(col, teal, smoothstep(0.32, 0.80, n1) * 0.9);
  col = mix(col, indigo, smoothstep(0.38, 0.85, n2) * 0.8);
  col += vec3(0.02, 0.07, 0.09) * pow(n2, 3.0);

  // Rune circles (centre of the table), slow counter-rotation
  vec2 c = p + par * 0.6;
  float d = length(c);
  float ang = atan(c.y, c.x);
  vec3 gold = vec3(1.0, 0.78, 0.36);
  float runes = 0.0;
  runes += ring(d, 0.46, 0.0035) * 0.9;
  runes += ring(d, 0.50, 0.0020) * 0.6;
  runes += ring(d, 0.30, 0.0030) * 0.7;
  float ticks = step(0.5, fract((ang + t * 0.02) * 24.0 / 6.2831853));
  runes += ring(d, 0.475, 0.012) * ticks * 0.55;
  float glyph = step(0.62, noise(vec2(floor((ang - t * 0.015) * 36.0 / 6.2831853), 3.0) * 2.7));
  runes += ring(d, 0.385, 0.016) * glyph * 0.6;
  float spokes = smoothstep(0.012, 0.0, abs(sin((ang + t * 0.01) * 3.0)) * d) * step(d, 0.5) * step(0.3, d);
  runes += spokes * 0.3;
  float fade = smoothstep(0.62, 0.15, d);
  col += gold * runes * (0.10 + 0.05 * sin(t * 0.4)) * (0.35 + 0.65 * fade);

  // Motes
  for (int i = 0; i < 2; i++) {
    float sc = i == 0 ? 14.0 : 24.0;
    vec2 g = (uv * vec2(aspect, 1.0)) * sc;
    g.y -= t * (i == 0 ? 0.16 : 0.28);
    g.x += sin(t * 0.2 + float(i) * 2.0) * 0.3 + par.x * 20.0;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + float(i) * 91.0);
    vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
    float dd = length(f - off);
    float tw = 0.5 + 0.5 * sin(t * (0.8 + h * 1.6) + h * 40.0);
    float m = step(0.72, h) * smoothstep(0.075, 0.0, dd) * tw;
    col += mix(vec3(0.5, 0.9, 1.0), gold, h) * m * 0.55;
  }

  gl_FragColor = vec4(col, 1.0);
}`;

const FRAME_MS = 1000 / 40;
const MAX_SCALE = 0.75;

export default function ArenaBackdropCanvas({ animationLevel }: { animationLevel: AnimationLevel }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const levelRef = useRef(animationLevel);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    levelRef.current = animationLevel;
    redrawRef.current?.();
  }, [animationLevel]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
        depth: false,
        stencil: false,
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1) * MAX_SCALE);
    const canvas = renderer.domElement;
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    host.appendChild(canvas);

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    const uniforms = {
      uTime: { value: 12 },
      uRes: { value: new Vector2(1, 1) },
      uPointer: { value: new Vector2(0, 0) },
    };
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const target = new Vector2(0, 0);
    let raf = 0;
    let last = 0;
    let clock = 12;
    let hidden = document.hidden;
    let disposed = false;

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };
    const draw = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };
    const tick = (now: number) => {
      raf = 0;
      if (disposed || hidden) return;
      const level = levelRef.current;
      if (level === "off") {
        draw();
        return;
      }
      raf = requestAnimationFrame(tick);
      const frameMs = level === "reduced" ? 1000 / 24 : FRAME_MS;
      if (now - last < frameMs) return;
      const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
      last = now;
      clock += dt * (level === "reduced" ? 0.5 : 1);
      uniforms.uTime.value = clock;
      uniforms.uPointer.value.lerp(target, level === "full" ? 0.06 : 0);
      draw();
    };
    const start = () => {
      if (!raf && !hidden && !disposed) raf = requestAnimationFrame(tick);
    };
    redrawRef.current = () => {
      resize();
      draw();
      start();
    };
    const onVisibility = () => {
      hidden = document.hidden;
      if (hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else start();
    };
    const onPointer = (event: PointerEvent) => {
      target.set((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
    };
    const onContextLost = (event: Event) => event.preventDefault();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { resize(); draw(); }) : null;
    observer?.observe(host);
    resize();
    draw();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointer, { passive: true });
    canvas.addEventListener("webglcontextlost", onContextLost);

    return () => {
      disposed = true;
      redrawRef.current = null;
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  return <div ref={hostRef} className="arena-backdrop-canvas absolute inset-0" />;
}
