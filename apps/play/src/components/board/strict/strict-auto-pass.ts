/**
 * Strict auto-pass client model (pure; docs/rules/auto-pass.md).
 *
 * The preferences live on `Room.rules.autoPass[seat]` (the viewer only ever receives their own
 * seats' entries) and change through `rules_set_auto_pass`. Automatic actions are logged by the
 * rules layer as `rules.auto.*` log entries; `autoNotices` turns the new ones into the short
 * translated lines the board shows so players see what happened without them.
 */
import type { Translator } from "@rift/i18n";
import type {
  AutoEndTurnMode,
  AutoPassPrefs,
  AutoPassPrefsUpdate,
  AutoPassResponseMode,
  AutoResolveMode,
  GameState,
  GameplayLogEntry,
  Prompt,
  WireAction,
} from "@rift/protocol";

/** The seat the auto-pass controls act for: the deciding controlled seat, else the viewer. */
export function autoPassSeat(room: GameState, viewerId: string, controlled: readonly string[]): string {
  const seats = controlled.length > 0 ? controlled : [viewerId];
  const rules = room.rules;
  const deciding = rules?.prompt?.playerId ?? rules?.priority ?? rules?.focus ?? null;
  if (deciding && seats.includes(deciding)) return deciding;
  return seats.includes(viewerId) ? viewerId : seats[0]!;
}

/**
 * What a seat without an entry gets (a room that predates auto-pass): nothing automatic. Mirrors
 * `MANUAL_AUTO_PASS` in `@rift/rules`, the base the server merges a first update into.
 */
export const MANUAL_PREFS: Readonly<AutoPassPrefs> = Object.freeze({
  ownItems: false,
  responses: "stop",
  forcedPrompts: "off",
  endTurn: "manual",
  hold: false,
});

/** The seat's stored preferences, or `MANUAL_PREFS` when the room has none for it. */
export function autoPassPrefsFor(room: GameState, seat: string): AutoPassPrefs {
  return room.rules?.autoPass?.[seat] ?? MANUAL_PREFS;
}

export function autoPassIntent(prefs: AutoPassPrefsUpdate): WireAction {
  return { type: "rules_set_auto_pass", prefs } as WireAction;
}

export type PassUntilKind = "end_of_turn" | "opponent_action";

/** The active one-shot override for this turn, if any. */
export function activePassUntil(room: GameState, prefs: AutoPassPrefs | null): PassUntilKind | null {
  const until = prefs?.passUntil;
  if (!until || until.turn !== room.rules?.turn.number) return null;
  return until.kind;
}

/** Toggle a one-shot override: the same kind again cancels it. */
export function passUntilIntent(room: GameState, prefs: AutoPassPrefs | null, kind: PassUntilKind): WireAction {
  if (activePassUntil(room, prefs) === kind) return autoPassIntent({ passUntil: null });
  return autoPassIntent({ passUntil: { kind, turn: room.rules?.turn.number ?? 0 } });
}

export interface AutoPassChoice<T extends string> {
  value: T;
  labelKey: string;
  fallback: string;
  /** The option can reveal hand information to the opponent (shown with a warning). */
  leaks: boolean;
}

export const RESPONSE_CHOICES: readonly AutoPassChoice<AutoPassResponseMode>[] = [
  { value: "stop", labelKey: "rules.ui.autoPass.responsesStop", fallback: "Always stop", leaks: false },
  { value: "safe", labelKey: "rules.ui.autoPass.responsesSafe", fallback: "Skip when I clearly can't respond", leaks: false },
  { value: "no_response", labelKey: "rules.ui.autoPass.responsesNoResponse", fallback: "Skip whenever I have no response", leaks: true },
];

export const FORCED_CHOICES: readonly AutoPassChoice<AutoResolveMode>[] = [
  { value: "off", labelKey: "rules.ui.autoPass.forcedOff", fallback: "Always ask", leaks: false },
  { value: "safe", labelKey: "rules.ui.autoPass.forcedSafe", fallback: "Answer when it reveals nothing", leaks: false },
  { value: "all", labelKey: "rules.ui.autoPass.forcedAll", fallback: "Always answer", leaks: true },
];

