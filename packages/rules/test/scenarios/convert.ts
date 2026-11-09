/**
 * Strict repro → scenario skeleton.
 *
 * Replays an exported `rift-strict-repro` file (docs/rules/rewind.md) to action `at` with the
 * engine's own `replayStrictRepro`, reads that room back into a declarative `PositionSpec`, then
 * replays the following actions one by one through `applyGameAction`, turning each into a readable
 * step (board gestures are translated with the engine's `translateGesture`, exactly as the server
 * does). The last step gets a checkpoint with the state observed after the export: edit it to the
 * behaviour the rules require, and mark a real engine divergence with `expectFailure`.
 */
import type {
  BattlefieldZone,
  CardInstance,
  ChoiceRecord,
  ChoiceValue,
  ObjectRulesState,
  PaymentPlanWire,
  PlayerBoard,
  Prompt,
  PromptAnswer,
  Room,
  RulesIntent,
  StrictReproFile,
} from "@rift/protocol";
import {
  applyGameAction,
  createStrictRandom,
  replayStrictRepro,
  translateGesture,
} from "../../../engine/src/index";
import { createEngineRulesHost } from "../../../engine/src/strict/host";
import { battlefieldController, turnState } from "../../src";
import type {
  BattlefieldSpec,
  Checkpoint,
  Domain,
  PaySpec,
  PlayerKey,
  PlayerPositionSpec,
  PositionSpec,
  ScenarioSpec,
  ScenarioStep,
  UnitSpec,
} from "./format";
import { deterministicContext } from "./context";

export interface ConvertOptions {
  /** 0-based index of the first action to turn into a step (the position is the room before it). */
  at: number;
  /** How many actions to convert (default: all remaining, at most 40). */
  count?: number;
  title?: string;
  sourceFile?: string;
}

export interface ConvertedScenario {
  spec: ScenarioSpec;
  warnings: string[];
}

const BATTLEFIELD_ZONES: readonly BattlefieldZone[] = ["battlefieldA", "battlefieldB"];
const DOMAINS: readonly Domain[] = ["Fury", "Calm", "Mind", "Body", "Chaos", "Order"];
const SKIPPED_STATE_KEYS = new Set<keyof ObjectRulesState | string>([
  "baseMight",
  "damage",
  "buffs",
  "stunned",
  "hiddenTurn",
  "hiddenBy",
  "designation",
  "assignedDamage",
  "assignedBy",
  "controller",
]);

/* ------------------------------------------------------------------ naming */

class Namer {
  /** card id → label (only for names that are not unique on the boards). */
  readonly labels = new Map<string, string>();
  readonly keys: Record<string, PlayerKey> = {};
  constructor(readonly room: Room) {
    room.players.slice(0, 2).forEach((player, index) => {
      this.keys[player.id] = index === 0 ? "P1" : "P2";
    });
    const boardCards: CardInstance[] = [];
    for (const player of room.players) {
      const board = player.board;
      if (!board) continue;
      for (const zone of ["base", ...BATTLEFIELD_ZONES] as const)
        boardCards.push(...(board[zone] ?? []));
    }
    const counts = new Map<string, number>();
    for (const card of boardCards) counts.set(card.name, (counts.get(card.name) ?? 0) + 1);
    const seen = new Map<string, number>();
    for (const card of boardCards) {
      if ((counts.get(card.name) ?? 0) < 2) continue;
      const n = (seen.get(card.name) ?? 0) + 1;
      seen.set(card.name, n);
      this.labels.set(card.id, `${card.name} (${n})`);
    }
  }

  key(playerId: string | null | undefined): PlayerKey | null {
    return playerId ? (this.keys[playerId] ?? null) : null;
  }

  /** The battlefield's printed name, or its zone id when both seats chose the same one. */
  battlefieldName(room: Room, zone: string): string {
    const index = BATTLEFIELD_ZONES.indexOf(zone as BattlefieldZone);
    const contributors = room.players.filter((player) => !!player.selectedBattlefield);
    const name = index >= 0 ? contributors[index]?.selectedBattlefield : undefined;
    if (!name) return zone;
    const duplicate =
      contributors.filter((player) => player.selectedBattlefield === name).length > 1;
    return duplicate ? zone : name;
  }

