/**
 * Payment sources — rules 162–167 (Runes, Basic Runes, Rune Pools).
 *
 * A player pays Energy and Power from their Rune Pool (166) and by activating their Basic
 * Runes' two Add abilities while paying (357.1.a / 430.3):
 *
 * - 164.2.a `[Reaction][>] [E]: Add [1].` — only a ready rune can be exhausted (415.4);
 * - 164.2.b `[Reaction][>] Recycle this: Add [C].` — no exhaust in the cost, so an exhausted
 *   rune can still be recycled for one Power of its own Domain (164.2.b.1).
 *
 * Pure reads only.
 */
import type { Room, RunePool } from "@rift/protocol";
import type { RulesHost } from "../host";
import { cardDomains, type PowerDomain } from "./cost-model";

export interface RuneSource {
  id: string;
  domain: PowerDomain | null;
  exhausted: boolean;
}

export interface PaymentSources {
  playerId: string;
  pool: { energy: number; power: Partial<Record<PowerDomain | "any", number>> };
  runes: RuneSource[];
}

/** 164.1: the six Basic Runes are named after their Domain. */
export function isBasicRuneName(name: string | undefined): boolean {
  return !!name && /^(fury|calm|mind|body|chaos|order)\s+rune$/i.test(name.trim());
}

/** The runes a player controls on the board (`runeArea`), Basic Runes only (164.2). */
export function runeSources(room: Room, host: RulesHost, playerId: string): RuneSource[] {
  const out: RuneSource[] = [];
  for (const card of host.zoneCards(room, playerId, "runeArea")) {
    const info = host.cardInfo(room, card.id);
    if (!isBasicRuneName(info?.name ?? card.name)) continue;
    const domains = cardDomains(info ?? { name: card.name });
    out.push({ id: card.id, domain: domains[0] ?? null, exhausted: card.exhausted === true });
  }
  return out;
}

export function poolOf(room: Room, playerId: string): RunePool {
  return room.rules?.pools[playerId] ?? { energy: 0, power: {} };
}

export function paymentSources(room: Room, host: RulesHost, playerId: string): PaymentSources {
  const pool = poolOf(room, playerId);
  const power: Partial<Record<PowerDomain | "any", number>> = {};
  for (const [key, value] of Object.entries(pool.power)) {
    if (typeof value === "number" && value > 0 && key !== "Unknown") {
      power[key as PowerDomain | "any"] = Math.trunc(value);
    }
  }
  return {
    playerId,
    pool: { energy: Math.max(0, Math.trunc(pool.energy)), power },
    runes: runeSources(room, host, playerId),
  };
}
