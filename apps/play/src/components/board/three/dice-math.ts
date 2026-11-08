/**
 * Initiative dice — pure tumble / reveal maths (module 157661, chunk
 * `3vkoknf821dno.js`). Values are copied verbatim from the original bundle.
 *
 * The animation is a pure function of elapsed seconds; the rolled value itself is
 * server state (`room.initiativeRolls`) and is only used to orient a face.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Quaternion,
  Vector3,
} from "three";

/** Vertical bounce constant `(2.88 - 1.05) / 0.6`. */
export const BOUNCE_SLOPE = (2.88 - 1.05) / 0.6;
export const ROLL_DURATION_SECONDS = 1.7;
export const REVEAL_DURATION_SECONDS = 0.44;
export const REVEAL_START_OFFSET_MS = 2000;
export const REVEAL_FALLBACK_OFFSET_MS = 300;

const UP = new Vector3(0, 1, 0);
const RIGHT = new Vector3(1, 0, 0);

/** Mulberry32 seeded from the animation start timestamp (deterministic tumble path). */
export function seedFromTimestamp(timestamp: number): number {
  const base = Number.isFinite(timestamp) ? Math.trunc(timestamp) >>> 0 : 0;
  return (base ^ 0x9e3779b9) >>> 0;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bounce curve from the bundle (`h` in 157661). */
export function bounceHeight(elapsedSeconds: number): number {
  let t = Math.max(0, elapsedSeconds);
  if (t < 0.6) return 1.05 + BOUNCE_SLOPE * t - 8 * t * t;
  t -= 0.6;
  let amplitude = (9.6 - BOUNCE_SLOPE) * 0.48;
  while (amplitude > 0.08) {
    const segment = (2 * amplitude) / 16;
    if (t < segment) return Math.max(0, amplitude * t - 8 * t * t);
    t -= segment;
    amplitude *= 0.48;
  }
  return 0;
}

/** `clamp01` used by both the tumble and the reveal. */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export interface DiceMotionInit {
  direction: number;
  drift: number;
  turns: number;
  axis: Vector3;
}

export interface DiceMotionSample {
  quaternion: Quaternion;
  position: Vector3;
  height: number;
  scale: number;
}

/** Per-die randomised tumble parameters (`class f` in the bundle). */
export class DiceMotion {
  readonly direction: number;
  readonly drift: number;
  readonly turns: number;
  readonly axis: Vector3;

  private readonly rotation = new Quaternion();
  private readonly vertex = new Vector3();

  constructor(random: () => number = Math.random) {
    this.direction = random() < 0.5 ? -1 : 1;
    this.drift = (random() - 0.5) * 0.3;
    this.turns = 13 + 5 * random();
    this.axis = new Vector3(0.7 + 0.6 * random(), 0.25, 0.6 * this.direction).normalize();
  }

  /** `sample(e, baseQuaternion, vertices, reducedMotion)`. */
  sample(
    elapsedSeconds: number,
    baseQuaternion: Quaternion,
    vertices: readonly Vector3[],
    reducedMotion = false,
  ): DiceMotionSample {
    const i = reducedMotion ? ROLL_DURATION_SECONDS : Math.max(0, elapsedSeconds);
    const l = clamp01(i / ROLL_DURATION_SECONDS);
    const a = 1 - l;
    const s = i < 0.6 ? 1 : Math.exp(-1.8 * (i - 0.6));
    const f = this.turns * a * a * s;

    const quaternion = baseQuaternion.clone();
    this.rotation.setFromAxisAngle(this.axis, f * this.direction);
    quaternion.premultiply(this.rotation);
    this.rotation.setFromAxisAngle(UP, 0.37 * f);
    quaternion.premultiply(this.rotation);

    const wobble = Math.sin(l * Math.PI * 10) * Math.sin(l * Math.PI) * 0.045;
    this.rotation.setFromAxisAngle(RIGHT, wobble * a);
    quaternion.premultiply(this.rotation);

    let drop = 0;
    for (const vertex of vertices) {
      this.vertex.copy(vertex).applyQuaternion(quaternion);
      drop = Math.max(drop, -this.vertex.y);
    }

    const height = bounceHeight(i);
    const position = new Vector3(
      this.direction * (-0.54 * a ** 3 + 0.12 * l),
      -0.64 + drop + height,
      this.drift * l - 0.18 * a ** 2,
    );

    return { quaternion, position, height, scale: 1 };
  }

  /**
   * `present(e, target, center, winner, reducedMotion)` — 440 ms smoothstep
   * reveal rotating the rolled face towards the camera.
   */
  present(
    elapsedSeconds: number,
    target: Quaternion,
    center: Vector3,
    winner: boolean,
    reducedMotion = false,
    current?: DiceMotionSample,
  ): { quaternion: Quaternion; position: Vector3; scale: number; revealProgress: number } {
    const t = reducedMotion ? 1 : clamp01(elapsedSeconds / REVEAL_DURATION_SECONDS);
    const k = t * t * (3 - 2 * t);
    const quaternion = (current?.quaternion.clone() ?? new Quaternion()).slerp(target, k);
    const position = (current?.position.clone() ?? new Vector3()).lerp(center, k);
    return {
      quaternion,
      position,
      scale: 1 + (winner ? 0.65 : 0.35) * k,
      revealProgress: k,
    };
  }
}

/** Build the exact tumble base orientation for a rolled face. */
export function faceBaseOrientation(faceOrientation: Quaternion): Quaternion {
  return faceOrientation.clone().invert().premultiply(CAMERA_TILT);
}

/** The reveal target: the face turned toward the camera. */
export function faceRevealOrientation(
  faceOrientation: Quaternion,
  cameraQuaternion: Quaternion,
): Quaternion {
  return faceOrientation.clone().invert().premultiply(cameraQuaternion);
}

/** `U = setFromAxisAngle((1,0,0), -π/2)` from the bundle. */
export const CAMERA_TILT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

/* --------------------------------------------------------------- geometry */

export interface PlateGeometryData {
  positions: Float32Array;
  /** Vertices in group 0 (addGroup start/count are vertex indices). */
  insetVertexCount: number;
  /** Number of inset plate triangles (36 for a dodecahedron). */
  insetTriangleCount: number;
  vertexPositions: Vector3[];
}

/**
 * Rebuild the dodecahedron into inset pentagon plates + rim quads + centre-hole
 * fans (module 157661 `w`). The returned buffer uses two groups: 0 = plate
 * triangles, 1 = rims + fans.
 */
export function buildInsetPlateGeometry(source: BufferGeometry): PlateGeometryData {
  const attribute = source.getAttribute("position");
  const unique: Vector3[] = [];
  const insetByEdge = new Map<string, Array<Vector3[]>>();
  const insetByVertex = new Map<number, Vector3[]>();
  const positions: number[] = [];

  const centroid = new Vector3();
  const edge = new Vector3();
  const cross = new Vector3();
  const pushTriangle = (a: Vector3, b: Vector3, c: Vector3) => {
    edge.copy(b).sub(a).cross(cross.copy(c).sub(a));
    centroid.copy(a).add(b).add(c);
    const ordered = edge.dot(centroid) >= 0 ? [a, b, c] : [a, c, b];
    for (const point of ordered) positions.push(point.x, point.y, point.z);
  };

  const count = attribute.count;
  for (let index = 0; index < count; index += 3) {
    const tri = [0, 1, 2].map((offset) =>
      new Vector3().fromBufferAttribute(attribute as BufferAttribute, index + offset),
    );
    const ids = tri.map((point) => {
      let found = unique.findIndex((candidate) => candidate.distanceToSquared(point) < 1e-10);
      if (found < 0) {
        found = unique.length;
        unique.push(point);
      }
      return found;
    });
    const faceCenter = tri[0]!
      .clone()
      .add(tri[1]!)
      .add(tri[2]!)
      .multiplyScalar(1 / 3);
    const inset = tri.map((point) => point.clone().lerp(faceCenter, 0.075));

    pushTriangle(inset[0]!, inset[1]!, inset[2]!);
    for (let corner = 0; corner < 3; corner += 1) {
      const next = (corner + 1) % 3;
      const low = ids[corner]!;
      const high = ids[next]!;
      const key = low < high ? `${low}:${high}` : `${high}:${low}`;
      const pair = low < high ? [inset[corner]!, inset[next]!] : [inset[next]!, inset[corner]!];
      insetByEdge.set(key, [...(insetByEdge.get(key) ?? []), pair]);
      insetByVertex.set(low, [...(insetByVertex.get(low) ?? []), inset[corner]!]);
    }
  }

  const insetVertexCount = positions.length / 3;
  for (const pairs of insetByEdge.values()) {
    const first = pairs[0];
    const second = pairs[1];
    if (!first || !second) continue;
    pushTriangle(first[0]!, second[0]!, second[1]!);
    pushTriangle(first[0]!, second[1]!, first[1]!);
  }

  for (const [index, points] of insetByVertex) {
    const origin = unique[index];
    if (!origin) continue;
    const normal = origin.clone().normalize();
    const center = points.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(1 / points.length);
    const tangent = points[0]!.clone().sub(center).normalize();
    const binormal = new Vector3().crossVectors(normal, tangent);
    const angle = (point: Vector3) =>
      Math.atan2(
        point.clone().sub(center).dot(binormal),
        point.clone().sub(center).dot(tangent),
      );
    const sorted = [...points].sort((a, b) => angle(a) - angle(b));
    for (let i = 0; i < sorted.length; i += 1) {
      pushTriangle(center, sorted[i]!, sorted[(i + 1) % sorted.length]!);
    }
  }

  return {
    positions: new Float32Array(positions),
    insetVertexCount,
    insetTriangleCount: insetVertexCount / 3,
    vertexPositions: unique,
  };
}

/** Values that get an underline so 6 does not read as 9. */
export function isUnderlinedDieValue(value: number): boolean {
  return value === 6 || value === 9;
}

/** Relation → body colour (`h(player, isMe)` in the bundle). */
export function initiativeColor(isMe: boolean, relation: "self" | "ally" | "opponent"): number {
  if (isMe) return 0x2bc78f;
  if (relation === "ally") return 0x4fafd0;
  return 0xd88936;
}