  /** A readable ref for an id in `room`: label, card name, battlefield name or player key. */
  ref(room: Room, id: string): string {
    const label = this.labels.get(id);
    if (label) return label;
    if (id.startsWith("battlefield")) return this.battlefieldName(room, id);
    const key = this.key(id);
    if (key) return key;
    for (const player of room.players) {
      const board = player.board as unknown as
        Record<string, CardInstance[] | undefined> | undefined;
      if (!board) continue;
      for (const [zone, list] of Object.entries(board)) {
        if (!Array.isArray(list)) continue;
        const card = list.find((entry) => entry && typeof entry === "object" && entry.id === id);
        // Runes are interchangeable except for their exhausted state: qualify it.
        if (card)
          return zone === "runeArea"
            ? `${card.name}@${card.exhausted ? "exhausted" : "ready"}`
            : card.name;
      }
    }
    const item = room.rules?.chain.find((entry) => entry.cardSnapshot?.id === id);
    if (item?.cardSnapshot) return item.cardSnapshot.name;
    return id;
  }

  location(room: Room, zone: string): string {
    return zone.startsWith("battlefield") ? this.battlefieldName(room, zone) : zone;
  }
}

/* ------------------------------------------------------------------ position */

function runeRecord(cards: readonly CardInstance[]): Partial<Record<Domain, number>> | string[] {
  const record: Partial<Record<Domain, number>> = {};
  for (const card of cards) {
    const domain = card.name.replace(/ Rune$/, "") as Domain;
    if (!DOMAINS.includes(domain)) return cards.map((entry) => entry.name);
    record[domain] = (record[domain] ?? 0) + 1;
  }
  return record;
}

function objectSpec(room: Room, namer: Namer, card: CardInstance): UnitSpec {
  const object = room.rules?.objects[card.id] ?? {};
  const spec: UnitSpec = { name: card.name };
  const label = namer.labels.get(card.id);
  if (label) spec.label = label;
  if (card.source === "token") spec.token = true;
  if (card.exhausted) spec.exhausted = true;
  if (object.damage) spec.damage = object.damage;
  if (object.buffs) spec.buffs = object.buffs;
  if (object.stunned) spec.stunned = true;
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (SKIPPED_STATE_KEYS.has(key) || value === undefined || value === false) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    rest[key] = value;
  }
  if (Object.keys(rest).length > 0) spec.state = rest as Partial<ObjectRulesState>;
  return spec;
}

function unitsAt(room: Room, namer: Namer, board: PlayerBoard, zone: string): UnitSpec[] {
  const list = (
    (board as unknown as Record<string, CardInstance[] | undefined>)[zone] ?? []
  ).filter((card) => !card.hidden);
  const units: UnitSpec[] = [];
  const byId = new Map<string, UnitSpec>();
  for (const card of list) {
    if (card.attachedToCardId) continue;
    const spec = objectSpec(room, namer, card);
    byId.set(card.id, spec);
    units.push(spec);
  }
  for (const card of list) {
    if (!card.attachedToCardId) continue;
    const host = byId.get(card.attachedToCardId);
    const gear = objectSpec(room, namer, card);
    if (host) (host.gear ??= []).push(gear);
    else units.push(gear);
  }
  return units;
}

