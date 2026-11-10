/**
 * Build a real strict `Room` at a declared position (Main Phase, Neutral Open).
 *
 * The room comes from the engine's real `createInitialGameState` (so card instances, zones and
 * catalog data are exactly what the server creates), every card is then placed where the position
 * says, and `Room.rules` is created with the public `createRulesState` before the turn fields,
 * object states (damage/buffs/stun/hidden), battlefield control, pools and points are applied.
 * No Start of Turn is replayed: the board is authoritative, like the engine's restore contract.
 */
import type {
  BattlefieldZone,
  CardInstance,
  DeckSections,
  DecklistEntry,
  PlayerBoard,
  Room,
} from "@rift/protocol";
import type { Card } from "@rift/cards";
import { createInitialGameState } from "../../../engine/src/index";
import { createEngineRulesHost } from "../../../engine/src/strict/host";
import {
  applyAutoPassUpdate,
  createRulesState,
  projectRules,
  type RulesContext,
  type RulesHost,
} from "../../src";
import { deterministicContext } from "./context";
import { ScenarioCardError, didYouMean, resolveCatalogCard, runeName } from "./catalog";
import {
  PLAYER_KEYS,
  type BattlefieldSpec,
  type CardSpec,
  type Domain,
  type PlayerKey,
  type PlayerPositionSpec,
  type PositionSpec,
  type RuneList,
  type UnitEntry,
  type UnitSpec,
} from "./format";

export const DEFAULT_FILLER = "Mega-Mech";
export const DEFAULT_FILLER_COUNT = 20;
export const DEFAULT_TURN_NUMBER = 5;
const BATTLEFIELD_ZONES: readonly BattlefieldZone[] = ["battlefieldA", "battlefieldB"];
const DOMAINS: readonly Domain[] = ["Fury", "Calm", "Mind", "Body", "Chaos", "Order"];

export interface BuiltPosition {
  room: Room;
  host: RulesHost;
  ctx: RulesContext;
  /** "P1" → "p1" and back. */
  playerId: Record<PlayerKey, string>;
  playerKey: Record<string, PlayerKey>;
  /** Labels (and unique-name aliases) → card instance id. */
  labels: Map<string, string>;
  battlefields: Array<{ name: string; zone: BattlefieldZone }>;
  warnings: string[];
}

export class ScenarioPositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioPositionError";
  }
}

/* ------------------------------------------------------------------ helpers */

function cardSpec(entry: string | CardSpec): CardSpec {
  return typeof entry === "string" ? { name: entry } : entry;
}

function unitSpec(entry: UnitEntry): UnitSpec {
  return typeof entry === "string" ? { name: entry } : entry;
}

function typeOf(card: Card): string {
  return (card.type ?? "").toLowerCase();
}

/** Expand a rune list (names or per-domain counts) into rune card names. */
export function runeNames(list: RuneList | undefined, where: string): string[] {
  if (!list) return [];
  if (Array.isArray(list)) {
    return list.map((name) => {
      const card = resolveCatalogCard(name, where);
      if (typeOf(card) !== "rune")
        throw new ScenarioCardError(`${where}: ${card.name} is not a rune`);
      return card.name;
    });
  }
  const out: string[] = [];
  for (const [domain, count] of Object.entries(list)) {
    if (!DOMAINS.includes(domain as Domain)) {
      throw new ScenarioPositionError(
        `${where}: unknown rune domain ${JSON.stringify(domain)}.${didYouMean(domain, DOMAINS)}`,
      );
    }
    for (let index = 0; index < (count ?? 0); index += 1) out.push(runeName(domain));
  }
  return out;
}

function entries(names: readonly string[]): DecklistEntry[] {
  const counts = new Map<string, { card: Card; count: number }>();
  for (const name of names) {
    const card = resolveCatalogCard(name, "deck");
    const entry = counts.get(card.name);
    if (entry) entry.count += 1;
    else counts.set(card.name, { card, count: 1 });
  }
  return [...counts.values()].map(({ card, count }) => ({
    name: card.name,
    count,
    cardCode: card.id,
  }));
}

/** Take the first card named `name` out of `pool`. */
function take(pool: CardInstance[], name: string, where: string): CardInstance {
  const index = pool.findIndex((card) => card.name === name);
  if (index < 0)
    throw new ScenarioPositionError(`internal: ${name} missing from the built deck (${where})`);
  return pool.splice(index, 1)[0]!;
}

