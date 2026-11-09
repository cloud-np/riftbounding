/**
 * Declarative scenario format (v2) — tournament positions and play-test regressions.
 *
 * A scenario is a typed TS object (`export default defineScenario({...})`, file name
 * `*.scenario.ts`); a plain `*.scenario.json` with the same shape is accepted too. It describes a
 * starting position, a readable sequence of player actions mapped onto real `rules_*` intents and
 * prompt answers, and checkpoints. `runner.ts` executes it against the real strict engine
 * (`@rift/rules` + the engine host) and reports the first divergence as a readable diff.
 *
 * Players are always "P1"/"P2" (P1 sits first: its battlefield is `battlefieldA`). Cards are
 * referenced by their printed name and resolved through the card catalog (with a did-you-mean
 * error on typos). See docs/rules/scenarios.md for the full reference.
 */
import type {
  AutoPassPrefsUpdate,
  ChoiceValue,
  ObjectRulesState,
  PaymentPlanWire,
  PromptAnswer,
  RulesIntent,
} from "@rift/protocol";

export type PlayerKey = "P1" | "P2";
export const PLAYER_KEYS: readonly PlayerKey[] = ["P1", "P2"];

export type Domain = "Fury" | "Calm" | "Mind" | "Body" | "Chaos" | "Order";

/**
 * A card reference used in steps and checkpoints: a `label` given in the position (or bound by a
 * step's `as`), or a printed card name, optionally narrowed with `@<location>` (`base`, `hand`,
 * `trash`, a battlefield name or zone id), e.g. `"Pouty Poro@Targon's Peak"`.
 */
export type CardRef = string;

/** `"base"`, a battlefield's printed name, or a zone id (`battlefieldA`/`battlefieldB`). */
export type LocationRef = string;

/* ------------------------------------------------------------------ metadata */

export type Verification =
  /** The sequence is taken from a public source (VOD / written play-by-play) that is cited. */
  | "sourced"
  /** Rebuilt from a partial public source (e.g. a recap); gaps are filled and said so in notes. */
  | "reconstructed"
  /** Not a real game: built from real decklists / common competitive lines to exercise rules. */
  | "illustrative";

export interface ScenarioSource {
  /** What the link is (event coverage, decklist page, VOD, recap …). */
  label: string;
  url?: string;
  /** VOD timestamp, e.g. "1:23:45". */
  timestamp?: string;
}

export interface ScenarioMeta {
  title: string;
  event?: string;
  round?: string;
  /** ISO date of the event or the match. */
  date?: string;
  sources?: ScenarioSource[];
  verification: Verification;
  notes?: string;
  /** Rule ids the scenario exercises, e.g. ["467.2.c", "473.1.b"] (informational). */
  rules?: string[];
  tags?: string[];
}

/* ------------------------------------------------------------------ position */

/** Shared per-object state for units and gear on the board. */
export interface ObjectStateSpec {
  exhausted?: boolean;
  /** 418: damage marked on the unit. */
  damage?: number;
  /** 427: buff counters. */
  buffs?: number;
  /** 424: stunned until the end of turn. */
  stunned?: boolean;
  /** Escape hatch: raw `rules.objects[id]` fields merged after the ones above. */
  state?: Partial<ObjectRulesState>;
}

export interface CardSpec extends ObjectStateSpec {
  name: string;
  /** Unique handle for steps/checkpoints when the same card name appears more than once. */
  label?: string;
  /** A token (Sand Soldier, Recruit, Mech, …) created with the engine's token factory. */
  token?: boolean;
}

export interface UnitSpec extends CardSpec {
  /** Gear attached to this unit (435). */
  gear?: Array<string | CardSpec>;
}

export type UnitEntry = string | UnitSpec;
export type CardEntry = string | CardSpec;

/** Rune Area contents: card names, or counts per domain (`{ Fury: 3, Chaos: 2 }`). */
export type RuneList = string[] | Partial<Record<Domain, number>>;

