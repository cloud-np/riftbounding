/**
 * Automatic actions after every accepted intent (`docs/rules/auto-pass.md`).
 *
 * `advanceWithAuto` replaces the bare `advance` call of `applyRulesIntent` /
 * `initializeStrictRules`: it advances to the next decision, then — while the deciding player's
 * own preferences say so — takes that decision through the very handler a manual intent uses
 * (`rules_choose` → `applyPromptAnswer`, `rules_pass` → `handlePass`, `rules_end_turn` →
 * `handleEndTurn`), after the same verdict, and advances again. So:
 *
 * - an automatic action is always one the player could legally have taken (same verdict, same
 *   handler, same events);
 * - only the player who must decide (Prompt / Priority / Focus holder, 312/313/411.2) is ever
 *   acted for, and only when their stored preferences opt in (a seat with no entry gets nothing);
 * - it is deterministic: decisions read only the room, so rewind snapshots and repro replays
 *   reproduce them exactly (they happen inside the recorded action);
 * - it terminates: at most `AUTO_ACTION_CAP` automatic actions per transition, then control is
 *   handed back to a person (the corpus has no rule for infinite/mandatory loops; see the doc).
 */
import type { Prompt, PromptAnswer, Room, RulesIntent } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { log, pushEvent } from "../types";
import { advance, type AdvanceResult } from "../timing/advance";
import { whoMayAct } from "../view/who";
import { passVerdict } from "../legality/pass";
import { endTurnVerdict } from "../legality/end-turn";
import { chooseVerdict } from "../legality/choose";
import { handlePass } from "../intents/pass";
import { handleEndTurn } from "../intents/end-turn";
import { applyPromptAnswer } from "../intents/choose";
import { checkpoint, rollback } from "../play/payment";
import { autoPassPrefs, expireAutoPass, passUntilActive } from "./prefs";
import { forcedPromptAnswer } from "./forced";
import { hasLegalAction, hasLegalResponse, provablyNoAction, provablyNoResponse } from "./respond";
import { promptSignature, standingEligible } from "./signature";

/** Hard bound on automatic actions in one transition (a trigger loop cannot spin forever). */
export const AUTO_ACTION_CAP = 64;

/** The intent that started this transition (its `hold` suppresses the actor's auto-passes). */
export interface AutoTrigger {
  actorId: string;
  intent: RulesIntent;
}

export type AutoActionKind = "pass" | "own_item" | "pass_until" | "end_turn" | "choose" | "repeat";

export interface AutoAction {
  playerId: string;
  kind: AutoActionKind;
}

function heldBy(trigger: AutoTrigger | undefined, playerId: string): boolean {
  if (!trigger || trigger.actorId !== playerId) return false;
  const intent = trigger.intent;
  return (intent.type === "rules_play" || intent.type === "rules_activate") && intent.hold === true;
}

function intentContext(room: Room, step: RulesStepContext, actorId: string, intent: RulesIntent) {
  return { room, rules: room.rules!, actorId, intent, ctx: step.ctx, host: step.host, step };
}

/** 411.2: a remembered "yes to all" answer or a forced answer the player's mode allows. */
function automaticAnswer(room: Room, step: RulesStepContext, prompt: Prompt): { answer: PromptAnswer; kind: AutoActionKind } | null {
  const rules = room.rules;
  const prefs = autoPassPrefs(rules, prompt.playerId);
  if (!rules || !prefs) return null;
  if (prefs.standing && standingEligible(prompt)) {
    const signature = promptSignature(room, prompt);
    const standing = prefs.standing.find((entry) => entry.signature === signature && entry.turn === rules.turn.number);
    if (standing) return { answer: { optionIds: [...(standing.answer.optionIds ?? [])] }, kind: "repeat" };
  }
  if (prefs.forcedPrompts === "off") return null;
  const forced = forcedPromptAnswer(room, prompt, step.host);
  if (!forced) return null;
  if (prefs.forcedPrompts === "safe" && !forced.public) return null;
  return { answer: forced.answer, kind: "choose" };
}

