/**
 * Declarative scenario runner: executes a `ScenarioSpec` against the real strict engine and
 * reports the first divergence as a human-readable diff, e.g.
 *
 *   step 4 (P2 plays Firestorm at Void Gate): expected Garen dead, got alive at Void Gate (Might 4, 3 damage)
 *
 * Every action goes through `applyRulesIntent` with the engine's real `RulesHost`, exactly like
 * `applyGameAction` does for a `rules_*` wire action. Prompt answers are mapped onto the pending
 * prompt's real options; nothing is simulated.
 */
import type {
  ChainItem,
  ChoiceRecord,
  ChoiceValue,
  GameEvent,
  PaymentPlanWire,
  Prompt,
  PromptAnswer,
  PromptOption,
  RulesIntent,
} from "@rift/protocol";
import { normalizeCardName } from "@rift/cards";
import {
  activatedAbilitiesOf,
  applyRulesIntent,
  battlefieldController,
  effectiveKeywords,
  effectiveMight,
  legalIntents,
  lookupAbility,
  promptReason,
  requiredChoices,
  turnState,
} from "../../src";
import { didYouMean } from "./catalog";
import {
  PLAYER_KEYS,
  type CardRef,
  type Checkpoint,
  type ExpectedFailure,
  type NameListExpectation,
  type PaySpec,
  type PlayerKey,
  type RuneList,
  type ScenarioSpec,
  type ScenarioStep,
  type UnitExpectation,
} from "./format";
import { buildPosition, runeNames, type BuiltPosition } from "./position";
import { validateScenario } from "./validate";

export type ScenarioStatus = "pass" | "fail" | "xfail" | "xpass";

export interface ScenarioFailure {
  /** 1-based step index (0 = the position itself). */
  step: number;
  label: string;
  message: string;
  diffs: string[];
}

export interface ScenarioResult {
  title: string;
  file?: string;
  verification: ScenarioSpec["verification"];
  status: ScenarioStatus;
  /** Present for `fail` and `xfail`. */
  failure?: ScenarioFailure;
  expectFailure?: ExpectedFailure;
  /** Step-by-step trace (always collected). */
  trace: string[];
  warnings: string[];
  steps: number;
  engineCalls: number;
}

export class ScenarioStepError extends Error {
  constructor(
    message: string,
    readonly diffs: string[] = [message],
  ) {
    super(message);
    this.name = "ScenarioStepError";
  }
}

const BOARD_ZONES = [
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
] as const;
const ALL_ZONES = [
  ...BOARD_ZONES,
  "hand",
  "champion",
  "legend",
  "runeArea",
  "trash",
  "banished",
  "deck",
  "runeDeck",
] as const;

export function normalizeExpectedFailure(
  value: ScenarioSpec["expectFailure"],
): ExpectedFailure | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? { reason: value } : value;
}

/* ------------------------------------------------------------------ session */

interface Located {
  id: string;
  name: string;
  playerId: string;
  zone: string;
}

/** Live state of one scenario run: the room plus name/label resolution helpers. */
export class ScenarioSession {
  readonly built: BuiltPosition;
  /** Events of the engine calls made by the current step. */
  stepEvents: GameEvent[] = [];
  engineCalls = 0;
  readonly trace: string[] = [];

  constructor(built: BuiltPosition) {
    this.built = built;
  }

  get room() {
    return this.built.room;
  }
  get host() {
    return this.built.host;
  }

  pid(key: PlayerKey): string {
    const id = this.built.playerId[key];
    if (!id) throw new ScenarioStepError(`unknown player ${JSON.stringify(key)} (use P1 or P2)`);
    return id;
  }

  keyOf(playerId: string | null | undefined): PlayerKey | null {
    if (!playerId) return null;
    return this.built.playerKey[playerId] ?? null;
  }

  /* ---------------------------------------------------------------- locations */

  battlefieldName(zone: string): string {
    const name = this.built.battlefields.find((bf) => bf.zone === zone)?.name;
    if (!name) return zone;
    // Both seats may pick the same battlefield: show the zone id too.
    return this.built.battlefields.filter((bf) => bf.name === name).length > 1
      ? `${name} (${zone})`
      : name;
  }

  /** Readable location: "base", a battlefield name, "hand", "trash", … */
  locationName(zone: string): string {
    return zone.startsWith("battlefield") ? this.battlefieldName(zone) : zone;
  }

  /** `base` / battlefield name / zone id → zone id. */
  zoneOf(ref: string, where: string): string {
    const trimmed = ref.trim();
    const lower = trimmed.toLowerCase();
    if (lower === "base") return "base";
    if ((BOARD_ZONES as readonly string[]).includes(trimmed)) return trimmed;
    const matches = this.built.battlefields.filter((entry) => entry.name.toLowerCase() === lower);
    if (matches.length > 1) {
      throw new ScenarioStepError(
        `${where}: both battlefields are ${JSON.stringify(ref)}; use the zone id (${matches.map((entry) => entry.zone).join(" or ")})`,
      );
    }
    const bf = matches[0];
    if (bf) return bf.zone;
    throw new ScenarioStepError(
      `${where}: ${JSON.stringify(ref)} is not a location (base or a battlefield).${didYouMean(
        ref,
        ["base", ...this.built.battlefields.map((entry) => entry.name)],
      )}`,
    );
  }

  /** Like `zoneOf`, but also accepts the non-board zones used in checkpoints. */
  anyZoneOf(ref: string, where: string): string {
    const lower = ref.trim().toLowerCase();
    if (
      (
        ["hand", "trash", "banished", "deck", "chain", "board", "champion", "legend"] as const
      ).includes(lower as never)
    ) {
      return lower;
    }
    return this.zoneOf(ref, where);
  }

  /* ---------------------------------------------------------------- cards */

  locate(id: string): Located | null {
    const found = this.host.findCard(this.room, id);
    if (found) return { id, name: found.card.name, playerId: found.playerId, zone: found.zone };
    const chainItem = this.room.rules?.chain.find(
      (item) => item.cardSnapshot?.id === id || item.sourceObjectId === id,
    );
    if (chainItem?.cardSnapshot && chainItem.cardSnapshot.id === id) {
      return {
        id,
        name: chainItem.cardSnapshot.name,
        playerId: chainItem.controller,
        zone: "chain",
      };
    }
    return null;
  }

  /** Label for an id if one was bound, else the card's printed name. */
  nameOf(id: string | undefined | null): string {
    if (!id) return "?";
    for (const [label, bound] of this.built.labels) if (bound === id) return label;
    if (id.startsWith("battlefield")) return this.battlefieldName(id);
    const located = this.locate(id);
    if (located) return located.name;
    const key = this.keyOf(id);
    return key ?? id;
  }

  /** Every card instance (all players, all zones, plus cards on the chain). */
  allCards(): Located[] {
    const out: Located[] = [];
    for (const player of this.room.players) {
      const board = player.board as unknown as
        Record<string, Array<{ id: string; name: string }> | undefined> | undefined;
      if (!board) continue;
      for (const zone of ALL_ZONES) {
        for (const card of board[zone] ?? [])
          out.push({ id: card.id, name: card.name, playerId: player.id, zone });
      }
    }
    for (const item of this.room.rules?.chain ?? []) {
      if (item.cardSnapshot) {
        out.push({
          id: item.cardSnapshot.id,
          name: item.cardSnapshot.name,
          playerId: item.controller,
          zone: "chain",
        });
      }
    }
    return out;
  }

  /**
   * Resolve a card ref to candidate instances. Labels win; otherwise the printed name
   * (case/punctuation-insensitive), optionally narrowed by `@location`, filtered by `filter`.
   */
  candidates(ref: CardRef, filter: (card: Located) => boolean = () => true): Located[] {
    const bound = this.built.labels.get(ref);
    if (bound) {
      const located = this.locate(bound);
      return located ? [located] : [];
    }
    // "<name>[@<qualifier>]...": a location, a player key (P1/P2), or ready/exhausted.
    const [name = ref, ...qualifiers] = ref.split("@");
    let at: string | null = null;
    let owner: string | null = null;
    let exhausted: boolean | null = null;
    for (const raw of qualifiers) {
      const qualifier = raw.trim();
      if ((PLAYER_KEYS as readonly string[]).includes(qualifier))
        owner = this.pid(qualifier as PlayerKey);
      else if (qualifier === "ready" || qualifier === "exhausted")
        exhausted = qualifier === "exhausted";
      else at = this.anyZoneOf(qualifier, `card ref ${JSON.stringify(ref)}`);
    }
    const wanted = normalizeCardName(name);
    return this.allCards().filter((card) => {
      if (normalizeCardName(card.name) !== wanted) return false;
      if (owner && card.playerId !== owner) return false;
      if (exhausted !== null && !!this.host.isExhausted(this.room, card.id) !== exhausted)
        return false;
      if (at && at !== "board" && card.zone !== at) return false;
      if (at === "board" && !(BOARD_ZONES as readonly string[]).includes(card.zone)) return false;
      return filter(card);
    });
  }