export function positionFromRoom(room: Room, namer: Namer, warnings: string[]): PositionSpec {
  const rules = room.rules;
  if (!rules) throw new Error("the room at this index has no strict rules state");
  if (room.players.length !== 2)
    throw new Error("only duels can be converted (the scenario format is P1/P2)");
  if (rules.chain.length > 0)
    warnings.push(
      `the chain is not empty at this index (${rules.chain.length} item(s)); it is not part of the position — pick an index with an empty chain`,
    );
  if (rules.prompt)
    warnings.push(
      `a ${rules.prompt.kind} prompt is pending at this index; prompts are not part of the position`,
    );
  if (rules.showdown || rules.combat)
    warnings.push("a showdown/combat is in progress at this index; it is not part of the position");
  if (rules.manual) warnings.push("a manual-resolution window is open at this index");
  if (rules.turn.phase !== "main")
    warnings.push(
      `the turn is in the ${rules.turn.phase} phase; positions always start in the Main Phase`,
    );
  if (rules.effects.length > 0)
    warnings.push(
      `${rules.effects.length} continuous effect(s) (e.g. "this turn" Might changes) are not carried over`,
    );
  if (rules.triggers.length > 0 || rules.tasks.length > 0)
    warnings.push("pending triggers/tasks at this index are not carried over");

  const contributors = room.players.filter((player) => !!player.selectedBattlefield);
  const battlefields = BATTLEFIELD_ZONES.map((zone, index): BattlefieldSpec => {
    const name = contributors[index]?.selectedBattlefield;
    if (!name) throw new Error(`no battlefield is selected for seat ${index + 1}`);
    const spec: BattlefieldSpec = { name };
    const controller = rules.objects[zone]?.controller;
    if (controller !== undefined)
      spec.controller = controller === null ? null : namer.key(controller);
    for (const player of room.players) {
      const key = namer.key(player.id);
      const board = player.board;
      if (!key || !board) continue;
      const units = unitsAt(room, namer, board, zone);
      if (units.length > 0) (spec.units ??= {})[key] = units;
      const hidden = (board[zone] ?? []).find((card) => card.hidden);
      if (hidden) {
        const object = rules.objects[hidden.id];
        spec.facedown = {
          owner: key,
          card: hidden.name,
          ...(typeof object?.hiddenTurn === "number" ? { hiddenOnTurn: object.hiddenTurn } : {}),
        };
      }
    }
    return spec;
  }) as [BattlefieldSpec, BattlefieldSpec];

  const players = {} as Record<PlayerKey, PlayerPositionSpec>;
  for (const player of room.players) {
    const key = namer.key(player.id)!;
    const board = player.board;
    if (!board) throw new Error(`${key} has no board`);
    const legend = board.legend[0];
    if (!legend) throw new Error(`${key} has no legend`);
    const ready = board.runeArea.filter((card) => !card.exhausted);
    const exhausted = board.runeArea.filter((card) => card.exhausted);
    const pool = rules.pools[player.id];
    const spec: PlayerPositionSpec = {
      legend: legend.exhausted ? { name: legend.name, exhausted: true } : legend.name,
      ...(board.champion[0] ? { champion: board.champion[0].name } : {}),
      points: board.score,
      hand: board.hand.map((card) => card.name),
      base: unitsAt(room, namer, board, "base"),
      trash: board.trash.map((card) => card.name),
      banished: board.banished.map((card) => card.name),
      deck: [...board.deck].reverse().map((card) => card.name),
      deckFiller: { count: 0 },
      runes: {
        ...(ready.length > 0 ? { ready: runeRecord(ready) } : {}),
        ...(exhausted.length > 0 ? { exhausted: runeRecord(exhausted) } : {}),
      },
      runeDeck: [...board.runeDeck].reverse().map((card) => card.name),
    };
    if (pool && (pool.energy > 0 || Object.values(pool.power).some((value) => (value ?? 0) > 0))) {
      spec.pool = {
        energy: pool.energy,
        power: { ...pool.power } as NonNullable<PlayerPositionSpec["pool"]>["power"],
      };
    }
    const scored = rules.scoredThisTurn[player.id] ?? [];
    if (scored.length > 0)
      spec.scoredThisTurn = scored.map((zone) => namer.battlefieldName(room, zone));
    players[key] = spec;
  }

  const turnKey = namer.key(rules.turn.player) ?? "P1";
  const position: PositionSpec = {
    turn: { player: turnKey, number: rules.turn.number },
    ...(room.firstPlayerId && namer.key(room.firstPlayerId) !== "P1"
      ? { firstPlayer: namer.key(room.firstPlayerId)! }
      : {}),
    ...(rules.priority && namer.key(rules.priority) !== turnKey
      ? { priority: namer.key(rules.priority)! }
      : {}),
    battlefields,
    players,
  };
  return position;
}

/* ------------------------------------------------------------------ steps */

function choicesToReadable(
  room: Room,
  namer: Namer,
  choices: ChoiceRecord,
): Record<string, ChoiceValue> {
  const map = (value: ChoiceValue): ChoiceValue => {
    if (Array.isArray(value)) return (value as ChoiceValue[]).map(map) as ChoiceValue;
    if (typeof value === "string") {
      const ref = namer.ref(room, value);
      return ref;
    }
    return value;
  };
  const out: Record<string, ChoiceValue> = {};
  for (const [key, value] of Object.entries(choices)) {
    if (key.startsWith("cost:")) continue;
    out[key] = map(value);
  }
  return out;
}

function payFromPlan(room: Room, namer: Namer, plan: PaymentPlanWire): PaySpec {
  const runeNames = (ids: readonly string[]) => ids.map((id) => namer.ref(room, id));
  return {
    ...(plan.exhaustRunes ? { exhaust: runeNames(plan.exhaustRunes) } : {}),
    ...(plan.recycleRunes ? { recycle: runeNames(plan.recycleRunes) } : {}),
    ...(plan.poolEnergy !== undefined ? { poolEnergy: plan.poolEnergy } : {}),
    ...(plan.poolPower ? { poolPower: { ...plan.poolPower } as PaySpec["poolPower"] } : {}),
    ...(plan.exhaust ? { exhaustObjects: plan.exhaust.map((id) => namer.ref(room, id)) } : {}),
    ...(plan.discard ? { discard: plan.discard.map((id) => namer.ref(room, id)) } : {}),
    ...(plan.kill ? { kill: plan.kill.map((id) => namer.ref(room, id)) } : {}),
  };
}

