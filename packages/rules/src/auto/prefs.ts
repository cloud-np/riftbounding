/**
 * Auto-pass preferences — storage, defaults and lifetime (`docs/rules/auto-pass.md`).
 *
 * Preferences live on `RulesState.autoPass[playerId]`, so they are part of every rewind
 * snapshot and repro step. A seat without an entry gets no automatic action at all (beyond owner
 * decision 3), which keeps every hand-built test state at its R1–R4 behaviour; the engine seeds
 * `DEFAULT_AUTO_PASS` for every seat when a real strict game starts.
 */
import type {
  AutoPassPrefs,
  AutoPassPrefsUpdate,
  Room,
  RulesIntent,
  RulesState,
} from "@rift/protocol";
import { areOpponents } from "../scoring/teams";

/**
 * Information-safe defaults: pass on your own items (never depends on your cards), pass a
 * response window only when public information proves you have no response, and answer a
 * prompt automatically only when its single legal answer follows from public information.
 */
export const DEFAULT_AUTO_PASS: Readonly<AutoPassPrefs> = Object.freeze({
  ownItems: true,
  responses: "safe",
  forcedPrompts: "safe",
  endTurn: "safe",
  hold: false,
});

/**
 * Fast mode (opt-in; the default for a human in Practice vs Bot): also pass whenever there is no
 * legal response and answer every single-answer prompt. Both leak hand information to a human
 * opponent through timing, which is why PvP never gets them unless the player asks.
 */
export const FAST_AUTO_PASS: Readonly<AutoPassPrefs> = Object.freeze({
  ownItems: true,
  responses: "no_response",
  forcedPrompts: "all",
  endTurn: "safe",
  hold: false,
});

/**
 * Seed for a seat at strict game start: a human in a room with any bot seat (Practice vs Bot;
 * detected by `isBot`, not by room mode, which the dev harness flips) gets `FAST_AUTO_PASS`,
 * everyone else the information-safe `DEFAULT_AUTO_PASS`.
 */
export function defaultAutoPassFor(
  room: Pick<Room, "players">,
  playerId: string,
): AutoPassPrefs {
  const seat = room.players.find((player) => player.id === playerId);
  const botGame = room.players.some((player) => player.isBot);
  return { ...(botGame && seat && !seat.isBot ? FAST_AUTO_PASS : DEFAULT_AUTO_PASS) };
}

/** True when the preferences are exactly the fast preset (ignoring one-shot overrides). */
export function isFastAutoPass(prefs: AutoPassPrefs | null | undefined): boolean {
  return !!prefs && prefs.responses === "no_response" && prefs.forcedPrompts === "all";
}

/** A fresh copy of the defaults (never share the frozen object with a draft). */
export function defaultAutoPassPrefs(): AutoPassPrefs {
  return { ...DEFAULT_AUTO_PASS };
}

/** The seat's preferences, or null when the seat has opted out of everything (no entry). */
export function autoPassPrefs(rules: RulesState | null | undefined, playerId: string): AutoPassPrefs | null {
  return rules?.autoPass?.[playerId] ?? null;
}

/** Full control (the hold override): nothing is ever passed on this player's behalf. */
export function fullControl(rules: RulesState | null | undefined, playerId: string): boolean {
  return autoPassPrefs(rules, playerId)?.hold === true;
}

/** Nothing automatic: the base of an entry created for a seat that had none. */
export const MANUAL_AUTO_PASS: Readonly<AutoPassPrefs> = Object.freeze({
  ownItems: false,
  responses: "stop",
  forcedPrompts: "off",
  endTurn: "manual",
  hold: false,
});

/**
 * Merge a `rules_set_auto_pass` update into the actor's entry. A seat without an entry starts
 * from `MANUAL_AUTO_PASS`, so only what the player explicitly set becomes automatic.
 */
export function applyAutoPassUpdate(rules: RulesState, playerId: string, update: AutoPassPrefsUpdate): AutoPassPrefs {
  const table = (rules.autoPass ??= {});
  const current: AutoPassPrefs = table[playerId] ? { ...table[playerId] } : { ...MANUAL_AUTO_PASS };
  if (update.ownItems !== undefined) current.ownItems = update.ownItems;
  if (update.responses !== undefined) current.responses = update.responses;
  if (update.forcedPrompts !== undefined) current.forcedPrompts = update.forcedPrompts;
  if (update.endTurn !== undefined) current.endTurn = update.endTurn;
  if (update.hold !== undefined) current.hold = update.hold;
  if (update.passUntil !== undefined) {
    if (update.passUntil === null) delete current.passUntil;
    // The override always applies to the current turn, whatever turn the client believed.
    else current.passUntil = { kind: update.passUntil.kind, turn: rules.turn.number };
  }
  if (update.clearStanding) delete current.standing;
  if (current.standing) current.standing = current.standing.map((entry) => ({ ...entry }));
  table[playerId] = current;
  return current;
}

/**
 * Turn-scoped entries expire when the turn they were set on is over: a "pass until end of turn"
 * / "until the opponent acts" override and every "yes to all" answer. Deterministic: it only
 * reads `rules.turn.number`.
 */
export function expireAutoPass(rules: RulesState): void {
  const table = rules.autoPass;
  if (!table) return;
  const turn = rules.turn.number;
  for (const prefs of Object.values(table)) {
    if (prefs.passUntil && prefs.passUntil.turn !== turn) delete prefs.passUntil;
    if (prefs.standing) {
      const kept = prefs.standing.filter((entry) => entry.turn === turn);
      if (kept.length > 0) prefs.standing = kept;
      else delete prefs.standing;
    }
  }
}

const DISCRETIONARY: ReadonlySet<RulesIntent["type"]> = new Set(["rules_play", "rules_activate", "rules_move"]);

/**
 * "Pass until the opponent acts" ends as soon as an opponent takes a Discretionary Action
 * (411.1: a play, an activation or a Standard Move) — the player then gets the window again.
 */
export function noteDiscretionaryAction(room: Room, actorId: string, intent: RulesIntent): void {
  const table = room.rules?.autoPass;
  if (!table || !DISCRETIONARY.has(intent.type)) return;
  for (const [playerId, prefs] of Object.entries(table)) {
    if (prefs.passUntil?.kind !== "opponent_action") continue;
    if (!areOpponents(room, playerId, actorId)) continue;
    delete prefs.passUntil;
  }
}

/** True while the seat's "pass until …" override still applies this turn. */
export function passUntilActive(rules: RulesState, prefs: AutoPassPrefs): boolean {
  return !!prefs.passUntil && prefs.passUntil.turn === rules.turn.number;
}
