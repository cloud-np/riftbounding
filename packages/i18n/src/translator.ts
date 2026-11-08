/**
 * @rift/i18n — compiled next-intl message runtime + translator factory.
 *
 * The simulator ships its EN catalogs in source form (namespaced compiled
 * message trees) and its non-EN catalogs as standalone `{exact, patterns,
 * parts}` compiled catalogs whose keys are generated from the English message
 * text (`<widget>_<fnv1a base36>` — module 93422). This module ports both the
 * renderer (interpolation / select / plural) and the generated-key algorithm,
 * so runtime messages can be localized exactly like the original.
 */

import enData from "../data/i18n-en.json" with { type: "json" };
import frData from "../data/i18n-fr.json" with { type: "json" };
import koData from "../data/i18n-ko.json" with { type: "json" };
import zhData from "../data/i18n-zh-CN.json" with { type: "json" };
import frSentences from "../data/i18n-fr-sentences.json" with { type: "json" };
import koSentences from "../data/i18n-ko-sentences.json" with { type: "json" };
import zhSentences from "../data/i18n-zh-CN-sentences.json" with { type: "json" };

import { intlLocale, normalizeLocale, resolveLocale } from "./locales";
import type { LocaleCode } from "./locales";

/* ------------------------------------------------------------- types */

export type MessageParam = string | number | boolean | null | undefined;
export type MessageParams = Record<string, MessageParam>;

/** A compiled next-intl message node. */
export type CompiledNode = string | number | CompiledNode[] | CompiledArg | CompiledSelector;

/** `["argName"]` */
export type CompiledArg = [name: string];
/** `["argName", 1, options]` (select) or `["argName", 2, options]` (plural). */
export type CompiledSelector = [name: string, type: 1 | 2, options: Record<string, CompiledNode>];

export type MessageTree = Record<string, unknown>;

export interface UiCatalog {
  exact: Record<string, CompiledNode>;
  patterns: Record<string, CompiledNode>;
  parts: Record<string, CompiledNode>;
}

export interface Translator {
  readonly locale: LocaleCode;
  /** Translate a catalog key (dotted paths supported for EN / sentence trees). */
  (key: string, params?: MessageParams): string | null;
  has(key: string): boolean;
  /** Localize an English runtime message using the generated-key catalog. */
  translateText(englishText: string, params?: MessageParams): string | null;
}

/* ------------------------------------------------------------- catalogs */

const EN_UI: MessageTree = (enData as { ui: MessageTree }).ui;
const LOCALIZED_UI: Partial<Record<LocaleCode, UiCatalog>> = {
  fr: (frData as { ui: UiCatalog }).ui,
  ko: (koData as { ui: UiCatalog }).ui,
  "zh-CN": (zhData as { ui: UiCatalog }).ui,
};

const SENTENCE_CATALOGS: Partial<Record<LocaleCode, MessageTree>> = {
  fr: (frSentences as { sentences: MessageTree }).sentences,
  ko: (koSentences as { sentences: MessageTree }).sentences,
  "zh-CN": (zhSentences as { sentences: MessageTree }).sentences,
};

/** EN sentence catalog: literal strings + `$pattern` markers (no render templates). */
export const EN_SENTENCES: Readonly<Record<string, string | { $pattern: true }>> = (
  enData as { sentences: Record<string, string | { $pattern: true }> }
).sentences;

/* ----------------------------------------------------- hash + key index */

/** FNV-1a 32-bit (module 93422). */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x1000193) >>> 0;
  }
  return hash;
}

function base36Padded(value: number): string {
  return value.toString(36).padStart(7, "0");
}

/**
 * The original generated-key algorithm: first ≤6 ASCII alphanumeric words
 * camelCased, then `_<fnv1a(original text) base36>`. Empty → `message_…`.
 */
export function buildCompiledKey(text: string): string {
  const widget = text
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((word) => /^[A-Za-z0-9]+$/u.test(word))
    .slice(0, 6)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join("");
  return `${widget || "message"}_${base36Padded(fnv1a(text))}`;
}

