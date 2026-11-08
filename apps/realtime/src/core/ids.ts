/**
 * Room-code allocation.
 *
 * Client evidence: join input `pattern="[A-Z0-9]{1,10}"`, `maxLength: 10`, placeholder `AB12CD`;
 * the code is always uppercased (`35qz5rkx7yexy.js:41490-41545`, `dm()` in 21700). The original
 * server allocates five-character uppercase alphanumeric codes: every real room code in the
 * recon captures is five characters (`V30BY`, `PZUSU` — `.recon/reports/01-browser-walkthrough.md`
 * §111). `V30BY` contains `0`, so zero is part of the alphabet (no ambiguous-glyph subset).
 * Collisions are retried by the coordinator (`createMatchRoomInWorker`).
 */

const ROOM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{1,10}$/u;

function randomInt(max: number): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return (buffer[0] ?? 0) % max;
  }
  return Math.floor(Math.random() * max);
}

export function generateRoomCode(): string {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)] ?? "A";
  }
  return code;
}

export function normalizeRoomCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