interface Placement {
  key: PlayerKey;
  /** board zone */
  zone: string;
  spec: CardSpec;
  /** resolved catalog name */
  name: string;
  attachTo?: CardSpec;
  facedown?: { hiddenOnTurn?: number };
}

/* ------------------------------------------------------------------ build */

export function buildPosition(
  position: PositionSpec,
  options: { roomCode?: string } = {},
): BuiltPosition {
  const warnings: string[] = [];
  const playerId: Record<PlayerKey, string> = { P1: "p1", P2: "p2" };
  const playerKey: Record<string, PlayerKey> = { p1: "P1", p2: "P2" };
  const turnPlayer = position.turn.player;
  if (!PLAYER_KEYS.includes(turnPlayer))
    throw new ScenarioPositionError(`turn.player must be P1 or P2`);
  const turnNumber = position.turn.number ?? DEFAULT_TURN_NUMBER;
  if (!Array.isArray(position.battlefields) || position.battlefields.length !== 2) {
    throw new ScenarioPositionError("a duel position needs exactly two battlefields (P1's first)");
  }

  // Battlefields: entry i is contributed by player i (battlefieldA/B, 103.4).
  const battlefields = position.battlefields.map((spec, index) => {
    const card = resolveCatalogCard(spec.name, `battlefield ${index + 1}`);
    if (typeOf(card) !== "battlefield") {
      throw new ScenarioCardError(
        `battlefield ${index + 1}: ${card.name} is a ${card.type}, not a Battlefield`,
      );
    }
    return { name: card.name, zone: BATTLEFIELD_ZONES[index]!, spec };
  });
  const zoneOfBattlefield = (ref: string, where: string): BattlefieldZone => {
    if ((BATTLEFIELD_ZONES as readonly string[]).includes(ref)) return ref as BattlefieldZone;
    const lower = ref.trim().toLowerCase();
    const matches = battlefields.filter((bf) => bf.name.toLowerCase() === lower);
    if (matches.length > 1) {
      throw new ScenarioPositionError(
        `${where}: both battlefields are ${JSON.stringify(ref)}; use battlefieldA or battlefieldB`,
      );
    }
    const found = matches[0];
    if (found) return found.zone;
    throw new ScenarioPositionError(
      `${where}: ${JSON.stringify(ref)} is not a battlefield in this position.${didYouMean(
        ref,
        battlefields.map((bf) => bf.name),
      )}`,
    );
  };

  // Collect every placement and each player's main-deck/rune names.
  const placements: Placement[] = [];
  const mainNames: Record<PlayerKey, string[]> = { P1: [], P2: [] };
  const runeAreaReady: Record<PlayerKey, string[]> = { P1: [], P2: [] };
  const runeAreaExhausted: Record<PlayerKey, string[]> = { P1: [], P2: [] };
  const runeDeckNames: Record<PlayerKey, string[]> = { P1: [], P2: [] };
  const legends: Record<PlayerKey, Card | null> = { P1: null, P2: null };
  const champions: Record<PlayerKey, Card | null> = { P1: null, P2: null };
  const deckOrder: Record<PlayerKey, string[]> = { P1: [], P2: [] };
  const filler: Record<PlayerKey, { name: string; count: number }> = {
    P1: { name: DEFAULT_FILLER, count: DEFAULT_FILLER_COUNT },
    P2: { name: DEFAULT_FILLER, count: DEFAULT_FILLER_COUNT },
  };

  const addUnit = (
    key: PlayerKey,
    zone: string,
    entry: UnitEntry,
    where: string,
    permanentZone: boolean,
  ) => {
    const spec = unitSpec(entry);
    const name = spec.token ? spec.name : resolveCatalogCard(spec.name, where).name;
    if (!spec.token) {
      const card = resolveCatalogCard(spec.name, where);
      const type = typeOf(card);
      const isBattlefield = zone !== "base";
      if (permanentZone && isBattlefield && !type.includes("unit")) {
        throw new ScenarioPositionError(
          `${where}: ${card.name} is a ${card.type}; only units stand at a battlefield (attach gear with \`gear\`)`,
        );
      }
      if (permanentZone && !type.includes("unit") && !type.includes("gear")) {
        throw new ScenarioPositionError(
          `${where}: ${card.name} is a ${card.type}; only units and gear can be on the board`,
        );
      }
      mainNames[key].push(name);
    }
    placements.push({ key, zone, spec, name });
    for (const gearEntry of spec.gear ?? []) {
      const gear = cardSpec(gearEntry);
      const gearName = gear.token ? gear.name : resolveCatalogCard(gear.name, `${where} gear`).name;
      if (!gear.token) {
        const card = resolveCatalogCard(gear.name, `${where} gear`);
        if (!typeOf(card).includes("gear")) {
          throw new ScenarioPositionError(`${where}: ${card.name} is a ${card.type}, not gear`);
        }
        mainNames[key].push(gearName);
      }
      placements.push({ key, zone, spec: gear, name: gearName, attachTo: spec });
    }
  };

  for (const key of PLAYER_KEYS) {
    const player: PlayerPositionSpec | undefined = position.players[key];
    if (!player) throw new ScenarioPositionError(`position.players.${key} is missing`);
    const legendSpec = typeof player.legend === "string" ? { name: player.legend } : player.legend;
    const legend = resolveCatalogCard(legendSpec.name, `${key} legend`);
    if (typeOf(legend) !== "legend")
      throw new ScenarioCardError(
        `${key} legend: ${legend.name} is a ${legend.type}, not a Legend`,
      );
    legends[key] = legend;
    if (player.champion) champions[key] = resolveCatalogCard(player.champion, `${key} champion`);

    for (const name of player.hand ?? []) {
      const card = resolveCatalogCard(name, `${key} hand`);
      mainNames[key].push(card.name);
      placements.push({ key, zone: "hand", spec: { name: card.name }, name: card.name });
    }
    for (const entry of player.base ?? []) addUnit(key, "base", entry, `${key} base`, true);
    for (const zone of ["trash", "banished"] as const) {
      for (const name of player[zone] ?? []) {
        const card = resolveCatalogCard(name, `${key} ${zone}`);
        mainNames[key].push(card.name);
        placements.push({ key, zone, spec: { name: card.name }, name: card.name });
      }
    }
    for (const name of player.deck ?? []) {
      const card = resolveCatalogCard(name, `${key} deck`);
      mainNames[key].push(card.name);
      deckOrder[key].push(card.name);
    }
    if (player.deckFiller) {
      const fillerName = player.deckFiller.card
        ? resolveCatalogCard(player.deckFiller.card, `${key} deckFiller`).name
        : DEFAULT_FILLER;
      filler[key] = {
        name: fillerName,
        count: Math.max(0, Math.trunc(player.deckFiller.count ?? DEFAULT_FILLER_COUNT)),
      };
    }
    runeAreaReady[key] = runeNames(player.runes?.ready, `${key} runes.ready`);
    runeAreaExhausted[key] = runeNames(player.runes?.exhausted, `${key} runes.exhausted`);
    runeDeckNames[key] =
      player.runeDeck !== undefined
        ? runeNames(player.runeDeck, `${key} runeDeck`)
        : defaultRuneDeck(legend);
  }

  battlefields.forEach((bf, index) => {
    const spec: BattlefieldSpec = bf.spec;
    for (const key of PLAYER_KEYS) {
      for (const entry of spec.units?.[key] ?? [])
        addUnit(key, bf.zone, entry, `${key} units at ${bf.name}`, true);
    }
    if (spec.facedown) {
      const card = resolveCatalogCard(spec.facedown.card, `facedown at ${bf.name}`);
      mainNames[spec.facedown.owner].push(card.name);
      placements.push({
        key: spec.facedown.owner,
        zone: bf.zone,
        spec: { name: card.name, ...(spec.facedown.label ? { label: spec.facedown.label } : {}) },
        name: card.name,
        facedown: {
          ...(spec.facedown.hiddenOnTurn !== undefined
            ? { hiddenOnTurn: spec.facedown.hiddenOnTurn }
            : {}),
        },
      });
    }
    if (
      spec.controller !== undefined &&
      spec.controller !== null &&
      !PLAYER_KEYS.includes(spec.controller)
    ) {
      throw new ScenarioPositionError(`battlefield ${index + 1} controller must be P1, P2 or null`);
    }
  });

  // Labels must be unique across the scenario.
  const seenLabels = new Set<string>();
  for (const placement of placements) {
    const label = placement.spec.label;
    if (!label) continue;
    if (seenLabels.has(label))
      throw new ScenarioPositionError(`duplicate label ${JSON.stringify(label)}`);
    seenLabels.add(label);
  }

  // Build decklists: everything named is a Main Deck card, plus filler (taken out again below).
  const sections = (key: PlayerKey): DeckSections =>
    ({
      legend: entries([legends[key]!.name]),
      champion: champions[key] ? entries([champions[key]!.name]) : [],
      mainDeck: entries([
        ...mainNames[key],
        ...Array.from({ length: filler[key].count }, () => filler[key].name),
      ]),
      battlefields: entries([battlefields[PLAYER_KEYS.indexOf(key)]!.name]),
      runes: entries([...runeAreaReady[key], ...runeAreaExhausted[key], ...runeDeckNames[key]]),
      sideboard: [],
    }) as DeckSections;

  const ctx = deterministicContext(position.seed ?? 1);
  const room = createInitialGameState({
    roomCode: options.roomCode ?? "SCENARIO",
    createdAt: ctx.now,
    phase: "in_game",
    gameVariant: "duel",
    roomMode: "multiplayer",
    shuffleDecks: false,
    players: PLAYER_KEYS.map((key) => {
      const raw = "";
      return {
        id: playerId[key],
        name: position.players[key].name ?? key,
        submittedDeck: { sections: sections(key), raw },
      };
    }),
  });
  room.rulesMode = "strict";
  room.firstPlayerId = playerId[position.firstPlayer ?? "P1"];
  room.turnNumber = turnNumber;
  room.activeTurnPlayerId = playerId[turnPlayer];
  room.activeTurnStep = "main";
  PLAYER_KEYS.forEach((key, index) => {
    const player = room.players.find((entry) => entry.id === playerId[key])!;
    player.selectedBattlefield = battlefields[index]!.name;
  });

  const host = createEngineRulesHost(ctx);
  const labels = new Map<string, string>();
  const objectStates: Array<{ id: string; spec: CardSpec }> = [];
  const hidden: Array<{ id: string; key: PlayerKey; hiddenOnTurn?: number }> = [];
  const boards = {} as Record<PlayerKey, PlayerBoard>;
  for (const key of PLAYER_KEYS) {
    const board = room.players.find((entry) => entry.id === playerId[key])!.board;
    if (!board) throw new ScenarioPositionError(`internal: no board for ${key}`);
    boards[key] = board;
  }

  // Main Deck pool → zones.
  const pools = {} as Record<PlayerKey, CardInstance[]>;
  for (const key of PLAYER_KEYS) {
    pools[key] = boards[key].deck.splice(0, boards[key].deck.length);
  }
  const placedIds = new Map<CardSpec, string>();
  for (const placement of placements) {
    const board = boards[placement.key];
    const list = (board as unknown as Record<string, CardInstance[]>)[placement.zone];
    if (!list) throw new ScenarioPositionError(`internal: unknown zone ${placement.zone}`);
    let card: CardInstance;
    if (placement.spec.token) {
      const id = host.createToken(
        room,
        playerId[placement.key],
        placement.spec.name,
        placement.zone,
      );
      if (!id)
        throw new ScenarioPositionError(
          `${placement.key}: could not create token ${placement.spec.name}`,
        );
      const created = list.findIndex((entry) => entry.id === id);
      card = list.splice(created, 1)[0]!;
    } else {
      card = take(pools[placement.key], placement.name, `${placement.key} ${placement.zone}`);
    }
    const permanent = placement.zone === "base" || placement.zone.startsWith("battlefield");
    card = { ...card, exhausted: permanent ? placement.spec.exhausted === true : false };
    if (placement.facedown) {
      card.hidden = true;
      card.revealedToOpponent = false;
      hidden.push({
        id: card.id,
        key: placement.key,
        ...(placement.facedown.hiddenOnTurn !== undefined
          ? { hiddenOnTurn: placement.facedown.hiddenOnTurn }
          : {}),
      });
    }
    if (placement.attachTo) {
      const hostId = placedIds.get(placement.attachTo);
      if (!hostId)
        throw new ScenarioPositionError(`internal: gear host for ${placement.name} not placed`);
      card.attachedToCardId = hostId;
      const index = list.findIndex((entry) => entry.id === hostId);
      let next = index + 1;
      while (next < list.length && list[next]?.attachedToCardId === hostId) next += 1;
      list.splice(next, 0, card);
    } else {
      list.push(card);
    }
    placedIds.set(placement.spec, card.id);
    if (placement.spec.label) labels.set(placement.spec.label, card.id);
    if (permanent) objectStates.push({ id: card.id, spec: placement.spec });
  }
  // Deck: the declared order (index 0 = top = end of the array) above the filler.
  for (const key of PLAYER_KEYS) {
    const top: CardInstance[] = deckOrder[key].map((name) => take(pools[key], name, `${key} deck`));
    const rest = pools[key].splice(0, pools[key].length);
    const unexpected = rest.filter((card) => card.name !== filler[key].name);
    if (unexpected.length > 0) {
      throw new ScenarioPositionError(
        `internal: unplaced cards for ${key}: ${unexpected.map((card) => card.name).join(", ")}`,
      );
    }
    boards[key].deck = [...rest, ...top.reverse()];
  }

  // Runes: pool → Rune Area (ready, then exhausted) → Rune Deck (top = end).
  for (const key of PLAYER_KEYS) {
    const board = boards[key];
    const runePool = board.runeDeck.splice(0, board.runeDeck.length);
    board.runeArea = [
      ...runeAreaReady[key].map((name) => ({
        ...take(runePool, name, `${key} runes`),
        exhausted: false,
      })),
      ...runeAreaExhausted[key].map((name) => ({
        ...take(runePool, name, `${key} runes`),
        exhausted: true,
      })),
    ];
    board.runeDeck = runeDeckNames[key]
      .map((name) => take(runePool, name, `${key} runeDeck`))
      .reverse();
    const player = position.players[key];
    const legendSpec = typeof player.legend === "string" ? { name: player.legend } : player.legend;
    const legendCard = board.legend[0];
    if (legendCard) {
      board.legend[0] = { ...legendCard, exhausted: legendSpec.exhausted === true };
      if (legendSpec.label) labels.set(legendSpec.label, legendCard.id);
    }
    board.score = Math.max(0, Math.trunc(player.points ?? 0));
  }

  // Strict state at Main, Neutral Open (restore contract: no Start of Turn replay).
  const rules = createRulesState(room, host);
  room.rules = rules;
  rules.turn = { player: playerId[turnPlayer], number: turnNumber, phase: "main" };
  rules.priority = playerId[position.priority ?? turnPlayer];
  rules.focus = null;
  for (const { id, spec } of objectStates) {
    const object = (rules.objects[id] ??= {});
    if (spec.damage) object.damage = Math.trunc(spec.damage);
    if (spec.buffs) object.buffs = Math.trunc(spec.buffs);
    if (spec.stunned) object.stunned = true;
    if (spec.state) Object.assign(object, spec.state);
    const info = host.cardInfo(room, id);
    if (
      spec.damage &&
      typeof info?.might === "number" &&
      spec.damage >= info.might + (spec.buffs ?? 0)
    ) {
      warnings.push(
        `${spec.label ?? spec.name} starts with lethal damage (${spec.damage}); the next cleanup kills it`,
      );
    }
  }
  for (const entry of hidden) {
    const object = (rules.objects[entry.id] ??= {});
    object.hiddenTurn = entry.hiddenOnTurn ?? turnNumber - 1;
    object.hiddenBy = playerId[entry.key];
  }
  for (const bf of battlefields) {
    if (bf.spec.controller !== undefined) {
      rules.objects[bf.zone] = {
        ...(rules.objects[bf.zone] ?? {}),
        controller: bf.spec.controller === null ? null : playerId[bf.spec.controller],
      };
    }
  }
  for (const key of PLAYER_KEYS) {
    const pool = position.players[key].pool;
    rules.pools[playerId[key]] = { energy: pool?.energy ?? 0, power: { ...(pool?.power ?? {}) } };
    for (const ref of position.players[key].scoredThisTurn ?? []) {
      host.markScored(room, playerId[key], zoneOfBattlefield(ref, `${key} scoredThisTurn`));
    }
    const autoPass = position.players[key].autoPass;
    if (autoPass) applyAutoPassUpdate(rules, playerId[key], autoPass);
  }
  projectRules(room, host);

  // Unique names on the board are aliases too (handy in checkpoints after the card moves).
  return {
    room,
    host,
    ctx,
    playerId,
    playerKey,
    labels,
    battlefields: battlefields.map(({ name, zone }) => ({ name, zone })),
    warnings,
  };
}

/** 6 runes split across the legend's domains (the default Rune Deck). */
function defaultRuneDeck(legend: Card): string[] {
  const domains = (legend.domains ?? []).filter((domain) => DOMAINS.includes(domain as Domain));
  if (domains.length === 0) return [];
  return Array.from({ length: 6 }, (_, index) => runeName(domains[index % domains.length]!));
}
