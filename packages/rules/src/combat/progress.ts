/**
 * Steps of Combat driver — rules 465–468 (467.1, 467.3, 468.2, 468.4, 468.6).
 *
 * `rules.history.combatProgress.stage` records where the combat is, so the sequence survives
 * intent boundaries (a damage-assignment prompt, or chain items that must resolve first).
 *
 * 468.2 / 468.4 / 468.6: "Resolve any items on the chain from … and associated FEPR before
 * performing this step." When a step leaves chain items, pending triggers, tasks or a prompt
 * behind, the driver marks the progress `waiting` and stops; the `beforeTasks` advance hook below
 * queues the next `combat` Task once all of that is gone.
 */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { registerAdvanceHook } from "../timing/hooks";
import { bothSidesRemain, dealAssignedDamage, runAssignments } from "./damage";
import { designateCombatants } from "./designate";
import { determineCombatResult, endCombat, establishCombatControl, runCombatCleanup } from "./resolve";

export type CombatContinue = "await" | "wait" | "done";

/** Anything that must finish before the next Resolution-Step Task becomes Outstanding. */
export function combatBlocked(room: Room): boolean {
  const rules = room.rules;
  if (!rules) return false;
  return (
    rules.chain.length > 0 ||
    rules.triggers.length > 0 ||
    rules.tasks.length > 0 ||
    !!rules.prompt ||
    !!rules.manual ||
    !!room.gameOutcome
  );
}

/**
 * Run the Steps of Combat from the recorded stage until a player decision is needed
 * (`"await"`: damage-assignment prompt), chain work must resolve first (`"wait"`), or the combat
 * ended (`"done"`).
 */
export function continueCombat(room: Room, step: RulesStepContext): CombatContinue {
  const rules = room.rules;
  for (let guard = 0; guard < 16; guard += 1) {
    const combat = rules?.combat;
    if (!rules || !combat) return "done";
    if (room.gameOutcome) return "done";
    const progress = (rules.history.combatProgress ??= { battlefield: combat.battlefield, stage: "damage" });
    if (rules.showdown) return "wait"; // the Combat Showdown is still open (466 → 467).
    delete progress.waiting;
    switch (progress.stage) {
      case "damage": {
        // 467.1: only resolve combat damage if both Attacking and Defending units remain.
        combat.step = "damage";
        designateCombatants(room, step);
        progress.stage = bothSidesRemain(room, step) ? "assign" : "cleanup";
        if (progress.stage === "cleanup") combat.step = "resolution";
        continue;
      }
      case "assign": {
        combat.step = "damage";
        if (runAssignments(room, step) === "await") return "await";
        progress.stage = "deal";
        continue;
      }
      case "deal": {
        dealAssignedDamage(room, step);
        // 467.3: skip the FEPR process and cancel any outstanding tasks.
        rules.tasks = [];
        progress.stage = "cleanup";
        combat.step = "resolution";
        continue;
      }
      case "cleanup": {
        runCombatCleanup(room, step);
        progress.stage = "result";
        if (combatBlocked(room)) return markWaiting(room);
        continue;
      }
      case "result": {
        determineCombatResult(room, step);
        progress.stage = "control";
        if (combatBlocked(room)) return markWaiting(room);
        continue;
      }
      case "control": {
        establishCombatControl(room, step);
        progress.stage = "end";
        if (combatBlocked(room)) return markWaiting(room);
        continue;
      }
      case "end": {
        endCombat(room, step);
        return "done";
      }
    }
  }
  return "wait";
}

function markWaiting(room: Room): "wait" {
  const progress = room.rules?.history.combatProgress;
  if (progress) progress.waiting = true;
  return "wait";
}

/**
 * 468.2 / 468.4 / 468.6: once the chain, the trigger queue and the task queue are empty again,
 * the next Resolution-Step Task becomes Outstanding.
 */
export function resumeCombatHook(room: Room, step: RulesStepContext): void {
  const rules = room.rules;
  if (!rules?.combat || rules.showdown) return;
  const progress = rules.history.combatProgress;
  if (!progress?.waiting) return;
  if (combatBlocked(room)) return;
  delete progress.waiting;
  rules.tasks.push({
    id: step.host.nextId("task"),
    kind: "combat",
    zone: rules.combat.battlefield,
    playerId: rules.combat.attacker,
  });
}

registerAdvanceHook("beforeTasks", resumeCombatHook);

/**
 * Legacy entry point (R1 API): run the Resolution Step (468) to the end, ignoring the 468.2 /
 * 468.4 / 468.6 waits. Prefer `continueCombat`, which waits for chain items as the rules require.
 */
export function runCombatResolution(room: Room, step: RulesStepContext): boolean {
  const rules = room.rules;
  const combat = rules?.combat;
  if (!rules || !combat) return false;
  const progress = (rules.history.combatProgress ??= { battlefield: combat.battlefield, stage: "cleanup" });
  if (progress.stage === "damage" || progress.stage === "assign" || progress.stage === "deal") {
    progress.stage = "cleanup";
  }
  if (progress.stage === "cleanup") {
    runCombatCleanup(room, step);
    progress.stage = "result";
  }
  if (progress.stage === "result") {
    determineCombatResult(room, step);
    progress.stage = "control";
  }
  if (progress.stage === "control") {
    establishCombatControl(room, step);
    progress.stage = "end";
  }
  return endCombat(room, step);
}
