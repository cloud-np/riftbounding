/**
 * @rift/i18n — locale registry and locale helpers.
 *
 * Port of the original locale module (783266 `2smwag0o-c14m.js`) and the
 * pathname/formatting helpers (701804): aliases, route prefixes, label
 * separators, Intl formatting and the `riftbound_locale` cookie string.
 */

export type LocaleCode = "en" | "zh-CN" | "fr" | "ko";

export interface LocaleDefinition {
  code: LocaleCode;
  intl: string;
  openGraph: string;
  nativeName: string;
  pickerLabel: string;
  aliases: readonly string[];
  aliasPrefixes: readonly string[];
  geoCountries: readonly string[];
  script: "Latin" | "Han" | "Hangul";
  labelSeparator: string;
  wordSpace: string;
  sentenceEnd: string;
  ellipsis: string;
  slashSeparator: string;
}

/** `$` — the locale table, exactly as in the bundle. */
export const LOCALES: readonly LocaleDefinition[] = [
  {
    code: "en",
    intl: "en-US",
    openGraph: "en_US",
    nativeName: "English",
    pickerLabel: "EN",
    aliases: [],
    aliasPrefixes: ["en-"],
    geoCountries: [],
    script: "Latin",
    labelSeparator: ": ",
    wordSpace: " ",
    sentenceEnd: ".",
    ellipsis: "...",
    slashSeparator: " / ",
  },
  {
    code: "zh-CN",
    intl: "zh-CN",
    openGraph: "zh_CN",
    nativeName: "简体中文",
    pickerLabel: "简体中文",
    aliases: ["zh", "zh-hans", "zh-sg"],
    aliasPrefixes: ["zh-cn-", "zh-hans-", "zh-sg-"],
    geoCountries: ["CN"],
    script: "Han",
    labelSeparator: "：",
    wordSpace: "",
    sentenceEnd: "。",
    ellipsis: "…",
    slashSeparator: "／",
  },
  {
    code: "fr",
    intl: "fr-FR",
    openGraph: "fr_FR",
    nativeName: "Français",
    pickerLabel: "FR",
    aliases: [],
    aliasPrefixes: ["fr-"],
    geoCountries: [],
    script: "Latin",
    labelSeparator: "\u00a0: ",
    wordSpace: " ",
    sentenceEnd: ".",
    ellipsis: "…",
    slashSeparator: " / ",
  },
  {
    code: "ko",
    intl: "ko-KR",
    openGraph: "ko_KR",
    nativeName: "한국어",
    pickerLabel: "한국어",
    aliases: [],
    aliasPrefixes: ["ko-"],
    geoCountries: [],
    script: "Hangul",
    labelSeparator: ": ",
    wordSpace: " ",
    sentenceEnd: ".",
    ellipsis: "…",
    slashSeparator: " / ",
  },
] as const;

/** `k` — the default locale code. */
export const DEFAULT_LOCALE: LocaleCode = "en";

/** `r` — non-default locale codes in table order. */
export const NON_DEFAULT_LOCALES: readonly LocaleCode[] = Object.freeze(
  LOCALES.map((locale) => locale.code).filter((code): code is LocaleCode => code !== "en"),
);

const BY_CODE = new Map(LOCALES.map((locale) => [locale.code, locale]));

export function getLocaleDefinition(code: string): LocaleDefinition | undefined {
  const normalized = normalizeLocale(code);
  return normalized ? BY_CODE.get(normalized) : undefined;
}

/** `n` — normalize an arbitrary tag to a supported locale code (or null). */
export function normalizeLocale(code: string | null | undefined): LocaleCode | null {
  const value = code?.trim().toLowerCase();
  if (!value) return null;
  for (const locale of LOCALES) {
    if (
      value === locale.code.toLowerCase() ||
      locale.aliases.includes(value) ||
      locale.aliasPrefixes.some((prefix) => value.startsWith(prefix))
    ) {
      return locale.code;
    }
  }
  return null;
}

/** `p` — route prefix regex (non-default locales). */
export const LOCALE_ROUTE_PATTERN = `(?:${NON_DEFAULT_LOCALES.map((locale) =>
  locale.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
).join("|")})`;

/** `W` — locale prefix for a path (`en` has no prefix). */
export function localePrefix(code: string): string {
  const normalized = normalizeLocale(code) ?? DEFAULT_LOCALE;
  return normalized === "en" ? "" : `/${normalized}`;
}

/** `g` — is this a non-default locale code? */
export function isNonDefaultLocale(code: unknown): code is LocaleCode {
  return typeof code === "string" && (NON_DEFAULT_LOCALES as readonly string[]).includes(code);
}

/** `f` — split a pathname into `{locale, pathname}` using the route prefix. */
export function localeFromPathname(pathname: string): {
  locale: LocaleCode | null;
  pathname: string;
} {
  const match = new RegExp(`^/(${LOCALE_ROUTE_PATTERN})(?=/|$)`, "u").exec(pathname);
  return match
    ? { locale: match[1] as LocaleCode, pathname: pathname.slice(match[0].length) || "/" }
    : { locale: null, pathname };
}

/**
 * `p` (second) — robust pathname splitter: decode the first segment, normalize
 * aliases, and strip it when it is a supported locale.
 */
