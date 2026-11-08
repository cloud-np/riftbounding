/**
 * @rift/cards — card/static asset URL builders.
 *
 * Ports of the original client modules:
 *  - 957423 (`1ixua9twvm95a.js`) — base URL normalisation, `toStaticUrl`,
 *    `buildCardImageUrl`, `buildResponsiveSrc`, width buckets, resize allow-list,
 *    the `/asset-fallback` proxy pair and the cdn-cgi transform builders;
 *  - 928748 (`123h3ohyw0ag5.js`) — the 3-candidate locale fallback list;
 *  - 718355 — the asset URL sanitizer (allow-list);
 *  - 926062 — logical image slot → asset size bucket;
 *  - 582436 — token-art → card-art candidate swap;
 *  - 3z6_mkb37q-85 (`D`) — inline keyword icon candidates.
 */

import assetManifestFile from "../data/asset-manifest.json" with { type: "json" };
import cardImageRevisionsFile from "../data/card-image-revisions.json" with { type: "json" };

import { TOKEN_ART, TOKEN_CARD_IDS } from "./tokens";
import { SLOT_TO_SIZE } from "./types";
import type { ImageSlot, ImageSlotSize } from "./types";

/* ------------------------------------------------------------------ data */

/** `d` — `"<ID>.webp"` → 16-hex revision (1509 entries). */
export const CARD_IMAGE_REVISIONS: Readonly<Record<string, string>> = cardImageRevisionsFile;

/** `N`/`z` (module 633272) — `static/<path>` → revision (187 entries). */
export const ASSET_MANIFEST: Readonly<Record<string, string>> = assetManifestFile;

/** `t` (module 633272) — frozen manifest key list. */
export const ASSET_MANIFEST_KEYS: readonly string[] = Object.freeze(Object.keys(ASSET_MANIFEST));

/* ------------------------------------------------------- configuration */

const DEFAULT_CARDS_BASE = "https://assets.riftatlas-workers.com/riftbound/cards";
const DEFAULT_STATIC_BASE = "https://assets.riftatlas-workers.com/riftbound/static";

let cardsBaseUrl = DEFAULT_CARDS_BASE;
let staticBaseUrl = DEFAULT_STATIC_BASE;

/** Configure the asset hosts (NEXT_PUBLIC_CARD_ASSET_BASE equivalent). */
export function configureAssetBases(bases: { cardsBase?: string; staticBase?: string } = {}): void {
  if (bases.cardsBase !== undefined) cardsBaseUrl = normalizeBaseUrl(bases.cardsBase);
  if (bases.staticBase !== undefined) staticBaseUrl = normalizeBaseUrl(bases.staticBase);
}

/** `L`/`N` — the current cards base. */
export function getCardsBase(): string {
  return cardsBaseUrl;
}

/** `w` — the current static base. */
export function getStaticBase(): string {
  return staticBaseUrl;
}

/* ------------------------------------------------------------- internals */

const ABSOLUTE_URL_RE = /^https?:\/\//i;
const SLOT_SIZE = "small-v2";
const SLOTS: ReadonlySet<string> = new Set([SLOT_SIZE, "original"]);
const LOCALE_SEGMENT_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu;
const VW_RE = /(^|\s)(1?\d?\d)vw/g;
const IMAGE_EXT_RE = /\.(?:jpe?g|png|webp)$/i;
const MANIFEST_KEYS_SET: ReadonlySet<string> = new Set(ASSET_MANIFEST_KEYS);

const NON_RESIZE_KEYS: ReadonlySet<string> = new Set(["guide-banners/challenger-tcg-partner.webp"]);

/** `G` — the resize-eligible static paths. */
export const RESIZE_ELIGIBLE_KEYS: ReadonlySet<string> = new Set([
  "Discord-Symbol-Black.png",
  "Discord-Symbol-White.png",
  "ads/tcgplayer-international-shipping-skyscraper.jpeg",
  "auto_pay-poster.webp",
  "bmc-logo-no-background.png",
  "board.webp",
  "cardback-black-landscape.png",
  "cardback-black.png",
  "cardback-blue.png",
  "cardback-white.png",
  "effects/rewind-clock-face-v1.webp",
  "point-node-outline.png",
  "rewind-poster.webp",
  "showdown-poster.webp",
  "tcgplayer-logo-primary-white.png",
  ...ASSET_MANIFEST_KEYS.filter(
    (key) =>
      !NON_RESIZE_KEYS.has(key) &&
      (key.startsWith("brand/rift-atlas/") ||
        key.startsWith("guide-banners/") ||
        key.startsWith("sealed/") ||
        key.startsWith("sets/")),
  ),
  ...ASSET_MANIFEST_KEYS.filter((key) => key.startsWith("tokens/")),
]);

