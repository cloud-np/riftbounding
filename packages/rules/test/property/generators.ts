/**
 * Shared property-test generators/helpers.
 *
 * This file is a non-test helper (no `describe`/`it`) so each domain can add its own
 * `property/<domain>.test.ts` without touching a shared test file.
 */
import type { CardScript, PromptAnswer, Room, RulesIntent } from "@rift/protocol";
import {
  applyRulesIntent,
  clearCardScripts,
  explainIllegal,
  legalIntents,
  registerCardScripts,
  turnState,
  whoMayAct,
} from "../../src";
import { scenario, type RulesScenario } from "../scenarios/dsl";
import { answerFromRegistry } from "./answerers/registry";
import "./answerers/index";

/**
 * `Meditation` is deliberately left without a script so the property also drives the §6.4
 * manual window; `Treasure Hunter` has [triggered, activated] so the activation path is covered
 * (and its ref must stay `activated:1` everywhere).
 */
const NOOP_SPELLS = [
  ["Rebuke", "[ACTION] test"],
  ["Gust", "[REACTION] test"],
  ["Defy", "[REACTION] test"],
  ["En Garde", "[REACTION] test"],
] as const;

const ACTIVATED_UNIT: CardScript = {
  name: "Treasure Hunter",
  text: "Test script: triggered + activated.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "probe" } },
      effect: { op: "seq", effects: [] },
    },
    { kind: "activated", cost: {}, effect: { op: "seq", effects: [] } },
  ],
};

function noopScript(name: string, text: string): CardScript {
  return {
    name,
    text,
    status: "implemented",
    abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }],
  };
}

/** Register the synthetic scripts used by the timing property. */
export function registerPropertyScripts(): void {
  registerCardScripts([
    ...NOOP_SPELLS.map(([name, text]) => noopScript(name, text)),
    ACTIVATED_UNIT,
  ]);
}

