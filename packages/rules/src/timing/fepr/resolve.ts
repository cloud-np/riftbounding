/** Resolve — rules 340.1, including the §6.4 manual fallback and resolution-time prompts. */
import type { ChainItem, Room } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { executeCardScript } from "../../effects/execute";
import { afterChainItemResolved } from "./after";
import { noteExpirationFepr, removeChainItem } from "./chain";
import { resolvePermanent } from "./finalize";
import { openManual } from "./manual";
import { pushSpellToTrash } from "./spell";

/** `await`: the item is still resolving behind an `effects.resume` prompt (355.18). */
export type FeprResult = "resolved" | "manual" | "await" | "none";

/**
 * 340 / 359.3.f: the item has executed all of its instructions — a spell goes to its owner's
 * Trash, the item leaves the chain, and Priority/Focus move on (340.2–340.4).
 */
export function finishResolution(room: Room, item: ChainItem, step: RulesStepContext): void {
  const rules = room.rules;
  if (!rules || !rules.chain.some((entry) => entry.id === item.id)) return;
  if (item.kind === "card") pushSpellToTrash(room, item, step);
  const openedBy = rules.history.chainOpenedBy;
  removeChainItem(room, item.id);
  afterChainItemResolved(room, step, openedBy);
}

/** 340.1: the newest Finalized Chain Item resolves. */
export function resolveNewest(room: Room, step: RulesStepContext): FeprResult {
  const rules = room.rules;
  if (!rules) return "none";
  if (rules.manual) return "manual";
  const item = [...rules.chain].reverse().find((entry) => entry.status === "finalized");
  if (!item) return "none";
  // 317.2.f: an item resolving during the Expiration Step restarts the step.
  noteExpirationFepr(rules);

  if (item.kind === "card") {
    const info = item.cardSnapshot ? step.host.cardInfo(room, item.cardSnapshot.id) : null;
    const type = (info?.type ?? item.cardSnapshot?.type ?? "").toLowerCase();
    if (type.includes("unit") || type.includes("gear")) {
      // Defensive: a permanent should already have resolved during finalize.
      resolvePermanent(room, item, type.includes("unit"), step);
      return "resolved";
    }
  }
  const result = executeCardScript(item.cardName, item.kind === "card" ? "spell" : item.abilityRef, {
    room,
    step,
    itemId: item.id,
    controller: item.controller,
    choices: item.choices,
  });
  if (result.status === "manual") {
    openManual(room, item, step, result.reason);
    return "manual";
  }
  if (result.status === "await") {
    // 359 / 355.18: the remaining instructions run once the prompt is answered; until then the
    // item is still resolving and stays on the chain (the resume handler finishes it).
    return "await";
  }
  finishResolution(room, item, step);
  return "resolved";
}