export interface RuneAreaSpec {
  ready?: RuneList;
  exhausted?: RuneList;
}

export interface PoolSpec {
  energy?: number;
  power?: Partial<Record<Domain | "any", number>>;
}

export interface PlayerPositionSpec {
  /** Display name for traces. Use only a name that appears in the public source. */
  name?: string;
  legend: string | { name: string; exhausted?: boolean; label?: string };
  /** A Chosen Champion still in the Champion Zone (not yet played). */
  champion?: string;
  points?: number;
  hand?: string[];
  base?: UnitEntry[];
  trash?: string[];
  banished?: string[];
  /** Main Deck from the top (index 0 is drawn first). Filler cards follow (see `deckFiller`). */
  deck?: string[];
  /** Vanilla cards placed under `deck` so draws never burn out. Default 20 × "Mega-Mech". */
  deckFiller?: { card?: string; count?: number };
  runes?: RuneAreaSpec;
  /** Rune Deck from the top. Default: 6 runes of the legend's domains. */
  runeDeck?: RuneList;
  pool?: PoolSpec;
  /** 472: battlefields this player already scored this turn (matters for 473.1.b). */
  scoredThisTurn?: LocationRef[];
  /**
   * Auto-pass preferences (docs/rules/auto-pass.md). Default: none, so every Pass / End turn is
   * an explicit step. The repro converter copies each seat's recorded preferences, otherwise the
   * replay diverges wherever the original game passed automatically.
   */
  autoPass?: AutoPassPrefsUpdate;
}

export interface BattlefieldSpec {
  /** The battlefield card's printed name. Entry 0 is P1's (battlefieldA), entry 1 P2's. */
  name: string;
  /** 190.2: stored control; `null` = Uncontrolled. Omit to use the 190.4.a presence proxy. */
  controller?: PlayerKey | null;
  units?: Partial<Record<PlayerKey, UnitEntry[]>>;
  /** 107.3 / 811: a facedown (Hidden) card in this battlefield's Facedown Zone. */
  facedown?: { owner: PlayerKey; card: string; label?: string; hiddenOnTurn?: number };
}

export interface PositionSpec {
  /**
   * Engine turn counter (each player's turn counts as one, P1's first turn is 1) and Turn
   * Player. The position always starts in the Main Phase in a Neutral Open state.
   */
  turn: { player: PlayerKey; number?: number };
  /** Who goes first in turn order (default P1). */
  firstPlayer?: PlayerKey;
  /** Who holds Priority at the start (default: the Turn Player). */
  priority?: PlayerKey;
  battlefields: [BattlefieldSpec, BattlefieldSpec];
  players: Record<PlayerKey, PlayerPositionSpec>;
  /** Deterministic RNG seed for shuffles/ids (default 1). */
  seed?: number;
}

/* ------------------------------------------------------------------ steps */

/** Raw choice values: strings are resolved as card refs, battlefield refs or player keys. */
export type ChoiceInput = ChoiceValue | CardRef;

export interface PaySpec {
  /** Exhaust ready runes for [1] each, by domain count or rune name list. */
  exhaust?: RuneList;
  /** Recycle runes for one Power of their domain each. */
  recycle?: RuneList;
  poolEnergy?: number;
  poolPower?: Partial<Record<Domain | "any", number>>;
  /** Non-standard cost objects (357.2). */
  exhaustObjects?: CardRef[];
  discard?: CardRef[];
  kill?: CardRef[];
}

interface StepBase {
  /** Free text shown in the trace (what happened at the table). */
  note?: string;
  /** Checkpoint evaluated after this step. */
  expect?: Checkpoint;
  /**
   * The engine must reject this step (an illegal action). `code`/`rule` narrow it, e.g.
   * `{ code: "closed_state_requires_reaction", rule: "309.1.a" }`. The room is unchanged.
   */
  reject?: true | { code?: string; rule?: string };
}