  /** Exactly one instance for `ref` (zone `order` breaks ties between fungible copies). */
  resolve(
    ref: CardRef,
    where: string,
    options: {
      filter?: (card: Located) => boolean;
      /** Narrow to these candidates when at least one qualifies (e.g. the legal ones). */
      prefer?: (card: Located) => boolean;
      order?: readonly string[];
      fungible?: readonly string[];
    } = {},
  ): Located {
    const all = this.candidates(ref, options.filter);
    const preferred = options.prefer ? all.filter(options.prefer) : [];
    const found = preferred.length > 0 ? preferred : all;
    if (found.length === 0) {
      const known = [
        ...new Set([...this.built.labels.keys(), ...this.allCards().map((card) => card.name)]),
      ];
      const anywhere = this.candidates(ref);
      const hint =
        anywhere.length > 0
          ? ` It is ${anywhere.map((card) => this.describeLocation(card)).join(", ")}.`
          : didYouMean(ref.split("@")[0] ?? ref, known);
      throw new ScenarioStepError(`${where}: no ${JSON.stringify(ref)} available.${hint}`);
    }
    if (found.length === 1) return found[0]!;
    const order = options.order ?? [];
    const rank = (card: Located) => {
      const index = order.indexOf(card.zone);
      return index < 0 ? order.length : index;
    };
    const sorted = [...found].sort((a, b) => rank(a) - rank(b));
    const best = sorted.filter((card) => rank(card) === rank(sorted[0]!));
    const fungible = options.fungible ?? ["hand", "deck", "trash", "banished", "runeDeck"];
    if (best.length === 1 || fungible.includes(best[0]!.zone)) return best[0]!;
    // Identical copies (e.g. two ready Fury Runes, two fresh tokens) are interchangeable.
    const signature = this.signature(best[0]!.id);
    if (best.every((card) => this.signature(card.id) === signature)) return best[0]!;
    throw new ScenarioStepError(
      `${where}: ${JSON.stringify(ref)} is ambiguous (${best
        .map((card) => this.describeLocation(card))
        .join("; ")}); give the cards labels or use "${ref}@<location>"`,
    );
  }

  /** Interchangeable copies share this (name, controller, zone and object state). */
  signature(id: string): string {
    const located = this.locate(id);
    if (!located) return id;
    const card = this.host.findCard(this.room, id)?.card;
    const object = this.room.rules?.objects[id];
    return [
      located.name,
      located.playerId,
      located.zone,
      !!card?.exhausted,
      !!card?.hidden,
      card?.attachedToCardId ?? "",
      object?.damage ?? 0,
      object?.buffs ?? 0,
      !!object?.stunned,
      this.room.players.some((player) =>
        Object.values(player.board ?? {}).some(
          (list) =>
            Array.isArray(list) &&
            list.some((entry: { attachedToCardId?: string }) => entry?.attachedToCardId === id),
        ),
      ),
    ].join("|");
  }

  describeLocation(card: Located): string {
    const owner = this.keyOf(card.playerId) ?? card.playerId;
    if ((BOARD_ZONES as readonly string[]).includes(card.zone))
      return `at ${this.locationName(card.zone)} (${owner})`;
    return `in ${owner}'s ${card.zone}`;
  }

  /** "alive at Void Gate (Might 4, 3 damage)" / "in P2's trash" / "gone". */
  describeCard(id: string): string {
    const located = this.locate(id);
    if (!located) return "gone (not in any zone)";
    if ((BOARD_ZONES as readonly string[]).includes(located.zone)) {
      return `alive at ${this.locationName(located.zone)} (${this.statSummary(id)})`;
    }
    return this.describeLocation(located);
  }

  statSummary(id: string): string {
    const object = this.room.rules?.objects[id];
    const parts = [`Might ${effectiveMight(this.room, id, this.host)}`];
    if (object?.damage) parts.push(`${object.damage} damage`);
    if (object?.buffs) parts.push(`${object.buffs} buff${object.buffs === 1 ? "" : "s"}`);
    if (object?.stunned) parts.push("stunned");
    if (this.host.isExhausted(this.room, id)) parts.push("exhausted");
    return parts.join(", ");
  }

  /* ---------------------------------------------------------------- engine */

  apply(
    actor: PlayerKey,
    intent: RulesIntent,
  ): { ok: true } | { ok: false; code: string; rule: string; detail?: string } {
    this.engineCalls += 1;
    const result = applyRulesIntent(this.room, this.pid(actor), intent, this.built.ctx, this.host);
    if (!result.ok) {
      this.trace.push(
        `     ${describeIntent(this, intent)} -> REJECTED ${result.code} (${result.rule})${result.detail ? ` ${result.detail}` : ""}`,
      );
      return {
        ok: false,
        code: result.code,
        rule: result.rule,
        ...(result.detail ? { detail: result.detail } : {}),
      };
    }
    this.built.room = result.room;
    this.stepEvents.push(...result.events);
    const summary = summarizeEvents(this, result.events);
    this.trace.push(
      `     ${actor} ${describeIntent(this, intent)} -> ok${summary ? `: ${summary}` : ""}`,
    );
    return { ok: true };
  }

  stateLine(): string {
    const rules = this.room.rules;
    const parts: string[] = [];
    for (const key of PLAYER_KEYS) parts.push(`${key} ${this.scoreOf(key)} pts`);
    if (rules) {
      parts.push(`turn ${this.keyOf(rules.turn.player)} #${rules.turn.number} ${rules.turn.phase}`);
      parts.push(turnState(this.room));
      parts.push(`priority ${this.keyOf(rules.priority) ?? "-"}`);
      if (rules.focus) parts.push(`focus ${this.keyOf(rules.focus)}`);
      if (rules.chain.length > 0)
        parts.push(`chain [${rules.chain.map((item) => chainName(this, item)).join(", ")}]`);
      if (rules.combat)
        parts.push(
          `combat at ${this.battlefieldName(rules.combat.battlefield)} (${rules.combat.step})`,
        );
      else if (rules.showdown)
        parts.push(`showdown at ${this.battlefieldName(rules.showdown.battlefield)}`);
      if (rules.prompt) {
        const prompt = rules.prompt;
        const options = (prompt.options ?? []).map((option) => describeOption(this, option));
        const bounds =
          prompt.min !== undefined || prompt.max !== undefined
            ? ` min ${prompt.min ?? 0} max ${prompt.max ?? "-"}`
            : "";
        const reason = promptReason(prompt);
        parts.push(
          `prompt ${prompt.kind} for ${this.keyOf(prompt.playerId)}${reason ? ` (${reason})` : ""}${options.length > 0 ? ` [${options.join(", ")}]` : ""}${bounds}`,
        );
      }
      if (rules.manual)
        parts.push(`manual window ${rules.manual.cardName} (${this.keyOf(rules.manual.player)})`);
    }
    if (this.room.gameOutcome) {
      parts.push(
        `WINNER ${this.room.gameOutcome.winnerPlayerIds.map((id) => this.keyOf(id)).join("+")}`,
      );
    }
    return parts.join(" | ");
  }

  scoreOf(key: PlayerKey): number {
    return this.room.players.find((player) => player.id === this.pid(key))?.board?.score ?? 0;
  }
}

/** Chain item display name: the card, or "<source> (trigger)" / "<source> (ability)". */
export function chainName(session: ScenarioSession, item: ChainItem): string {
  const source =
    item.cardName ??
    item.cardSnapshot?.name ??
    (item.sourceObjectId ? session.nameOf(item.sourceObjectId) : item.kind);
  if (item.kind === "triggered") return `${source} (trigger)`;
  if (item.kind === "activated") return `${source} (ability)`;
  return source;
}

