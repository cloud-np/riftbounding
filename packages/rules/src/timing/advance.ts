/**
 * Bounded auto-advance loop — rule 334 (HOT FEPR).
 *
 * After every accepted intent the layer advances until a player decision is required (priority,
 * focus, a prompt, or the manual window) or the game is over. The guard makes a bad rule
 * function fail loudly (`loop_guard`) instead of freezing a Durable Object.
 */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import {
  grantFocus,
  grantPriority,
  setPhase,
  turnState,
} from "../turn-state";
import { finalizeChainItem, runCleanupOrQueue } from "./fepr";
import { processNextTask, queueTask } from "./tasks";
import { projectRules } from "../turn-state";
import { runAdvanceHooks } from "./hooks";

export type AdvanceResult = "await" | "game_over" | "loop_guard" | "no_rules";

const MAX_ADVANCE_STEPS = 500;

export function advance(room: Room, step: RulesStepContext): AdvanceResult {
  const rules = room.rules;
  if (!rules) return "no_rules";

  for (let guard = 0; guard < MAX_ADVANCE_STEPS; guard += 1) {
    // 322 / 317.2.f: a bounded cleanup/expiration loop already failed loudly — stop advancing
    // so `applyRulesIntent` can return the loop_guard Verdict (N6).
    if (step.loopGuard) {
      projectRules(room, step.host);
      return "loop_guard";
    }
    if (room.gameOutcome) {
      projectRules(room, step.host);
      return "game_over";
    }
    // 312.1.b.1: a pending prompt does not need priority.
    if (rules.prompt || rules.manual) {
      projectRules(room, step.host);
      return "await";
    }

    // 334: Handle Outstanding Tasks before FEPR continues. 303.2.a trigger queue → chain.
    runAdvanceHooks("beforeTasks", room, step);
    if (rules.tasks.length > 0) {
      const result = processNextTask(room, step);
      if (result === "await") {
        projectRules(room, step.host);
        return "await";
      }
      continue;
    }

    // 336: FEPR.
    if (rules.chain.length > 0) {
      const pending = rules.chain.find((item) => item.status === "pending");
      if (pending) {
        finalizeChainItem(room, pending, step);
        // 321/NEW-10: if finalizing opened a manual/prompt window the cleanup is queued as an
        // Outstanding Task (321.1) instead of running during resolution.
        runCleanupOrQueue(room, step);
        runAdvanceHooks("afterResolve", room, step);
        continue;
      }
      // 337.4: controller of the next (newest) item gains Priority; stop for their decision.
      if (!rules.priority) {
        const newest = rules.chain[rules.chain.length - 1];
        grantPriority(rules, newest?.controller ?? null);
      }
      projectRules(room, step.host);
      return "await";
    }

    // 335.1: no tasks/pending items, ongoing Showdown → the Focus holder gets Priority.
    if (rules.showdown) {
      if (!rules.focus) {
        grantFocus(rules, rules.contested[rules.showdown.battlefield] ?? rules.showdown.startedBy);
      } else if (!rules.priority) {
        grantPriority(rules, rules.focus);
      }
      projectRules(room, step.host);
      return "await";
    }

    // 335: phase/substep progression.
    runAdvanceHooks("phaseStart", room, step);
    switch (rules.turn.phase) {
      case "awaken": {
        setPhase(rules, "beginning", "beginning");
        queueTask(room, { kind: "ready-all" }, step);
        continue;
      }
      case "beginning": {
        if (rules.turn.step === "beginning") {
          rules.turn.step = "scoring";
          queueTask(room, { kind: "hold" }, step);
          continue;
        }
        if (rules.turn.step === "scoring") {
          setPhase(rules, "channel");
          continue;
        }
        setPhase(rules, "channel");
        continue;
      }
      case "channel": {
        queueTask(room, { kind: "channel" }, step);
        continue;
      }
      case "draw": {
        queueTask(room, { kind: "draw" }, step);
        continue;
      }
      case "main": {
        // 312.2.a: Neutral Open during their Main Phase → the Turn Player receives Priority.
        if (turnState(room) === "neutral_open") {
          grantPriority(rules, rules.turn.player);
        }
        projectRules(room, step.host);
        return "await";
      }
      case "ending": {
        if (rules.turn.step !== "expiration") {
          rules.turn.step = "ending";
          queueTask(room, { kind: "ending" }, step);
          continue;
        }
        queueTask(room, { kind: "expiration" }, step);
        continue;
      }
    }
  }

  pushEvent(step.events, { type: "loop_guard", data: { steps: MAX_ADVANCE_STEPS } });
  projectRules(room, step.host);
  return "loop_guard";
}
