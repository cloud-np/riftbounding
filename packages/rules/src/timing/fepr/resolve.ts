/** Resolve — rules 340.1, including the §6.4 manual fallback. */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { executeCardScript } from "../../effects/execute";
import { afterChainItemResolved } from "./after";
import { noteExpirationFepr, removeChainItem } from "./chain";
import { resolvePermanent } from "./finalize";
import { openManual } from "./manual";
import { pushSpellToTrash } from "./spell";

export type FeprResult = "resolved" | "manual" | "none";

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
    const result = executeCardScript(item.cardName, "spell", {
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
    pushSpellToTrash(room, item, step);
    const openedBy = rules.history.chainOpenedBy;
    removeChainItem(room, item.id);
    afterChainItemResolved(room, step, openedBy);
    return "resolved";
  }

  const result = executeCardScript(item.cardName, item.abilityRef, {
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
  const openedBy = rules.history.chainOpenedBy;
  removeChainItem(room, item.id);
  afterChainItemResolved(room, step, openedBy);
  return "resolved";
}
