/**
 * @rift/protocol — strict-rules Effect DSL (§6.2).
 *
 * The discriminated union maps 1:1 to the game actions of rules 412–448 plus the control ops;
 * `Selector` / `Amount` / `Condition` are the building blocks. `Effect` is extensible: R2 agents
 * add ops to their `domains/*` file (`*EffectOp`), never to `CoreEffect` here.
 */

import type { BattlefieldZone } from "../game-state";
import type {
  ChoiceRecord,
  EffectDuration,
  RulesDomain,
  RulesPhase,
  RulesStep,
  TurnState,
} from "./core";
import type { Cost } from "./cost";
import type { PlayEffectOp } from "./domains/play";
import type { CombatEffectOp } from "./domains/combat";
import type { EffectsEffectOp } from "./domains/effects";
import type { IntEffectOp } from "./domains/int";

export type Amount =
  | number
  | { kind: "fixed"; value: number }
  | { kind: "count"; selector: Selector; per?: number }
  | { kind: "might"; selector: Selector }
  | { kind: "damage"; selector: Selector }
  | { kind: "points"; player?: PlayerSelector }
  | { kind: "cards-in-hand"; player?: PlayerSelector }
  | { kind: "cards-in-zone"; player?: PlayerSelector; zone: string }
  | { kind: "spent"; player?: PlayerSelector }
  | { kind: "x" }
  | { kind: "sum"; amounts: Amount[] }
  | { kind: "min"; amounts: Amount[]; cap?: Amount }
  | { kind: "max"; amounts: Amount[] }
  /** R3 — 832.1.d / 832.1.d.1: information about the shown-off object, noted when shown off. */
  | { kind: "shown-off"; property?: "might" | "energy-cost" | "power-cost" | "count" };

export type ComparisonOp = "lt" | "lte" | "eq" | "gte" | "gt" | "neq";

export interface Comparison {
  op: ComparisonOp;
  value: Amount;
}

export type PlayerSelector =
  | "self"
  | "opponent"
  | "all"
  | "each"
  | "turn-player"
  | "priority-holder"
  | "focus-holder"
  | { kind: "player"; id: string }
  | { kind: "chosen"; ref?: string }
  | { kind: "controller"; of: Selector }
  | { kind: "owner"; of: Selector };

export type ZoneSelector =
  | "base"
  | "hand"
  | "deck"
  | "trash"
  | "banished"
  | "champion"
  | "legend"
  | "runeArea"
  | "runeDeck"
  | "chain"
  | "battlefield"
  | BattlefieldZone
  | { kind: "battlefield"; id: BattlefieldZone }
  | { kind: "chosen"; ref?: string };

export interface Selector {
  /** Restrict to a zone / location. */
  zone?: ZoneSelector;
  controller?: "self" | "opponent" | "any" | "all" | PlayerSelector;
  owner?: PlayerSelector;
  cardType?: CardTypeName;
  /** Card name (unique names are the script key, §6.1). */
  name?: string;
  /** 143.1 / 185.2.c tag (catalog subtype, e.g. "Mech"); checked against the catalog by the registry integrity test. */
  tag?: string;
  keyword?: KeywordName;
  minMight?: Amount;
  might?: Comparison;
  maxCount?: Amount;
  count?: Amount;
  /** "chosen" reads a target bound on the chain item (355). */
  chosen?: boolean;
  targetRef?: string;
  excludeSource?: boolean;
  excludeSelf?: boolean;
  /** All objects matching, rather than a single chosen target. */
  all?: boolean;
  /** Picks one object from the matching set (default choice handling). */
  pick?: "controller" | "opponent" | "turn-player" | "random";
}

export interface TokenSpec {
  name: string;
  count?: number;
  exhausted?: boolean;
  might?: number;
  type?: string;
  keywords?: KeywordName[];
  zone?: ZoneSelector;
}

export interface ResourceSpec {
  energy?: Amount;
  power?: Partial<Record<RulesDomain | "any", number>>;
}