/* ------------------------------------------------------------------ describing */

export function describeIntent(session: ScenarioSession, intent: RulesIntent): string {
  switch (intent.type) {
    case "rules_play": {
      const parts = [`${intent.hide ? "hide" : "play"} ${session.nameOf(intent.cardId)}`];
      if (intent.location) parts.push(`at ${session.locationName(String(intent.location))}`);
      if (intent.choices && Object.keys(intent.choices).length > 0)
        parts.push(describeChoices(session, intent.choices));
      return `rules_play(${parts.join(" ")})`;
    }
    case "rules_activate": {
      const choices =
        intent.choices && Object.keys(intent.choices).length > 0
          ? ` ${describeChoices(session, intent.choices)}`
          : "";
      return `rules_activate(${session.nameOf(intent.objectId)} ${intent.ability}${choices})`;
    }
    case "rules_move":
      return `rules_move(${intent.unitIds.map((id) => session.nameOf(id)).join(", ")} -> ${session.locationName(String(intent.to))})`;
    case "rules_choose":
      return `rules_choose(${JSON.stringify(intent.answer)})`;
    default:
      return intent.type;
  }
}

function describeChoices(session: ScenarioSession, choices: ChoiceRecord): string {
  const describe = (value: ChoiceValue): string => {
    if (Array.isArray(value)) return `[${(value as ChoiceValue[]).map(describe).join(", ")}]`;
    if (typeof value === "string") {
      if (value.startsWith("battlefield")) return session.battlefieldName(value);
      const key = session.keyOf(value);
      if (key) return key;
      return session.locate(value) ? session.nameOf(value) : value;
    }
    return JSON.stringify(value);
  };
  return `{${Object.entries(choices)
    .map(([key, value]) => `${key}: ${describe(value)}`)
    .join(", ")}}`;
}

const QUIET_EVENTS = new Set([
  "pass_priority",
  "pass_focus",
  "focus_passes",
  "cost_paid",
  "exhaust",
  "finalize",
  "recycle",
  "zone_move",
  "pools_empty",
  "expiration_pass",
  "continuous_created",
  "contested",
]);

/** Compact human summary of the events one engine call emitted. */
export function summarizeEvents(session: ScenarioSession, events: readonly GameEvent[]): string {
  const out: string[] = [];
  const who = (event: GameEvent) => session.keyOf(event.playerId ?? event.controllerId) ?? "";
  const card = (event: GameEvent) => session.nameOf(event.cardId ?? event.objectId);
  const zone = (event: GameEvent) => (event.zone ? session.locationName(event.zone) : "");
  for (const event of events) {
    if (QUIET_EVENTS.has(event.type)) continue;
    switch (event.type) {
      case "card_played":
        out.push(`${who(event)} played ${event.cardName ?? card(event)}`);
        break;
      case "damage":
        out.push(`${event.amount ?? "?"} damage to ${card(event)}`);
        break;
      case "kill":
        out.push(`${card(event)} died`);
        break;
      case "move":
        out.push(`${card(event)} moved to ${zone(event) || "?"}`);
        break;
      case "showdown_begin":
        out.push(`showdown at ${zone(event)}`);
        break;
      case "combat_begin":
        out.push(`combat at ${zone(event)}`);
        break;
      case "damage_assigned":
        out.push(`${who(event)} assigned ${event.amount ?? 0}`);
        break;
      case "combat_result": {
        const data = event.data as { winner?: string | null; noResult?: boolean } | undefined;
        out.push(
          data?.noResult
            ? "combat: no result"
            : `combat won by ${session.keyOf(data?.winner) ?? "?"}`,
        );
        break;
      }
      case "conquer":
      case "hold":
      case "establish_control":
      case "lose_control":
        out.push(`${who(event)} ${event.type.replace("_", " ")} ${zone(event)}`.trim());
        break;
      case "gain_points":
      case "score":
        out.push(
          `${who(event)} +${event.amount ?? 1} point${(event.amount ?? 1) === 1 ? "" : "s"}`,
        );
        break;
      case "score_draw_instead":
        out.push(`${who(event)} draws instead of scoring (473.1.b)`);
        break;
      case "draw":
        out.push(`${who(event)} drew ${event.amount ?? 1}`);
        break;
      case "prompt":
        out.push(`prompt for ${who(event)}`);
        break;
      case "game_over":
        out.push("GAME OVER");
        break;
      case "trigger":
        out.push(`trigger: ${event.cardName ?? card(event)}`);
        break;
      case "spell_resolved":
      case "unit_played":
      case "gear_played":
        out.push(`${event.cardName ?? card(event)} resolved`);
        break;
      default:
        out.push(event.cardId || event.objectId ? `${event.type} ${card(event)}` : event.type);
    }
  }
  // Collapse duplicates ("x2").
  const collapsed: string[] = [];
  for (const line of out) {
    const last = collapsed[collapsed.length - 1];
    const match = last?.match(/^(.*) x(\d+)$/);
    if (last === line) collapsed[collapsed.length - 1] = `${line} x2`;
    else if (match && match[1] === line)
      collapsed[collapsed.length - 1] = `${line} x${Number(match[2]) + 1}`;
    else collapsed.push(line);
  }
  return collapsed.join("; ");
}

export function stepLabel(step: ScenarioStep): string {
  if ("check" in step) return "checkpoint";
  if ("settle" in step) return "everyone passes until the chain/showdown settles";
  const by = step.by;
  if ("play" in step) {
    const parts = [`${by} plays ${step.play}`];
    if (step.location) parts.push(`to ${step.location}`);
    if (step.targets?.length)
      parts.push(
        `targeting ${step.targets.map((t) => (Array.isArray(t) ? t.join(" + ") : t)).join(", ")}`,
      );
    if (step.mode)
      parts.push(`(mode ${Array.isArray(step.mode) ? step.mode.join(", ") : step.mode})`);
    if (Array.isArray(step.optionalCosts) && step.optionalCosts.length)
      parts.push(`paying ${step.optionalCosts.join(", ")}`);
    return parts.join(" ");
  }
  if ("hide" in step) return `${by} hides ${step.hide} at ${step.at}`;
  if ("activate" in step) {
    const targets = step.targets?.length ? ` targeting ${step.targets.flat().join(", ")}` : "";
    return `${by} activates ${step.activate}${step.ability ? ` (${step.ability})` : ""}${targets}`;
  }
  if ("move" in step) return `${by} moves ${[step.move].flat().join(" + ")} to ${step.to}`;
  if ("pass" in step) return `${by} passes`;
  if ("endTurn" in step) return `${by} ends the turn`;
  if ("choose" in step)
    return `${by} chooses ${Array.isArray(step.choose) ? step.choose.join(", ") : String(step.choose)}`;
  if ("assign" in step) {
    return `${by} assigns ${Object.entries(step.assign)
      .map(([ref, amount]) => `${amount} to ${ref}`)
      .join(", ")}`;
  }
  if ("order" in step) return `${by} orders ${step.order.join(" > ")}`;
  if ("manualDone" in step) return `${by} finishes the manual resolution`;
  if ("concede" in step) return `${by} concedes`;
  if ("intent" in step) return `${by} sends ${step.intent.type}`;
  if ("answer" in step) return `${by} answers ${JSON.stringify(step.answer)}`;
  return "step";
}

/* ------------------------------------------------------------------ step execution */

function choiceValue(session: ScenarioSession, value: unknown, where: string): ChoiceValue {
  if (Array.isArray(value))
    return value.map((entry) => choiceValue(session, entry, where)) as ChoiceValue;
  if (typeof value !== "string") return value as ChoiceValue;
  if ((PLAYER_KEYS as readonly string[]).includes(value)) return session.pid(value as PlayerKey);
  if (value.toLowerCase() === "base") return "base";
  const bf = session.built.battlefields.find(
    (entry) => entry.name.toLowerCase() === value.toLowerCase(),
  );
  if (bf) return bf.zone;
  const cards = session.candidates(value);
  if (cards.length > 0)
    return session.resolve(value, where, { order: BOARD_ZONES as unknown as string[] }).id;
  return value;
}