interface ChoiceFields {
  /** Targets in choice order (`target:<i>`); an inner array fills one multi-target choice. */
  targets?: Array<CardRef | CardRef[]>;
  /** 355.3 mode id(s). */
  mode?: string | string[];
  x?: number;
  /** Raw choice record (key → value); string values are resolved like refs. */
  choices?: Record<string, ChoiceInput>;
  /**
   * 355.1.a optional additional costs to pay (e.g. ["accelerate"]); default none. `"ask"` omits
   * the field so the engine prompts for each affordable optional cost (answer with `choose`).
   */
  optionalCosts?: string[] | "ask";
  /** 357 explicit payment; default: the engine's automatic plan. */
  pay?: PaySpec;
  /** Raw payment plan passthrough (ids). */
  plan?: PaymentPlanWire;
  /** 337.4: keep Priority after playing. */
  hold?: boolean;
}

export interface PlayStep extends StepBase, ChoiceFields {
  by: PlayerKey;
  /** Card in hand / Champion Zone / facedown / any zone the engine permits. */
  play: CardRef;
  /** Units/gear: `base` or a battlefield. */
  location?: LocationRef;
  /** Bind a label to the played card for later steps (useful with duplicates). */
  as?: string;
}

export interface HideStep extends StepBase {
  by: PlayerKey;
  /** 811.1.b: hide this card facedown at `at`. */
  hide: CardRef;
  at: LocationRef;
  pay?: PaySpec;
}

export interface ActivateStep extends StepBase, ChoiceFields {
  by: PlayerKey;
  /** A board object (unit, gear, legend, rune, battlefield) with an activated ability. */
  activate: CardRef;
  /** Ability ref (default: the only legal one, else "activated:0"). */
  ability?: string;
}

export interface MoveStep extends StepBase {
  by: PlayerKey;
  move: CardRef | CardRef[];
  to: LocationRef;
}

export interface PassStep extends StepBase {
  by: PlayerKey;
  pass: true;
}

export interface EndTurnStep extends StepBase {
  by: PlayerKey;
  endTurn: true;
}

/**
 * Answer the pending prompt. A string/array names options by card ref, battlefield, player key,
 * option label or option id; `true`/`false` (or "yes"/"no") answer a yes-no prompt; a number
 * answers a choose-number prompt.
 */
export interface ChooseStep extends StepBase {
  by: PlayerKey;
  choose: string | string[] | boolean | number;
}

/** 467.2.c / 355.14: assign damage per unit (`{ "Garen": 4, "Pouty Poro": 2 }`). */
export interface AssignStep extends StepBase {
  by: PlayerKey;
  assign: Record<CardRef, number>;
}

/** 383.3.d: order simultaneous triggers / options (refs, labels or option ids, first first). */
export interface OrderStep extends StepBase {
  by: PlayerKey;
  order: string[];
}

export interface ManualDoneStep extends StepBase {
  by: PlayerKey;
  manualDone: true;
}

export interface ConcedeStep extends StepBase {
  by: PlayerKey;
  concede: true;
}

/** Escape hatch: send this exact intent (ids are taken literally). */
export interface IntentStep extends StepBase {
  by: PlayerKey;
  intent: RulesIntent;
}

/** Raw prompt answer escape hatch (`rules_choose` with this answer). */
export interface AnswerStep extends StepBase {
  by: PlayerKey;
  answer: PromptAnswer;
}

/**
 * Whoever holds Priority/Focus passes until the chain is empty and no showdown/combat is open,
 * a prompt is pending, the game is over, or `max` passes were made (default 12).
 */
export interface SettleStep extends StepBase {
  settle: true;
  max?: number;
}

/** A checkpoint on its own (no action). */
export interface CheckStep {
  check: Checkpoint;
  note?: string;
}

