/**
 * `createInitialGameState` — room → game start.
 *
 * Mirrors the original room projection (35qz5rkx7yexy.js:26876-27000) and the `sz()` setup
 * card factory (35qz5rkx7yexy.js:20788-20836). The room starts in the first setup phase:
 *  - sealed / bo3 game 2+ → `sideboarding`
 *  - everything else      → `battlefield_pick`
 */
import type {
  CardInstance,
  DeckSections,
  DecklistEntry,
  PlayerBoard,
  Room,
  RoomPhase,
  RoomPlayer,
} from "@rift/protocol";
import { getCardByCode, getCardByName, hasWhenYouPlayMeText, typeWords } from "../catalog";
import { setupCardSlug } from "./ids";
import { emptyDeckSections, parseDecklist } from "../rules/decklist";
import type { DeckData, GameSetupConfig, GameSetupPlayer } from "../types";
import { variantForPlayerCount } from "../state/variant";
import { firstSetupPhase } from "./phases";
import { shuffleIds } from "./board";

function resolveSections(player: GameSetupPlayer): DeckSections | null {
  const submitted = player.submittedDeck?.sections;
  if (submitted) return submitted;
  const deck = player.deck as DeckData | { sections?: DeckSections } | null | undefined;
  if (deck && typeof deck === "object" && "sections" in deck && deck.sections) return deck.sections;
  const registered = player.registeredDeck as { sections?: DeckSections } | undefined;
  if (registered?.sections) return registered.sections;
  if (player.sealedRegisteredDeckSections) return player.sealedRegisteredDeckSections;
  if (player.decklistRaw?.trim()) return parseDecklist(player.decklistRaw).sections;
  return null;
}

/** `sz()`: build the setup-phase card instances from deck entries. */
export function setupCards(
  entries: readonly DecklistEntry[],
  ownerPlayerId: string,
  source: "mainDeck" | "champion" | "legend" | "rune",
  createdAt: number,
): CardInstance[] {
  const expanded = entries.flatMap((entry) =>
    entry.name.trim() && entry.count > 0
      ? Array.from({ length: Math.max(0, Math.trunc(entry.count)) }, () => entry)
      : [],
  );
  return expanded.map((entry, index) => {
    const card = getCardByCode(entry.cardCode) ?? getCardByName(entry.name);
    const slug = setupCardSlug(card?.id ?? entry.cardCode ?? entry.name) || "card";
    const type = card?.type ? typeWords(card.type)[0]?.toLowerCase() : undefined;
    return {
      id: `setup-${ownerPlayerId}-${source}-${index}-${slug}`,
      name: card?.name ?? entry.name,
      source,
      ownerPlayerId,
      exhausted: false,
      createdAt,
      cardCode: card?.id ?? entry.cardCode,
      hasWhenYouPlayMe: hasWhenYouPlayMeText(card?.text),
      imageUrl: card?.imageUrl,
      ...(type ? { type } : {}),
      ...(card?.domains ? { domains: [...card.domains] } : {}),
      ...(card?.text ? { text: card.text } : {}),
      ...(typeof card?.energyCost === "number" ? { energyCost: card.energyCost } : {}),
      ...(typeof card?.powerCost === "number" ? { powerCost: card.powerCost } : {}),
      ...(typeof card?.might === "number" ? { might: card.might } : {}),
      ...(card?.rarity ? { rarity: card.rarity } : {}),
      ...(card?.set ? { set: card.set } : {}),
      ...(card?.keywords ? { keywords: [...card.keywords] } : {}),
      ...(card?.subtypes ? { subtypes: [...card.subtypes] } : {}),
      isPlaceholder: !card,
    };
  });
}

function boardFromDeck(sections: DeckSections, playerId: string, createdAt: number): PlayerBoard {
  return {
    score: 0,
    floatingEnergy: 0,
    floatingPower: 0,
    legendXp: 0,
    deck: setupCards(sections.mainDeck, playerId, "mainDeck", createdAt),
    hand: [],
    handRevealToOpponent: false,
    base: [],
    trash: [],
    banished: [],
    battlefieldA: [],
    battlefieldB: [],
    battlefieldC: [],
    battlefieldToken: [],
    champion: setupCards(sections.champion, playerId, "champion", createdAt),
    legend: setupCards(sections.legend.slice(0, 1), playerId, "legend", createdAt),
    runeDeck: setupCards(sections.runes, playerId, "rune", createdAt),
    runeArea: [],
    deckPeek: { cardIds: [], revealedCardIds: [] },
  };
}