function tryAutoAnswer(room: Room, step: RulesStepContext, actions: AutoAction[], beforeAct: () => void): boolean {
  const prompt = room.rules?.prompt;
  if (!prompt) return false;
  const auto = automaticAnswer(room, step, prompt);
  if (!auto) return false;
  // Same verdict as a manual `rules_choose`; a rejected automatic answer is simply not sent.
  const verdict = chooseVerdict(room, prompt.playerId, prompt.id, auto.answer, step.host);
  if (!verdict.ok) return false;
  beforeAct();
  const point = checkpoint(room, step);
  const result = applyPromptAnswer(room, prompt.playerId, prompt.id, auto.answer, step);
  if (!result.ok) {
    rollback(room, step, point);
    return false;
  }
  pushEvent(step.events, {
    type: "auto_choose",
    playerId: prompt.playerId,
    data: { promptId: prompt.id, kind: prompt.kind, reason: prompt.data?.reason ?? null, source: auto.kind },
  });
  actions.push({ playerId: prompt.playerId, kind: auto.kind });
  return true;
}

/** Why `playerId` may be passed for right now, or null (Priority/Focus windows only). */
function passReason(room: Room, step: RulesStepContext, playerId: string, trigger: AutoTrigger | undefined): AutoActionKind | null {
  const rules = room.rules;
  const prefs = autoPassPrefs(rules, playerId);
  if (!rules || !prefs || prefs.hold || heldBy(trigger, playerId)) return null;
  if (!passVerdict(room, playerId).ok) return null;
  const top = rules.chain[rules.chain.length - 1];
  const ownItem = rules.chain.length > 0 && top?.controller === playerId;
  // 337.4 / 340.4: the player's own item is on top — passing never depends on their cards.
  if (ownItem && prefs.ownItems) return "own_item";
  // A one-shot "pass until …" override: unconditional, so it reveals nothing either.
  if (passUntilActive(rules, prefs)) return "pass_until";
  if (ownItem) return null;
  // Response window: an opponent's item on top, or showdown Focus with an empty chain.
  if (prefs.responses === "safe") return provablyNoResponse(room, step.host, playerId) ? "pass" : null;
  if (prefs.responses === "no_response") return hasLegalResponse(room, step.host, playerId) ? null : "pass";
  return null;
}

/**
 * Why the Turn Player's turn may be ended for them, or null. At most one turn ends
 * automatically per transition, so nobody watches several turns fly by after one click.
 */
function endTurnReason(
  room: Room,
  step: RulesStepContext,
  playerId: string,
  trigger: AutoTrigger | undefined,
  actions: readonly AutoAction[],
): "pass_until" | "no_action" | null {
  const rules = room.rules;
  const prefs = autoPassPrefs(rules, playerId);
  if (!rules || !prefs || prefs.hold || heldBy(trigger, playerId)) return null;
  if (actions.some((action) => action.kind === "end_turn")) return null;
  if (!endTurnVerdict(room, playerId).ok) return null;
  if (prefs.passUntil?.kind === "end_of_turn" && passUntilActive(rules, prefs)) return "pass_until";
  if (prefs.endTurn === "safe") return provablyNoAction(room, step.host, playerId) ? "no_action" : null;
  if (prefs.endTurn === "no_action") return hasLegalAction(room, step.host, playerId) ? null : "no_action";
  return null;
}

/** One automatic action, if the deciding player's preferences call for one. */
export function runOneAutoAction(
  room: Room,
  step: RulesStepContext,
  trigger: AutoTrigger | undefined,
  actions: AutoAction[],
  /** Called once, right before the first mutation (lets the caller take a checkpoint). */
  beforeAct: () => void = () => {},
): boolean {
  const rules = room.rules;
  if (!rules?.autoPass || room.gameOutcome) return false;
  expireAutoPass(rules);
  const who = whoMayAct(room);
  if (who.kind === "prompt") return tryAutoAnswer(room, step, actions, beforeAct);
  if (who.kind !== "priority" && who.kind !== "focus") return false;
  const playerId = who.player;

  if (who.kind === "priority" && rules.chain.length === 0 && !rules.showdown) {
    // Neutral Open Main Phase on the player's own turn (316.9).
    const reason = endTurnReason(room, step, playerId, trigger, actions);
    if (!reason) return false;
    beforeAct();
    const done = handleEndTurn(intentContext(room, step, playerId, { type: "rules_end_turn" }));
    if (!done.ok) return false;
    pushEvent(step.events, { type: "auto_end_turn", playerId, data: { reason } });
    actions.push({ playerId, kind: "end_turn" });
    return true;
  }

  const reason = passReason(room, step, playerId, trigger);
  if (!reason) return false;
  const window = rules.chain.length > 0 ? "chain" : "showdown";
  beforeAct();
  const done = handlePass(intentContext(room, step, playerId, { type: "rules_pass" }));
  if (!done.ok) return false;
  pushEvent(step.events, { type: "auto_pass", playerId, data: { reason, window } });
  actions.push({ playerId, kind: reason });
  return true;
}