export type Condition =
  | { kind: "true" }
  | { kind: "false" }
  | { kind: "and"; conditions: Condition[] }
  | { kind: "or"; conditions: Condition[] }
  | { kind: "not"; condition: Condition }
  | { kind: "exists"; selector: Selector }
  | { kind: "count"; selector: Selector; comparison: Comparison }
  | { kind: "compare"; left: Amount; op: ComparisonOp; right: Amount }
  | { kind: "has-keyword"; selector: Selector; keyword: KeywordName }
  | { kind: "is-turn-player"; player?: PlayerSelector }
  | { kind: "is-phase"; phase: RulesPhase }
  | { kind: "is-state"; state: TurnState }
  | { kind: "player-score"; player?: PlayerSelector; comparison: Comparison }
  | { kind: "scored-this-turn"; player?: PlayerSelector; zone?: BattlefieldZone }
  | { kind: "controls"; player?: PlayerSelector; zone?: BattlefieldZone }
  | { kind: "custom"; id: string; params?: Record<string, unknown> };

export interface EventMatcher {
  type: EventType | EventType[];
  sourceObjectId?: string;
  controller?: PlayerSelector;
  cardType?: CardTypeName;
  zone?: ZoneSelector;
  condition?: Condition;
  data?: Record<string, unknown>;
}

export interface Limit {
  kind: "once-per-turn" | "once-per-game" | "once-per-chain" | "per-turn" | "custom";
  key?: string;
  count?: number;
  /** Optional state key used by the interpreter. */
  scope?: "object" | "player" | "game";
}

/**
 * Closed keyword vocabulary (F7/G7): the rules 805–832 keyword glossary plus the bracketed game
 * terms printed like keywords (`[Add]`, `[Buff]`, `[Burn]`, `[Mighty]`, `[Predict]`). A keyword's
 * value ("[Assault 2]") is never part of the name: use the separate `value` field.
 *
 * Adding a keyword (new set): add it here, then follow docs/rules/CARD-AUTHORING.md §"New
 * keyword or mechanic".
 */
export const KEYWORD_NAMES = [
  "Accelerate",
  "Action",
  "Ambush",
  "Assault",
  "Backline",
  "Deathknell",
  "Deflect",
  "Deploy",
  "Disarm",
  "Empower",
  "Empowered",
  "Equip",
  "Flow",
  "Ganking",
  "Hidden",
  "Hunt",
  "Legion",
  "Level",
  "Quick-Draw",
  "Reaction",
  "Repeat",
  "Shield",
  "Show Off",
  "Tank",
  "Temporary",
  "Unique",
  "Vision",
  "Weaponmaster",
  /* bracketed game terms */
  "Add",
  "Buff",
  "Burn",
  "Mighty",
  "Predict",
] as const;

export type KeywordName = (typeof KEYWORD_NAMES)[number];

/**
 * Card-type filters for `Selector.cardType`, `EventMatcher.cardType` and cost modifiers (G7).
 * `permanent` = unit or gear; `card` = anything but runes, legends, battlefields and abilities.
 */
export const CARD_TYPE_NAMES = ["unit", "gear", "spell", "rune", "battlefield", "legend", "permanent", "card"] as const;

export type CardTypeName = (typeof CARD_TYPE_NAMES)[number];

/**
 * Restriction kinds ("can't …", 054–056, 756–758) a `restriction` modifier may impose (G7),
 * optionally qualified: `be-targeted:enemy` (757.1 "can't be chosen by enemy spells and
 * abilities"), `be-targeted:spells` / `be-targeted:abilities`, `move:to-base`.
 */
export const RESTRICTION_KINDS = [
  "play",
  "activate",
  "move",
  "be-targeted",
  "be-dealt-damage",
  "attack",
  "defend",
  "ready",
  "score",
] as const;

export type RestrictionKind = (typeof RESTRICTION_KINDS)[number];

export const RESTRICTION_QUALIFIED = [
  "be-targeted:enemy",
  "be-targeted:spells",
  "be-targeted:abilities",
  "move:to-base",
] as const;

export type RestrictionName = RestrictionKind | (typeof RESTRICTION_QUALIFIED)[number];