function stripHash(key: string): string {
  return key.replace(/_[a-z0-9]+$/u, "");
}

interface LocalizedIndex {
  exactByFull: Map<string, CompiledNode>;
  exactByWidget: Map<string, CompiledNode>;
  patterns: Map<string, CompiledNode>;
  parts: Map<string, CompiledNode>;
}

const localizedIndexes = new Map<LocaleCode, LocalizedIndex>();

function localizedIndex(locale: LocaleCode): LocalizedIndex | null {
  const catalog = LOCALIZED_UI[locale];
  if (!catalog) return null;
  const cached = localizedIndexes.get(locale);
  if (cached) return cached;
  const exactByFull = new Map<string, CompiledNode>(Object.entries(catalog.exact));
  const exactByWidget = new Map<string, CompiledNode>();
  for (const [key, node] of exactByFull) {
    const widget = stripHash(key);
    if (!exactByWidget.has(widget)) exactByWidget.set(widget, node);
  }
  const index: LocalizedIndex = {
    exactByFull,
    exactByWidget,
    patterns: new Map(Object.entries(catalog.patterns)),
    parts: new Map(Object.entries(catalog.parts)),
  };
  localizedIndexes.set(locale, index);
  return index;
}

/* ------------------------------------------------------------- rendering */

function interpolationValue(value: MessageParam): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

/** Render a compiled message tree. */
export function renderCompiled(
  node: CompiledNode | undefined,
  params: MessageParams = {},
  locale: string = "en",
): string {
  if (node === undefined) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!Array.isArray(node)) return "";
  // A token is either `[name]` (argument) or `[name, 1|2, options]` (selector);
  // every other array is a concatenation of message parts.
  if (node.length === 1 && typeof node[0] === "string") {
    return interpolationValue(params[node[0]]);
  }
  if (node.length === 3 && typeof node[0] === "string" && (node[1] === 1 || node[1] === 2)) {
    const [name, type, options] = node as [string, 1 | 2, Record<string, CompiledNode>];
    if (type === 1) {
      const value = String(params[name] ?? "other");
      const selected = options[value] ?? options.other;
      return selected === undefined ? "" : renderCompiled(selected, params, locale);
    }
    const raw = params[name];
    const numeric = typeof raw === "number" ? raw : Number(raw ?? 0);
    const exact = options[`=${numeric}`] ?? options[`=${raw}`];
    if (exact !== undefined) return renderCompiled(exact, params, locale);
    const category = new Intl.PluralRules(intlLocale(locale)).select(numeric);
    const selected = options[category] ?? options.other;
    return selected === undefined ? "" : renderCompiled(selected, params, locale);
  }
  return node.map((part) => renderCompiled(part as CompiledNode, params, locale)).join("");
}

/** Resolve a dotted path inside a nested message tree. */
export function resolveMessagePath(tree: MessageTree, key: string): unknown {
  if (!key) return undefined;
  if (Object.prototype.hasOwnProperty.call(tree, key)) return tree[key];
  let current: unknown = tree;
  for (const segment of key.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
    if (current === undefined) return undefined;
  }
  return current;
}

function isCompiledNode(value: unknown): value is CompiledNode {
  return typeof value === "string" || Array.isArray(value);
}

/* --------------------------------------------------------- postprocess */

const KO_JOSA: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  "을(를)": ["을", "를"],
  "이(가)": ["이", "가"],
  "은(는)": ["은", "는"],
  "과(와)": ["과", "와"],
  "(으)로": ["으로", "로"],
});

const KO_JOSA_RE = /을\(를\)|이\(가\)|은\(는\)|과\(와\)|\(으\)로/gu;

const KO_DIGIT_FINAL: Readonly<Record<string, number>> = Object.freeze({
  "1": 8,
  "2": 0,
  "3": 16,
  "4": 0,
  "5": 0,
  "6": 1,
  "7": 8,
  "8": 8,
  "9": 0,
});