const LOG_TEXT: Record<AutoActionKind, (name: string, count: number) => string> = {
  pass: (name, count) => `${name} auto-passed${count > 1 ? ` (×${count})` : ""}`,
  own_item: (name, count) => `${name} auto-passed on their own item${count > 1 ? ` (×${count})` : ""}`,
  pass_until: (name, count) => `${name} auto-passed (pass until)${count > 1 ? ` (×${count})` : ""}`,
  end_turn: (name) => `${name}'s turn was ended automatically`,
  choose: (name, count) => `${name}'s only legal choice was made automatically${count > 1 ? ` (×${count})` : ""}`,
  repeat: (name, count) => `${name}'s answer was repeated automatically (yes to all)${count > 1 ? ` (×${count})` : ""}`,
};

const LOG_KEY: Record<AutoActionKind, string> = {
  pass: "auto.pass",
  own_item: "auto.ownItem",
  pass_until: "auto.passUntil",
  end_turn: "auto.endTurn",
  choose: "auto.choose",
  repeat: "auto.repeat",
};

/** One public log line per (player, kind) for this transition, in first-seen order. */
function logAutoActions(room: Room, step: RulesStepContext, actions: readonly AutoAction[]): void {
  const groups = new Map<string, { playerId: string; kind: AutoActionKind; count: number }>();
  for (const action of actions) {
    const key = `${action.playerId}\u0000${action.kind}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { playerId: action.playerId, kind: action.kind, count: 1 });
  }
  for (const group of groups.values()) {
    const name = step.host.playerName(room, group.playerId) || group.playerId;
    log(step, room, LOG_KEY[group.kind], LOG_TEXT[group.kind](name, group.count), group.playerId, "turn", {
      player: name,
      count: group.count,
    });
  }
}

/**
 * `advance` (334), then automatic decisions while preferences allow, each followed by a fresh
 * `advance`. Each `advance` keeps its own 500-step guard, and the automatic actions are capped.
 */
export function advanceWithAuto(room: Room, step: RulesStepContext, trigger?: AutoTrigger): AdvanceResult {
  let result = advance(room, step);
  if (!room.rules?.autoPass) return result;
  const actions: AutoAction[] = [];
  while (result === "await") {
    if (actions.length >= AUTO_ACTION_CAP) {
      const who = whoMayAct(room);
      const playerId = who.kind === "none" ? undefined : who.player;
      pushEvent(step.events, { type: "auto_paused", ...(playerId ? { playerId } : {}), data: { cap: AUTO_ACTION_CAP } });
      log(step, room, "auto.paused", `Automatic actions paused after ${AUTO_ACTION_CAP} in a row`, playerId, "turn", {
        cap: AUTO_ACTION_CAP,
      });
      break;
    }
    // An automatic action must never turn the player's own accepted intent into a rejection: if
    // it runs into a bounded-loop guard (322 / 317.2.f / 334), undo it and leave that decision
    // to the player, exactly where the game stood without auto-pass.
    let point: ReturnType<typeof checkpoint> | null = null;
    const before = actions.length;
    if (!runOneAutoAction(room, step, trigger, actions, () => (point = checkpoint(room, step)))) break;
    result = advance(room, step);
    if (result === "loop_guard" && point) {
      rollback(room, step, point);
      actions.length = before;
      delete step.loopGuard;
      result = "await";
      break;
    }
  }
  if (actions.length > 0) logAutoActions(room, step, actions);
  return result;
}
