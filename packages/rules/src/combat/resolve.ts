/**
 * The Resolution Step — rule 468 (468.1–468.7); 190.3.b, 190.4, 471.1, 740.3.a.
 *
 * 468.1 Combat Special Cleanup (3c heal all Units, 3d recall Attackers if Defenders remain) →
 * 468.3 combat result → 468.5 control / Conquer → 468.7 combat ends. Each later step is a Task
 * that only becomes Outstanding once the chain items created by the step before have resolved
 * (468.2 / 468.4 / 468.6); `continueCombat` (combat/progress.ts) does that sequencing.
 */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { clearPasses, dropFocus, stageCombat, stageShowdown } from "../state";
import { runCleanup } from "../cleanup/cleanup";
import { conquer } from "../actions/score";
import { battlefieldController, loseControl, setBattlefieldController } from "../actions/control";
import { clearCombatDesignations } from "./designate";
import { hasUnitPresentAt, unitsPresentAt } from "../state/presence";

/** 468.1.a: "3c. Heal all Units." and "3d. Recall Attackers present … if Defenders are still present." */
export const COMBAT_CLEANUP_INSERTS = ["heal-all-units", "recall-attackers"] as const;

/** 468.1 / 468.1.a: perform the Combat Special Cleanup. */
export function runCombatCleanup(room: Room, step: RulesStepContext): void {
  const combat = room.rules?.combat;
  if (!combat) return;
  combat.step = "resolution";
  runCleanup(room, step, { insert: { after: "3a", steps: [...COMBAT_CLEANUP_INSERTS] } });
}

/**
 * 468.3: determine the combat result.
 *
 * - 468.3.a / 468.3.b: a designated player wins when they are the only player with units
 *   remaining at the battlefield; the other designated player loses.
 * - 468.3.c: units at the battlefield inherit their controller's result.
 * - 468.3.d: "No Result" when units were recalled at 3d, when both players (or neither) have
 *   units here. 468.3.d.1: with both players' units remaining, stage a Showdown and a Combat here.
 */
export function determineCombatResult(room: Room, step: RulesStepContext): { winner: string | null; loser: string | null } {
  const rules = room.rules;
  const combat = rules?.combat;
  if (!rules || !combat) return { winner: null, loser: null };
  const zone = combat.battlefield;
  const progress = (rules.history.combatProgress ??= { battlefield: zone, stage: "result" });
  const present = step.host.activePlayerIds(room).filter((id) => hasUnitPresentAt(room, step.host, id, zone));
  const participants = [combat.attacker, combat.defender];
  let winner: string | null = null;
  let loser: string | null = null;
  if (!progress.recalled) {
    const remaining = participants.filter((id) => present.includes(id));
    const outsiders = present.filter((id) => !participants.includes(id));
    if (remaining.length === 1 && outsiders.length === 0) {
      winner = remaining[0]!;
      loser = participants.find((id) => id !== winner) ?? null;
    }
  }
  const noResult = winner === null;
  if (noResult && participants.every((id) => present.includes(id))) {
    // 468.3.d.1
    stageShowdown(rules, zone);
    stageCombat(rules, zone);
  }
  progress.result = { winner, loser, noResult };
  const unitResults: Record<string, "win" | "loss"> = {};
  for (const card of unitsPresentAt(room, step.host, zone)) {
    const located = step.host.findCard(room, card.id);
    if (!located) continue;
    if (located.playerId === winner) unitResults[card.id] = "win";
    else if (located.playerId === loser) unitResults[card.id] = "loss";
  }
  pushEvent(step.events, {
    type: "combat_result",
    zone,
    ...(winner ? { playerId: winner } : {}),
    data: {
      rule: "468.3",
      winner,
      loser,
      noResult,
      recalled: progress.recalled === true,
      units: unitResults,
    },
  });
  return { winner, loser };
}

/**
 * 468.5: if no Showdown or Combat is staged here, the player with Units remaining Establishes
 * Control if they didn't already control the battlefield (468.5.e: not necessarily the
 * Contested applier); 468.5.d: that results in a Conquer if they have not scored it this turn.
 * 468.5.a clears Contested, 468.5.b makes an empty battlefield Uncontrolled and 468.5.c removes
 * Hidden cards that do not share the battlefield's controller.
 */
export function establishCombatControl(room: Room, step: RulesStepContext): void {
  const rules = room.rules;
  const combat = rules?.combat;
  if (!rules || !combat) return;
  const zone = combat.battlefield;
  if (rules.staged.showdowns.includes(zone) || rules.staged.combats.includes(zone)) return;
  // 468.5.a
  delete rules.contested[zone];
  const present = step.host.activePlayerIds(room).filter((id) => hasUnitPresentAt(room, step.host, id, zone));
  if (present.length === 0) {
    // 468.5.b
    loseControl(room, zone, step, "468.5.b");
  } else if (present.length === 1) {
    const player = present[0]!;
    const controller = battlefieldController(room, zone, step.host);
    if (controller !== player) {
      // 468.5 / 468.5.d: `conquer` establishes control (one `establish_control` event, NEW-2)
      // and scores when the battlefield was not yet scored this turn.
      conquer(room, player, zone, step);
    } else {
      // Already in control: make the (possibly inferred) control explicit; no Conquer.
      setBattlefieldController(room, zone, player);
    }
  }
  // 468.5.c
  const owner = battlefieldController(room, zone, step.host);
  for (const player of room.players) {
    if (!player.board) continue;
    for (const card of [...step.host.zoneCards(room, player.id, zone)]) {
      if (!card.hidden || player.id === owner) continue;
      if (step.host.moveCardToOwnerZone(room, card.id, "trash")) {
        pushEvent(step.events, {
          type: "hidden_card_to_trash",
          cardId: card.id,
          playerId: player.id,
          zone,
          data: { rule: "468.5.c" },
        });
      }
    }
  }
}

/**
 * 468.7: combat ends — 468.7.a remove designations, 468.7.b "end of combat" effects
 * (`combat_end`), 468.7.c "this combat" effects expire. The state leaves the Showdown State, so a
 * Cleanup follows (319.1); it begins a staged Showdown/Combat (468.3.d.1) when one is waiting.
 */
export function endCombat(room: Room, step: RulesStepContext): boolean {
  const rules = room.rules;
  const combat = rules?.combat;
  if (!rules || !combat) return false;
  clearCombatDesignations(room);
  rules.effects = rules.effects.filter((effect) => effect.duration !== "this-combat");
  const result = rules.history.combatProgress?.result;
  rules.combat = null;
  delete rules.history.combatProgress;
  dropFocus(rules);
  rules.priority = null;
  clearPasses(rules);
  pushEvent(step.events, {
    type: "combat_end",
    zone: combat.battlefield,
    data: {
      rule: "468.7",
      attacker: combat.attacker,
      defender: combat.defender,
      winner: result?.winner ?? null,
      noResult: result?.noResult ?? true,
    },
  });
  runCleanup(room, step);
  return true;
}