/**
 * Event types a trigger / replacement matcher may name (G7): every `GameEvent.type` the rules
 * engine emits, plus the matcher aliases (`die` → `kill`; `played` → the three resolution
 * events, 420.4.a). The registry integrity test checks each entry is emitted by the engine.
 */
export const RULES_EVENT_TYPES = [
  "ability_activated",
  "add_resolved",
  "add_resources",
  "attach",
  "attack",
  "banish",
  "battlefield_replaced",
  "become_mighty",
  "buff",
  "burn",
  "burn_out",
  "card_played",
  "chain_append",
  "channel",
  "combat_begin",
  "combat_damage",
  "combat_end",
  "combat_result",
  "concede",
  "conquer",
  "conquer_result",
  "contested",
  "contested_reapplied",
  "continuous_created",
  "cost_paid",
  "counter",
  "counter_added",
  "counter_spent",
  "create_token",
  "damage",
  "damage_assigned",
  "defend",
  "delayed_created",
  "detach",
  "discard",
  "disempower",
  "draw",
  "empower",
  "ending_step",
  "end_turn",
  "enters_ready",
  "establish_control",
  "exhaust",
  "expiration_pass",
  "expiration_paused",
  "expiration_repeat",
  "finalize",
  "focus_passes",
  "gain_control",
  "gain_points",
  "gain_xp",
  "game_over",
  "gear_played",
  "grant_keyword",
  "group_subset",
  "heal",
  "hidden_card_to_trash",
  "hide",
  "hold",
  "hold_scoring",
  "kill",
  "look",
  "loop_guard",
  "lose_control",
  "lose_game",
  "lose_points",
  "manual_done",
  "manual_window",
  "might",
  "mill",
  "mistarget",
  "move",
  "pass_focus",
  "pass_priority",
  "pay_points",
  "place_in_deck",
  "play_cancelled",
  "player_removed",
  "pools_empty",
  "predict",
  "prevent",
  "prevented",
  "prompt",
  "prompt_answered",
  "put_in_hand",
  "put_on_deck",
  "ready",
  "ready_all",
  "recall",
  "recycle",
  "remove_keyword",
  "replaced",
  "replacement_created",
  "replacement_held",
  "return_to_hand",
  "reveal",
  "score",
  "score_draw_instead",
  "search",
  "showdown_begin",
  "showdown_end",
  "shuffle",
  "skip",
  "skip_created",
  "spell_resolved",
  "spend_buff",
  "spend_xp",
  "stun",
  "swap",
  "trigger",
  "turn_end",
  "turn_start",
  "unit_played",
  "zone_move",
] as const;

/**
 * Matcher-only aliases (`triggers/match.ts`): `die` = `kill`; `played` = a card finished
 * resolving (420.4.a); `deal_damage` = the damage game action as replacement abilities name it
 * (the proposal type of `actions/damage.ts`, matched against `damage` events).
 */
export const EVENT_TYPE_ALIASES = {
  die: ["kill"],
  played: ["spell_resolved", "unit_played", "gear_played"],
  deal_damage: ["damage"],
} as const satisfies Record<string, readonly (typeof RULES_EVENT_TYPES)[number][]>;

export type EventType = (typeof RULES_EVENT_TYPES)[number] | keyof typeof EVENT_TYPE_ALIASES;