function targetId(session: ScenarioSession, ref: string, where: string): string {
  if ((PLAYER_KEYS as readonly string[]).includes(ref)) return session.pid(ref as PlayerKey);
  const bf = session.built.battlefields.find(
    (entry) => entry.name.toLowerCase() === ref.toLowerCase(),
  );
  if (bf && session.candidates(ref).length === 0) return bf.zone;
  return session.resolve(ref, where, {
    order: [...BOARD_ZONES, "chain", "hand", "trash", "banished", "legend", "runeArea"],
  }).id;
}

type ChoiceSpecs = ReturnType<typeof requiredChoices>;

/** Does prompt/choice option `option` denote the readable `ref`? */
function optionMatches(session: ScenarioSession, option: PromptOption, ref: string): boolean {
  const lower = ref.trim().toLowerCase();
  if (option.id === ref) return true;
  if ((PLAYER_KEYS as readonly string[]).includes(ref)) {
    const playerId = session.pid(ref as PlayerKey);
    return option.playerId === playerId || option.id === playerId;
  }
  const bf = session.built.battlefields.find(
    (entry) => entry.name.toLowerCase() === lower || entry.zone === ref,
  );
  if (
    bf &&
    (option.zone === bf.zone ||
      option.id === bf.zone ||
      option.id === `battlefield:${bf.zone}` ||
      option.objectId === `battlefield:${bf.zone}`)
  ) {
    return true;
  }
  if (lower === "base" && (option.zone === "base" || option.id === "base")) return true;
  const ids = new Set(session.candidates(ref).map((card) => card.id));
  if (
    ids.has(option.id) ||
    (option.cardId !== undefined && ids.has(option.cardId)) ||
    (option.objectId !== undefined && ids.has(option.objectId))
  ) {
    return true;
  }
  return !!option.label && option.label.toLowerCase() === lower && ids.size === 0;
}

/**
 * Bind readable targets to the ability's real choice specs (355.5-355.7): each ref goes to the
 * first spec (in rule order) that offers it, so battlefield objects, units, players and zones get
 * the option ids the engine expects. Unmatched refs fall back to `target:<i>` with a resolved id,
 * so the engine's own verdict (illegal_target ...) is reported.
 */
function bindTargets(
  session: ScenarioSession,
  specsFor: ((choices: ChoiceRecord) => ChoiceSpecs) | null,
  targets: Array<string | string[]>,
  choices: ChoiceRecord,
  where: string,
): void {
  const specs = specsFor
    ? specsFor(choices).filter((spec) => spec.key !== "mode" && spec.key !== "x")
    : [];
  const bound = new Map<string, string[]>();
  targets.forEach((target, index) => {
    const refs = Array.isArray(target) ? target : [target];
    for (const ref of refs) {
      const spec = specs.find((candidate) => {
        if (choices[candidate.key] !== undefined && !bound.has(candidate.key)) return false;
        const already = bound.get(candidate.key) ?? [];
        if (already.length >= Math.max(1, candidate.max)) return false;
        // An inner array fills one spec; separate entries go to separate specs when possible.
        if (already.length > 0 && !Array.isArray(target)) return false;
        return candidate.options.some((option) => optionMatches(session, option, ref));
      });
      if (spec) {
        const option = spec.options.find((entry) => optionMatches(session, entry, ref))!;
        bound.set(spec.key, [...(bound.get(spec.key) ?? []), option.id]);
        continue;
      }
      const key = `target:${index}`;
      if (choices[key] !== undefined && !bound.has(key)) continue;
      bound.set(key, [
        ...(bound.get(key) ?? []),
        targetId(session, ref, `${where} target ${index + 1}`),
      ]);
    }
  });
  for (const [key, ids] of bound) choices[key] = ids;
}

function buildChoices(
  session: ScenarioSession,
  step: {
    targets?: Array<string | string[]>;
    mode?: string | string[];
    x?: number;
    choices?: Record<string, unknown>;
  },
  specsFor: ((choices: ChoiceRecord) => ChoiceSpecs) | null,
  where: string,
): { choices?: ChoiceRecord; modes?: string[]; x?: number } {
  const choices: ChoiceRecord = {};
  for (const [key, value] of Object.entries(step.choices ?? {}))
    choices[key] = choiceValue(session, value, `${where} choice ${key}`);
  const modes =
    step.mode !== undefined ? (Array.isArray(step.mode) ? step.mode : [step.mode]) : undefined;
  if (step.targets?.length) {
    const withMode: ChoiceRecord = {
      ...choices,
      ...(modes ? { mode: modes.length === 1 ? modes[0]! : modes } : {}),
    };
    bindTargets(session, specsFor, step.targets, withMode, where);
    for (const [key, value] of Object.entries(withMode))
      if (key !== "mode" || choices.mode !== undefined) choices[key] = value;
  }
  return {
    ...(Object.keys(choices).length > 0 ? { choices } : {}),
    ...(modes ? { modes } : {}),
    ...(step.x !== undefined ? { x: step.x } : {}),
  };
}

/** Play-time choice specs of a card's spell ability (units/gear choose on their triggers). */
function playSpecs(
  session: ScenarioSession,
  actorId: string,
  cardId: string,
): ((choices: ChoiceRecord) => ChoiceSpecs) | null {
  const info = session.host.cardInfo(session.room, cardId);
  const spell = info ? lookupAbility(info.name, "spell")?.ability : undefined;
  if (!spell) return null;
  return (choices) =>
    requiredChoices(session.room, session.host, spell, {
      controller: actorId,
      sourceObjectId: cardId,
      choices,
    });
}

function activateSpecs(
  session: ScenarioSession,
  actorId: string,
  objectId: string,
  ref: string,
): ((choices: ChoiceRecord) => ChoiceSpecs) | null {
  const located = session.host.findCard(session.room, objectId);
  const entry = located
    ? activatedAbilitiesOf(session.room, session.host, located).find(
        (candidate) => candidate.ref === ref,
      )
    : undefined;
  if (!entry || entry.builtin || entry.manual) return null;
  return (choices) =>
    requiredChoices(session.room, session.host, entry.ability, {
      controller: actorId,
      sourceObjectId: objectId,
      choices,
    });
}

function pickRunes(
  session: ScenarioSession,
  playerId: string,
  list: RuneList,
  ready: boolean | null,
  taken: Set<string>,
  where: string,
): string[] {
  const board = session.room.players.find((player) => player.id === playerId)?.board;
  const out: string[] = [];
  for (const name of runeNames(list, where)) {
    const rune = board?.runeArea.find(
      (card) =>
        card.name === name && !taken.has(card.id) && (ready === null || card.exhausted !== ready),
    );
    if (!rune)
      throw new ScenarioStepError(
        `${where}: no ${ready ? "ready " : ""}${name} left in the Rune Area`,
      );
    taken.add(rune.id);
    out.push(rune.id);
  }
  return out;
}

function buildPlan(
  session: ScenarioSession,
  actor: PlayerKey,
  pay: PaySpec | undefined,
  raw: PaymentPlanWire | undefined,
  where: string,
): PaymentPlanWire | undefined {
  if (!pay) return raw;
  const playerId = session.pid(actor);
  const taken = new Set<string>();
  const plan: PaymentPlanWire = { ...(raw ?? {}) };
  if (pay.exhaust)
    plan.exhaustRunes = pickRunes(
      session,
      playerId,
      pay.exhaust,
      true,
      taken,
      `${where} pay.exhaust`,
    );
  if (pay.recycle)
    plan.recycleRunes = pickRunes(
      session,
      playerId,
      pay.recycle,
      null,
      taken,
      `${where} pay.recycle`,
    );
  if (pay.poolEnergy !== undefined) plan.poolEnergy = pay.poolEnergy;
  if (pay.poolPower) plan.poolPower = { ...pay.poolPower };
  const own = (card: Located) => card.playerId === playerId;
  if (pay.exhaustObjects)
    plan.exhaust = pay.exhaustObjects.map(
      (ref) => session.resolve(ref, `${where} pay.exhaustObjects`, { filter: own }).id,
    );
  if (pay.discard)
    plan.discard = pay.discard.map(
      (ref) =>
        session.resolve(ref, `${where} pay.discard`, { filter: (c) => own(c) && c.zone === "hand" })
          .id,
    );
  if (pay.kill)
    plan.kill = pay.kill.map(
      (ref) => session.resolve(ref, `${where} pay.kill`, { filter: own }).id,
    );
  return plan;
}

