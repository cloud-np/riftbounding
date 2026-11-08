"use client";

/**
 * One WebGL die for `InitiativeDiceStage` (module 157661). Geometry, textures,
 * materials, camera, lights and timings are copied verbatim from the original
 * chunk `3vkoknf821dno.js`.
 */

import { useEffect, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import {
  DiceMotion,
  seededRandom,
  REVEAL_DURATION_SECONDS,
  REVEAL_START_OFFSET_MS,
  buildInsetPlateGeometry,
  clamp01,
  faceBaseOrientation,
  faceRevealOrientation,
  initiativeColor,
  isUnderlinedDieValue,
  seedFromTimestamp,
} from "./dice-math";

export interface InitiativeDiePlayer {
  id: string;
  name: string;
  relation: "self" | "ally" | "opponent";
  value?: number;
  rolling?: boolean;
}

export interface InitiativeDiceCanvasProps {
  player: InitiativeDiePlayer;
  isMe: boolean;
  reveal: boolean;
  winner: boolean;
  animationStartedAt: number | null;
  onUnavailable: () => void;
}

interface FaceDecal {
  material: MeshStandardMaterial;
  orientation: Quaternion;
  value: number;
}

interface MotionState {
  quaternion: Quaternion;
  position: Vector3;
  height: number;
  scale: number;
  revealProgress: number;
}

const CANVAS_SIZE = 256;
const DECAL_SIZE = 0.68 * 0.62;

function makeNumberTexture(value: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  const texture = new CanvasTexture(canvas);
  if (!ctx) {
    texture.needsUpdate = true;
    return texture;
  }
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 146px Georgia, serif";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(6, 15, 30, 0.96)";
  ctx.strokeText(String(value), 128, 134);
  ctx.fillStyle = "#fff1d1";
  ctx.fillText(String(value), 128, 133);
  if (isUnderlinedDieValue(value)) {
    ctx.beginPath();
    ctx.moveTo(94.72, 202.24);
    ctx.lineTo(161.28, 202.24);
    ctx.lineCap = "round";
    ctx.lineWidth = 18;
    ctx.strokeStyle = "rgba(6, 15, 30, 0.96)";
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#f7fbff";
    ctx.stroke();
  }
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

function makeShadowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.65)");
    gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.42)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function InitiativeDiceCanvas({
  player,
  isMe,
  reveal,
  winner,
  animationStartedAt,
  onUnavailable,
}: InitiativeDiceCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef(player);
  const isMeRef = useRef(isMe);
  const stateRef = useRef({ reveal, winner });
  const startedAtRef = useRef(animationStartedAt);
  const unavailableRef = useRef(onUnavailable);
  const requestRenderRef = useRef<() => void>(() => {});

  playerRef.current = player;
  isMeRef.current = isMe;
  startedAtRef.current = animationStartedAt;
  stateRef.current = { reveal, winner };
  unavailableRef.current = onUnavailable;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new Scene();
    const camera = new PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 5, 0.6);
    camera.lookAt(0, 0.65, 0);

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      unavailableRef.current();
      return;
    }

    try {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0, 0);
    } catch {
      renderer.dispose();
      unavailableRef.current();
      return;
    }

    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "style",
      "display:block;width:100%;height:100%;position:absolute;inset:0;",
    );

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      unavailableRef.current();
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

    try {
      const roomEnvironment = new RoomEnvironment();
      const pmremGenerator = new PMREMGenerator(renderer);
      const environment = pmremGenerator.fromScene(roomEnvironment, 0.04);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.45;
      pmremGenerator.dispose();
      roomEnvironment.dispose();
    } catch {
      // Environment is a nicety; the three-light rig is the original look.
    }

    scene.add(new HemisphereLight(0xe4ecff, 0x243044, 1.6));
    const keyLight = new DirectionalLight(0xffeed3, 2.8);
    keyLight.position.set(-2, 4, 3);
    scene.add(keyLight);
    const rimLight = new DirectionalLight(0x95caff, 0.8);
    rimLight.position.set(-2, -1, 2);
    scene.add(rimLight);

    const sourceGeometry = new DodecahedronGeometry(0.62, 0);
    const rebuildSource = new DodecahedronGeometry(0.62, 0);
    const plateData = buildInsetPlateGeometry(rebuildSource);
    rebuildSource.dispose();

    const bodyGeometry = new BufferGeometry();
    bodyGeometry.setAttribute("position", new Float32BufferAttribute(plateData.positions, 3));
    bodyGeometry.addGroup(0, plateData.insetVertexCount, 0);
    bodyGeometry.addGroup(
      plateData.insetVertexCount,
      plateData.positions.length / 3 - plateData.insetVertexCount,
      1,
    );
    bodyGeometry.computeVertexNormals();

    const bodyMaterial = new MeshPhysicalMaterial({
      color: initiativeColor(isMeRef.current, playerRef.current.relation),
      metalness: 0.28,
      roughness: 0.3,
      flatShading: true,
      clearcoat: 0.85,
      clearcoatRoughness: 0.22,
    });
    const rimMaterial = bodyMaterial.clone();
    rimMaterial.roughness = 0.22;
    rimMaterial.metalness = 0.5;

    const body = new Mesh(bodyGeometry, [bodyMaterial, rimMaterial]);
    body.frustumCulled = false;
    scene.add(body);

    const decalGeometry = new PlaneGeometry(DECAL_SIZE, DECAL_SIZE);
    const textureCache = new Map<number, CanvasTexture>();
    const decals: FaceDecal[] = [];
    const sourcePositions = sourceGeometry.getAttribute("position");
    const sourceTriangles = Math.floor(sourcePositions.count / 3);
    const facePoint = new Vector3();
    const edgeA = new Vector3();
    const edgeB = new Vector3();
    const normal = new Vector3();
    const centroid = new Vector3();
    const down = new Vector3();
    const side = new Vector3();
    const basis = new Quaternion();

    for (let index = 0; index < sourceTriangles; index += 1) {
      const offset = 3 * index;
      const a = new Vector3().fromBufferAttribute(sourcePositions as BufferAttribute, offset);
      const b = new Vector3().fromBufferAttribute(sourcePositions as BufferAttribute, offset + 1);
      const c = new Vector3().fromBufferAttribute(sourcePositions as BufferAttribute, offset + 2);
      edgeA.copy(b).sub(a);
      edgeB.copy(c).sub(a);
      normal.copy(edgeA).cross(edgeB).normalize();
      centroid
        .copy(a)
        .add(b)
        .add(c)
        .multiplyScalar(1 / 3)
        .addScaledVector(normal, 0.00372);
      const texture = (() => {
        const value = index + 1;
        const cached = textureCache.get(value);
        if (cached) return cached;
        const made = makeNumberTexture(value);
        textureCache.set(value, made);
        return made;
      })();
      const material = new MeshStandardMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        color: 0xffefcf,
        roughness: 0.58,
        metalness: 0.25,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const decal = new Mesh(decalGeometry, material);
      facePoint.copy(a).sub(centroid).normalize();
      side.crossVectors(facePoint, normal).normalize();
      facePoint.crossVectors(normal, side).normalize();
      basis.setFromRotationMatrix(new Matrix4().makeBasis(side, facePoint, normal));
      decal.quaternion.copy(basis);
      decal.position.copy(centroid);
      decal.renderOrder = 3;
      decal.material.visible = false;
      body.add(decal);
      decals.push({ material, orientation: basis.clone(), value: index + 1 });
    }

    const vertices: Vector3[] = [];
    for (let index = 0; index < sourcePositions.count; index += 1) {
      const point = new Vector3().fromBufferAttribute(sourcePositions as BufferAttribute, index);
      if (!vertices.some((candidate) => candidate.equals(point))) vertices.push(point);
    }

    const shadowTexture = makeShadowTexture();
    const shadowGeometry = new PlaneGeometry(1.9, 1.9);
    const shadowMaterial = new MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.635;
    scene.add(shadow);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cameraTilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    const baseOrientation = new Quaternion();
    const revealTarget = new Quaternion();
    const revealCenter = new Vector3(0, 0.65, 0);
    const motion = new DiceMotion(seededRandom(seedFromTimestamp(startedAtRef.current ?? 0)));
    let lastRolledValue: number | undefined;
    let rollStartedAt: number | null = startedAtRef.current;
    const renderState: MotionState = {
      quaternion: new Quaternion(),
      position: new Vector3(),
      height: 0,
      scale: 1,
      revealProgress: 0,
    };

    let frame = 0;
    let disposed = false;
    let drawFn: () => void = () => {};
    const requestFrame = () => {
      if (disposed || frame) return;
      frame = window.requestAnimationFrame(() => drawFn());
    };

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width <= 0 || height <= 0) return;
      try {
        renderer.setSize(width, height);
      } catch {
        unavailableRef.current();
        return;
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      requestFrame();
    };

    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(host);

    const draw = () => {
      frame = 0;
      if (disposed) return;
      const currentPlayer = playerRef.current;
      const startedAt = startedAtRef.current;
      if (startedAt !== rollStartedAt) {
        rollStartedAt = startedAt;
      }
      const value = currentPlayer.value;
      if (value !== lastRolledValue) {
        if (typeof value === "number") {
          // Re-seed the path only when the rolled value changes (tie re-roll).
          lastRolledValue = value;
        }
      }
      const hasValue = typeof value === "number";
      for (const decal of decals) decal.material.visible = hasValue;
      const face = hasValue ? decals.find((decal) => decal.value === value) : undefined;
      if (face) {
        baseOrientation.copy(faceBaseOrientation(face.orientation)).premultiply(cameraTilt);
      } else {
        baseOrientation.identity();
      }

      const now = performance.now();
      const elapsed =
        rollStartedAt === null ? 1.7 : Math.max(0, (now - rollStartedAt) / 1000);
      const sample = motion.sample(elapsed, baseOrientation, vertices, reducedMotion.matches);
      renderState.quaternion.copy(sample.quaternion);
      renderState.position.copy(sample.position);
      renderState.height = sample.height;
      renderState.scale = sample.scale;
      renderState.revealProgress = 0;

      const currentState = stateRef.current;
      if (currentState.reveal && face) {
        const revealStart =
          typeof rollStartedAt === "number"
            ? rollStartedAt + REVEAL_START_OFFSET_MS
            : Math.max(now, (rollStartedAt ?? now - 1700) + 1700) + 300;
        revealTarget.copy(faceRevealOrientation(face.orientation, camera.quaternion));
        const presented = motion.present(
          (now - revealStart) / 1000,
          revealTarget,
          revealCenter,
          currentState.winner,
          reducedMotion.matches,
          {
            quaternion: renderState.quaternion,
            position: renderState.position,
            height: renderState.height,
            scale: 1,
          },
        );
        renderState.quaternion.copy(presented.quaternion);
        renderState.position.copy(presented.position);
        renderState.scale = presented.scale;
        renderState.revealProgress = presented.revealProgress;
      }

      body.position.copy(renderState.position);
      body.quaternion.copy(renderState.quaternion);
      body.scale.setScalar(renderState.scale);
      bodyMaterial.color.setHex(initiativeColor(isMeRef.current, currentPlayer.relation));
      rimMaterial.color.copy(bodyMaterial.color).multiplyScalar(0.82);
      shadow.position.set(body.position.x, -0.635, body.position.z);
      shadow.scale.setScalar(1 + 0.55 * renderState.height);
      shadowMaterial.opacity =
        (0.9 * (1 - 0.85 * renderState.revealProgress)) / (1 + 1.8 * renderState.height);

      try {
        renderer.render(scene, camera);
      } catch {
        unavailableRef.current();
        return;
      }

      const animating =
        !reducedMotion.matches &&
        (elapsed < 1.7 || (currentState.reveal && renderState.revealProgress < 1));
      if (animating) requestFrame();
    };

    drawFn = draw;
    requestRenderRef.current = requestFrame;

    const onReducedMotionChange = () => requestFrame();
    reducedMotion.addEventListener("change", onReducedMotionChange);
    resize();
    draw();

    return () => {
      disposed = true;
      requestRenderRef.current = () => {};
      reducedMotion.removeEventListener("change", onReducedMotionChange);
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.dispose();
      shadowTexture.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      for (const decal of decals) decal.material.dispose();
      decalGeometry.dispose();
      for (const texture of textureCache.values()) texture.dispose();
      sourceGeometry.dispose();
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      rimMaterial.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one renderer per die
  }, []);

  useEffect(() => {
    requestRenderRef.current();
  }, [player, isMe, reveal, winner, animationStartedAt]);

  return <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />;
}

export default InitiativeDiceCanvas;
