/** Finalize — rule 337, including 337.2 immediate permanent resolution. */
import type { BattlefieldZone, ChainItem, Room } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { pushEvent } from "../../types";
import { executeCardScript } from "../../effects/execute";
import { runFinalizeHooks } from "../hooks";
import { afterChainItemResolved } from "./after";
import { noteExpirationFepr, removeChainItem } from "./chain";
import { hasUnitPresentAt } from "../../state/presence";

/** 337.2: Units/Gear/Add-resource abilities resolve immediately on finalize. */
export function finalizeChainItem(room: Room, item: ChainItem, step: RulesStepContext): void {
  const rules = room.rules;
  if (!rules) return;
  item.status = "finalized";
  pushEvent(step.events, { type: "finalize", cardName: item.cardName, data: { itemId: item.id } });
  // 337.1 finalize step: R2-effects registers “when played” triggers here (afterFinalize).
  runFinalizeHooks(room, item, step);

  if (item.origin === "add") {
    // 430.2/430.2.a: Add abilities finalize and resolve immediately; Priority and Focus do not
    // pass. The effect comes from the card script — R1 never fabricates resources from the
    // `addsResources` hint. TODO(R2-effects): execute the scripted Add effect; until then an
    // unimplemented effect leaves the Rune Pool untouched.
    const result = executeCardScript(item.cardName, item.abilityRef, {
      room,
      step,
      itemId: item.id,
      controller: item.controller,
      choices: item.choices,
    });
    pushEvent(step.events, {
      type: result.status === "resolved" ? "add_resolved" : "add_unimplemented",
      playerId: item.controller,
      cardName: item.cardName,
      data: { itemId: item.id, ...(result.reason ? { reason: result.reason } : {}) },
    });
    removeChainItem(room, item.id);
    return;
  }

  if (item.kind === "card" && item.cardSnapshot) {
    const info = step.host.cardInfo(room, item.cardSnapshot.id);
    const type = (info?.type ?? item.cardSnapshot.type ?? "").toLowerCase();
    if (type.includes("unit") || type.includes("gear")) {
      resolvePermanent(room, item, type.includes("unit"), step);
    }
  }
}

/** 351.1 / 355.2: a permanent becomes a Game Object at its chosen location. */
export function resolvePermanent(room: Room, item: ChainItem, isUnit: boolean, step: RulesStepContext): void {
  const rules = room.rules;
  const snapshot = item.cardSnapshot;
  if (!rules || !snapshot) return;
  const requested = item.choices.location;
  let destination = "base";
  if (typeof requested === "string") {
    // 355.2.a: validated in rules_play (invalid locations are cancelled at 358.5). Keep the
    // control proxy here only as a defensive check for restored/direct states. 359.2.c/d: a
    // location the process of play validated (it records `totalCost`) is used as is — Deploy
    // (830.1.b.1) and 355.2.b permissions allow battlefields without the controller's Units.
    const zones = step.host.battlefieldZones(room);
    const validated = item.totalCost !== undefined;
    if (zones.includes(requested as BattlefieldZone) && (validated || hasUnitPresentAt(room, step.host, item.controller, requested))) {
      destination = requested;
    } else if (requested === "base") {
      destination = "base";
    }
  }
  step.host.putCard(room, item.controller, destination, snapshot);
  // 143.4 Units enter exhausted; 149.1 Gear enter ready.
  if (isUnit) step.host.setExhausted(room, snapshot.id, true);
  if (isUnit) {
    const info = step.host.cardInfo(room, snapshot.id);
    const object = (rules.objects[snapshot.id] ??= {});
    if (typeof info?.might === "number") object.baseMight = info.might;
    object.enteredThisTurn = true;
    const list = (rules.history.unitsPlayedThisTurn ??= {});
    list[item.controller] = [...(list[item.controller] ?? []), snapshot.id];
  }
  // 340.2/340.2.a/340.4/346: a Unit/Gear resolves immediately (337.2), but the resolution still
  // advances Priority/Focus exactly like any other resolved item. `openedBy` must be captured
  // before the chain item is removed (removeChainItem clears history.chainOpenedBy).
  const openedBy = rules.history.chainOpenedBy;
  removeChainItem(room, item.id);
  pushEvent(step.events, {
    type: isUnit ? "unit_played" : "gear_played",
    cardId: snapshot.id,
    playerId: item.controller,
    zone: destination,
    cardName: snapshot.name,
  });
  // 430.2.a: Add abilities never pass Priority/Focus; only card permanents do.
  if (item.origin !== "add") afterChainItemResolved(room, step, openedBy);
}

// Re-exported so `resolve.ts` can defensively finalize a permanent without importing the
// resolution module back (keeps the FEPR split acyclic).
export { noteExpirationFepr };
