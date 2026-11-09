/**
 * The 337.1 `afterFinalize` hook of the effects layer, for every chain item that becomes Finalized:
 *
 * - every item: the zones of its chosen targets are recorded (`targetSnapshot`) so resolution
 *   can tell a target that moved to or from a non-board zone (359.3.e.2 / 359.3.e.4);
 * - triggered items: a stale Priority holder is cleared so the newest item's controller gains
 *   Priority (337.4 / 340.4);
 * - card items: a paid optional additional cost is remembered on the permanent (356.4.f.1).
 *
 * The steps before Finalization (403 "you may" / choices / 403.4 removal, 404.1.b.1 / 383.3.b
 * trigger base costs, 405.2 declining) are the play layer's single 399–407 path
 * (`play/triggered.ts`, `prepareTriggeredItem`).
 */
import type { ChainItem, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { idsOf } from "../effects/env";
import { findChainItem, isBoardZone, locate } from "../effects/objects";
import { noteShowOff, SHOW_OFF_KEY } from "../play/show-off";

/** 359.3.e: note where each chosen object is when the item finalizes. */
export function snapshotTargets(room: Room, item: ChainItem, step: RulesStepContext): void {
  const snapshot: NonNullable<ChainItem["targetSnapshot"]> = { ...(item.targetSnapshot ?? {}) };
  let any = false;
  for (const [key, value] of Object.entries(item.choices ?? {})) {
    if (key === "location" || key === SHOW_OFF_KEY || key.startsWith("$")) continue;
    for (const id of idsOf(value)) {
      if (snapshot[id]) continue;
      const located = locate(room, step.host, id);
      if (located) {
        snapshot[id] = { zone: located.zone, controller: located.playerId };
        any = true;
        // 359.3.e.4: mark the board object so a leave-and-return is detectable on resolution.
        if (room.rules && isBoardZone(room, step.host, located.zone)) {
          const object = (room.rules.objects[id] ??= {});
          object.targetedBy = [...(object.targetedBy ?? []).filter((entry) => entry !== item.id), item.id];
        }
      } else if (findChainItem(room, id)) {
        snapshot[id] = { zone: "chain" };
        any = true;
      }
    }
  }
  if (any) item.targetSnapshot = snapshot;
}

/** 337.1 afterFinalize hook body. */
export function onItemFinalized(room: Room, item: ChainItem, step: RulesStepContext): void {
  if (item.kind === "triggered") {
    // 337.4 / 340.4: once the pending triggers are finalized, the controller of the newest item
    // gains Priority. A trigger placed by a cleanup after Priority was already handed out (e.g.
    // a Deathknell after a spell resolved) must not leave the stale holder in place; the advance
    // loop grants the newest item's controller.
    if (room.rules) room.rules.priority = null;
  }
  // 832.1.d.1: shown-off information is noted before the targets (it is not a target).
  noteShowOff(room, item, step);
  snapshotTargets(room, item, step);
  notePaidAdditionalCost(room, item);
}

/**
 * 355.1.a / 356.4.f.1: remember on the permanent whether its optional additional cost was paid
 * (R2-play contract: `choices.additionalCost === true` or a non-empty `paid.additional`), so its
 * own "if you paid the additional cost" play effect can read it after the chain item is gone.
 */
function notePaidAdditionalCost(room: Room, item: ChainItem): void {
  const rules = room.rules;
  const card = item.cardSnapshot;
  if (!rules || item.kind !== "card" || !card) return;
  const flags = ["additionalCost", "optionalCost", "paidAdditional"];
  const paid =
    flags.some((key) => item.choices?.[key] === true) ||
    (!!item.paid?.additional && Object.keys(item.paid.additional).length > 0);
  if (paid) (rules.objects[card.id] ??= {}).paidAdditionalCost = true;
}