export type ScenarioStep =
  | PlayStep
  | HideStep
  | ActivateStep
  | MoveStep
  | PassStep
  | EndTurnStep
  | ChooseStep
  | AssignStep
  | OrderStep
  | ManualDoneStep
  | ConcedeStep
  | IntentStep
  | AnswerStep
  | SettleStep
  | CheckStep;

/* ------------------------------------------------------------------ checkpoints */

export type TurnStateName = "neutral_open" | "neutral_closed" | "showdown_open" | "showdown_closed";

export interface UnitExpectation {
  /** `base`, a battlefield, `hand`, `trash`, `banished`, `deck`, `chain`, or "board" (any board zone). */
  at?: LocationRef | "hand" | "trash" | "banished" | "deck" | "chain" | "board";
  /** Effective Might (layers applied). */
  might?: number;
  damage?: number;
  exhausted?: boolean;
  buffs?: number;
  stunned?: boolean;
  /** Effective keywords that must be present. */
  keywords?: string[];
  /** Controller (who has it on their board). */
  controller?: PlayerKey;
  /** Names of gear attached to it. */
  gear?: string[];
}

/** Exact multiset of names, or include/exclude constraints. */
export type NameListExpectation =
  string[] | { includes?: string[]; excludes?: string[]; count?: number };

export interface PlayerZonesExpectation {
  hand?: NameListExpectation;
  base?: NameListExpectation;
  trash?: NameListExpectation;
  banished?: NameListExpectation;
  /** Cards left in the Main Deck. */
  deckCount?: number;
  /** Rune Area counts. */
  runes?: { ready?: number; exhausted?: number; total?: number };
  pool?: { energy?: number; power?: Partial<Record<Domain | "any", number>> };
  legendExhausted?: boolean;
}

export interface Checkpoint {
  points?: Partial<Record<PlayerKey, number>>;
  /** Units/gear that must be on the board. */
  alive?: CardRef[];
  /** Units/gear that must have left the board for their owner's trash. */
  dead?: CardRef[];
  units?: Record<CardRef, UnitExpectation>;
  /** Battlefield control (190.2), `null` = Uncontrolled. */
  control?: Record<LocationRef, PlayerKey | null>;
  /** Chain contents by card/ability source name, bottom (oldest) first. `[]` = empty. */
  chain?: string[];
  priority?: PlayerKey | null;
  focus?: PlayerKey | null;
  state?: TurnStateName;
  turnPlayer?: PlayerKey;
  phase?: string;
  /** Pending prompt (`null` = none). */
  prompt?: null | { kind?: string; for?: PlayerKey; reason?: string };
  showdown?: null | { at?: LocationRef };
  combat?: null | { at?: LocationRef; attacker?: PlayerKey; defender?: PlayerKey };
  zones?: Partial<Record<PlayerKey, PlayerZonesExpectation>>;
  /** Winner (`null` = the game is not over). */
  winner?: PlayerKey | null;
  /** Event types the last engine call(s) of this step must have emitted. */
  events?: string[];
  /** Event types they must not have emitted. */
  noEvents?: string[];
}

/* ------------------------------------------------------------------ scenario */

export interface ExpectedFailure {
  /** Starts with "[BUG]" for a real engine divergence; quote the rule text. */
  reason: string;
  /** The quoted rule text the engine contradicts. */
  rule?: string;
  /** 1-based step index where the divergence must show up (optional, makes the xfail precise). */
  atStep?: number;
}

export interface ScenarioSpec extends ScenarioMeta {
  /** Format version (2; v1 is the fluent DSL in `dsl.ts`). */
  format?: 2;
  position: PositionSpec;
  steps: ScenarioStep[];
  /**
   * The engine provably diverges from the rules here: the runner expects the scenario to fail
   * (and reports it as XFAIL), and fails loudly once it unexpectedly passes.
   */
  expectFailure?: string | ExpectedFailure;
}

/** Identity helper that gives scenario files full type checking. */
export function defineScenario(spec: ScenarioSpec): ScenarioSpec {
  return spec;
}