/** Final-consonant index (0 = none) for Korean particle selection. */
function koFinalConsonant(context: string): number | null {
  const cleaned = context.trim().replace(/["'”’」』]+$/u, "");
  if (!cleaned) return null;
  const code = cleaned.slice(-1).charCodeAt(0);
  if (code >= 44032 && code <= 55203) return (code - 44032) % 28;
  const digits = /(\d+)$/u.exec(cleaned)?.[1];
  if (!digits) return null;
  const last = digits.slice(-1);
  if (last !== "0") return KO_DIGIT_FINAL[last] ?? null;
  const significant = digits.replace(/^0+/u, "");
  if (!significant) return 21;
  const trailingZeros = significant.length - significant.replace(/0+$/u, "").length;
  return trailingZeroesToFinal(trailingZeros);
}

function trailingZeroesToFinal(zeros: number): number {
  return zeros === 1 ? 17 : zeros === 2 ? 1 : 4;
}

/** Korean particle post-processing (`을(를)` → 을/를). */
export function postProcessKorean(text: string): string {
  return text.replace(KO_JOSA_RE, (match, offset: number, full: string) => {
    const pair = KO_JOSA[match];
    const final = koFinalConsonant(full.slice(0, offset));
    if (!pair || final === null) return match;
    const [consonant, vowel] = pair;
    return match === "(으)로"
      ? final === 0 || final === 8
        ? vowel
        : consonant
      : final === 0
        ? vowel
        : consonant;
  });
}

const FR_VOWEL_RE = /^[aeiouyàâéèêëîïôûAEIOUYÀÂÉÈÊËÎÏÔÛ]/u;

/** French elision/contraction params (`name` → `nameDe` / `nameA`). */
export function deriveFrenchParams(params: MessageParams): MessageParams {
  const derived: MessageParams = { ...params };
  for (const [name, value] of Object.entries(params)) {
    if (typeof value !== "string") continue;
    derived[`${name}De`] = /^le\s/u.test(value)
      ? `du ${value.slice(3)}`
      : /^les\s/u.test(value)
        ? `des ${value.slice(4)}`
        : /^(?:la\s|l’)/u.test(value)
          ? `de ${value}`
          : FR_VOWEL_RE.test(value)
            ? `d’${value}`
            : `de ${value}`;
    derived[`${name}A`] = /^le\s/u.test(value)
      ? `au ${value.slice(3)}`
      : /^les\s/u.test(value)
        ? `aux ${value.slice(4)}`
        : `à ${value}`;
  }
  return derived;
}

export interface PostProcessor {
  deriveParams?: (params: MessageParams) => MessageParams;
  postProcess?: (text: string) => string;
}

/** Module 137427 — per-locale parameter derivation + post-processing. */
export const POST_PROCESSORS: Readonly<Partial<Record<LocaleCode, PostProcessor>>> = Object.freeze({
  "zh-CN": {},
  fr: { deriveParams: deriveFrenchParams },
  ko: { postProcess: postProcessKorean },
});

/* --------------------------------------------------------- translators */

function lookupLocalized(locale: LocaleCode, key: string): CompiledNode | undefined {
  const index = localizedIndex(locale);
  if (!index) return undefined;
  if (index.exactByFull.has(key)) return index.exactByFull.get(key);
  if (key.startsWith("exact.")) {
    const rest = key.slice(6);
    if (index.exactByFull.has(rest)) return index.exactByFull.get(rest);
    if (index.exactByWidget.has(stripHash(rest))) return index.exactByWidget.get(stripHash(rest));
  }
  if (index.patterns.has(key)) return index.patterns.get(key);
  if (key.startsWith("patterns.")) {
    const rest = key.slice(9);
    if (index.patterns.has(rest)) return index.patterns.get(rest);
  }
  if (key.startsWith("parts.")) {
    const rest = key.slice(6);
    if (index.parts.has(rest)) return index.parts.get(rest);
  }
  if (index.parts.has(key)) return index.parts.get(key);
  const widget = stripHash(key);
  if (index.exactByWidget.has(widget)) return index.exactByWidget.get(widget);
  return undefined;
}

function lookupEnglish(key: string): CompiledNode | undefined {
  const direct = resolveMessagePath(EN_UI, key);
  if (isCompiledNode(direct)) return direct;
  // allow sub-namespace keys without an explicit namespace prefix
  for (const namespace of Object.keys(EN_UI)) {
    const nested = resolveMessagePath(EN_UI, `${namespace}.${key}`);
    if (isCompiledNode(nested)) return nested;
  }
  return undefined;
}

function createTranslatorFor(locale: LocaleCode, messages: MessageTree | null): Translator {
  const processor = POST_PROCESSORS[locale];
  const english: Translator | null = locale === "en" ? null : createTranslatorFor("en", null);

  const t = (key: string, params: MessageParams = {}): string | null => {
    let node: unknown;
    if (messages) node = resolveMessagePath(messages, key);
    else if (locale === "en") node = lookupEnglish(key);
    else node = lookupLocalized(locale, key);
    if (!isCompiledNode(node)) {
      if (english) return english(key, params);
      return null;
    }
    const effective = processor?.deriveParams ? processor.deriveParams(params) : params;
    const rendered = renderCompiled(node, effective, locale);
    if (!rendered) return null;
    return processor?.postProcess ? processor.postProcess(rendered) : rendered;
  };

  const translator = t as Translator;
  Object.defineProperty(translator, "locale", { value: locale, enumerable: true });
  translator.has = (key: string): boolean => {
    if (messages) return isCompiledNode(resolveMessagePath(messages, key));
    if (locale === "en") return isCompiledNode(lookupEnglish(key));
    if (isCompiledNode(lookupLocalized(locale, key))) return true;
    return english ? english.has(key) : false;
  };
  translator.translateText = (englishText: string, params: MessageParams = {}): string | null => {
    if (locale === "en") return englishText;
    const generated = buildCompiledKey(englishText);
    const node =
      lookupLocalized(locale, `exact.${generated}`) ?? lookupLocalized(locale, generated);
    if (!isCompiledNode(node)) return englishText;
    const effective = processor?.deriveParams ? processor.deriveParams(params) : params;
    const rendered = renderCompiled(node, effective, locale);
    if (!rendered) return englishText;
    return processor?.postProcess ? processor.postProcess(rendered) : rendered;
  };
  return translator;
}

/** `createTranslator(locale)` — UI catalog translator with EN fallback. */
export function createTranslator(locale: string | null | undefined): Translator {
  return createTranslatorFor(resolveLocale(locale), null);
}

/** `createMessageTranslator(locale, messages)` — nested compiled message tree. */
export function createMessageTranslator(
  locale: string | null | undefined,
  messages: MessageTree,
): Translator {
  const normalized = resolveLocale(locale);
  const translator = createTranslatorFor(normalized, messages);
  // fall back to the locale's UI catalog for keys not in this tree?
  return translator;
}

/** The localized sentence catalog (fr/ko/zh-CN) or null for EN. */
export function sentenceCatalog(locale: string | null | undefined): MessageTree | null {
  const normalized = normalizeLocale(locale);
  return normalized ? (SENTENCE_CATALOGS[normalized] ?? null) : null;
}

/** EN sentence literals as a nested message tree (patterns stay unresolved). */
const EN_SENTENCE_TREE: MessageTree = {
  sentence: Object.fromEntries(
    Object.entries(EN_SENTENCES).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ),
};

/** `createSentenceTranslator(locale)` — game-log sentence/phrase/list/label tree. */
export function createSentenceTranslator(locale: string | null | undefined): Translator {
  const normalized = resolveLocale(locale);
  const catalog = SENTENCE_CATALOGS[normalized];
  if (catalog) return createMessageTranslator(normalized, catalog);
  if (normalized === "en") return createMessageTranslator("en", EN_SENTENCE_TREE);
  return createTranslatorFor(normalized, null);
}

/** Convenience: localize one English runtime message (fr/ko/zh-CN). */
export function translateRuntimeMessage(
  locale: string | null | undefined,
  englishText: string,
  params?: MessageParams,
): string {
  return createTranslator(locale).translateText(englishText, params) ?? englishText;
}