/** Core Effect ops (§6.2). R2 agents add ops to their `domains/*` file, never here. */
export type CoreEffect =
  /* control ops */
  | { op: "seq"; effects: Effect[] }
  | {
      op: "choose_mode";
      modes: Array<{ id: string; label?: string; effect: Effect }>;
      promptKey?: string;
    }
  | { op: "may"; effect: Effect; label?: string }
  | { op: "if"; condition: Condition; then: Effect; else?: Effect }
  | { op: "for_each"; selector: Selector; effect: Effect; max?: Amount }
  | { op: "repeat"; times: Amount; effect: Effect }
  /* rules 412–448 game actions */
  | { op: "draw"; amount: Amount; player?: PlayerSelector }
  | { op: "exhaust"; target: Selector }
  | { op: "ready"; target: Selector }
  | {
      op: "recycle";
      target: Selector;
      to?: "deck" | "runeDeck";
      amount?: Amount;
      from?: ZoneSelector;
    }
  | { op: "deal"; amount: Amount; target: Selector; source?: Selector }
  | { op: "heal"; amount: Amount; target: Selector }
  | { op: "play"; target: Selector; cost?: "normal" | "ignored" | "free"; location?: ZoneSelector }
  | { op: "move"; target: Selector; to: ZoneSelector }
  | { op: "hide"; target: Selector }
  | { op: "discard"; player?: PlayerSelector; amount: Amount }
  | { op: "stun"; target: Selector }
  | { op: "reveal"; target: Selector }
  | { op: "counter"; target: Selector }
  | { op: "buff"; target: Selector }
  | { op: "banish"; target: Selector }
  | { op: "kill"; target: Selector }
  | { op: "add"; resources: ResourceSpec; player?: PlayerSelector }
  | { op: "channel"; amount: Amount; player?: PlayerSelector; exhausted?: boolean }
  | { op: "burn_out"; player?: PlayerSelector }
  | { op: "double"; target: Selector; property?: "might" | "damage" | "points" }
  | { op: "swap"; a: Selector; b: Selector; property?: "might" | "zone" | "control" }
  | { op: "attach"; gear: Selector; to: Selector }
  | { op: "detach"; target: Selector }
  | { op: "predict"; amount: Amount; player?: PlayerSelector }
  | { op: "prevent"; amount: Amount; target?: Selector }
  | { op: "replace"; matches: EventMatcher; replace: Effect | { prevent: Amount } }
  | { op: "create"; token: TokenSpec; player?: PlayerSelector; zone?: ZoneSelector }
  | { op: "burn"; amount: Amount; target: Selector }
  | { op: "empower"; target: Selector }
  | { op: "disempower"; target: Selector }
  | { op: "skip"; what: "draw" | "channel" | "phase"; phase?: RulesPhase }
  | { op: "pay"; cost: Cost; player?: PlayerSelector }
  | { op: "copy"; target: Selector; choices?: ChoiceRecord }
  | { op: "recall"; target: Selector }
  | { op: "score_points"; amount: Amount; player?: PlayerSelector }
  | { op: "gain_xp"; amount: Amount; player?: PlayerSelector }
  | { op: "spend_xp"; amount: Amount; player?: PlayerSelector }
  | {
      op: "look";
      amount: Amount;
      player?: PlayerSelector;
      zone?: "deck" | "runeDeck";
      then?: Effect;
    }
  | {
      op: "search";
      player?: PlayerSelector;
      zone?: "deck" | "runeDeck";
      selector?: Selector;
      then?: Effect;
    }
  | { op: "shuffle"; player?: PlayerSelector; zone?: "deck" | "runeDeck" }
  | { op: "temporary_might"; amount: Amount; target: Selector; duration?: EffectDuration }
  /** `value` = the keyword's value ("[Assault 2]" → `{ keyword: "Assault", value: 2 }`). */
  | { op: "grant_keyword"; keyword: KeywordName; value?: Amount; target: Selector; duration?: EffectDuration }
  | { op: "return_to_hand"; target: Selector }
  /** Escape hatch for genuinely unique text (§6.2); always registered and tested. */
  | { op: "custom"; id: string; params?: Record<string, unknown> };

export type Effect = CoreEffect | PlayEffectOp | CombatEffectOp | EffectsEffectOp | IntEffectOp;

export type Trigger =
  | { kind: "event"; event: EventMatcher }
  | { kind: "phase"; phase: RulesPhase; step?: RulesStep }
  | { kind: "turn-start" }
  | { kind: "turn-end" }
  | { kind: "showdown-begin" }
  | { kind: "showdown-end" }
  | { kind: "combat-begin" }
  | { kind: "combat-end" }
  | { kind: "custom"; id: string };

export type Modifier =
  | { kind: "might"; amount: Amount; target: Selector }
  | { kind: "keyword"; keyword: KeywordName; value?: number; target: Selector }
  | { kind: "cost"; amount: Amount; target: Selector; cardType?: CardTypeName }
  | { kind: "restriction"; restriction: RestrictionName; target: Selector }
  | { kind: "custom"; id: string; params?: Record<string, unknown> };
