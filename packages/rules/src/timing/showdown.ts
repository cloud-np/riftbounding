/**
 * Showdowns — rules 341–348.
 *
 * A showdown is a Window of Opportunity with an Open State (342); the player who applied
 * Contested gains Focus as it begins (345). Focus passes when the chain closes (346), but not
 * when the chain opened from a triggered ability or an Add ability (346.1). All players passing
 * Focus in sequence closes the showdown (347.2.a / 348).
 *
 * This module deliberately does NOT import `combat/`: when a Combat Showdown closes it queues a
 * `combat` task (333) and `timing/tasks.ts` performs the 467/468 resolution. That breaks the old
 * `combat/index.ts ↔ timing/showdown.ts` runtime cycle.
 */
import type { BattlefieldZone, Room, Task } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import {
  clearPasses,
  dropFocus,
  grantFocus,
  nextPlayerInTurnOrder,
  unstageShowdown,
} from "../turn-state";
import { conquer } from "../actions/primitives";
import { battlefieldController } from "../actions/control";

export interface BeginShowdownOptions {
  force?: boolean;
  /**
   * 466.2.c.1.b: when an ongoing non-combat Showdown upgrades to a Combat Showdown the player
   * who already has Focus keeps it; only a fresh showdown grants Focus to the Contested applier.
   */
  preserveFocus?: boolean;
}

export function beginShowdown(
  room: Room,
  zone: BattlefieldZone,
  kind: "non_combat" | "combat",
  startedBy: string,
  step: RulesStepContext,
  options: BeginShowdownOptions = {},
): boolean {
  const rules = room.rules;
  if (!rules) return false;
  if (rules.showdown && !options.force) return false;
  rules.showdown = { battlefield: zone, kind, startedBy };
  unstageShowdown(rules, zone);
  clearPasses(rules);
  // 345: the player who applied Contested gains Focus (and Priority, 313.2).
  const focus = rules.contested[zone] ?? startedBy;
  if (options.preserveFocus && rules.focus) {
    // 466.2.c.1.b: the existing Focus holder maintains Focus (and Priority, 313.2).
    grantFocus(rules, rules.focus);
  } else {
    grantFocus(rules, focus);
  }
  pushEvent(step.events, {
    type: "showdown_begin",
    zone,
    playerId: rules.focus ?? focus,
    data: { kind, startedBy, preserveFocus: options.preserveFocus === true },
  });
  return true;
}

/** 347.2: pass Focus. All players passing once in sequence ends the showdown (348). */
export function passFocus(room: Room, playerId: string, step: RulesStepContext): boolean {
  const rules = room.rules;
  if (!rules || !rules.showdown) return false;
  if (rules.focus !== playerId) return false;
  if (rules.chain.length > 0) return false;
  const active = step.host.activePlayerIds(room);
  const passes = new Set(rules.passes);
  passes.add(playerId);
  rules.passes = [...passes];
  pushEvent(step.events, { type: "pass_focus", playerId, zone: rules.showdown.battlefield });
  if (active.every((id) => passes.has(id))) {
    endShowdown(room, step);
    return true;
  }
  const next = nextPlayerInTurnOrder(room, playerId, step.host);
  if (!next) return true;
  dropFocus(rules);
  grantFocus(rules, next);
  return true;
}

/** 348: close the showdown and apply the non-combat conquer result (348.2). */
export function endShowdown(room: Room, step: RulesStepContext): boolean {
  const rules = room.rules;
  const showdown = rules?.showdown;
  if (!rules || !showdown) return false;
  const zone = showdown.battlefield;
  const kind = showdown.kind;
  rules.showdown = null;
  dropFocus(rules);
  rules.priority = null;
  clearPasses(rules);
  pushEvent(step.events, { type: "showdown_end", zone, data: { kind } });

  if (kind === "combat") {
    // 468.1: the Combat Showdown closed; a Combat Special Cleanup + 467/468 resolution follow.
    // Queue an Outstanding Task instead of importing `combat/` (breaks the module cycle). The
    // task is handled before FEPR continues (334).
    const combat = rules.combat ?? {
      battlefield: zone,
      attacker: showdown.startedBy,
      defender: step.host.activePlayerIds(room).find((id) => id !== showdown.startedBy) ?? showdown.startedBy,
      step: "damage" as const,
    };
    combat.step = "damage";
    rules.combat = combat;
    // 467: the Combat Damage Step is next (combat/progress.ts drives 467 → 468).
    const progress = (rules.history.combatProgress ??= { battlefield: combat.battlefield, stage: "damage" });
    delete progress.waiting;
    const task: Task = { id: step.host.nextId("task"), kind: "combat", zone, playerId: combat.attacker };
    rules.tasks.push(task);
    return true;
  }

  // 348.2.a: if only one player's Units remain, and that player does not already Control the
  // battlefield, that player establishes Control over it.
  const present = step.host
    .activePlayerIds(room)
    .filter((id) => step.host.hasUnitAt(room, id, zone));
  if (present.length === 1) {
    const winner = present[0];
    if (winner && battlefieldController(room, zone, step.host) !== winner) {
      // 348.2.a.1: this results in a Conquer if not yet scored this turn. `conquer` owns the
      // single 348.2.a/468.5.d control establishment (NEW-2: do not call it twice); it aborts
      // when Control cannot be established (190.4).
      conquer(room, winner, zone, step);
    }
  }
  // 190.3.b: Contested ends once control is established. Otherwise the applier has no units left
  // (323.10 would remove it in the next Cleanup anyway) or nobody could establish control.
  // RULES-QUESTION(190.3.b): when control is not established although the applier's units remain
  // (e.g. 2v2 teammates sharing a battlefield, or a prevented Establish Control) a literal reading
  // keeps it Contested and re-stages a Showdown forever (323.7); we clear it instead.
  delete rules.contested[zone];
  return true;
}