/** Map a readable answer onto the pending prompt's options. */
function promptOptionFor(
  session: ScenarioSession,
  prompt: Prompt,
  wanted: string,
  where: string,
  taken: ReadonlySet<string> = new Set(),
): PromptOption {
  const options = (prompt.options ?? []).filter((option) => !taken.has(option.id));
  const lower = wanted.trim().toLowerCase();
  const direct =
    options.find((option) => option.id === wanted) ??
    options.find((option) => option.label?.toLowerCase() === lower) ??
    options.find((option) => String(option.value ?? "").toLowerCase() === lower);
  if (direct) return direct;
  if ((PLAYER_KEYS as readonly string[]).includes(wanted)) {
    const playerId = session.pid(wanted as PlayerKey);
    const found = options.find((option) => option.playerId === playerId || option.id === playerId);
    if (found) return found;
  }
  if (
    lower === "base" ||
    session.built.battlefields.some((bf) => bf.name.toLowerCase() === lower || bf.zone === wanted)
  ) {
    const zone = session.zoneOf(wanted, where);
    const found = options.find(
      (option) =>
        option.zone === zone ||
        option.id === zone ||
        option.id === `battlefield:${zone}` ||
        option.objectId === `battlefield:${zone}`,
    );
    if (found) return found;
  }
  const ids = new Set(session.candidates(wanted).map((card) => card.id));
  const matching = options.filter(
    (option) =>
      ids.has(option.id) ||
      (option.cardId && ids.has(option.cardId)) ||
      (option.objectId && ids.has(option.objectId)),
  );
  if (matching.length === 1) return matching[0]!;
  if (matching.length > 1) {
    // Identical copies (same name, controller, zone and exhausted state, e.g. runes) are fungible.
    const signature = (option: PromptOption) =>
      session.signature(option.cardId ?? option.objectId ?? option.id);
    const first = signature(matching[0]!);
    if (matching.every((option) => signature(option) === first)) return matching[0]!;
    throw new ScenarioStepError(
      `${where}: ${JSON.stringify(wanted)} matches ${matching.length} different prompt options (${matching
        .map((option) => session.describeCard(option.cardId ?? option.objectId ?? option.id))
        .join("; ")}); use labels or "<name>@P1" / "<name>@<location>"`,
    );
  }
  const offered = options.map((option) => describeOption(session, option));
  throw new ScenarioStepError(
    `${where}: ${JSON.stringify(wanted)} is not offered by the ${prompt.kind} prompt (offered: ${offered.join(", ") || "nothing"}).${didYouMean(wanted, offered)}`,
  );
}

export function describeOption(session: ScenarioSession, option: PromptOption): string {
  const battlefield = /^battlefield:(battlefield[A-Z]\w*)$/.exec(option.objectId ?? option.id)?.[1];
  if (battlefield) return session.battlefieldName(battlefield);
  if (option.cardId || option.objectId) return session.nameOf(option.cardId ?? option.objectId);
  if (option.zone) return session.locationName(option.zone);
  if (option.playerId) return session.keyOf(option.playerId) ?? option.playerId;
  if (session.locate(option.id)) return session.nameOf(option.id);
  if (option.id.startsWith("battlefield")) return session.battlefieldName(option.id);
  return option.label ?? option.id;
}

function requirePrompt(session: ScenarioSession, actor: PlayerKey, where: string): Prompt {
  const prompt = session.room.rules?.prompt;
  if (!prompt)
    throw new ScenarioStepError(`${where}: no prompt is pending (${session.stateLine()})`);
  if (prompt.playerId !== session.pid(actor)) {
    throw new ScenarioStepError(
      `${where}: the pending ${prompt.kind} prompt belongs to ${session.keyOf(prompt.playerId)}, not ${actor}`,
    );
  }
  return prompt;
}

function chooseAnswer(
  session: ScenarioSession,
  prompt: Prompt,
  choose: string | string[] | boolean | number,
  where: string,
): PromptAnswer {
  if (typeof choose === "boolean") {
    // yes-no prompts: "yes"/"no", or "pay"/"decline" style ids (the first option is affirmative).
    const options = prompt.options ?? [];
    const words = choose
      ? ["yes", "pay", "accept", "apply", "true"]
      : ["no", "decline", "skip", "false"];
    const option =
      options.find(
        (entry) =>
          words.includes(entry.id.toLowerCase()) ||
          words.includes((entry.label ?? "").toLowerCase()),
      ) ?? options[choose ? 0 : 1];
    return { optionIds: [option?.id ?? (choose ? "yes" : "no")] };
  }
  if (typeof choose === "number") {
    const option = (prompt.options ?? []).find(
      (entry) => entry.value === choose || entry.id === String(choose),
    );
    return option ? { optionIds: [option.id] } : { number: choose };
  }
  const list = Array.isArray(choose) ? choose : [choose];
  const taken = new Set<string>();
  const options = list.map((wanted) => {
    const option = promptOptionFor(session, prompt, wanted, where, taken);
    taken.add(option.id);
    return option;
  });
  if (prompt.kind === "choose-opponent" || prompt.kind === "choose-player") {
    const option = options[0]!;
    return { playerId: option.playerId ?? option.id };
  }
  return { optionIds: options.map((option) => option.id) };
}

function assignAnswer(
  session: ScenarioSession,
  prompt: Prompt,
  assign: Record<string, number>,
  where: string,
): PromptAnswer {
  const data = (prompt.data ?? {}) as {
    targets?: Array<{ objectId: string }>;
    ask?: { targets?: string[] };
  };
  const offered = new Set<string>([
    ...(data.targets ?? []).map((target) => target.objectId),
    ...(data.ask?.targets ?? []),
    ...(prompt.options ?? []).map((option) => option.objectId ?? option.cardId ?? option.id),
  ]);
  const assignments = Object.entries(assign).map(([ref, amount]) => {
    const located = session.resolve(ref, `${where} assign`, {
      filter: (card) => offered.size === 0 || offered.has(card.id),
    });
    return { targetId: located.id, amount };
  });
  return { assignments };
}

function orderAnswer(
  session: ScenarioSession,
  prompt: Prompt,
  order: string[],
  where: string,
): PromptAnswer {
  const taken = new Set<string>();
  const ids = order.map((wanted) => {
    const id = promptOptionFor(session, prompt, wanted, where, taken).id;
    taken.add(id);
    return id;
  });
  return { orderedIds: ids } as PromptAnswer;
}

/** 355.1.a: an explicit list (default none), or `"ask"` to let the engine prompt. */
function optionalCostsField(value: string[] | "ask" | undefined): { optionalCosts?: string[] } {
  return value === "ask" ? {} : { optionalCosts: value ?? [] };
}

