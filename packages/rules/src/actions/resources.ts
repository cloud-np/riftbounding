/** Resources / Rune Pool — rules 165–168, 430, 431. */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { interceptAction } from "../timing/hooks";

/* ---------------------------------------------------------------- channel (431) */

/** 315.3.b / 431.4.a: channel two runes (as many as possible, 315.3.b.1). */
export function channelRunes(
  room: Room,
  playerId: string,
  count: number,
  step: RulesStepContext,
  options: { exhausted?: boolean } = {},
): string[] {
  const proposal = interceptAction(room, step, {
    type: "channel",
    playerId,
    amount: Math.max(0, Math.trunc(count)),
  });
  if (!proposal) return [];
  const ids = step.host.channel(room, playerId, Math.max(0, Math.trunc(proposal.amount ?? count)));
  pushEvent(step.events, { type: "channel", playerId, amount: ids.length, data: { runeIds: ids } });
  if (options.exhausted) {
    for (const id of ids) step.host.setExhausted(room, id, true);
  }
  return ids;
}

/* ---------------------------------------------------------------- resources (165–168, 430) */

export function addResources(
  room: Room,
  playerId: string,
  resources: { energy?: number; power?: Partial<Record<string, number>> },
  step: RulesStepContext,
): void {
  const rules = room.rules;
  if (!rules) return;
  // 367–375: replacement effects may prevent or rewrite resource additions.
  const proposal = interceptAction(room, step, {
    type: "add_resources",
    playerId,
    amount: Math.max(0, Math.trunc(resources.energy ?? 0)),
    data: { power: resources.power ?? {} },
  });
  if (!proposal) return;
  const pool = (rules.pools[playerId] ??= { energy: 0, power: {} });
  pool.energy += Math.max(0, Math.trunc(proposal.amount ?? resources.energy ?? 0));
  const power = (proposal.data?.power as Partial<Record<string, number>> | undefined) ?? resources.power ?? {};
  for (const [domain, value] of Object.entries(power)) {
    if (typeof value !== "number" || value <= 0) continue;
    pool.power[domain as keyof typeof pool.power] =
      (pool.power[domain as keyof typeof pool.power] ?? 0) + Math.trunc(value);
  }
  pushEvent(step.events, {
    type: "add_resources",
    playerId,
    amount: proposal.amount ?? resources.energy ?? 0,
    data: { power },
  });
}

export function emptyPools(room: Room, step: RulesStepContext): void {
  const rules = room.rules;
  if (!rules) return;
  for (const pool of Object.values(rules.pools)) {
    pool.energy = 0;
    pool.power = {};
  }
  pushEvent(step.events, { type: "pools_empty" });
}
