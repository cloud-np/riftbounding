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
  | { kind: "max"; amounts: Amount[] };

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
  cardType?: string;
  /** Card name (unique names are the script key, §6.1). */
  name?: string;
  tag?: string;
  keyword?: string;
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
  keywords?: string[];
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
  | { kind: "has-keyword"; selector: Selector; keyword: string }
  | { kind: "is-turn-player"; player?: PlayerSelector }
  | { kind: "is-phase"; phase: RulesPhase }
  | { kind: "is-state"; state: TurnState }
  | { kind: "player-score"; player?: PlayerSelector; comparison: Comparison }
  | { kind: "scored-this-turn"; player?: PlayerSelector; zone?: BattlefieldZone }
  | { kind: "controls"; player?: PlayerSelector; zone?: BattlefieldZone }
  | { kind: "custom"; id: string; params?: Record<string, unknown> };

export interface EventMatcher {
  type: string | string[];
  sourceObjectId?: string;
  controller?: PlayerSelector;
  cardType?: string;
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

export type KeywordName =
  | "Action"
  | "Reaction"
  | "Hidden"
  | "Accelerate"
  | "Assault"
  | "Shield"
  | "Tank"
  | "Deflect"
  | "Ganking"
  | "Legion"
  | "Vision"
  | "Temporary"
  | "Deathknell"
  | "Add"
  | "Empower"
  | "Empowered"
  | "Ambush"
  | "Weaponmaster"
  | "Deploy"
  | "Repeat"
  | "Buff"
  | "Level"
  | "Flow"
  | "Mighty"
  | "Disarm"
  | "Hunt"
  | "Predict"
  | "Burn"
  | "Quick-Draw"
  | "Show Off"
  | "Equip"
  | (string & {});

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
  | { op: "grant_keyword"; keyword: KeywordName; target: Selector; duration?: EffectDuration }
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
  | { kind: "keyword"; keyword: KeywordName; target: Selector }
  | { kind: "cost"; amount: Amount; target: Selector; cardType?: string }
  | { kind: "restriction"; restriction: string; target: Selector }
  | { kind: "custom"; id: string; params?: Record<string, unknown> };