function answerToStep(
  room: Room,
  namer: Namer,
  by: PlayerKey,
  prompt: Prompt | null,
  answer: PromptAnswer,
): ScenarioStep {
  if (answer.assignments) {
    return {
      by,
      assign: Object.fromEntries(
        answer.assignments.map((entry) => [namer.ref(room, entry.targetId), entry.amount]),
      ),
    };
  }
  const describe = (optionId: string): string | boolean => {
    const option = prompt?.options?.find((entry) => entry.id === optionId);
    if (prompt?.kind === "yes-no" && (optionId === "yes" || optionId === "no"))
      return optionId === "yes";
    const objectId = option?.cardId ?? option?.objectId;
    if (objectId) return namer.ref(room, objectId);
    if (option?.zone) return namer.location(room, option.zone);
    if (option?.playerId) return namer.key(option.playerId) ?? optionId;
    const ref = namer.ref(room, optionId);
    return ref !== optionId ? ref : optionId;
  };
  const ordered = (answer as { orderedIds?: string[] }).orderedIds;
  if (ordered) return { by, order: ordered.map((id) => String(describe(id))) };
  if (answer.optionIds) {
    const values = answer.optionIds.map(describe);
    if (values.length === 1 && typeof values[0] === "boolean") return { by, choose: values[0] };
    return { by, choose: values.length === 1 ? String(values[0]) : values.map(String) };
  }
  if (answer.playerId) return { by, choose: namer.key(answer.playerId) ?? answer.playerId };
  if (typeof answer.number === "number") return { by, choose: answer.number };
  if (typeof answer.boolean === "boolean") return { by, choose: answer.boolean };
  return { by, answer };
}

function intentToStep(
  before: Room,
  after: Room,
  namer: Namer,
  by: PlayerKey,
  intent: RulesIntent,
): ScenarioStep {
  switch (intent.type) {
    case "rules_play": {
      if (intent.hide) {
        return {
          by,
          hide: namer.ref(before, intent.cardId),
          at: namer.location(before, String(intent.location ?? "")),
        };
      }
      const choices = intent.choices ? choicesToReadable(before, namer, intent.choices) : {};
      (intent.targets ?? []).forEach((target, index) => {
        const key = `target:${index}`;
        if (choices[key] === undefined) choices[key] = namer.ref(before, target);
      });
      if (intent.x !== undefined && choices.x === undefined) choices.x = intent.x;
      // 355.1.a: the original intent left optional costs open, and the engine asked about them.
      const asked =
        intent.optionalCosts === undefined &&
        after.rules?.chain.some((item) => item.process?.stage === "optional");
      const step: ScenarioStep = {
        by,
        play: namer.ref(before, intent.cardId),
        ...(intent.location ? { location: namer.location(before, String(intent.location)) } : {}),
        ...(Object.keys(choices).length > 0 ? { choices } : {}),
        ...(intent.modes?.length
          ? { mode: intent.modes.length === 1 ? intent.modes[0]! : intent.modes }
          : {}),
        ...(intent.optionalCosts?.length
          ? { optionalCosts: intent.optionalCosts }
          : asked
            ? { optionalCosts: "ask" as const }
            : {}),
        ...(intent.plan ? { pay: payFromPlan(before, namer, intent.plan) } : {}),
        ...(intent.hold ? { hold: true } : {}),
      };
      return step;
    }
    case "rules_activate": {
      const choices = intent.choices ? choicesToReadable(before, namer, intent.choices) : {};
      (intent.targets ?? []).forEach((target, index) => {
        const key = `target:${index}`;
        if (choices[key] === undefined) choices[key] = namer.ref(before, target);
      });
      const asked =
        intent.optionalCosts === undefined &&
        after.rules?.chain.some((item) => item.process?.stage === "optional");
      return {
        by,
        activate: namer.ref(before, intent.objectId),
        ability: intent.ability,
        ...(Object.keys(choices).length > 0 ? { choices } : {}),
        ...(intent.optionalCosts?.length
          ? { optionalCosts: intent.optionalCosts }
          : asked
            ? { optionalCosts: "ask" as const }
            : {}),
        ...(intent.plan ? { pay: payFromPlan(before, namer, intent.plan) } : {}),
        ...(intent.hold ? { hold: true } : {}),
      };
    }
    case "rules_move":
      return {
        by,
        move: intent.unitIds.map((id) => namer.ref(before, id)),
        to: namer.location(before, String(intent.to)),
      };
    case "rules_pass":
      return { by, pass: true };
    case "rules_end_turn":
      return { by, endTurn: true };
    case "rules_manual_done":
      return { by, manualDone: true };
    case "rules_concede":
      return { by, concede: true };
    case "rules_choose":
      return answerToStep(before, namer, by, before.rules?.prompt ?? null, intent.answer);
  }
}