/** Translate one readable step into engine calls. */
function executeStep(session: ScenarioSession, step: ScenarioStep, where: string): void {
  if ("check" in step) return;
  if ("settle" in step) {
    const max = step.max ?? 12;
    for (let index = 0; index < max; index += 1) {
      const rules = session.room.rules;
      if (!rules || session.room.gameOutcome || rules.prompt || rules.manual) return;
      if (rules.chain.length === 0 && !rules.showdown && !rules.combat) return;
      const holder = rules.chain.length > 0 ? rules.priority : (rules.focus ?? rules.priority);
      const key = session.keyOf(holder);
      if (!key) return;
      const result = session.apply(key, { type: "rules_pass" });
      if (!result.ok)
        throw new ScenarioStepError(
          `${where}: ${key} could not pass: ${result.code} (${result.rule})`,
        );
    }
    return;
  }
  const actor = step.by;
  if (!(PLAYER_KEYS as readonly string[]).includes(actor))
    throw new ScenarioStepError(`${where}: \`by\` must be P1 or P2`);
  const playerId = session.pid(actor);
  const own = (card: Located) => card.playerId === playerId;
  let intent: RulesIntent;

  if ("play" in step) {
    const playable = new Set(legalIntents(session.room, playerId, session.host).playableCardIds);
    const card = session.resolve(step.play, `${where} play`, {
      filter: (c) =>
        own(c) && ["hand", "champion", "trash", "banished", ...BOARD_ZONES].includes(c.zone),
      prefer: (c) => playable.has(c.id),
      order: [
        "hand",
        "champion",
        "battlefieldA",
        "battlefieldB",
        "battlefieldC",
        "trash",
        "banished",
        "base",
      ],
    });
    const location = step.location
      ? session.zoneOf(step.location, `${where} location`)
      : card.zone.startsWith("battlefield")
        ? card.zone
        : undefined;
    const plan = buildPlan(session, actor, step.pay, step.plan, where);
    intent = {
      type: "rules_play",
      cardId: card.id,
      ...optionalCostsField(step.optionalCosts),
      ...buildChoices(session, step, playSpecs(session, playerId, card.id), where),
      ...(location ? { location: location as never } : {}),
      ...(plan ? { plan } : {}),
      ...(step.hold !== undefined ? { hold: step.hold } : {}),
    };
    if (step.as) session.built.labels.set(step.as, card.id);
  } else if ("hide" in step) {
    const card = session.resolve(step.hide, `${where} hide`, {
      filter: (c) => own(c) && (c.zone === "hand" || c.zone === "champion"),
      order: ["hand", "champion"],
    });
    const plan = buildPlan(session, actor, step.pay, undefined, where);
    intent = {
      type: "rules_play",
      cardId: card.id,
      hide: true,
      location: session.zoneOf(step.at, `${where} at`) as never,
      ...(plan ? { plan } : {}),
    };
  } else if ("activate" in step) {
    const activatable = legalIntents(session.room, playerId, session.host).activatable;
    const object = session.resolve(step.activate, `${where} activate`, {
      filter: (c) => own(c) && [...BOARD_ZONES, "legend", "runeArea", "champion"].includes(c.zone),
      prefer: (c) =>
        activatable.some(
          (entry) => entry.objectId === c.id && (!step.ability || entry.ability === step.ability),
        ),
      order: ["legend", ...BOARD_ZONES, "runeArea"],
    });
    let ability = step.ability;
    if (!ability) {
      const legal = legalIntents(session.room, playerId, session.host).activatable.filter(
        (entry) => entry.objectId === object.id,
      );
      const distinct = [...new Set(legal.map((entry) => entry.ability))];
      if (distinct.length > 1) {
        throw new ScenarioStepError(
          `${where}: ${step.activate} has several legal abilities (${distinct.join(", ")}); set \`ability\``,
        );
      }
      ability = distinct[0] ?? "activated:0";
    }
    const plan = buildPlan(session, actor, step.pay, step.plan, where);
    intent = {
      type: "rules_activate",
      objectId: object.id,
      ability,
      ...optionalCostsField(step.optionalCosts),
      ...buildChoices(session, step, activateSpecs(session, playerId, object.id, ability), where),
      ...(plan ? { plan } : {}),
      ...(step.hold !== undefined ? { hold: step.hold } : {}),
    };
  } else if ("move" in step) {
    const refs = Array.isArray(step.move) ? step.move : [step.move];
    const to = session.zoneOf(step.to, `${where} to`);
    const movers = new Set(
      legalIntents(session.room, playerId, session.host)
        .moves.filter((entry) => entry.to === to)
        .flatMap((entry) => entry.unitIds),
    );
    const chosen = new Set<string>();
    const unitIds = refs.map((ref) => {
      const unit = session.resolve(ref, `${where} move`, {
        filter: (c) =>
          own(c) && (BOARD_ZONES as readonly string[]).includes(c.zone) && !chosen.has(c.id),
        prefer: (c) => movers.has(c.id),
      });
      chosen.add(unit.id);
      return unit.id;
    });
    intent = { type: "rules_move", unitIds, to: to as never };
  } else if ("pass" in step) {
    intent = { type: "rules_pass" };
  } else if ("endTurn" in step) {
    intent = { type: "rules_end_turn" };
  } else if ("choose" in step) {
    const prompt = requirePrompt(session, actor, where);
    intent = {
      type: "rules_choose",
      promptId: prompt.id,
      answer: chooseAnswer(session, prompt, step.choose, where),
    };
  } else if ("assign" in step) {
    const prompt = requirePrompt(session, actor, where);
    intent = {
      type: "rules_choose",
      promptId: prompt.id,
      answer: assignAnswer(session, prompt, step.assign, where),
    };
  } else if ("order" in step) {
    const prompt = requirePrompt(session, actor, where);
    intent = {
      type: "rules_choose",
      promptId: prompt.id,
      answer: orderAnswer(session, prompt, step.order, where),
    };
  } else if ("answer" in step) {
    const prompt = requirePrompt(session, actor, where);
    intent = { type: "rules_choose", promptId: prompt.id, answer: step.answer };
  } else if ("manualDone" in step) {
    intent = { type: "rules_manual_done" };
  } else if ("concede" in step) {
    intent = { type: "rules_concede" };
  } else if ("intent" in step) {
    intent = step.intent;
  } else {
    throw new ScenarioStepError(`${where}: unknown step shape ${JSON.stringify(step)}`);
  }

  const result = session.apply(actor, intent);
  const reject = "reject" in step ? step.reject : undefined;
  if (reject) {
    if (result.ok)
      throw new ScenarioStepError(
        `${where}: expected the engine to reject this, but it was accepted`,
      );
    const wanted = reject === true ? {} : reject;
    const diffs: string[] = [];
    if (wanted.code && wanted.code !== result.code)
      diffs.push(`expected rejection ${wanted.code}, got ${result.code} (${result.rule})`);
    if (wanted.rule && wanted.rule !== result.rule)
      diffs.push(
        `expected rejection under rule ${wanted.rule}, got ${result.rule} (${result.code})`,
      );
    if (diffs.length > 0) throw new ScenarioStepError(`${where}: ${diffs.join("; ")}`, diffs);
    return;
  }
  if (!result.ok) {
    throw new ScenarioStepError(
      `${where}: the engine rejected it: ${result.code} (rule ${result.rule})${result.detail ? ` — ${result.detail}` : ""} [${session.stateLine()}]`,
    );
  }
}

/* ------------------------------------------------------------------ checkpoints */

function namesIn(session: ScenarioSession, key: PlayerKey, zone: string): string[] {
  const board = session.room.players.find((player) => player.id === session.pid(key))
    ?.board as unknown as Record<string, Array<{ name: string }> | undefined> | undefined;
  return (board?.[zone] ?? []).map((card) => card.name);
}

function compareNames(
  label: string,
  actual: string[],
  expected: NameListExpectation,
  diffs: string[],
): void {
  if (Array.isArray(expected)) {
    const a = [...actual].sort();
    const e = expected.map((name) => name).sort();
    const same =
      a.length === e.length &&
      a.every((name, index) => normalizeCardName(name) === normalizeCardName(e[index]!));
    if (!same) diffs.push(`expected ${label} [${expected.join(", ")}], got [${actual.join(", ")}]`);
    return;
  }
  const has = (name: string) =>
    actual.some((entry) => normalizeCardName(entry) === normalizeCardName(name));
  for (const name of expected.includes ?? [])
    if (!has(name)) diffs.push(`expected ${label} to include ${name}, got [${actual.join(", ")}]`);
  for (const name of expected.excludes ?? [])
    if (has(name))
      diffs.push(`expected ${label} not to include ${name}, got [${actual.join(", ")}]`);
  if (expected.count !== undefined && actual.length !== expected.count) {
    diffs.push(
      `expected ${expected.count} card(s) in ${label}, got ${actual.length} [${actual.join(", ")}]`,
    );
  }
}

function onBoard(card: Located): boolean {
  return (BOARD_ZONES as readonly string[]).includes(card.zone);
}

