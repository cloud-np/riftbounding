/**
 * Runtime configuration — host resolution + static asset bases.
 *
 * Ported from the original bundles:
 *  - `.recon/pretty/playapp/0cvaqmu9022vp.js` (module 111243): `H()` (host), `R()` (REST base)
 *  - `.recon/pretty/playapp/1w8d13szpogkp.js` (module 111243 use: `(0, f.b)({room,id,query})`)
 *
 * Original behaviour (kept verbatim where it matters):
 *   host = NEXT_PUBLIC_PARTYKIT_HOST, trimmed; missing host throws
 *     "Missing NEXT_PUBLIC_PARTYKIT_HOST. Set it to your PartyKit host before opening realtime connections."
 *   REST base: strip trailing slashes; already-schemed values pass through; `http` for
 *     127.0.0.1/localhost, otherwise `https`.
 *   Socket protocol: ws only for localhost / 127.0.0.1 / 192.168.* / 10.* / 172.16-31.* /
 *     [::ffff:7f00:1], otherwise wss.
 *
 * Clone default (task B11): `localhost:1999` so the local realtime worker (apps/realtime) is used
 * without env setup. Override with `NEXT_PUBLIC_REALTIME_HOST`.
 */

/**
 * Next.js only inlines *statically referenced* `process.env.NEXT_PUBLIC_*` expressions.
 * Never look env vars up by a computed key here — that silently falls back to the
 * localhost default in the browser build.
 */
const CONFIGURED_REALTIME_HOST = process.env.NEXT_PUBLIC_REALTIME_HOST;
const CONFIGURED_STATIC_ASSET_BASE = process.env.NEXT_PUBLIC_STATIC_ASSET_BASE;
const CONFIGURED_AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_BASE;

export const DEFAULT_REALTIME_HOST = "localhost:1999";

/** Original message thrown when the host is not configured. */
export const MISSING_HOST_MESSAGE =
  "Missing NEXT_PUBLIC_PARTYKIT_HOST. Set it to your PartyKit host before opening realtime connections.";

/** `111243.H` — raw realtime host (no scheme), trimmed. */
export function realtimeHost(): string {
  const raw = (CONFIGURED_REALTIME_HOST ?? DEFAULT_REALTIME_HOST).trim();
  if (raw) return raw;
  throw new Error(MISSING_HOST_MESSAGE);
}

/** `111243.R` — REST base (`http(s)://host`, no trailing slash). */
export function realtimeHttpBase(host: string = realtimeHost()): string {
  const trimmed = host.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const scheme =
    trimmed.startsWith("127.0.0.1") || trimmed.startsWith("localhost") ? "http" : "https";
  return `${scheme}://${trimmed}`;
}

/** `0cvaqmu9022vp.js` URL builder — ws only for local/private hosts. */
export function socketProtocol(host: string): "ws" | "wss" {
  const h = host.replace(/^(http|https|ws|wss):\/\//, "");
  const local =
    h.startsWith("localhost:") ||
    h.startsWith("127.0.0.1:") ||
    h.startsWith("192.168.") ||
    h.startsWith("10.") ||
    (h.startsWith("172.") && h.split(".")[1]! >= "16" && h.split(".")[1]! <= "31") ||
    h.startsWith("[::ffff:7f00:1]:");
  return local ? "ws" : "wss";
}

/**
 * Party socket URL: `protocol://host/parties/<party ?? "main">/<room>?<query>`.
 * (`d()` in `0cvaqmu9022vp.js`.)
 */
export function partyUrl(options: {
  host?: string;
  party?: string;
  room: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  basePath?: string;
  prefix?: string;
}): string {
  const host = (options.host ?? realtimeHost())
    .replace(/^(http|https|ws|wss):\/\//, "")
    .replace(/\/$/, "");
  const party = options.party ?? "main";
  const base = options.basePath ?? `${options.prefix ?? "parties"}/${party}/${options.room}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined) params.append(key, String(value));
  }
  const query = params.toString();
  return `${socketProtocol(host)}://${host}/${base}${query ? `?${query}` : ""}`;
}

/**
 * Static asset base for the copied Riftbound UI assets. The original resolves
 * `/sounds/20260716/<file>` through a static-URL builder against the CDN
 * (`https://assets.riftatlas-workers.com/riftbound/static/...`). The clone ships the assets at
 * `apps/play/public/riftbound/static/...`, so the default is same-origin.
 */
export function staticAssetBase(): string {
  const configured = CONFIGURED_STATIC_ASSET_BASE;
  const base = (configured ?? "/riftbound/static").trim().replace(/\/+$/, "");
  return base;
}

/** Absolute/relative URL for a static asset path (e.g. `sounds/20260716/card_draw1.webm`). */
export function staticAssetUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return `${staticAssetBase()}/${clean}`;
}

/** Auth service base. Defaults to the realtime host (`POST /api/auth/token` per the clone contract). */
export function authBase(): string {
  const configured = CONFIGURED_AUTH_BASE;
  if (configured && configured.trim()) return configured.trim().replace(/\/+$/, "");
  return realtimeHttpBase();
}

/** localStorage keys (original where known — `.recon/reports/01-browser-walkthrough.md` §7). */
export const STORAGE_KEYS = {
  sfxVolume: "riftbound_simulator_sfx_volume:v2",
  sfxVolumeV1: "riftbound_simulator_sfx_volume:v1",
  playMode: "riftbound_simulator_play_mode",
  playerName: "riftbound_simulator_player_name",
  playerNameAccount: "riftbound_simulator_player_name_account",
  lastRoom: "riftbound_simulator_last_room",
  activeRoom: "riftbound_simulator_active_room",
  /** clone-only: persisted guest JWT */
  guestToken: "riftbound_simulator_guest_token_v1",
  /** clone-only: persisted guest display name */
  guestName: "riftbound_simulator_guest_name_v1",
  /** clone-only: Better Auth session token + display identity (opaque token, see runtime/auth.ts) */
  accountSession: "riftbound_simulator_account_session_v1",
} as const;

/** `229172.B`-adjacent transport constants (module 299043 `o.B`). */
export const REALTIME_RECONNECT_BASE_MS = 2000;
export const REALTIME_MESSAGES = {
  connectionFailed: "Realtime room connection failed.",
  connectionLost: "Realtime room connection lost. Reconnecting...",
} as const;

export function isRealtimeConnectionMessage(value: string): boolean {
  return value === REALTIME_MESSAGES.connectionFailed || value === REALTIME_MESSAGES.connectionLost;
}
