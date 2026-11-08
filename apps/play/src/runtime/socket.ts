/**
 * PartySocket wiring — port of the vendored PartySocket usage from
 * `.recon/pretty/playapp/0cvaqmu9022vp.js` (module 111243 factory `b`) and the option sets used by
 * the game runtime (`1w8d13szpogkp.js:1788`) and the matchmaking client
 * (`35qz5rkx7yexy.js:32870`).
 *
 * The `partysocket` npm package is a dependency of apps/play, so we reuse it instead of vendoring;
 * the factory below reproduces the original option sets and URL shape exactly:
 *
 *   match socket      party "match",       maxRetries 0, connectionTimeout 10000
 *   matchmaking       party "matchmaking", minReconnectionDelay 1000, maxReconnectionDelay 3000,
 *                     reconnectionDelayGrowFactor 3, minUptime 0, maxRetries 2
 *   quick-match party party "matchmaking", room "enam-v2-constructed-all-multiplayer"
 *   account/social    party "account",     maxReconnectionDelay 15000, shouldReconnectOnClose: code !== 4014
 */

import { PartySocket, type PartySocketOptions } from "partysocket";
import { partyUrl, realtimeHost } from "./config";

export type PartyName = "match" | "matchmaking" | "coordinator" | "account" | (string & {});

export interface RuntimeSocketOptions {
  host?: string;
  room: string;
  party?: PartyName;
  /** stable connection id (PartySocket `id`) — kept across reconnects */
  id?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  protocols?: string | string[];
}

function stringifyQuery(query: RuntimeSocketOptions["query"]): Record<string, string> | undefined {
  if (!query) return undefined;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    params[key] = String(value);
  }
  return params;
}

function baseOptions(options: RuntimeSocketOptions): PartySocketOptions {
  const host = options.host ?? realtimeHost();
  const query = stringifyQuery(options.query);
  return {
    host,
    room: options.room,
    party: options.party ?? "match",
    ...(options.id ? { id: options.id } : {}),
    ...(query ? { query } : {}),
    ...(options.protocols ? { protocols: options.protocols } : {}),
  };
}

/**
 * Game / shell room socket (`111243.b`): party "match", `maxRetries: 0`,
 * `connectionTimeout: 10000`. The room is the *gameInstanceId*; the room code travels in the query.
 */
export function createMatchSocket(
  options: RuntimeSocketOptions & {
    room: string;
    query?: { playerId?: string; roomCode?: string };
  },
): PartySocket {
  return new PartySocket({
    ...baseOptions(options),
    party: options.party ?? "match",
    maxRetries: 0,
    connectionTimeout: 10_000,
  });
}

/** Matchmaking queue socket (`35qz5rkx7yexy.js:32870`). */
export function createMatchmakingSocket(options: RuntimeSocketOptions): PartySocket {
  return new PartySocket({
    ...baseOptions(options),
    party: "matchmaking",
    minReconnectionDelay: 1_000,
    maxReconnectionDelay: 3_000,
    reconnectionDelayGrowFactor: 3,
    minUptime: 0,
    maxRetries: 2,
  });
}

/** Quick-match party socket (same party, queue room `enam-v2-constructed-all-multiplayer`). */
export function createQuickMatchPartySocket(options: RuntimeSocketOptions): PartySocket {
  return new PartySocket({
    ...baseOptions(options),
    party: "matchmaking",
    minReconnectionDelay: 1_000,
    maxReconnectionDelay: 10_000,
    reconnectionDelayGrowFactor: 2,
    minUptime: 0,
  });
}

/** Social/friends socket (party "account"; 4014 is terminal — no reconnect). */
export function createAccountSocket(options: RuntimeSocketOptions): PartySocket {
  return new PartySocket({
    ...baseOptions(options),
    party: "account",
    maxReconnectionDelay: 15_000,
    shouldReconnectOnClose: (event: CloseEvent) => event.code !== 4014,
  });
}

/** Exposed for diagnostics/tests: the URL the match socket will open. */
export function matchSocketUrl(options: {
  host?: string;
  room: string;
  query?: Record<string, string | number | boolean | null | undefined>;
}): string {
  return partyUrl({ host: options.host, party: "match", room: options.room, query: options.query });
}