function checkUnit(
  session: ScenarioSession,
  ref: string,
  expected: UnitExpectation,
  diffs: string[],
): void {
  const found = session.candidates(ref);
  if (found.length === 0) {
    diffs.push(`expected ${ref} to exist, but no such card is in any zone`);
    return;
  }
  const preferred = found.filter(onBoard);
  const pool = preferred.length > 0 ? preferred : found;
  if (preferred.length > 1) {
    diffs.push(
      `${ref} is ambiguous on the board (${preferred.map((card) => session.describeLocation(card)).join("; ")}); use labels`,
    );
    return;
  }
  const card = pool[0]!;
  const object = session.room.rules?.objects[card.id];
  const now = session.describeCard(card.id);
  if (expected.at !== undefined) {
    const at = session.anyZoneOf(expected.at, `units.${ref}.at`);
    const ok = at === "board" ? onBoard(card) : card.zone === at;
    if (!ok) diffs.push(`expected ${ref} at ${expected.at}, got ${now}`);
  }
  const wantsStats =
    expected.might !== undefined ||
    expected.damage !== undefined ||
    expected.exhausted !== undefined ||
    expected.buffs !== undefined ||
    expected.stunned !== undefined ||
    expected.keywords !== undefined;
  if (wantsStats && !onBoard(card)) {
    diffs.push(`expected ${ref} on the board (${JSON.stringify(expected)}), got ${now}`);
    return;
  }
  if (expected.might !== undefined) {
    const might = effectiveMight(session.room, card.id, session.host);
    if (might !== expected.might)
      diffs.push(`expected ${ref} Might ${expected.might}, got ${might} (${now})`);
  }
  if (expected.damage !== undefined && (object?.damage ?? 0) !== expected.damage) {
    diffs.push(
      `expected ${ref} with ${expected.damage} damage, got ${object?.damage ?? 0} (${now})`,
    );
  }
  if (expected.buffs !== undefined && (object?.buffs ?? 0) !== expected.buffs) {
    diffs.push(`expected ${ref} with ${expected.buffs} buff(s), got ${object?.buffs ?? 0}`);
  }
  if (expected.stunned !== undefined && !!object?.stunned !== expected.stunned) {
    diffs.push(`expected ${ref} ${expected.stunned ? "stunned" : "not stunned"}, got ${now}`);
  }
  if (expected.exhausted !== undefined) {
    const exhausted = !!session.host.isExhausted(session.room, card.id);
    if (exhausted !== expected.exhausted)
      diffs.push(`expected ${ref} ${expected.exhausted ? "exhausted" : "ready"}, got ${now}`);
  }
  if (expected.keywords) {
    const keywords = effectiveKeywords(session.room, card.id, session.host).map((k) =>
      k.toLowerCase(),
    );
    for (const keyword of expected.keywords) {
      if (
        !keywords.some(
          (entry) =>
            entry === keyword.toLowerCase() || entry.startsWith(`${keyword.toLowerCase()} `),
        )
      ) {
        diffs.push(`expected ${ref} to have [${keyword}], got [${keywords.join(", ")}]`);
      }
    }
  }
  if (expected.controller !== undefined && session.keyOf(card.playerId) !== expected.controller) {
    diffs.push(
      `expected ${ref} controlled by ${expected.controller}, got ${session.keyOf(card.playerId)}`,
    );
  }
  if (expected.gear !== undefined) {
    const gear = session
      .allCards()
      .filter(
        (entry) => session.host.findCard(session.room, entry.id)?.card.attachedToCardId === card.id,
      )
      .map((entry) => entry.name);
    compareNames(`gear on ${ref}`, gear, expected.gear, diffs);
  }
}

/** Every mismatch between the room and the checkpoint, as readable sentences. */
export function checkpointDiffs(session: ScenarioSession, checkpoint: Checkpoint): string[] {
  const diffs: string[] = [];
  const rules = session.room.rules;
  for (const [key, points] of Object.entries(checkpoint.points ?? {})) {
    const actual = session.scoreOf(key as PlayerKey);
    if (actual !== points) diffs.push(`expected ${key} at ${points} point(s), got ${actual}`);
  }
  for (const ref of checkpoint.alive ?? []) {
    const found = session.candidates(ref);
    if (!found.some(onBoard)) {
      diffs.push(
        `expected ${ref} alive, got ${found.length > 0 ? found.map((card) => session.describeCard(card.id)).join("; ") : "no such card anywhere"}`,
      );
    }
  }
  for (const ref of checkpoint.dead ?? []) {
    const found = session.candidates(ref);
    const living = found.filter(onBoard);
    if (living.length > 0) {
      diffs.push(
        `expected ${ref} dead, got ${living.map((card) => session.describeCard(card.id)).join("; ")}`,
      );
    } else if (!found.some((card) => card.zone === "trash")) {
      diffs.push(
        `expected ${ref} dead (in its owner's trash), got ${found.length > 0 ? found.map((card) => session.describeCard(card.id)).join("; ") : "no such card anywhere"}`,
      );
    }
  }
  for (const [ref, expected] of Object.entries(checkpoint.units ?? {}))
    checkUnit(session, ref, expected, diffs);
  for (const [ref, expected] of Object.entries(checkpoint.control ?? {})) {
    let zone: string;
    try {
      zone = session.zoneOf(ref, "control");
    } catch (error) {
      diffs.push((error as Error).message);
      continue;
    }
    const actual = session.keyOf(battlefieldController(session.room, zone, session.host));
    if (actual !== expected)
      diffs.push(
        `expected ${ref} controlled by ${expected ?? "nobody"}, got ${actual ?? "nobody"}`,
      );
  }
  if (checkpoint.chain !== undefined) {
    const actual = (rules?.chain ?? []).map((item) => chainName(session, item));
    const same =
      actual.length === checkpoint.chain.length &&
      actual.every((name, index) =>
        normalizeCardName(name).startsWith(normalizeCardName(checkpoint.chain![index]!)),
      );
    if (!same)
      diffs.push(`expected chain [${checkpoint.chain.join(", ")}], got [${actual.join(", ")}]`);
  }
  const playerField = (
    label: string,
    expected: PlayerKey | null | undefined,
    actual: string | null | undefined,
  ) => {
    if (expected === undefined) return;
    const got = session.keyOf(actual);
    if (got !== expected)
      diffs.push(`expected ${label} ${expected ?? "nobody"}, got ${got ?? "nobody"}`);
  };
  playerField("priority with", checkpoint.priority, rules?.priority);
  playerField("focus with", checkpoint.focus, rules?.focus);
  playerField("turn player", checkpoint.turnPlayer, rules?.turn.player);
  if (checkpoint.state !== undefined && turnState(session.room) !== checkpoint.state) {
    diffs.push(`expected state ${checkpoint.state}, got ${turnState(session.room)}`);
  }
  if (checkpoint.phase !== undefined && rules?.turn.phase !== checkpoint.phase) {
    diffs.push(`expected phase ${checkpoint.phase}, got ${rules?.turn.phase}`);
  }
  if (checkpoint.prompt !== undefined) {
    const prompt = rules?.prompt ?? null;
    if (checkpoint.prompt === null) {
      if (prompt)
        diffs.push(
          `expected no prompt, got ${prompt.kind} for ${session.keyOf(prompt.playerId)} (${promptReason(prompt) ?? ""})`,
        );
    } else if (!prompt) {
      diffs.push(
        `expected a ${checkpoint.prompt.kind ?? ""} prompt${checkpoint.prompt.for ? ` for ${checkpoint.prompt.for}` : ""}, got none`,
      );
    } else {
      if (checkpoint.prompt.kind && prompt.kind !== checkpoint.prompt.kind)
        diffs.push(`expected a ${checkpoint.prompt.kind} prompt, got ${prompt.kind}`);
      if (checkpoint.prompt.for && session.keyOf(prompt.playerId) !== checkpoint.prompt.for) {
        diffs.push(
          `expected the prompt for ${checkpoint.prompt.for}, got ${session.keyOf(prompt.playerId)}`,
        );
      }
      if (checkpoint.prompt.reason && promptReason(prompt) !== checkpoint.prompt.reason) {
        diffs.push(
          `expected prompt reason ${checkpoint.prompt.reason}, got ${promptReason(prompt)}`,
        );
      }
    }
  }
  if (checkpoint.showdown !== undefined) {
    const showdown = rules?.showdown ?? null;
    if (checkpoint.showdown === null) {
      if (showdown)
        diffs.push(
          `expected no showdown, got one at ${session.battlefieldName(showdown.battlefield)}`,
        );
    } else if (!showdown) diffs.push("expected a showdown, got none");
    else if (
      checkpoint.showdown.at &&
      session.zoneOf(checkpoint.showdown.at, "showdown.at") !== showdown.battlefield
    ) {
      diffs.push(
        `expected the showdown at ${checkpoint.showdown.at}, got ${session.battlefieldName(showdown.battlefield)}`,
      );
    }
  }
  if (checkpoint.combat !== undefined) {
    const combat = rules?.combat ?? null;
    if (checkpoint.combat === null) {
      if (combat)
        diffs.push(`expected no combat, got one at ${session.battlefieldName(combat.battlefield)}`);
    } else if (!combat) diffs.push("expected a combat, got none");
    else {
      if (
        checkpoint.combat.at &&
        session.zoneOf(checkpoint.combat.at, "combat.at") !== combat.battlefield
      ) {
        diffs.push(
          `expected the combat at ${checkpoint.combat.at}, got ${session.battlefieldName(combat.battlefield)}`,
        );
      }
      playerField("attacker", checkpoint.combat.attacker, combat.attacker);
      playerField("defender", checkpoint.combat.defender, combat.defender);
    }
  }
  if (checkpoint.winner !== undefined) {
    const winners = session.room.gameOutcome?.winnerPlayerIds ?? [];
    const got = winners.length > 0 ? winners.map((id) => session.keyOf(id)).join("+") : null;
    if (got !== checkpoint.winner)
      diffs.push(
        `expected winner ${checkpoint.winner ?? "none (game continues)"}, got ${got ?? "none"}`,
      );
  }
  for (const [key, zones] of Object.entries(checkpoint.zones ?? {})) {
    const player = key as PlayerKey;
    if (!zones) continue;
    for (const zone of ["hand", "base", "trash", "banished"] as const) {
      const expected = zones[zone];
      if (expected !== undefined)
        compareNames(`${player} ${zone}`, namesIn(session, player, zone), expected, diffs);
    }
    if (zones.deckCount !== undefined) {
      const count = namesIn(session, player, "deck").length;
      if (count !== zones.deckCount)
        diffs.push(`expected ${player} deck at ${zones.deckCount} card(s), got ${count}`);
    }
    const board = session.room.players.find((entry) => entry.id === session.pid(player))?.board;
    if (zones.runes && board) {
      const ready = board.runeArea.filter((card) => !card.exhausted).length;
      const exhausted = board.runeArea.length - ready;
      if (zones.runes.ready !== undefined && ready !== zones.runes.ready)
        diffs.push(`expected ${player} with ${zones.runes.ready} ready rune(s), got ${ready}`);
      if (zones.runes.exhausted !== undefined && exhausted !== zones.runes.exhausted) {
        diffs.push(
          `expected ${player} with ${zones.runes.exhausted} exhausted rune(s), got ${exhausted}`,
        );
      }
      if (zones.runes.total !== undefined && board.runeArea.length !== zones.runes.total) {
        diffs.push(
          `expected ${player} with ${zones.runes.total} rune(s), got ${board.runeArea.length}`,
        );
      }
    }
    if (zones.pool) {
      const pool = rules?.pools[session.pid(player)] ?? { energy: 0, power: {} };
      if (zones.pool.energy !== undefined && pool.energy !== zones.pool.energy)
        diffs.push(`expected ${player} pool energy ${zones.pool.energy}, got ${pool.energy}`);
      for (const [domain, amount] of Object.entries(zones.pool.power ?? {})) {
        const got = pool.power[domain as keyof typeof pool.power] ?? 0;
        if (got !== amount)
          diffs.push(`expected ${player} pool ${domain} power ${amount}, got ${got}`);
      }
    }
    if (zones.legendExhausted !== undefined && board) {
      const exhausted = !!board.legend[0]?.exhausted;
      if (exhausted !== zones.legendExhausted)
        diffs.push(
          `expected ${player}'s legend ${zones.legendExhausted ? "exhausted" : "ready"}, got ${exhausted ? "exhausted" : "ready"}`,
        );
    }
  }
  const types = session.stepEvents.map((event) => event.type);
  for (const type of checkpoint.events ?? [])
    if (!types.includes(type))
      diffs.push(`expected a ${type} event, got [${[...new Set(types)].join(", ")}]`);
  for (const type of checkpoint.noEvents ?? [])
    if (types.includes(type)) diffs.push(`expected no ${type} event, but it was emitted`);
  return diffs;
}

