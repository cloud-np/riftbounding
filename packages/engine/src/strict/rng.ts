/**
 * Deterministic strict-room randomness.
 *
 * A strict bot/solo room stores `Room.rngSeed` + `Room.rngCursor`. Every draw comes from
 * `seededValue(seed, cursor)` and advances the cursor, so the RNG position is part of every
 * rewind snapshot. `Room.rngSeed` is derived from state (`roomCode|createdAt`) and never from
 * `Date`/`Math.random`. Strict human-vs-human rooms do not set a seed and keep the server clock
 * RNG, so their randomness cannot be predicted from a snapshot.
 *
 * `splitmix32` is counter-based: seeking to a cursor does not require replaying earlier draws.
 */

export function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The state-derived game seed for a strict room. */
export function deriveStrictSeed(roomCode: string, createdAt: number): number {
  return hashSeed(`${roomCode.trim().toUpperCase()}|${createdAt}`) >>> 0;
}

/** One deterministic draw at `index` for `seed` (splitmix32 finalizer). */
export function seededValue(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  value = (value ^ (value >>> 15)) >>> 0;
  return value / 4294967296;
}

export interface StrictRandom {
  rng: () => number;
  /** Next cursor value (the number of draws consumed). */
  position: () => number;
}

/** A seeded stream starting at `cursor`; `position()` reports the next cursor. */
export function createStrictRandom(seed: number, cursor = 0): StrictRandom {
  let position = Math.max(0, Math.trunc(cursor));
  return {
    rng: () => seededValue(seed, position++),
    position: () => position,
  };
}

/**
 * The bot picker's seed: state-derived game seed + the number of accepted actions. Repeating
 * the same human action from a rewound snapshot therefore asks the bot the same question.
 */
export function botPickerSeed(room: {
  rngSeed?: number;
  actionCount?: number;
  roomCode?: string;
  createdAt?: number;
}): number {
  const seed =
    typeof room.rngSeed === "number"
      ? room.rngSeed
      : deriveStrictSeed(room.roomCode ?? "", room.createdAt ?? 0);
  return hashSeed(`${seed}|bot|${room.actionCount ?? 0}`);
}