function defaultPhase(config: GameSetupConfig, variant: import("@rift/protocol").GameVariant): RoomPhase {
  if (config.phase) return config.phase;
  return firstSetupPhase({
    gameVariant: variant,
    players: config.players.map((player, index) => ({ id: player.id, seat: player.seat ?? index })) as Room["players"],
    roomMode: config.roomMode ?? "multiplayer",
    playMode: config.playMode,
    matchFormat: config.matchFormat,
    gameNumber: config.gameNumber,
  });
}

function uniqueNames(entries: readonly DecklistEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of entries) {
    const trimmed = entry.name.trim();
    if (!trimmed || trimmed.startsWith("__sealed_blank_battlefield__:")) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/** `createInitialGameState(config)` */
export function createInitialGameState(config: GameSetupConfig): Room {
  if (!config || typeof config.roomCode !== "string" || config.roomCode.trim().length === 0) {
    throw new Error("createInitialGameState: roomCode is required");
  }
  const soloPending = config.roomMode === "single_player" && config.soloSetupPending === true;
  if (
    !Array.isArray(config.players) ||
    config.players.length < (soloPending ? 1 : 2) ||
    config.players.length > 4
  ) {
    throw new Error("createInitialGameState: 2..4 players are required");
  }
  const now = config.createdAt ?? config.now ?? config.updatedAt ?? 0;
  const variant = config.gameVariant ?? variantForPlayerCount(undefined, config.players.length);
  const roomMode = config.roomMode ?? "multiplayer";
  const playMode = config.playMode ?? "constructed";
  const deckRulesMode =
    config.deckRulesMode ?? (playMode === "sealed" ? "standard" : roomMode === "multiplayer" ? "standard" : "unrestricted");
  const phase = defaultPhase({ ...config, playMode }, variant);
  const seats = [...config.players]
    .map((player, index) => ({ player, seat: player.seat ?? index }))
    .sort((a, b) => a.seat - b.seat);
  const players: RoomPlayer[] = seats.map(({ player, seat }) => {
    const joinedAt = player.joinedAt ?? now + seat * 1000;
    const sections = resolveSections(player);
    const used = new Set((config.usedBattlefieldsByPlayerId?.[player.id] ?? []).map((name) => name.trim().toLowerCase()));
    const allOptions = (player.battlefieldOptions ?? (sections ? uniqueNames(sections.battlefields) : [])).filter(Boolean);
    const options = allOptions.filter((name) => !used.has(name.trim().toLowerCase()));
    const finalOptions = options.length > 0 ? options : allOptions;
    const roomPlayer: RoomPlayer = {
      id: player.id,
      seat,
      name: player.name,
      joinedAt,
      ...(player.decklistRaw ? { decklistRaw: player.decklistRaw } : {}),
      ...(player.deck ? { deck: player.deck } : {}),
      ...(player.submittedDeck
        ? { submittedDeck: { sections: player.submittedDeck.sections, raw: player.submittedDeck.raw ?? "" } }
        : {}),
      ...(player.registeredDeck !== undefined ? { registeredDeck: player.registeredDeck } : {}),
      ...(player.sealedFormatId ? { sealedFormatId: player.sealedFormatId } : {}),
      ...(player.sealedDraftId ? { sealedDraftId: player.sealedDraftId } : {}),
      ...(player.sealedPoolSections ? { sealedPoolSections: player.sealedPoolSections } : {}),
      ...(player.sealedRegisteredDeckSections
        ? { sealedRegisteredDeckSections: player.sealedRegisteredDeckSections }
        : {}),
      ...(player.isSealedSeat ? { isSealedSeat: true } : {}),
      ...(player.selectedBattlefield ? { selectedBattlefield: player.selectedBattlefield } : {}),
      ...(player.selectedBattlefieldCardCode
        ? { selectedBattlefieldCardCode: player.selectedBattlefieldCardCode }
        : {}),
      ...(finalOptions.length > 0 ? { battlefieldOptions: finalOptions } : {}),
      ...(player.battlefieldOptionCount !== undefined
        ? { battlefieldOptionCount: player.battlefieldOptionCount }
        : finalOptions.length > 0
          ? { battlefieldOptionCount: finalOptions.length }
          : {}),
      ...(player.identity ? { identity: player.identity } : {}),
      ...(player.leftAt !== undefined ? { leftAt: player.leftAt } : {}),
      ...(player.leftReason ? { leftReason: player.leftReason } : {}),
    };
    const setupPhase =
      phase === "sideboarding" ||
      phase === "battlefield_pick" ||
      phase === "initiative_roll" ||
      phase === "first_player_choice" ||
      phase === "mulligan" ||
      phase === "in_game";
    if (sections && setupPhase) roomPlayer.board = boardFromDeck(sections, player.id, joinedAt);
    return roomPlayer;
  });

  const room: Room = {
    roomCode: config.roomCode,
    createdAt: now,
    updatedAt: now,
    phase,
    gameVariant: variant,
    roomMode,
    ...(config.teamIdByPlayerId ? { teamIdByPlayerId: { ...config.teamIdByPlayerId } } : {}),
    playMode,
    deckRulesMode,
    matchFormat: config.matchFormat ?? "bo1",
    setupOrderVersion: config.setupOrderVersion ?? 2,
    ...(config.singlePlayerTurnOrder ? { singlePlayerTurnOrder: config.singlePlayerTurnOrder } : {}),
    ...(config.soloSetupPending !== undefined ? { soloSetupPending: config.soloSetupPending } : {}),
    ...(config.starterChooserPlayerId ? { starterChooserPlayerId: config.starterChooserPlayerId } : {}),
    ...(config.usedBattlefieldsByPlayerId
      ? { usedBattlefieldsByPlayerId: config.usedBattlefieldsByPlayerId }
      : {}),
    ...(config.gameNumber !== undefined ? { gameNumber: config.gameNumber } : {}),
    ...(config.seriesStartedAt !== undefined ? { seriesStartedAt: config.seriesStartedAt } : {}),
    ...(config.winsByPlayerId ? { winsByPlayerId: { ...config.winsByPlayerId } } : {}),
    ...(config.bo3CompletedGames ? { bo3CompletedGames: config.bo3CompletedGames } : {}),
    ...(config.testMode ? { testMode: true } : {}),
    hostPlayerId: config.hostPlayerId ?? config.players[0]?.id,
    players,
    log: config.log ?? [],
    chainEntries: [],
    chainResolveVotes: [],
    initiativeRound: phase === "initiative_roll" ? 1 : 0,
    initiativeRolls: {},
    rewindProtocolVersion: 5,
    rewindablePlayerIds: [],
    forwardablePlayerIds: [],
  };

  if (phase === "sideboarding") {
    for (const player of room.players) {
      delete player.selectedBattlefield;
      delete player.selectedBattlefieldCardCode;
    }
  }

  if (config.shuffleDecks !== false) {
    for (const player of room.players) {
      const board = player.board;
      if (!board) continue;
      const shuffleOptions = config.rng
        ? { random: config.rng }
        : { seedKey: `${room.roomCode}|${player.id}|mainDeck` };
      board.deck = shuffleIds(board.deck, shuffleOptions);
      const runeOptions = config.rng
        ? { random: config.rng }
        : { seedKey: `${room.roomCode}|${player.id}|runeDeck` };
      board.runeDeck = shuffleIds(board.runeDeck, runeOptions);
    }
  }
  return room;
}

/** Empty board (exported for tests / spectator seats). */
export function emptyPlayerBoard(): PlayerBoard {
  return {
    score: 0,
    floatingEnergy: 0,
    floatingPower: 0,
    legendXp: 0,
    deck: [],
    hand: [],
    handRevealToOpponent: false,
    base: [],
    trash: [],
    banished: [],
    battlefieldA: [],
    battlefieldB: [],
    battlefieldC: [],
    battlefieldToken: [],
    champion: [],
    legend: [],
    runeDeck: [],
    runeArea: [],
    deckPeek: { cardIds: [], revealedCardIds: [] },
  };
}

export { emptyDeckSections };