export function parseLocalizedPathname(pathname: string): {
  locale: LocaleCode | null;
  pathname: string;
} {
  if (!pathname.startsWith("/")) return { locale: null, pathname };
  const [first = "", ...rest] = pathname.slice(1).split("/");
  let decoded = first;
  try {
    decoded = decodeURIComponent(first);
  } catch {
    return { locale: null, pathname };
  }
  const locale = normalizeLocale(decoded);
  return locale ? { locale, pathname: `/${rest.join("/")}` } : { locale: null, pathname };
}

/** `h`/`x` — strip a locale prefix from a pathname. */
export function stripLocalePrefix(pathname: string): string {
  return parseLocalizedPathname(pathname).pathname;
}

const ABSOLUTE_URL_RE = /^https?:\/\//i;
const PROTOCOL_RELATIVE_RE = /^\/\//;
const SCHEME_RE = /^[a-z][a-z\d+.-]*:/i;

/**
 * `m`/`k` — add (or replace) the locale prefix of a URL/path. Absolute URLs,
 * protocol-relative URLs, hashes and non-http schemes are handled like the
 * original.
 */
export function localizeUrl(url: string, locale: string = DEFAULT_LOCALE): string {
  if (
    !url ||
    url.startsWith("#") ||
    (SCHEME_RE.test(url) && !ABSOLUTE_URL_RE.test(url) && !PROTOCOL_RELATIVE_RE.test(url))
  ) {
    return url;
  }
  const absolute = ABSOLUTE_URL_RE.test(url);
  const protocolRelative = PROTOCOL_RELATIVE_RE.test(url);
  const rootRelative = url.startsWith("/") && !protocolRelative;
  if (!absolute && !protocolRelative && !rootRelative) return url;
  let parsed: URL;
  try {
    parsed = new URL(url, "https://riftbound.local");
  } catch {
    return url;
  }
  const normalized = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  const pathname = stripLocalePrefix(parsed.pathname) || "/";
  parsed.pathname =
    normalized !== "en"
      ? pathname === "/"
        ? `/${normalized}`
        : `/${normalized}${pathname}`
      : pathname;
  if (absolute) return parsed.toString();
  if (protocolRelative) return `//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** `_` — localized path from pathname + search + hash. */
export function localizedPath(
  pathname: string,
  search = "",
  hash = "",
  locale: string = DEFAULT_LOCALE,
): string {
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  const fragment = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  return localizeUrl(`${pathname || "/"}${query}${fragment}`, locale);
}

/* ------------------------------------------------------------ formatting */

const intlByLocale = new Map(LOCALES.map((locale) => [locale.code, locale.intl]));

/** `s`/`b` — normalize a locale or fall back to `en`. */
export function resolveLocale(
  code: string | null | undefined,
  fallback: LocaleCode = DEFAULT_LOCALE,
): LocaleCode {
  return normalizeLocale(code) ?? fallback;
}

/** `d`/`h` — the Intl locale string. */
export function intlLocale(code: string | null | undefined): string {
  return intlByLocale.get(resolveLocale(code)) ?? "en-US";
}

const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

/** `f` — cached `Intl.DateTimeFormat`. */
export function dateFormatter(
  code: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const intl = intlLocale(code);
  const key = `${intl}|${JSON.stringify(options ?? {})}`;
  let formatter = dateFormatCache.get(key);
  if (!formatter) {
    if (dateFormatCache.size >= 64) dateFormatCache.clear();
    formatter = new Intl.DateTimeFormat(intl, options);
    dateFormatCache.set(key, formatter);
  }
  return formatter;
}

export function formatDate(
  value: Date | number,
  locale: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  return dateFormatter(locale, options).format(value);
}

export function formatList(
  values: Iterable<string>,
  locale: string | null | undefined,
  options?: Intl.ListFormatOptions,
): string {
  return new Intl.ListFormat(intlLocale(locale), options).format(values);
}

export function formatNumber(
  value: number,
  locale: string | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatTime(
  value: Date | number,
  locale: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  return dateFormatter(locale, { hour: "2-digit", minute: "2-digit", ...options }).format(value);
}

/** `G` — the `riftbound_locale` cookie string. */
export function localeCookie(
  code: string,
  options: { hostname?: string; secure?: boolean } = {},
): string {
  const parts = [`riftbound_locale=${code}`, "Path=/", "Max-Age=31536000", "SameSite=Lax"];
  const hostname = options.hostname?.trim().toLowerCase().replace(/\.$/u, "");
  const domain =
    hostname === "riftatlas.com" || hostname?.endsWith(".riftatlas.com") ? "riftatlas.com" : null;
  if (domain) parts.push(`Domain=${domain}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

/** `geoCountries` → locale (CN → zh-CN). */
export function localeForCountry(country: string | null | undefined): LocaleCode | null {
  const value = country?.trim().toUpperCase();
  if (!value) return null;
  return LOCALES.find((locale) => locale.geoCountries.includes(value))?.code ?? null;
}

export const pickerLabels: Readonly<Record<LocaleCode, string>> = Object.freeze(
  Object.fromEntries(LOCALES.map((locale) => [locale.code, locale.pickerLabel])) as Record<
    LocaleCode,
    string
  >,
);

/** Locale `<option>` values, in picker order. */
export const LOCALE_OPTIONS: readonly { value: LocaleCode; label: string; lang: string }[] =
  LOCALES.map((locale) => ({
    value: locale.code,
    label: locale.pickerLabel,
    lang: locale.code,
  }));