export const END_TURN_CHOICES: readonly AutoPassChoice<AutoEndTurnMode>[] = [
  { value: "manual", labelKey: "rules.ui.autoPass.endTurnManual", fallback: "Never", leaks: false },
  { value: "safe", labelKey: "rules.ui.autoPass.endTurnSafe", fallback: "When it reveals nothing", leaks: false },
  { value: "no_action", labelKey: "rules.ui.autoPass.endTurnNoAction", fallback: "Whenever nothing is playable", leaks: true },
];

/** The two presets the "Fast mode" switch toggles between (mirrors `FAST_AUTO_PASS` / defaults). */
export const FAST_UPDATE: Readonly<AutoPassPrefsUpdate> = Object.freeze({
  responses: "no_response",
  forcedPrompts: "all",
});
export const SAFE_UPDATE: Readonly<AutoPassPrefsUpdate> = Object.freeze({
  responses: "safe",
  forcedPrompts: "safe",
});

export type AutoPassMode = "fast" | "safe" | "custom";

/** Which preset the detailed values match; anything else is "custom". */
export function autoPassMode(prefs: AutoPassPrefs | null): AutoPassMode {
  if (!prefs) return "safe";
  if (prefs.responses === FAST_UPDATE.responses && prefs.forcedPrompts === FAST_UPDATE.forcedPrompts) return "fast";
  if (prefs.responses === SAFE_UPDATE.responses && prefs.forcedPrompts === SAFE_UPDATE.forcedPrompts) return "safe";
  return "custom";
}

/** The update the Fast mode switch sends. */
export function fastModeUpdate(on: boolean): AutoPassPrefsUpdate {
  return { ...(on ? FAST_UPDATE : SAFE_UPDATE) };
}

/** A room with a bot seat (Practice vs Bot): no human opponent can read the viewer's timing. */
export function isBotGame(room: Pick<GameState, "players">): boolean {
  return room.players.some((player) => player.isBot === true);
}

/** True when any stored preference may reveal hand information. */
export function prefsLeak(prefs: AutoPassPrefs | null): boolean {
  if (!prefs) return false;
  return prefs.responses === "no_response" || prefs.forcedPrompts === "all" || prefs.endTurn === "no_action";
}

/* ------------------------------------------------------------- notices (log entries) */

const NOTICE_KEYS: Record<string, string> = {
  "rules.auto.pass": "rules.ui.autoPass.notice.pass",
  "rules.auto.ownItem": "rules.ui.autoPass.notice.ownItem",
  "rules.auto.passUntil": "rules.ui.autoPass.notice.passUntil",
  "rules.auto.endTurn": "rules.ui.autoPass.notice.endTurn",
  "rules.auto.choose": "rules.ui.autoPass.notice.choose",
  "rules.auto.repeat": "rules.ui.autoPass.notice.repeat",
  "rules.auto.paused": "rules.ui.autoPass.notice.paused",
};

export interface AutoNotice {
  id: string;
  key: string;
  text: string;
  playerId: string | null;
}

export function isAutoLogEntry(entry: Pick<GameplayLogEntry, "key">): boolean {
  return typeof entry.key === "string" && entry.key in NOTICE_KEYS;
}

/** Translated notice lines for the automatic-action log entries in `entries`. */
export function autoNotices(t: Translator, entries: readonly GameplayLogEntry[]): AutoNotice[] {
  const out: AutoNotice[] = [];
  for (const entry of entries) {
    if (!isAutoLogEntry(entry)) continue;
    const key = NOTICE_KEYS[entry.key!]!;
    const params = (entry.params ?? {}) as Record<string, string | number>;
    out.push({
      id: entry.id,
      key: entry.key!,
      text: t(key, params) ?? entry.text,
      playerId: entry.authorPlayerId ?? null,
    });
  }
  return out;
}

/* ------------------------------------------------------------- "yes to all" */

/** Prompts whose answer can be remembered for identical prompts this turn (rules layer rule). */
export function promptAllowsSimilar(prompt: Prompt): boolean {
  if (prompt.kind === "order") return true;
  if (prompt.kind !== "yes-no") return false;
  const ids = (prompt.options ?? []).map((option) => option.id).sort();
  return ids.length === 2 && ids[0] === "no" && ids[1] === "yes";
}