/** The observed state after the converted steps, as a checkpoint to edit. */
function observedCheckpoint(room: Room, namer: Namer): Checkpoint {
  const rules = room.rules;
  const host = createEngineRulesHost(deterministicContext(1));
  const points: Partial<Record<PlayerKey, number>> = {};
  const alive: string[] = [];
  for (const player of room.players) {
    const key = namer.key(player.id);
    if (!key || !player.board) continue;
    points[key] = player.board.score;
    for (const zone of ["base", ...BATTLEFIELD_ZONES] as const) {
      for (const card of player.board[zone] ?? []) {
        if (!card.hidden && card.source !== "token")
          alive.push(namer.labels.get(card.id) ?? card.name);
      }
    }
  }
  const control: Record<string, PlayerKey | null> = {};
  for (const zone of BATTLEFIELD_ZONES)
    control[namer.battlefieldName(room, zone)] = namer.key(battlefieldController(room, zone, host));
  return {
    points,
    control,
    ...(alive.length > 0 ? { alive: [...new Set(alive)] } : {}),
    chain: (rules?.chain ?? []).map(
      (item) => item.cardName ?? item.cardSnapshot?.name ?? item.kind,
    ),
    priority: namer.key(rules?.priority),
    state: turnState(room),
    winner: room.gameOutcome?.winnerPlayerIds[0]
      ? namer.key(room.gameOutcome.winnerPlayerIds[0])
      : null,
  };
}

/* ------------------------------------------------------------------ clean indices */

export interface ReproIndexInfo {
  index: number;
  /** Turn number and Turn Player key before the action. */
  turn: number;
  player: PlayerKey | null;
  /** Main Phase, Neutral Open, no prompt/manual window: a position can start here. */
  clean: boolean;
  action: string;
  actor: PlayerKey | null;
}

/** Replay a repro once and describe the room before every action (for picking `--at`). */
export function reproIndices(file: StrictReproFile): ReproIndexInfo[] {
  const replay = replayStrictRepro(file, 0);
  if (!replay.ok) throw new Error(`the repro does not replay: ${replay.failure.message}`);
  let room = replay.room;
  const namer = new Namer(room);
  const out: ReproIndexInfo[] = [];
  const mode = (file.roomMode ?? room.roomMode ?? "multiplayer") as "multiplayer";
  for (const entry of file.actions) {
    const rules = room.rules;
    out.push({
      index: entry.index,
      turn: rules?.turn.number ?? 0,
      player: namer.key(rules?.turn.player),
      clean:
        !!rules &&
        room.phase === "in_game" &&
        !room.gameOutcome &&
        rules.turn.phase === "main" &&
        turnState(room) === "neutral_open" &&
        !rules.prompt &&
        !rules.manual,
      action: entry.action.type,
      actor: namer.key(entry.actorId),
    });
    const result = applyGameAction(room, entry.actorId, entry.action, {
      now: entry.at,
      rng: createStrictRandom(room.rngSeed ?? 0, room.rngCursor ?? 0).rng,
      mode,
    });
    if (!result.ok) break;
    room = result.state;
  }
  return out;
}

/* ------------------------------------------------------------------ convert */

