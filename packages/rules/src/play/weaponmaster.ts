/**
 * Weaponmaster (821.1.b / 821.1.c) — the `keyword:weaponmaster` custom effect.
 *
 * Weaponmaster is short for: "When you play me, you may choose a Card you control with the
 * Equipment tag. Necessary portions of its Rules Text are no longer Inactive if they are
 * currently Inactive. Pay the cost of its Equip ability, reduced by [A], to attach it to this
 * unit." (821.1.c)
 *
 * The trigger itself is the keyword entry in `triggers/keywords.ts` (`for_each` over the chosen
 * Equipment, so 403.2 binds the choice and no legal Equipment removes the trigger at 403.4).
 * This handler runs on resolution:
 * - the Equip cost alternatives come from `weaponmasterEquipCosts` (the [A] reduction plus the
 *   821.1.c.2.b Equip-cost reductions that read the chosen unit, e.g. Hextech Gauntlets);
 * - the first alternative that can actually be paid is paid (821.1.c.3/.c.4);
 * - if none can be paid, or the Equipment can no longer be attached, nothing happens
 *   (821.1.c.5: it stays in its current location);
 * - the standard `attach` op performs the Attach (435, 818.1.c.2) and emits the `attach` event
 *   that "when this becomes equipped" effects read (818.2/818.2.a).
 *
 * The chosen Equipment is frozen into the pushed frame (`obj:<id>`): the `for_each` element
 * (`it`) is restored before a pushed frame runs.
 */
import type { Effect } from "@rift/protocol";
import { registerCustomEffect } from "../effects/ops/control";
import { isOnBoard } from "../effects/ops/util";
import { RESOLVED } from "../effects/execute";
import { canPayCost, payCost } from "./payment";
import { weaponmasterEquipCosts } from "./keyword-helpers";

export const WEAPONMASTER_EFFECT_ID = "keyword:weaponmaster";

registerCustomEffect(WEAPONMASTER_EFFECT_ID, (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const equipmentId = machine.env.it;
  if (!equipmentId) return RESOLVED;
  const host = context.step.host;
  if (!isOnBoard(context.room, host, equipmentId)) return RESOLVED;
  // 821.1.c.2: the cost is determined as though the Equip ability were activated choosing the
  // unit with Weaponmaster (the trigger's source object).
  const unitId = machine.env.sourceObjectId;
  const costs = weaponmasterEquipCosts(context.room, host, equipmentId, unitId);
  if (!costs) return RESOLVED; // 821.1.c.4: no Equip cost -> it can't be paid.
  for (const cost of costs) {
    // 821.1.c.2: the cost is determined as if the Equip ability were activated. 821.1.c.5: an
    // alternative that needs a player decision (object-cost choice) is not offered here.
    if (!canPayCost(context.room, host, context.controller, cost, { sourceObjectId: equipmentId })) continue;
    const paid = payCost(context.room, context.step, context.controller, cost, {
      sourceObjectId: equipmentId,
    });
    if (!paid.ok) continue;
    const attach: Effect = {
      op: "attach",
      gear: { targetRef: `obj:${equipmentId}` },
      to: { targetRef: "self" },
    };
    machine.push({ effect: attach });
    return RESOLVED;
  }
  // 821.1.c.5: unpayable or unattachable -> it stays where it is, attached to anything it was.
  return RESOLVED;
});
