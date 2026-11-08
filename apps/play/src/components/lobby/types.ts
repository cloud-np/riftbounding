import type { SavedDeckSummary } from "@/runtime/decks";

export type PlayMode = "constructed" | "sealed";
export type GameVariant = "duel" | "free_for_all_3" | "free_for_all_4" | "teams_2v2";
export type MatchFormat = "bo1" | "bo3";
export type DeckRulesMode = "standard" | "unrestricted";
export type LobbyTable = "duel" | "ffa3" | "ffa4" | "teams";
export type CardPool = "standard" | "radiance";

/** Account library row (`savedDecks.listSavedDeckSummaries`). */
export type SavedDeck = SavedDeckSummary;

/** Metadata of the deck most recently resolved from the account library. */
export interface ActiveSavedDeck {
  id: string;
  name: string;
  status: "ready" | "incomplete";
  revision: number;
  legalityVersion: string;
}

export interface DeckEntry {
  name: string;
  count: number;
  cardCode?: string;
  /** Optional catalog metadata (used by the stats tab when available). */
  imageUrl?: string;
  energyCost?: number | null;
  might?: number | null;
  powerCost?: number | null;
  domains?: string[];
  types?: string[];
  keywords?: string[];
}

export interface DeckSections {
  legend: DeckEntry[];
  champion: DeckEntry[];
  mainDeck: DeckEntry[];
  battlefields: DeckEntry[];
  runes: DeckEntry[];
  sideboard: DeckEntry[];
}

export interface DeckTotals {
  legend: number;
  champion: number;
  mainDeck: number;
  battlefields: number;
  runes: number;
  sideboard: number;
}

export interface ParsedDeck {
  raw: string;
  sections: DeckSections;
  totals: DeckTotals;
  warnings: string[];
  errors: string[];
  valid: boolean;
  /** Rules bucket used for the parse. Signed-in lobbies use `standard`; signed-out import
   * uses `unrestricted`, exactly like the original's `deckRulesMode` switch. */
  deckRulesMode: DeckRulesMode;
}

export interface DeckStats {
  totalMainDeckCards: number;
  averageEnergy: number | null;
  averageMight: number | null;
  powerCardCount: number;
  energyCurve: { cost: number; count: number }[];
  powerDemand: { domains: string[]; cards: number; power: number }[];
  runeDistribution: { domain: string; count: number; ratio: number }[];
  typeDistribution: { type: string; count: number; ratio: number }[];
  domainDistribution: { domain: string; count: number; ratio: number }[];
  hasCardMetadata: boolean;
}

export interface GuestSession {
  name: string;
  createdAt: number;
}

export interface RoomSeat {
  id: string;
  name: string;
  seat: number;
  ready: boolean;
  deckReady: boolean;
  isHost: boolean;
}

export interface RoomChatEntry {
  id: string;
  author: string;
  authorPlayerId: string;
  text: string;
  at: number;
}

export interface RoomSpectator {
  id: string;
  name: string;
}

export interface RoomState {
  code: string;
  origin: "private" | "solo" | "practice";
  roomMode: "multiplayer" | "solo_lab" | "single_player";
  hostId: string;
  myId: string;
  mySeat: number | null;
  viewerRole: "player" | "spectator";
  variant: GameVariant;
  playMode: PlayMode;
  format: MatchFormat;
  deckRules: DeckRulesMode;
  seats: (RoomSeat | null)[];
  chat: RoomChatEntry[];
  spectators: RoomSpectator[];
  started: boolean;
  matchComplete: boolean;
  gameNumber: number;
}

export interface LobbyQuickMatchSettings {
  table: LobbyTable;
  format: MatchFormat;
  cardPool: CardPool;
}