/** `f` — the 2x buckets. */
export const WIDTH_BUCKETS_2X: readonly number[] = Object.freeze([640, 768, 1024, 1280, 1536]);

/** `p` — all width buckets (1x + 2x). */
export const WIDTH_BUCKETS: readonly number[] = Object.freeze([
  96,
  128,
  192,
  256,
  320,
  384,
  512,
  ...WIDTH_BUCKETS_2X,
]);

/** `a` (module 957423) — the same-origin fallback path prefix. */
export const ASSET_FALLBACK_PREFIX = "/asset-fallback";

/** `R` — normalize a base URL: empty → default cards base; "/" stays; trailing slashes stripped. */
export function normalizeBaseUrl(base: string): string {
  const trimmed = base.trim();
  if (trimmed.length === 0) return DEFAULT_CARDS_BASE;
  if (trimmed === "/") return trimmed;
  return trimmed.replace(/\/+$/, "");
}

/**
 * `l` — normalize a managed relative path: strip query/hash, leading slashes,
 * a leading `cards/` segment and a leading `small-v2|original` segment.
 */
export function managedRelativePath(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return "";
  const path = (trimmed.split(/[?#]/u, 1)[0] ?? "").replace(/^\/+/, "");
  const parts = (path.startsWith("cards/") ? path.slice(6) : path).split("/").filter(Boolean);
  if (parts.length === 0) return "";
  if (SLOTS.has(parts[0] ?? "")) parts.shift();
  return parts.join("/");
}

function searchOf(url: string): string {
  try {
    return new URL(url).search;
  } catch {
    const question = url.indexOf("?");
    if (question < 0) return "";
    const hash = url.indexOf("#", question);
    return url.slice(question, hash < 0 ? undefined : hash);
  }
}

/**
 * `U` — managed-relative path for a source string, or null when the source is
 * not a managed asset path. Absolute URLs only resolve when the base is an
 * absolute URL and the source lives under it; `"/"` bases reject slot-prefixed
 * same-origin paths (those are treated as static, not card, paths).
 */
export function resolveManagedPath(src: string, base: string = getCardsBase()): string | null {
  const value = src.trim();
  if (!value) return null;
  if (ABSOLUTE_URL_RE.test(value)) {
    const normalizedBase = normalizeBaseUrl(base);
    try {
      const url = new URL(value);
      if (normalizedBase !== "/") {
        const baseUrl = new URL(normalizedBase);
        const prefix = `${baseUrl.pathname.replace(/\/$/, "")}/`;
        if (url.origin === baseUrl.origin && url.pathname.startsWith(prefix)) {
          return managedRelativePath(url.pathname.slice(prefix.length));
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  }
  if (value.startsWith("/") && !value.startsWith("/cards/")) {
    const normalizedBase = normalizeBaseUrl(base);
    const parts = (value.split(/[?#]/u, 1)[0] ?? "").replace(/^\/+/, "").split("/").filter(Boolean);
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    if (!(
      normalizedBase === "/" &&
      (SLOTS.has(first) || (LOCALE_SEGMENT_RE.test(first) && SLOTS.has(second)))
    )) {
      return null;
    }
  }
  return managedRelativePath(value);
}

interface ResolvedAsset {
  assetBaseUrl: string;
  sourceUrl: string;
}

/** `F` — build `{assetBaseUrl, sourceUrl}` for a managed path + slot + base. */
export function resolveCardAsset(input: {
  src: string;
  managedRelativePath: string;
  slot: string;
  assetBaseUrl: string;
}): ResolvedAsset {
  const parts = input.managedRelativePath.split("/").filter(Boolean);
  const locale =
    LOCALE_SEGMENT_RE.test(parts[0] ?? "") && SLOTS.has(parts[1] ?? "") && !(parts.length < 3)
      ? { assetPathSegment: parts[0] ?? "", relativePath: parts.slice(2).join("/") }
      : null;
  const assetBaseUrl = locale
    ? input.assetBaseUrl === "/"
      ? `/${locale.assetPathSegment}`
      : `${input.assetBaseUrl}/${locale.assetPathSegment}`
    : input.assetBaseUrl;
  const relative = locale?.relativePath ?? input.managedRelativePath;

  const normalizedBase = normalizeBaseUrl(assetBaseUrl);
  const managed = managedRelativePath(relative);
  let sourceUrl = "";
  if (managed) {
    const path =
      normalizedBase === "/"
        ? `/${input.slot}/${managed}`
        : `${normalizedBase}/${input.slot}/${managed}`;
    const revision = CARD_IMAGE_REVISIONS[managed];
    sourceUrl = revision ? `${path}?v=${revision}` : path;
  }
  if (locale && sourceUrl) {
    sourceUrl = `${sourceUrl.split(/[?#]/u, 1)[0]}${searchOf(input.src)}`;
  }
  return { assetBaseUrl, sourceUrl };
}

/** `u` — static base derived from a cards base. */
export function staticBaseFromCardsBase(base: string): string {
  const normalized = normalizeBaseUrl(base);
  if (normalized === "/") return "/static";
  if (normalized.endsWith("/cards")) return `${normalized.slice(0, -6)}/static`;
  return getStaticBase();
}

/** `V` — manifest key for a static asset source, or null. */
export function staticKeyOf(src: string): string | null {
  const value = src.trim();
  if (!value || value.startsWith("data:") || ABSOLUTE_URL_RE.test(value)) return null;
  const key = (value.split(/[?#]/u, 1)[0] ?? "").replace(/^\/+/, "");
  return key && MANIFEST_KEYS_SET.has(key) ? key : null;
}

/** `E`/`h` — static asset URL: `"${staticBase}/${key}?v=${revision}"`. */
export function toStaticUrl(src: string, assetBaseUrl: string = getCardsBase()): string {
  const value = src.trim();
  const key = staticKeyOf(value);
  if (!key) return value;
  const base = staticBaseFromCardsBase(assetBaseUrl);
  return `${base}/${key}?v=${ASSET_MANIFEST[key]}`;
}

/* ------------------------------------------------ self-hosted static copy */

const DEFAULT_PUBLIC_STATIC_BASE = "/riftbound/static";
let publicStaticBase = DEFAULT_PUBLIC_STATIC_BASE;

/** Configure the self-hosted static UI asset base (default `/riftbound/static`). */
export function configureStaticAssetBase(base: string): void {
  const trimmed = base.trim();
  publicStaticBase = trimmed.length > 0 ? trimmed.replace(/\/+$/, "") : DEFAULT_PUBLIC_STATIC_BASE;
}

/** The current self-hosted static UI asset base. */
export function getStaticAssetBase(): string {
  return publicStaticBase;
}

/**
 * `staticAsset(path)` — URL for a static UI asset served from our own app
 * (`apps/play/public/riftbound/static/...`). Revisions come from the asset
 * manifest; unknown paths are returned under the base unchanged.
 */
export function staticAsset(path: string): string {
  const value = path.trim();
  if (!value) return "";
  const key =
    value
      .replace(/^\/+/, "")
      .replace(/^riftbound\/static\//, "")
      .split(/[?#]/u, 1)[0] ?? "";
  const revision = ASSET_MANIFEST[key];
  return revision ? `${publicStaticBase}/${key}?v=${revision}` : `${publicStaticBase}/${key}`;
}

/** `g` — positive-integer guard used by the width/quality helpers. */
function positiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const truncated = Math.trunc(value);
  return truncated > 0 ? truncated : null;
}

/** `m` — quality clamp 75..92 with default fallback. */
export function qualityOf(value: unknown, fallback: number): number {
  return Math.min(
    92,
    Math.max(75, (typeof value === "number" ? positiveInt(value) : null) ?? fallback),
  );
}

/** `v` — width bucket: first bucket ≥ requested, else the largest (1536). */
export function widthBucket(width: unknown): number | null {
  const value = positiveInt(width);
  if (value === null) return null;
  return (
    WIDTH_BUCKETS.find((bucket) => bucket >= value) ??
    WIDTH_BUCKETS[WIDTH_BUCKETS.length - 1] ??
    null
  );
}

/**
 * `h`/`M` — responsive static-asset source: manifest-resolvable image assets in
 * the resize allow-list get a `cdn-cgi/image` transform with `onerror=redirect`.
 */
export function buildStaticResponsiveSrc(input: {
  src: string;
  width?: number;
  quality?: number;
  assetBaseUrl?: string;
}): string {
  const base = input.assetBaseUrl ?? getCardsBase();
  const value = input.src.trim();
  const key = (() => {
    const direct = staticKeyOf(value);
    if (direct || !ABSOLUTE_URL_RE.test(value)) return direct;
    try {
      const url = new URL(value);
      for (const candidate of new Set([staticBaseFromCardsBase(base), getStaticBase()])) {
        if (candidate.startsWith("/")) continue;
        const candidateUrl = new URL(candidate);
        const prefix = `${candidateUrl.pathname.replace(/\/$/u, "")}/`;
        if (url.origin === candidateUrl.origin && url.pathname.startsWith(prefix)) {
          return staticKeyOf(url.pathname.slice(prefix.length));
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  })();
  if (!key) return value;
  const sourceUrl = toStaticUrl(value, base);
  if (!(IMAGE_EXT_RE.test(key) && RESIZE_ELIGIBLE_KEYS.has(key))) return sourceUrl;
  const bucket = widthBucket(input.width);
  if (bucket === null) return sourceUrl;
  const transform = `width=${bucket},quality=${qualityOf(input.quality, 75)},format=auto,fit=scale-down,onerror=redirect`;
  try {
    const url = new URL(sourceUrl, "https://local.riftatlas.invalid");
    if (url.origin === "https://local.riftatlas.invalid") {
      return `/cdn-cgi/image/${transform}${url.pathname}${url.search}`;
    }
    return `${url.origin}/cdn-cgi/image/${transform}${url.pathname}${url.search}`;
  } catch {
    return sourceUrl;
  }
}

/** `y` — the catalog-load URL rewriter (`imageUrl` → absolute static URL). */
export function buildOriginalAssetUrl(src: string | undefined | null): string {
  const value = src?.trim();
  if (!value) return "";
  if (value.startsWith("data:")) return value;
  const managed = resolveManagedPath(value);
  if (!managed) return value;
  return resolveCardAsset({
    src: value,
    managedRelativePath: managed,
    slot: "original",
    assetBaseUrl: normalizeBaseUrl(getCardsBase()),
  }).sourceUrl;
}

/**
 * `o` — card art URL: `${cardsBase}[/locale]/${slot}/${id}.webp?v=<rev>`.
 * The slot is passed verbatim (callers map logical slots via `slotToSize`).
 */
export function buildCardImageUrl(src: string | undefined | null, slot: string): string {
  const value = src?.trim();
  if (!value) return "";
  if (value.startsWith("data:")) return value;
  const managed = resolveManagedPath(value);
  if (!managed) return value;
  return resolveCardAsset({
    src: value,
    managedRelativePath: managed,
    slot,
    assetBaseUrl: normalizeBaseUrl(getCardsBase()),
  }).sourceUrl;
}

/**
 * `O` — responsive source for any card/static asset:
 *  1. static-asset route when the path is a resize-eligible manifest key;
 *  2. managed card path → `slot = bucket ≤ 384 ? small-v2 : original` and a
 *     transform without `onerror=redirect`.
 */
export function buildResponsiveSrc(input: {
  src: string;
  width?: number;
  quality?: number;
  assetBaseUrl?: string;
}): string {
  const staticResult = buildStaticResponsiveSrc(input);
  if (staticResult !== input.src.trim()) return staticResult;

  const value = input.src.trim();
  if (!value || value.startsWith("data:")) return value;
  const base = normalizeBaseUrl(input.assetBaseUrl ?? getCardsBase());
  const managed = resolveManagedPath(value, base);
  if (!managed) return value;
  const bucket = widthBucket(input.width);
  const transform =
    bucket === null
      ? null
      : `width=${bucket},quality=${qualityOf(input.quality, 75)},format=auto,fit=scale-down`;
  const { assetBaseUrl, sourceUrl } = resolveCardAsset({
    src: value,
    managedRelativePath: managed,
    slot: bucket !== null && bucket <= 384 ? SLOT_SIZE : "original",
    assetBaseUrl: base,
  });
  if (!transform || !sourceUrl) return sourceUrl || value;
  if (assetBaseUrl.startsWith("/")) return `/cdn-cgi/image/${transform}${sourceUrl}`;
  try {
    const baseUrl = new URL(assetBaseUrl);
    const url = new URL(sourceUrl);
    const path = `${url.pathname}${url.search}`;
    return `${baseUrl.origin}/cdn-cgi/image/${transform}${path}`;
  } catch {
    return sourceUrl;
  }
}

/** `f` — width buckets for an inline style with `vw` units (2x-oriented). */
export function responsiveWidthsFromStyle(style: string): number[] {
  const widths: number[] = [];
  for (const match of style.matchAll(VW_RE)) widths.push(Number.parseInt(match[2] ?? "", 10));
  if (widths.length === 0) return [...WIDTH_BUCKETS];
  const smallest = 0.01 * Math.min(...widths);
  return WIDTH_BUCKETS.filter((bucket) => bucket >= (WIDTH_BUCKETS_2X[0] ?? 0) * smallest);
}

/* ------------------------------------------------- asset URL sanitizer */

const SANITIZER_CARDS_PATH_RE =
  /^\/riftbound\/cards\/(?:zh-CN\/)?(?:original|small-v2)\/[A-Z]{3}-[A-Z0-9]+\.webp$/u;
const SANITIZER_TRANSFORM_RE =
  /^width=\d{1,4},quality=\d{2},format=(?:auto|webp|avif),fit=scale-down(?:,onerror=redirect)?$/u;

/** `$` (module 718355) — the asset loader allow-list. Returns null when rejected. */
export function sanitizeAssetUrl(url: string): string | null {
  if (url.length > 1024) return null;
  try {
    const parsed = new URL(url);
    const origin = new URL(getStaticBase()).origin;
    if (parsed.origin !== origin || parsed.username || parsed.password) return null;
    let pathname = parsed.pathname;
    if (pathname.startsWith("/cdn-cgi/image/")) {
      const end = pathname.indexOf("/", 15);
      if (!SANITIZER_TRANSFORM_RE.test(pathname.slice(15, end))) return null;
      pathname = pathname.slice(end);
    }
    const isStatic =
      pathname.startsWith("/riftbound/static/") && MANIFEST_KEYS_SET.has(pathname.slice(18));
    if (!SANITIZER_CARDS_PATH_RE.test(pathname) && !isStatic) return null;
    const revision = parsed.searchParams.get("v");
    return `${parsed.origin}${parsed.pathname}${revision && /^[a-f0-9]{8,64}$/iu.test(revision) ? `?v=${revision}` : ""}`;
  } catch {
    return null;
  }
}

/* --------------------------------------------- same-origin asset proxy */

/** `R` (export) — rewrite a CDN asset URL to the same-origin `/asset-fallback` path. */
export function toAssetFallbackUrl(src: string, base: string = getCardsBase()): string | null {
  const namespace = namespaceOf(normalizeBaseUrl(base));
  if (!namespace) return null;
  try {
    const url = new URL(src);
    if (url.origin !== namespace.origin || !url.pathname.startsWith(`/${namespace.namespace}/`))
      return null;
    return `${ASSET_FALLBACK_PREFIX}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/** `V` (export) — inverse of `toAssetFallbackUrl` (proxy path → CDN URL). */
export function fromAssetFallbackUrl(src: string, base: string = getCardsBase()): string | null {
  const normalizedBase = normalizeBaseUrl(base);
  const namespace = namespaceOf(normalizedBase);
  if (!namespace) return null;
  let pathname: string;
  let search: string;
  try {
    const url = new URL(src, "https://app.riftatlas.invalid");
    pathname = url.pathname;
    search = url.search;
  } catch {
    return null;
  }
  const prefix = `${ASSET_FALLBACK_PREFIX}/${namespace.namespace}/`;
  return pathname.startsWith(prefix)
    ? `${namespace.origin}${pathname.slice(ASSET_FALLBACK_PREFIX.length)}${search}`
    : null;
}

function namespaceOf(base: string): { origin: string; namespace: string } | null {
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const namespace = url.pathname.split("/").filter(Boolean)[0];
    return namespace ? { origin: url.origin, namespace } : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------- locale publication */

export interface LocaleImageManifest {
  schemaVersion: number;
  assetPathSegment: string;
  publishedSets: Map<string, Set<string>>;
  assetRevisions: Map<string, string>;
  englishAssetCardIds: Map<string, string>;
  localizedAssetCardIds: Map<string, string>;
}

export interface CardArtPublication {
  status:
    "not-requested" | "missing-print-identity" | "data-not-loaded" | "published" | "not-published";
  cardId: string | null;
  assetCardId: string | null;
  englishAssetCardId: string | null;
  assetPathSegment: string | null;
  assetRevision: string | null;
}

export type PublicationResolver = (cardId: string, locale: string) => CardArtPublication;

const localeManifests = new Map<string, LocaleImageManifest>();

const CARD_ID_RE = /^[A-Z]{3}-[A-Z0-9]+$/u;
const REVISION_RE = /^[a-f0-9]{16}$/u;

/**
 * Parse + validate a schema-v2 locale image manifest (module 928748's
 * `isValidLocaleManifest`). Returns null when the manifest is malformed.
 */
export function parseLocaleImageManifest(
  locale: string,
  manifest: unknown,
): LocaleImageManifest | null {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return null;
  const record = manifest as Record<string, unknown>;
  if (record.schemaVersion !== 2) return null;
  if (record.assetPathSegment !== locale) return null;
  const publishedSetsRaw = record.publishedSets;
  if (!publishedSetsRaw || typeof publishedSetsRaw !== "object" || Array.isArray(publishedSetsRaw))
    return null;
  const publishedIds = new Set<string>();
  const publishedSets = new Map<string, Set<string>>();
  for (const [setCode, ids] of Object.entries(publishedSetsRaw as Record<string, unknown>)) {
    if (!/^[A-Z]{3}$/u.test(setCode) || !Array.isArray(ids)) return null;
    const set = new Set<string>();
    for (const id of ids) {
      if (
        typeof id !== "string" ||
        !CARD_ID_RE.test(id) ||
        !id.startsWith(`${setCode}-`) ||
        publishedIds.has(id)
      ) {
        return null;
      }
      publishedIds.add(id);
      set.add(id);
    }
    publishedSets.set(setCode, set);
  }
  const revisionsRaw = record.assetRevisions;
  if (!revisionsRaw || typeof revisionsRaw !== "object" || Array.isArray(revisionsRaw)) return null;
  const revisionEntries = Object.entries(revisionsRaw as Record<string, unknown>);
  if (
    revisionEntries.length !== publishedIds.size ||
    !revisionEntries.every(
      ([id, rev]) => publishedIds.has(id) && typeof rev === "string" && REVISION_RE.test(rev),
    )
  ) {
    return null;
  }
  const englishRaw = record.englishAssetCardIds;
  if (englishRaw !== undefined) {
    if (typeof englishRaw !== "object" || englishRaw === null || Array.isArray(englishRaw))
      return null;
    for (const [id, value] of Object.entries(englishRaw as Record<string, unknown>)) {
      if (
        !publishedIds.has(id) ||
        typeof value !== "string" ||
        !CARD_ID_RE.test(value) ||
        value === id
      )
        return null;
    }
  }
  const localizedRaw = record.localizedAssetCardIds;
  if (localizedRaw !== undefined) {
    if (typeof localizedRaw !== "object" || localizedRaw === null || Array.isArray(localizedRaw))
      return null;
    for (const [id, value] of Object.entries(localizedRaw as Record<string, unknown>)) {
      if (
        !CARD_ID_RE.test(id) ||
        typeof value !== "string" ||
        !CARD_ID_RE.test(value) ||
        id === value ||
        id.split("-", 1)[0] !== value.split("-", 1)[0] ||
        publishedIds.has(id) ||
        !publishedIds.has(value)
      ) {
        return null;
      }
    }
  }
  return {
    schemaVersion: 2,
    assetPathSegment: record.assetPathSegment,
    publishedSets,
    assetRevisions: new Map(revisionEntries as Array<[string, string]>),
    englishAssetCardIds: new Map(Object.entries((englishRaw ?? {}) as Record<string, string>)),
    localizedAssetCardIds: new Map(Object.entries((localizedRaw ?? {}) as Record<string, string>)),
  };
}

/** Register locale image manifests (fr / ko / zh-CN). */
export function setLocaleImageManifests(manifests: Record<string, unknown>): void {
  for (const [locale, manifest] of Object.entries(manifests)) {
    const parsed = parseLocaleImageManifest(locale, manifest);
    if (parsed) localeManifests.set(locale, parsed);
  }
}

/** The default publication resolver over registered locale manifests. */
export const defaultPublicationResolver: PublicationResolver = (cardId, locale) => {
  const normalized = normalizeLocaleTag(locale);
  const requested = normalized && normalized !== "en" ? normalized : null;
  if (!requested) {
    return {
      status: "not-requested",
      cardId: null,
      assetCardId: null,
      englishAssetCardId: null,
      assetPathSegment: null,
      assetRevision: null,
    };
  }
  const print = cardId?.trim().toUpperCase() || null;
  if (!print) {
    return {
      status: "missing-print-identity",
      cardId: null,
      assetCardId: null,
      englishAssetCardId: null,
      assetPathSegment: null,
      assetRevision: null,
    };
  }
  const manifest = localeManifests.get(requested);
  if (!manifest) {
    return {
      status: "data-not-loaded",
      cardId: print,
      assetCardId: null,
      englishAssetCardId: null,
      assetPathSegment: null,
      assetRevision: null,
    };
  }
  const setCode = print.split("-", 1)[0];
  const published = !!setCode && manifest.publishedSets.get(setCode)?.has(print) === true;
  const assetCardId = published ? print : (manifest.localizedAssetCardIds.get(print) ?? null);
  if (!assetCardId) {
    return {
      status: "not-published",
      cardId: print,
      assetCardId: null,
      englishAssetCardId: null,
      assetPathSegment: null,
      assetRevision: null,
    };
  }
  return {
    status: "published",
    cardId: print,
    assetCardId,
    englishAssetCardId: published ? (manifest.englishAssetCardIds.get(print) ?? print) : print,
    assetPathSegment: manifest.assetPathSegment,
    assetRevision: manifest.assetRevisions.get(assetCardId) ?? null,
  };
};

const CARD_FILE_RE = /^([A-Z]{3}-[A-Z0-9]+)\.webp$/iu;

const KNOWN_LOCALES = ["en", "zh-CN", "fr", "ko"] as const;

/** Locale tag normalizer (canonical case for the four supported locales). */
function normalizeLocaleTag(locale: string | null | undefined): string | null {
  const trimmed = locale?.trim().toLowerCase();
  if (!trimmed) return null;
  return KNOWN_LOCALES.find((known) => known.toLowerCase() === trimmed) ?? null;
}

/**
 * `x` (module 928748) — the card image candidate list:
 *  1. the localized print (when the locale publishes it),
 *  2. the English `small-v2` (or requested slot) URL,
 *  3. the `original` URL as the last fallback.
 */
export function buildCardImageCandidates(input: {
  src?: string | null;
  slot?: string;
  locale?: string;
  cardId?: string;
  imageLocale?: string;
  fallbackSrc?: string | null;
  publicationResolver?: PublicationResolver;
}): { candidates: string[]; candidateLocales: Array<string | null> } {
  const slot = input.slot ?? "original";
  const source = input.src?.trim() || null;
  const englishUrl = source ? buildCardImageUrl(source, slot) : null;
  const resolver = input.publicationResolver ?? defaultPublicationResolver;
  const requestedLocale = normalizeLocaleTag(input.locale);

  let localizedUrl: string | null = null;
  if (source) {
    const publication = resolver(input.cardId ?? "", requestedLocale ?? "");
    if (
      publication.status === "published" &&
      publication.assetCardId &&
      publication.englishAssetCardId &&
      publication.assetPathSegment &&
      publication.assetRevision
    ) {
      const base = getCardsBase();
      const prefix = base === "/" ? `/${slot}/` : `${base}/${slot}/`;
      const relative =
        englishUrl && englishUrl.startsWith(prefix)
          ? englishUrl.slice(prefix.length).split(/[?#]/u, 1)[0]
          : null;
      const fileId = relative?.split("/").at(-1)?.match(CARD_FILE_RE)?.[1]?.toUpperCase() ?? null;
      if (fileId === publication.englishAssetCardId) {
        const localizedBase =
          base === "/"
            ? `/${encodeURIComponent(publication.assetPathSegment)}`
            : `${base}/${encodeURIComponent(publication.assetPathSegment)}`;
        localizedUrl = `${localizedBase}/${slot}/${encodeURIComponent(publication.assetCardId)}.webp?v=${encodeURIComponent(publication.assetRevision)}`;
      }
    }
  }

  const fallbackSrc = input.fallbackSrc === undefined ? "/placeholder.svg" : input.fallbackSrc;
  const fallback = fallbackSrc ? toStaticUrl(fallbackSrc) : null;
  const candidates = new Map<string, string | null>();
  for (const [url, locale] of [
    [localizedUrl, requestedLocale],
    [englishUrl, normalizeLocaleTag(input.imageLocale) ?? "en"],
    [fallback, null],
  ] as Array<[string | null, string | null]>) {
    if (url && !candidates.has(url)) candidates.set(url, locale);
  }
  return {
    candidates: Array.from(candidates.keys()),
    candidateLocales: Array.from(candidates.values()),
  };
}

/** `F` (module 928748) — which locale a displayed candidate URL belongs to. */
export function candidateLocaleOf(
  result: { candidates: string[]; candidateLocales: Array<string | null> },
  src: string | null | undefined,
): string | null {
  if (!src) return null;
  const value = fromAssetFallbackUrl(src) ?? src;
  const normalized = buildCardImageUrl(toStaticUrl(value), "original");
  const index = result.candidates.findIndex(
    (candidate) => buildCardImageUrl(toStaticUrl(candidate), "original") === normalized,
  );
  return result.candidateLocales[index] ?? null;
}

/** `d` — strip query/hash. */
function stripQuery(url: string): string {
  return url.split(/[?#]/u, 1)[0] ?? "";
}

/**
 * `f` (module 582436) — token-art → card-art candidate swap. When the source
 * is a physical token image that maps to a catalog print, the print's
 * candidates are prepended (minus its default slot URL).
 */
export function withTokenArtCandidates(input: {
  src?: string | null;
  slot?: string;
  locale?: string;
  cardId?: string;
  imageLocale?: string;
  fallbackSrc?: string | null;
  publicationResolver?: PublicationResolver;
}): { candidates: string[]; candidateLocales: Array<string | null> } {
  const base = buildCardImageCandidates(input);
  if (!input.src) return base;
  const src = input.src.trim();
  const tokenMatch = src.match(/\/tokens\/(?:thumbs\/)?([A-Za-z]+)\.webp(?:[?#].*)?$/u);
  let cardId: string | null = null;
  if (tokenMatch?.[1]) {
    const mapped = TOKEN_ART[tokenMatch[1]];
    if (mapped) {
      const tokenPath = stripQuery(tokenMatch[0]);
      if (stripQuery(toStaticUrl(src)) === stripQuery(toStaticUrl(tokenPath))) cardId = mapped;
    }
  }
  if (!cardId) {
    const idMatch = src.match(/\/([A-Z]{3}-[A-Z0-9]+)\.webp(?:[?#].*)?$/u)?.[1];
    if (
      idMatch &&
      TOKEN_CARD_IDS.has(idMatch) &&
      stripQuery(buildCardImageUrl(src, "original")) ===
        stripQuery(buildCardImageUrl(`/cards/${idMatch}.webp`, "original"))
    ) {
      cardId = idMatch;
    }
  }
  if (!cardId) return base;
  const tokenCardSrc = `/cards/${cardId}.webp`;
  const swapped = buildCardImageCandidates({
    ...input,
    src: tokenCardSrc,
    cardId,
    fallbackSrc: null,
  });
  const defaultUrl = buildCardImageUrl(tokenCardSrc, input.slot ?? "original");
  const extra = swapped.candidates.filter((candidate) => candidate !== defaultUrl);
  const candidates = [...new Set([...extra, ...base.candidates])];
  return {
    candidates,
    candidateLocales: candidates.map((candidate) => {
      if (extra.includes(candidate)) {
        return swapped.candidateLocales[swapped.candidates.indexOf(candidate)] ?? null;
      }
      return base.candidateLocales[base.candidates.indexOf(candidate)] ?? null;
    }),
  };
}

/* ------------------------------------------------------------ misc helpers */

/** `m` (module 926062) — logical image slot → asset size bucket. */
export function slotToSize(slot: ImageSlot): ImageSlotSize {
  return SLOT_TO_SIZE[slot];
}

/**
 * `D` (module 3z6_mkb37q-85) — inline keyword icon candidates, filtered to
 * manifest-resolvable static assets.
 */
export function keywordIconCandidates(
  token: string,
  options: { includeBaseFallback?: boolean } = {},
): string[] {
  const underscored = token.toLowerCase().replace(/\s+/g, "_");
  const baseName = underscored.replace(/_\d+$/, "");
  const includeBaseFallback = options.includeBaseFallback ?? true;
  const candidates = [
    `/icons/${underscored}.${/^\d+$/.test(underscored) ? "svg" : "webp"}`,
    `/icons/${underscored}.svg`,
  ];
  if (includeBaseFallback) candidates.push(`/icons/${baseName}.webp`, `/icons/${baseName}.svg`);
  return Array.from(new Set(candidates)).flatMap((candidate) => {
    const resolved = toStaticUrl(candidate);
    return resolved === candidate ? [] : [resolved];
  });
}