/* ------------------------------------------------------------------ run */

export interface RunOptions {
  file?: string;
}

/** Validate the scenario and build its position (step 0). */
function startSession(
  spec: ScenarioSpec,
): { session: ScenarioSession } | { failure: ScenarioFailure } {
  const problems = validateScenario(spec);
  if (problems.length > 0) {
    return {
      failure: {
        step: 0,
        label: "validation",
        message: `invalid scenario: ${problems.join("; ")}`,
        diffs: problems,
      },
    };
  }
  try {
    return { session: new ScenarioSession(buildPosition(spec.position, { roomCode: "SCENARIO" })) };
  } catch (error) {
    const message = (error as Error).message;
    return {
      failure: { step: 0, label: "position", message: `position: ${message}`, diffs: [message] },
    };
  }
}

/** Run one scenario. Never throws for scenario problems: they become a `fail` result. */
export function runScenario(spec: ScenarioSpec, options: RunOptions = {}): ScenarioResult {
  const expectFailure = normalizeExpectedFailure(spec.expectFailure);
  const trace: string[] = [];
  const warnings: string[] = [];
  let failure: ScenarioFailure | undefined;
  let session: ScenarioSession | null = null;
  const started = startSession(spec);
  if ("failure" in started) failure = started.failure;
  else {
    session = started.session;
    warnings.push(...started.session.built.warnings);
    trace.push(`  position: ${session.stateLine()}`);
  }

  let index = 0;
  if (session) {
    for (const step of spec.steps) {
      index += 1;
      const label = stepLabel(step);
      const where = `step ${index} (${label})`;
      session.stepEvents = [];
      session.trace.length = 0;
      trace.push(
        `  ${String(index).padStart(2, " ")}. ${label}${step.note ? `  — ${step.note}` : ""}`,
      );
      try {
        executeStep(session, step, where);
        trace.push(...session.trace);
        const checkpoint = "check" in step ? step.check : step.expect;
        if (checkpoint) {
          const diffs = checkpointDiffs(session, checkpoint);
          if (diffs.length > 0) {
            trace.push(`     CHECK FAILED: ${diffs.join("; ")}`);
            failure = { step: index, label, message: `${where}: ${diffs.join("; ")}`, diffs };
            break;
          }
          trace.push(`     check ok`);
        }
        trace.push(`     = ${session.stateLine()}`);
      } catch (error) {
        trace.push(...session.trace);
        const message = (error as Error).message;
        const diffs = error instanceof ScenarioStepError ? error.diffs : [message];
        trace.push(`     FAILED: ${message}`);
        failure = {
          step: index,
          label,
          message: message.startsWith("step ") ? message : `${where}: ${message}`,
          diffs,
        };
        break;
      }
    }
  }

  let status: ScenarioStatus;
  if (expectFailure) {
    if (!failure) status = "xpass";
    else if (expectFailure.atStep !== undefined && expectFailure.atStep !== failure.step)
      status = "fail";
    else status = "xfail";
  } else {
    status = failure ? "fail" : "pass";
  }
  if (status === "fail" && expectFailure && failure && expectFailure.atStep !== undefined) {
    failure = {
      ...failure,
      message: `expected the known divergence at step ${expectFailure.atStep}, but the scenario failed at step ${failure.step}: ${failure.message}`,
    };
  }
  return {
    title: spec.title,
    ...(options.file ? { file: options.file } : {}),
    verification: spec.verification,
    status,
    ...(failure ? { failure } : {}),
    ...(expectFailure ? { expectFailure } : {}),
    trace,
    warnings,
    steps: index,
    engineCalls: session?.engineCalls ?? 0,
  };
}

/** One-paragraph explanation for a non-passing result (used by vitest and the CLI). */
export function explainResult(result: ScenarioResult): string {
  const where = result.file ? ` (${result.file})` : "";
  switch (result.status) {
    case "pass":
      return `PASS ${result.title}${where}`;
    case "xfail":
      return `XFAIL ${result.title}${where}: known divergence ${result.expectFailure?.reason ?? ""} — ${result.failure?.message ?? ""}`;
    case "xpass":
      return `XPASS ${result.title}${where}: marked expectFailure (${result.expectFailure?.reason ?? ""}) but every step and checkpoint passed — the engine may be fixed; remove \`expectFailure\` (or fix the scenario).`;
    case "fail":
      return `FAIL ${result.title}${where}: ${result.failure?.message ?? "unknown failure"}\n${result.trace.join("\n")}`;
  }
}

/** Throws (with the readable diff) unless the result is `pass` or `xfail`. */
export function assertScenarioResult(result: ScenarioResult): void {
  if (result.status === "pass" || result.status === "xfail") return;
  throw new Error(explainResult(result));
}