/** Clear the card registry between suites. */
export function clearPropertyScripts(): void {
  clearCardScripts();
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildScenario(seed: number): RulesScenario {
  return scenario({
    seed,
    roomCode: `PROP-${seed}`,
    p1: {
      hand: ["Rebuke", "Gust", "Treasure Hunter", "Astral Heron", "Meditation"],
      energy: 9,
    },
    p2: {
      hand: ["Defy", "En Garde", "Caitlyn, Patrolling", "Clockwork Keeper"],
      energy: 9,
    },
  });
}

export function promptAnswerFor(s: RulesScenario, player: string): PromptAnswer | null {
  const prompt = legalIntents(s.room, player, s.host).prompt;
  if (!prompt) return null;
  const fromRegistry = answerFromRegistry(prompt, s.room);
  if (fromRegistry) return fromRegistry;
  const option = prompt.options?.[0];
  if (prompt.kind === "choose-opponent") {
    const playerId = option?.playerId ?? option?.id;
    return { ...(playerId ? { playerId } : {}) };
  }
  return {
    optionIds: option ? [option.id] : [],
    ...(option?.zone ? { zone: option.zone } : {}),
    ...(option?.playerId ? { playerId: option.playerId } : {}),
  };
}

export function candidateIntents(
  s: RulesScenario,
  random: () => number,
): { player: string; intent: RulesIntent }[] {
  const options: { player: string; intent: RulesIntent }[] = [];
  const who = whoMayAct(s.room);
  if (who.kind === "none") return options;
  const player = who.player;
  const legal = legalIntents(s.room, player, s.host);
  if (legal.prompt) {
    const answer = promptAnswerFor(s, player);
    if (answer)
      options.push({ player, intent: { type: "rules_choose", promptId: legal.prompt.id, answer } });
    return options;
  }
  if (legal.canManualDone) options.push({ player, intent: { type: "rules_manual_done" } });
  if (legal.canPass) options.push({ player, intent: { type: "rules_pass" } });
  if (legal.canEndTurn) options.push({ player, intent: { type: "rules_end_turn" } });
  for (const cardId of legal.playableCardIds) {
    options.push({
      player,
      intent: { type: "rules_play", cardId, ...(random() < 0.5 ? { hold: true } : {}) },
    });
  }
  for (const activatable of legal.activatable) {
    options.push({
      player,
      intent: {
        type: "rules_activate",
        objectId: activatable.objectId,
        ability: activatable.ability,
      },
    });
  }
  for (const move of legal.moves) {
    options.push({ player, intent: { type: "rules_move", unitIds: move.unitIds, to: move.to } });
  }
  return options;
}

/** Intents that are not taken from `legalIntents`, to compare the view and write verdict paths. */
export function sampledIntents(s: RulesScenario): { player: string; intent: RulesIntent }[] {
  const p1board = s.room.players.find((player) => player.id === "p1")?.board;
  const deckCard = p1board?.deck[0];
  const handCard = p1board?.hand[0];
  const out: { player: string; intent: RulesIntent }[] = [
    { player: "p2", intent: { type: "rules_end_turn" } },
    { player: "p1", intent: { type: "rules_move", to: "base" } as unknown as RulesIntent },
  ];
  if (deckCard) out.push({ player: "p1", intent: { type: "rules_play", cardId: deckCard.id } });
  if (handCard) {
    out.push({
      player: "p1",
      intent: { type: "rules_activate", objectId: handCard.id, ability: "activated:0" },
    });
    out.push({ player: "p1", intent: { type: "rules_move", unitIds: [handCard.id], to: "base" } });
  }
  return out;
}

export function assertInvariants(room: Room): string | null {
  const rules = room.rules;
  if (!rules) return "missing RulesState";
  const state = turnState(room);
  const who = whoMayAct(room);

  // 313.5: no Focus in a Neutral State.
  if (state.startsWith("neutral") && rules.focus !== null) return "focus in Neutral State (313.5)";
  // 321/411.2: the §6.4 window and a Limited-Action prompt are exclusive, and no Priority is
  // held while a Chain Item is resolving.
  if (rules.prompt && rules.manual) return "prompt and manual window both open";
  if (rules.manual && rules.priority !== null)
    return "priority held while manual window is open (321)";
  // 337.4/340.4: a closed chain always has a Priority holder (unless someone must answer).
  if (rules.chain.length > 0 && !rules.prompt && !rules.manual && !rules.priority) {
    return "closed chain without priority (337.4)";
  }
  // 335.1: a Showdown Open State belongs to the Focus holder, who also has Priority.
  if (state === "showdown_open" && !rules.prompt && !rules.manual) {
    if (!rules.focus) return "showdown open without focus (345)";
    if (rules.priority !== rules.focus) return "showdown open but priority != focus (335.1)";
  }
  // 312.2.a: Neutral Open Main belongs to the Turn Player.
  if (state === "neutral_open" && !rules.prompt && !rules.manual && rules.turn.phase === "main") {
    if (rules.priority !== rules.turn.player)
      return "neutral open Main priority != turn player (312.2.a)";
  }
  if (rules.priority && !room.players.some((player) => player.id === rules.priority)) {
    return "priority holder is not a seated player (312)";
  }
  // 312: at most one Priority holder — the stored field and the derived view must agree.
  const priorityActors = new Set<string>();
  if (rules.priority) priorityActors.add(rules.priority);
  if ((who.kind === "priority" || who.kind === "focus") && "player" in who && who.player) {
    priorityActors.add(who.player);
  }
  if (priorityActors.size > 1) return "more than one priority holder (312)";
  if (rules.focus && !room.players.some((player) => player.id === rules.focus)) {
    return "focus holder is not a seated player (313)";
  }
  if (!room.gameOutcome) {
    if (who.kind === "none" && rules.turn.phase !== "ending") return "deadlock: nobody may act";
  } else if (who.kind !== "none") {
    return "game over but someone may act";
  }
  const serialized = JSON.parse(JSON.stringify(room)) as Room;
  if (JSON.stringify(serialized) !== JSON.stringify(room))
    return "state is not JSON round-trippable";
  return null;
}

export function checkAgreement(s: RulesScenario, seed: number, stepIndex: number): string | null {
  const options = candidateIntents(s, mulberry32(seed + stepIndex * 7919));
  for (const option of options) {
    const explained = explainIllegal(s.room, option.player, option.intent, s.host);
    if (!explained.ok) {
      return `legalIntents listed ${option.intent.type} but explainIllegal rejected it: ${explained.code}`;
    }
  }
  for (const sample of sampledIntents(s)) {
    const clone = s.host.cloneRoom(s.room);
    const explained = explainIllegal(s.room, sample.player, sample.intent, s.host);
    const applied = applyRulesIntent(clone, sample.player, sample.intent, s.ctx, s.host);
    if (explained.ok !== applied.ok) {
      const code = !applied.ok ? `${applied.code} (${applied.rule})` : "ok";
      return `explainIllegal/applyRulesIntent disagree on ${sample.intent.type}: explain=${explained.ok} apply=${code}`;
    }
  }
  return null;
}

export function runSequence(seed: number, steps = 60): string | null {
  const random = mulberry32(seed);
  const s = buildScenario(seed);
  for (let index = 0; index < steps; index += 1) {
    if (s.room.gameOutcome) break;
    const options = candidateIntents(s, random);
    if (options.length === 0) {
      const who = whoMayAct(s.room);
      if (who.kind === "none") return `no legal intents at step ${index}`;
      return `no intent for ${who.kind} actor`;
    }

    const agreement = checkAgreement(s, seed, index);
    if (agreement) return `${agreement} at step ${index}`;

    // Prove that every intent the view lists is accepted by the write path (sampled steps keep
    // the property fast; the picked intent below is applied on every step).
    if (index % 9 === 0) {
      for (const option of options) {
        const clone = s.host.cloneRoom(s.room);
        const applied = applyRulesIntent(clone, option.player, option.intent, s.ctx, s.host);
        if (!applied.ok) {
          return `legalIntents listed ${option.intent.type} but apply rejected it: ${applied.code} (${applied.rule}) at step ${index}`;
        }
      }
    }

    const picked = options[Math.floor(random() * options.length)]!;
    s.as(picked.player).apply(picked.intent);
    const error = s.lastError();
    if (error) {
      return `legal-looking ${picked.intent.type} rejected: ${error.code} (${error.rule}) at step ${index}`;
    }
    const problem = assertInvariants(s.room);
    if (problem) return `${problem} at step ${index}`;
  }
  return null;
}

export function runScenarioJson(seed: number): string {
  const random = mulberry32(seed);
  const s = buildScenario(seed);
  for (let index = 0; index < 40; index += 1) {
    if (s.room.gameOutcome) break;
    const options = candidateIntents(s, random);
    if (options.length === 0) break;
    const picked = options[Math.floor(random() * options.length)]!;
    s.as(picked.player).apply(picked.intent);
  }
  return JSON.stringify(s.room);
}
