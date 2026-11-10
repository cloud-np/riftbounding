/**
 * Strict-rules dev scenarios (no server).
 *
 * `showdown` puts a real strict duel (already past setup, at the human's Main Phase) into a
 * ready-made combat position by moving real card instances between the zones of the room the
 * engine created, so card ids, zones and `room.rules` stay consistent. Strict state only needs the
 * zone move plus the battlefield `controller` entry (objects are created lazily by the rules
 * layer; this mirrors `packages/rules/test/scenarios/position.ts`, which is test-only).
 *
 * Position (human = seat 0, bot = seat 1):
 *  - human base (ready): Legion Rearguard (2), Hunting Dog (3, Deathknell), Petty Officer (5)
 *  - human hand: Noxus Saboteur (unit), Hextech Ray (3 damage to a unit at a battlefield), Cleave
 *  - human runes: 4 Fury + 4 Order, ready
 *  - bot at ITS battlefield (battlefieldB, controlled by the bot): Legion Rearguard (2) and
 *    Carrion Dredger (1, Deathknell) — both weaker than Hunting Dog (3) / Petty Officer (5).
 */
import type { CardInstance, DeckSections, DecklistEntry, Room } from "@rift/protocol";
import { getCardByName } from "@rift/cards";

export const SCENARIOS = ["showdown"] as const;
export type StrictScenarioId = (typeof SCENARIOS)[number];

export function parseScenario(value: string | null | undefined): StrictScenarioId | null {
  const v = value?.trim().toLowerCase();
  return (SCENARIOS as readonly string[]).find((id) => id === v) as StrictScenarioId | null ?? null;
}

const MAIN_DECK = [
  "Legion Rearguard",
  "Hunting Dog",
  "Carrion Dredger",
  "Petty Officer",
  "Noxus Saboteur",
  "Noxus Hopeful",
  "Flame Chompers",
  "Hextech Ray",
  "Cleave",
  "Get Excited!",
  "Noxian Drummer",
  "Imperial Decree",
  "Brazen Buccaneer",
] as const;

function entry(name: string, count: number): DecklistEntry {
  const card = getCardByName(name);
  if (!card) throw new Error(`strict dev deck: ${name} is missing from @rift/cards`);
  return { name: card.name, count, cardCode: card.id };
}

/** Two legal-enough (unrestricted) Fury/Order decks that contain every scenario card. */
export function buildStrictDecks(): [DeckSections, DeckSections] {
  const build = (battlefields: string[]): DeckSections => ({
    legend: [entry("Darius, Hand of Noxus", 1)],
    champion: [entry("Darius, Trifarian", 1)],
    // 13 names x3 = 39, +1 Hunting Dog = 40 cards.
    mainDeck: [...MAIN_DECK.map((name) => entry(name, 3)), entry("Hunting Dog", 1)].reduce<
      DecklistEntry[]
    >((out, item) => {
      const existing = out.find((e) => e.name === item.name);
      if (existing) existing.count += item.count;
      else out.push({ ...item });
      return out;
    }, []),
    battlefields: battlefields.map((name) => entry(name, 1)),
    runes: [entry("Fury Rune", 6), entry("Order Rune", 6)],
    sideboard: [],
  });
  return [
    build(["Altar to Unity", "Fortified Position", "Back-Alley Bar"]),
    build(["Bandle Tree", "Grove of the God-Willow", "Reaver's Row"]),
  ];
}

function boardOf(room: Room, playerId: string) {
  const board = room.players.find((player) => player.id === playerId)?.board;
  if (!board) throw new Error(`strict scenario: player ${playerId} has no board`);
  return board;
}

/** Remove the first card named `name` from hand/deck/trash and return it (ready). */
function pull(board: NonNullable<Room["players"][number]["board"]>, name: string): CardInstance {
  for (const pool of [board.hand, board.deck, board.trash] as CardInstance[][]) {
    const index = pool.findIndex((card) => card.name === name);
    if (index >= 0) {
      const [card] = pool.splice(index, 1);
      return { ...card!, exhausted: false };
    }
  }
  throw new Error(`strict scenario: ${name} not found in the deck`);
}

export interface ShowdownScenarioInfo {
  humanId: string;
  botId: string;
  /** The battlefield the bot holds (move human units here to start a showdown). */
  botBattlefield: "battlefieldB";
  humanUnits: string[];
  botUnits: string[];
}

/**
 * Mutate `room` (a strict, in-game duel at a Main Phase) into the showdown position with the
 * human holding priority at Main on turn 3. Returns the ids the harness/tests care about.
 */
export function applyShowdownScenario(
  room: Room,
  humanId: string,
  botId: string,
): ShowdownScenarioInfo {
  if (room.rulesMode !== "strict" || room.phase !== "in_game" || !room.rules) {
    throw new Error("strict scenario: room must be a strict in-game room");
  }
  const human = boardOf(room, humanId);
  const bot = boardOf(room, botId);

  // Human: current hand goes back under the deck, then the scripted hand/base.
  human.deck.unshift(...human.hand.splice(0, human.hand.length));
  for (const name of ["Noxus Saboteur", "Hextech Ray", "Cleave"]) human.hand.push(pull(human, name));
  const humanUnits = ["Legion Rearguard", "Hunting Dog", "Petty Officer"].map((name) => {
    const card = pull(human, name);
    human.base.push(card);
    return card.id;
  });
  // Runes: 4 Fury + 4 Order ready in the Rune Area.
  human.runeDeck.unshift(...human.runeArea.splice(0, human.runeArea.length));
  for (const name of ["Fury Rune", "Order Rune"]) {
    for (let i = 0; i < 4; i += 1) {
      const index = human.runeDeck.findIndex((rune) => rune.name === name);
      if (index < 0) throw new Error(`strict scenario: no ${name} left in the rune deck`);
      const [rune] = human.runeDeck.splice(index, 1);
      human.runeArea.push({ ...rune!, exhausted: false });
    }
  }

  // Bot: two weak units already standing at its battlefield, which it controls.
  const botUnits = ["Legion Rearguard", "Carrion Dredger"].map((name) => {
    const card = pull(bot, name);
    bot.battlefieldB.push(card);
    return card.id;
  });

  room.firstPlayerId = humanId;
  room.turnNumber = 3;
  room.activeTurnPlayerId = humanId;
  room.activeTurnStep = "main";
  const rules = room.rules;
  rules.turn = { player: humanId, number: 3, phase: "main" };
  rules.priority = humanId;
  rules.focus = null;
  rules.passes = [];
  rules.objects.battlefieldB = { ...(rules.objects.battlefieldB ?? {}), controller: botId };
  rules.pools[humanId] = { energy: 0, power: {} };
  rules.scoredThisTurn = { ...rules.scoredThisTurn, [humanId]: [], [botId]: [] };
  return { humanId, botId, botBattlefield: "battlefieldB", humanUnits, botUnits };
}