export function convertRepro(file: StrictReproFile, options: ConvertOptions): ConvertedScenario {
  const warnings: string[] = [];
  if (!file || file.format !== "rift-strict-repro") throw new Error("not a rift-strict-repro file");
  const total = file.actions.length;
  const at = Math.trunc(options.at);
  if (!Number.isFinite(at) || at < 0 || at >= total)
    throw new Error(`--at must be between 0 and ${total - 1} (the repro has ${total} action(s))`);
  const prefix = replayStrictRepro(file, at);
  if (!prefix.ok)
    throw new Error(
      `the repro does not replay up to action ${at}: ${prefix.failure.reason}: ${prefix.failure.message}`,
    );
  let room = prefix.room;
  if (room.rulesMode !== "strict" || room.phase !== "in_game" || !room.rules) {
    throw new Error(`the room before action ${at} is not a live strict game (phase ${room.phase})`);
  }
  const namer = new Namer(room);
  const position = positionFromRoom(room, namer, warnings);

  const steps: ScenarioStep[] = [];
  const count = Math.max(1, Math.min(options.count ?? 40, total - at));
  const mode = (file.roomMode ?? room.roomMode ?? "multiplayer") as "multiplayer";
  let skipped = 0;
  for (let index = at; index < at + count; index += 1) {
    const entry = file.actions[index]!;
    const by = namer.key(entry.actorId);
    if (!by) {
      warnings.push(`action ${index}: unknown actor ${entry.actorId}; stopped`);
      break;
    }
    let intent: RulesIntent | null = null;
    if (entry.action.type.startsWith("rules_")) {
      intent = entry.action as unknown as RulesIntent;
    } else {
      const translated = translateGesture(
        room,
        entry.actorId,
        entry.action,
        createEngineRulesHost(deterministicContext(1)),
      );
      if (translated.kind === "intent") intent = translated.intent;
      else if (translated.kind === "reject")
        warnings.push(
          `action ${index} (${entry.action.type}) was rejected on replay: ${translated.code}`,
        );
    }
    const result = applyGameAction(room, entry.actorId, entry.action, {
      now: entry.at,
      rng: createStrictRandom(room.rngSeed ?? 0, room.rngCursor ?? 0).rng,
      mode,
    });
    if (!result.ok) {
      warnings.push(
        `action ${index} (${entry.action.type} by ${by}) was rejected on replay (${result.error}); stopped`,
      );
      break;
    }
    if (intent) {
      const step = intentToStep(room, result.state, namer, by, intent);
      // A played card whose name is not unique gets a label for later steps.
      if ("play" in step && intent.type === "rules_play" && !namer.labels.has(intent.cardId)) {
        const sameName = [...namer.labels.values()].some((label) =>
          label.startsWith(`${step.play} (`),
        );
        if (sameName) {
          const n =
            [...namer.labels.values()].filter((label) => label.startsWith(`${step.play} (`))
              .length + 1;
          const label = `${step.play} (${n})`;
          namer.labels.set(intent.cardId, label);
          (step as { as?: string }).as = label;
        }
      }
      step.note = `repro action ${index}${entry.action.type.startsWith("rules_") ? "" : ` (gesture ${entry.action.type})`}`;
      steps.push(step);
    } else {
      skipped += 1;
    }
    room = result.state;
  }
  if (skipped > 0) warnings.push(`${skipped} cosmetic/non-rules action(s) were skipped`);
  steps.push({
    check: observedCheckpoint(room, namer),
    note: "observed after the last converted action — edit to the behaviour the rules require",
  });

  const spec: ScenarioSpec = {
    format: 2,
    title: options.title ?? `Repro ${file.roomCode} from action ${at}`,
    verification: "illustrative",
    sources: [
      {
        label: `strict repro ${options.sourceFile ?? file.roomCode}, actions ${at}–${at + count - 1}`,
      },
    ],
    notes: `Converted from an exported strict repro (room ${file.roomCode}, ${total} action(s)) at action ${at}. Not a tournament game. Edit the final checkpoint to the correct behaviour; if the engine is wrong, add expectFailure: "[BUG] ..." quoting the rule.`,
    position,
    steps,
  };
  return { spec, warnings };
}

/* ------------------------------------------------------------------ source */

/** Pretty TS source for a scenario (`export default defineScenario({...})`). */
export function scenarioSource(
  spec: ScenarioSpec,
  warnings: readonly string[] = [],
  formatImport = "../format",
): string {
  const body = JSON.stringify(spec, null, 2).replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, "$1$2:");
  const header = [
    "/**",
    ` * ${spec.title}`,
    " *",
    " * Generated by `pnpm --filter @rift/rules scenario convert`. Review every step, then edit the",
    " * final checkpoint to the behaviour the rules require (docs/rules/scenarios.md).",
    ...(warnings.length > 0
      ? [" *", " * Conversion warnings:", ...warnings.map((warning) => ` * - ${warning}`)]
      : []),
    " */",
  ];
  return `${header.join("\n")}\nimport { defineScenario } from "${formatImport}";\n\nexport default defineScenario(${body});\n`;
}
