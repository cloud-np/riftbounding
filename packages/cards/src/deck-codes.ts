/**
 * @rift/cards — deck code encode/decode.
 *
 * Exact port of the original deck-code modules (54080 / 673361, chunk
 * `2nqp-vipvdxlj.js`): base32 bit-packing, format nibble 1, versions 1–6,
 * SET_MAP/VARIANT_MAP, `R`/`SP` number prefixes, chosen champion + additional
 * legends, plus the UI glue that classifies a decoded pool into decklist
 * sections and infers the champion.
 */

import { getCardById, getCardByName, getCardsByNameAll, isChampionForLegend } from "./catalog";
import {
  championMatchesLegend,
  exportDeckText,
  hasMultipleLegends,
  sectionDisplayName,
} from "./deck-text";
import { SET_MAP, VARIANT_MAP } from "./types";
import type { Card, DeckCodeEntry, DeckSections, ParsedDeckEntry } from "./types";

/* ------------------------------------------------------------ varints */

/** Module 477443 — the original little varint translator. */
export class VarintTranslator {
  static readonly AllButMSB = 0x7f;
  static readonly JustMSB = 0x80;

  private bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = new Uint8Array(bytes);
  }

  get length(): number {
    return this.bytes.length;
  }

  PopVarint(): number {
    if (this.bytes.length === 0) throw new Error("No bytes available to read varint");
    let value = 0;
    let shift = 0;
    let consumed = 0;
    for (let index = 0; index < this.bytes.length; index += 1) {
      consumed += 1;
      value |= ((this.bytes[index] ?? 0) & VarintTranslator.AllButMSB) << shift;
      if (((this.bytes[index] ?? 0) & VarintTranslator.JustMSB) !== VarintTranslator.JustMSB) {
        this.bytes = this.bytes.slice(consumed);
        return value;
      }
      shift += 7;
    }
    throw new Error("Byte array did not contain valid varints.");
  }

  sliceAndSet(start: number, end?: number): void {
    this.bytes = this.bytes.slice(start, end);
  }

  get(index: number): number {
    if (index < 0 || index >= this.bytes.length) throw new Error(`Index out of bounds: ${index}`);
    return this.bytes[index] ?? 0;
  }

  static GetVarint(value: number): Uint8Array {
    const out = new Uint8Array(10);
    let length = 0;
    if (value === 0) return new Uint8Array([0]);
    while (value !== 0) {
      let byte = value & VarintTranslator.AllButMSB;
      value >>>= 7;
      if (value !== 0) byte |= VarintTranslator.JustMSB;
      out[length++] = byte;
    }
    return out.slice(0, length);
  }
}

/* ------------------------------------------------------------- base32 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) {
    buffer <<= 5 - bits;
    out += BASE32_ALPHABET[31 & buffer];
  }
  return out;
}

function decodeBase32(code: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of code) {
    const index = BASE32_ALPHABET.indexOf(char.toUpperCase());
    if (index === -1) throw new Error(`Invalid character in deck code: '${char}'`);
    buffer = (buffer << 5) | index;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 255);
    }
  }
  return new Uint8Array(out);
}

/* ------------------------------------------------------ card code parts */

interface CardCodeParts {
  set: string;
  number: string;
  variant: string;
}

/** `d` — split `SET-NUMBERvariant` into its parts. */
function parseCardCodeParts(cardCode: string): CardCodeParts {
  const parts = cardCode.split("-");
  if (parts.length !== 2) {
    throw new Error(`Invalid card code format: ${cardCode}. Expected format: SET-NUMBERvariant`);
  }
  const set = parts[0] ?? "";
  const numberPart = parts[1] ?? "";
  if (!set || !numberPart) {
    throw new Error(`Invalid card code format: ${cardCode}. Missing set or card number.`);
  }
  const match = numberPart.match(/^((?:R|SP)?\d+)([a-z*]?)$/);
  if (!match) {
    throw new Error(`Invalid card code format: ${cardCode}. Expected format: SET-NUMBERvariant`);
  }
  return { set, number: match[1] ?? "", variant: match[2] ?? "" };
}

/** `l` — variant id → suffix (id 2 → the signed suffix). */
function variantSuffixFromId(id: number, signedSuffix: string, context?: string): string {
  if (id === 2) return signedSuffix;
  const suffix = Object.entries(VARIANT_MAP).find(([, value]) => value === id)?.[0];
  if (suffix === undefined) {
    throw new Error(`Unknown variant code${context ? ` in ${context}` : ""}: ${id}`);
  }
  return suffix;
}

interface GroupedNumbers {
  set: number;
  variant: number;
  cardNumbers: string[];
}

/** `s` — group entries by set+variant, sorted, numbers numerically sorted. */
function groupEntries(entries: readonly DeckCodeEntry[]): GroupedNumbers[] {
  const groups = new Map<string, GroupedNumbers>();
  for (const entry of entries) {
    const { set, number, variant } = parseCardCodeParts(entry.cardCode ?? "");
    const key = `${set}-${variant}`;
    if (!groups.has(key)) {
      const setCode = SET_MAP[set as keyof typeof SET_MAP];
      if (setCode === undefined) {
        throw new Error(`Unknown set: ${set}. Valid sets: ${Object.keys(SET_MAP).join(", ")}`);
      }
      const variantCode = VARIANT_MAP[variant];
      if (variantCode === undefined) {
        throw new Error(
          `Unknown variant: '${variant}'. Valid variants: ${Object.keys(VARIANT_MAP).join(", ")}`,
        );
      }
      groups.set(key, { set: setCode, variant: variantCode, cardNumbers: [] });
    }
    groups.get(key)?.cardNumbers.push(number);
  }
  return Array.from(groups.values())
    .sort((a, b) =>
      a.set !== b.set ? a.set - b.set : a.variant !== b.variant ? a.variant - b.variant : 0,
    )
    .map((group) => ({
      ...group,
      cardNumbers: group.cardNumbers.sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    }));
}

/* --------------------------------------------------------- v1–v4 codecs */

/** `u` — legacy count-bucket encoding (v1–v4). */
function encodeCounts(entries: readonly DeckCodeEntry[], maxCount = 12, version = 4): number[] {
  const out: number[] = [];
  for (let count = maxCount; count >= 1; count -= 1) {
    const groups = groupEntries(entries.filter((entry) => entry.count === count));
    out.push(...VarintTranslator.GetVarint(groups.length));
    for (const group of groups) {
      out.push(...VarintTranslator.GetVarint(group.cardNumbers.length));
      out.push(group.set);
      out.push(group.variant);
      for (const number of group.cardNumbers) {
        if (version >= 4) {
          if (number.startsWith("R")) {
            out.push(1);
            out.push(...VarintTranslator.GetVarint(Number.parseInt(number.slice(1))));
          } else {
            out.push(0);
            out.push(...VarintTranslator.GetVarint(Number.parseInt(number)));
          }
        } else {
          out.push(...VarintTranslator.GetVarint(Number.parseInt(number)));
        }
      }
    }
  }
  return out;
}

/** `c` — legacy count-bucket decoding (v1–v4). */
function decodeCounts(
  reader: VarintTranslator,
  maxCount = 12,
  signedSuffix = "s",
  version = 4,
): DeckCodeEntry[] {
  const out: DeckCodeEntry[] = [];
  for (let count = maxCount; count >= 1; count -= 1) {
    const groupCount = reader.PopVarint();
    for (let group = 0; group < groupCount; group += 1) {
      const numberCount = reader.PopVarint();
      const setByte = reader.get(0);
      const variantByte = reader.get(1);
      reader.sliceAndSet(2);
      const setCode = Object.entries(SET_MAP).find(([, value]) => value === setByte)?.[0];
      if (!setCode) throw new Error(`Unknown set code: ${setByte}`);
      const variant = variantSuffixFromId(variantByte, signedSuffix);
      for (let index = 0; index < numberCount; index += 1) {
        let number: string;
        if (version >= 4) {
          const prefix = reader.get(0);
          reader.sliceAndSet(1);
          const value = reader.PopVarint();
          number =
            prefix === 1
              ? `R${value.toString().padStart(2, "0")}`
              : value.toString().padStart(3, "0");
        } else {
          number = reader.PopVarint().toString().padStart(3, "0");
        }
        out.push({ cardCode: `${setCode}-${number}${variant}`, count });
      }
    }
  }
  return out;
}

/* --------------------------------------------------------- v5+ codecs */

/** `f` — count-group encoding (v5+). */
function encodeCountGroups(entries: readonly DeckCodeEntry[], prefixFlag: boolean): number[] {
  const out: number[] = [];
  const counts = Array.from(
    new Set(entries.filter((entry) => entry.count >= 1).map((entry) => entry.count)),
  ).sort((a, b) => b - a);
  out.push(...VarintTranslator.GetVarint(counts.length));
  for (const count of counts) {
    out.push(...VarintTranslator.GetVarint(count));
    const groups = groupEntries(entries.filter((entry) => entry.count === count));
    out.push(...VarintTranslator.GetVarint(groups.length));
    for (const group of groups) {
      out.push(...VarintTranslator.GetVarint(group.cardNumbers.length));
      out.push(group.set);
      out.push(group.variant);
      for (const number of group.cardNumbers) {
        if (prefixFlag) {
          if (number.startsWith("SP")) {
            out.push(2);
            out.push(...VarintTranslator.GetVarint(Number.parseInt(number.slice(2))));
          } else if (number.startsWith("R")) {
            out.push(1);
            out.push(...VarintTranslator.GetVarint(Number.parseInt(number.slice(1))));
          } else {
            out.push(0);
            out.push(...VarintTranslator.GetVarint(Number.parseInt(number)));
          }
        } else {
          out.push(...VarintTranslator.GetVarint(Number.parseInt(number)));
        }
      }
    }
  }
  return out;
}

/** `m` — count-group decoding (v5+). */
function decodeCountGroups(
  reader: VarintTranslator,
  signedSuffix = "s",
  prefixFlag = true,
): DeckCodeEntry[] {
  const out: DeckCodeEntry[] = [];
  const countGroups = reader.PopVarint();
  for (let groupIndex = 0; groupIndex < countGroups; groupIndex += 1) {
    const count = reader.PopVarint();
    const setGroups = reader.PopVarint();
    for (let setIndex = 0; setIndex < setGroups; setIndex += 1) {
      const numberCount = reader.PopVarint();
      const setByte = reader.get(0);
      const variantByte = reader.get(1);
      reader.sliceAndSet(2);
      const setCode = Object.entries(SET_MAP).find(([, value]) => value === setByte)?.[0];
      if (!setCode) throw new Error(`Unknown set code: ${setByte}`);
      const variant = variantSuffixFromId(variantByte, signedSuffix);
      for (let index = 0; index < numberCount; index += 1) {
        let number: string;
        if (!prefixFlag) {
          number = reader.PopVarint().toString().padStart(3, "0");
          out.push({ cardCode: `${setCode}-${number}${variant}`, count });
          continue;
        }
        const prefix = reader.get(0);
        reader.sliceAndSet(1);
        const value = reader.PopVarint();
        if (prefix === 2) number = `SP${value}`;
        else if (prefix === 1) number = `R${value.toString().padStart(2, "0")}`;
        else if (prefix === 0) number = value.toString().padStart(3, "0");
        else throw new Error(`Unknown number-prefix flag: ${prefix}`);
        out.push({ cardCode: `${setCode}-${number}${variant}`, count });
      }
    }
  }
  return out;
}

/* ----------------------------------------------------- champion codecs */

/** `h` — encode a single champion/legend code. */
function encodeChampionCode(cardCode: string, prefixFlag: boolean, context: string): number[] {
  const { set, number, variant } = parseCardCodeParts(cardCode);
  const setCode = SET_MAP[set as keyof typeof SET_MAP];
  if (setCode === undefined) {
    throw new Error(
      `Unknown set in ${context}: ${set}. Valid sets: ${Object.keys(SET_MAP).join(", ")}`,
    );
  }
  const variantCode = VARIANT_MAP[variant];
  if (variantCode === undefined) {
    throw new Error(
      `Unknown variant in ${context}: '${variant}'. Valid variants: ${Object.keys(VARIANT_MAP).join(", ")}`,
    );
  }
  const out = [setCode, variantCode];
  if (prefixFlag && number.startsWith("SP")) {
    out.push(2, ...VarintTranslator.GetVarint(Number.parseInt(number.slice(2))));
  } else if (prefixFlag && number.startsWith("R")) {
    out.push(1, ...VarintTranslator.GetVarint(Number.parseInt(number.slice(1))));
  } else {
    if (prefixFlag) out.push(0);
    out.push(...VarintTranslator.GetVarint(Number.parseInt(number)));
  }
  return out;
}

/** `p` — decode a single champion/legend code. */
function decodeChampionCode(
  reader: VarintTranslator,
  prefixFlag: boolean,
  signedSuffix: string,
  context: string,
): string {
  let number: string;
  const setByte = reader.get(0);
  const variantByte = reader.get(1);
  reader.sliceAndSet(2);
  if (prefixFlag) {
    const prefix = reader.get(0);
    reader.sliceAndSet(1);
    const value = reader.PopVarint();
    if (prefix === 2) number = `SP${value}`;
    else if (prefix === 1) number = `R${value.toString().padStart(2, "0")}`;
    else if (prefix === 0) number = value.toString().padStart(3, "0");
    else throw new Error(`Unknown number-prefix flag in ${context}: ${prefix}`);
  } else {
    number = reader.PopVarint().toString().padStart(3, "0");
  }
  const setCode = Object.entries(SET_MAP).find(([, value]) => value === setByte)?.[0];
  if (!setCode) throw new Error(`Unknown set code in ${context}: ${setByte}`);
  const variant = variantSuffixFromId(variantByte, signedSuffix, context);
  return `${setCode}-${number}${variant}`;
}

/* ------------------------------------------------------- public codec */

export interface DeckCodePayload {
  mainDeck: DeckCodeEntry[];
  sideboard: DeckCodeEntry[];
  chosenChampion?: string;
  additionalLegends?: string[];
}

/** `getCodeFromDeck` — encode main/sideboard (+champion/legends) to a deck code. */
export function getCodeFromDeck(
  mainDeck: readonly DeckCodeEntry[],
  sideboard: readonly DeckCodeEntry[] = [],
  chosenChampion?: string,
  additionalLegends: readonly string[] = [],
): string {
  for (const entry of [...mainDeck, ...sideboard]) {
    if (!Number.isSafeInteger(entry.count) || entry.count < 1) {
      throw new Error(
        `Invalid card count for ${entry.cardCode}: ${entry.count}. Count must be a positive integer.`,
      );
    }
  }
  for (const legend of additionalLegends) {
    if (typeof legend !== "string" || legend.length === 0) {
      throw new Error(`Invalid additional legend: ${legend}. Expected a card code string.`);
    }
  }

  const isRune = (code: string) => parseCardCodeParts(code).number.startsWith("R");
  const isSpecial = (code: string) => parseCardCodeParts(code).number.startsWith("SP");
  const hasRune =
    mainDeck.some((entry) => isRune(entry.cardCode ?? "")) ||
    sideboard.some((entry) => isRune(entry.cardCode ?? "")) ||
    (chosenChampion !== undefined && isRune(chosenChampion)) ||
    additionalLegends.some(isRune);
  const maxMainCount = mainDeck.reduce((max, entry) => Math.max(max, entry.count), 0);
  const maxSideCount = sideboard.reduce((max, entry) => Math.max(max, entry.count), 0);
  const hasSpecial =
    mainDeck.some((entry) => isSpecial(entry.cardCode ?? "")) ||
    sideboard.some((entry) => isSpecial(entry.cardCode ?? "")) ||
    (chosenChampion !== undefined && isSpecial(chosenChampion)) ||
    additionalLegends.some(isSpecial);
  const version =
    additionalLegends.length > 0
      ? 6
      : maxMainCount > 12 || maxSideCount > 3 || hasSpecial
        ? 5
        : hasRune
          ? 4
          : 3;
  const prefixFlag = hasRune || hasSpecial;

  const bytes: number[] = [];
  bytes.push(16 | version);
  if (version >= 5) {
    bytes.push(
      prefixFlag ? 1 : 0,
      ...encodeCountGroups(mainDeck, prefixFlag),
      ...encodeCountGroups(sideboard, prefixFlag),
    );
  } else {
    bytes.push(...encodeCounts(mainDeck, 12, version), ...encodeCounts(sideboard, 3, version));
  }
  if (chosenChampion) {
    bytes.push(1, ...encodeChampionCode(chosenChampion, prefixFlag, "chosen champion"));
  } else {
    bytes.push(0);
  }
  if (version >= 6) {
    bytes.push(...VarintTranslator.GetVarint(additionalLegends.length));
    for (const legend of additionalLegends) {
      bytes.push(...encodeChampionCode(legend, prefixFlag, "additional legend"));
    }
  }
  return encodeBase32(new Uint8Array(bytes));
}

/** `getDeckFromCode` — decode a deck code. */
export function getDeckFromCode(
  code: string,
  options: { signedSuffix?: string } = {},
): DeckCodePayload {
  const signedSuffix = options.signedSuffix ?? "s";
  const reader = new VarintTranslator(decodeBase32(code));
  const header = reader.get(0);
  reader.sliceAndSet(1);
  const format = (header >> 4) & 15;
  const version = 15 & header;
  if (format !== 1) throw new Error(`Unsupported format: ${format}. Expected format: 1`);
  if (version > 6) throw new Error(`Unsupported version: ${version}. Maximum supported version: 6`);

  let prefixFlag: boolean;
  if (version >= 5) {
    const flag = reader.get(0);
    reader.sliceAndSet(1);
    if (flag > 1) throw new Error(`Unsupported deck prefix flag: ${flag}`);
    prefixFlag = flag === 1;
  } else {
    prefixFlag = version >= 4;
  }

  let mainDeck: DeckCodeEntry[];
  let sideboard: DeckCodeEntry[] = [];
  if (version >= 5) {
    mainDeck = decodeCountGroups(reader, signedSuffix, prefixFlag);
    sideboard = decodeCountGroups(reader, signedSuffix, prefixFlag);
  } else {
    mainDeck = decodeCounts(reader, 12, signedSuffix, version);
    if (version >= 2) sideboard = decodeCounts(reader, 3, signedSuffix, version);
  }

  let chosenChampion: string | undefined;
  if (version >= 3) {
    const hasChampion = reader.get(0);
    reader.sliceAndSet(1);
    if (hasChampion === 1)
      chosenChampion = decodeChampionCode(reader, prefixFlag, signedSuffix, "champion");
  }

  let additionalLegends: string[] | undefined;
  if (version >= 6) {
    const count = reader.PopVarint();
    additionalLegends = [];
    for (let index = 0; index < count; index += 1) {
      additionalLegends.push(
        decodeChampionCode(reader, prefixFlag, signedSuffix, "additional legend"),
      );
    }
  }

  return { mainDeck, sideboard, chosenChampion, additionalLegends };
}

/* ------------------------------------------------------------- UI glue */

const DECK_CODE_DOMAINS = ["Fury", "Calm", "Mind", "Body", "Chaos", "Order"];

/** `a` (673361) — normalize a user-pasted card code. */
export function normalizeCardCode(code: string): string {
  const trimmed = code.trim();
  const match = trimmed.match(/^([A-Za-z]{2,4})-([Rr]?\d+)([A-Za-z*]?)$/);
  if (!match) return trimmed.toUpperCase();
  const [, set, number, variant = ""] = match;
  const suffix = variant === "*" ? "S" : variant ? variant.toUpperCase() : "";
  return `${(set ?? "").toUpperCase()}-${(number ?? "").toUpperCase()}${suffix}`;
}

/**
 * `(673361 o)` — normalize a catalog id to the code the encoder understands
 * (drops promo `P` suffixes and the signed `C` suffix, keeps `A`/`B`).
 */
export function canonicalEncodableCardCode(id: string, baseCardId: string | undefined): string {
  const trimmed = id.trim();
  const match = trimmed.match(/^([A-Z]{2,4})-([R]?\d+)([AB][PS]|[A-Z*]?)$/i);
  if (!match) return trimmed;
  const [, set, number, variantRaw = ""] = match;
  const variant = variantRaw.toLowerCase();
  const isSignedBasePrint =
    variant === "c" &&
    VARIANT_MAP[variant] === undefined &&
    baseCardId === `${(set ?? "").toUpperCase()}-${(number ?? "").toUpperCase()}`;
  const isPromo = /^(?:[ab]?p)$/.test(variant);
  const suffix = /^[ab]s$/.test(variant)
    ? variant.slice(0, -1)
    : isPromo || isSignedBasePrint
      ? ""
      : variant;
  return `${(set ?? "").toUpperCase()}-${(number ?? "").toUpperCase()}${suffix}`;
}

/** `d` (673361) — resolve a decoded code to a catalog card. */
function resolveDeckCodeCard(code: string): Card {
  const normalized = normalizeCardCode(code);
  const card =
    getCardById(normalized) ??
    (() => {
      const runeDomain = /^[A-Z0-9]{2,4}-R0([1-6])[A-Z]?$/u.exec(normalized)?.[1];
      const domain = runeDomain ? DECK_CODE_DOMAINS[Number(runeDomain) - 1] : undefined;
      return domain ? getCardByName(`${domain} Rune`) : undefined;
    })();
  if (!card) throw new Error(`Unknown card code "${normalized}" in deck code.`);
  return card;
}

/** `l` (673361) — push an entry into a section. */
function pushSectionEntry(
  sections: DeckSections,
  section: keyof DeckSections,
  cardCode: string,
  count: number,
): void {
  const card = resolveDeckCodeCard(cardCode);
  sections[section].push({ count, name: card.name, cardCode: card.id });
}

/** `s` (673361) — merge duplicate decoded entries by catalog id. */
function mergeDecodedEntries(entries: readonly DeckCodeEntry[]): DeckCodeEntry[] {
  const merged = new Map<string, DeckCodeEntry>();
  for (const entry of entries) {
    const id = resolveDeckCodeCard(entry.cardCode ?? "").id;
    const existing = merged.get(id);
    if (existing) {
      existing.count += entry.count;
      continue;
    }
    merged.set(id, { cardCode: id, count: entry.count });
  }
  return [...merged.values()];
}

const WARNING_NO_SINGLE_LEGEND =
  "The decoded deck does not have a single legend to infer the Champion section from, so pick the champion manually after decoding.";
const WARNING_NO_CLEAR_CHAMPION =
  "The decoded deck does not include a clear champion unit for its legend, so pick the champion manually after decoding.";
const WARNING_MULTIPLE_CHAMPIONS =
  "The decoded deck has multiple valid champion units for its legend, so pick the champion manually after decoding.";

/**
 * `decodeDeckCodeToDecklist` — decode a deck code and classify its entries into
 * the decklist sections, inferring the champion from the legend tag.
 */
export function decodeDeckCodeToDecklist(code: string): {
  decklistRaw: string;
  warnings: string[];
} {
  const trimmed = code.trim();
  if (!trimmed) throw new Error("Paste a Riftbound deck code first.");
  const payload = getDeckFromCode(trimmed);
  const warnings: string[] = [];
  const sections: DeckSections = {
    legend: [],
    champion: [],
    mainDeck: [],
    battlefields: [],
    runes: [],
    sideboard: [],
  };

  const mainEntries = mergeDecodedEntries(payload.mainDeck);
  for (const entry of mainEntries) {
    if (entry.count <= 0) continue;
    const card = resolveDeckCodeCard(entry.cardCode ?? "");
    const type = card.type.trim().toLowerCase();
    const section: keyof DeckSections =
      type === "legend"
        ? "legend"
        : type === "battlefield"
          ? "battlefields"
          : type === "rune"
            ? "runes"
            : "mainDeck";
    pushSectionEntry(sections, section, entry.cardCode ?? "", entry.count);
  }
  for (const entry of mergeDecodedEntries(payload.sideboard)) {
    pushSectionEntry(sections, "sideboard", entry.cardCode ?? "", entry.count);
  }

  const legendCount = sections.legend.length;
  for (const legend of payload.additionalLegends ?? []) {
    pushSectionEntry(sections, "legend", legend, 1);
  }

  const chosenLegend =
    legendCount === 1
      ? sections.legend[0]
      : (() => {
          if (sections.legend.length <= 1) return sections.legend[0];
          const card = payload.chosenChampion
            ? getCardById(normalizeCardCode(payload.chosenChampion))
            : undefined;
          if (!card) return undefined;
          const target = { name: card.name, cardCode: card.id };
          const matching = sections.legend.filter((entry) => championMatchesLegend(entry, target));
          return matching.length === 1 ? matching[0] : undefined;
        })();

  if (chosenLegend) {
    sections.legend = [chosenLegend, ...sections.legend.filter((entry) => entry !== chosenLegend)];
    const inferred = inferChampion({
      mainDeckEntries: mainEntries,
      legendCardCode: chosenLegend.cardCode ?? "",
      chosenChampionCardCode: payload.chosenChampion,
    });
    if (inferred.cardCode) {
      const mainEntry = mainEntries.find(
        (entry) => entry.cardCode === inferred.cardCode && entry.count > 0,
      );
      if (mainEntry) {
        mainEntry.count -= 1;
        sections.mainDeck = sections.mainDeck
          .map((entry) =>
            entry.cardCode === inferred.cardCode ? { ...entry, count: entry.count - 1 } : entry,
          )
          .filter((entry) => entry.count > 0);
        pushSectionEntry(sections, "champion", inferred.cardCode, 1);
      }
    } else if (inferred.warning) {
      warnings.push(inferred.warning);
    }
  } else {
    warnings.push(WARNING_NO_SINGLE_LEGEND);
  }

  return { decklistRaw: exportDeckText(sections, { includeCardCodes: true }), warnings };
}

function inferChampion(input: {
  mainDeckEntries: readonly DeckCodeEntry[];
  legendCardCode: string;
  chosenChampionCardCode?: string;
}): { cardCode?: string; warning?: string } {
  const legend = getCardById(input.legendCardCode);
  const tag = legend?.subtypes?.[0]?.trim();
  if (!tag) return { warning: WARNING_NO_SINGLE_LEGEND };
  const candidates = input.mainDeckEntries.filter((entry) => {
    if (entry.count <= 0) return false;
    const card = getCardById(entry.cardCode);
    return !!card && isChampionForLegend(card, tag);
  });
  const chosen = input.chosenChampionCardCode
    ? getCardById(normalizeCardCode(input.chosenChampionCardCode))?.id
    : undefined;
  if (chosen && candidates.some((entry) => entry.cardCode === chosen)) return { cardCode: chosen };
  if (candidates.length === 1) return { cardCode: candidates[0]?.cardCode };
  if (candidates.length === 0) return { warning: WARNING_NO_CLEAR_CHAMPION };
  return { warning: WARNING_MULTIPLE_CHAMPIONS };
}

function encodeSectionEntries(
  section: keyof DeckSections,
  entries: readonly ParsedDeckEntry[],
): ParsedDeckEntry[] {
  return entries.map((entry) => {
    const code = entry.cardCode?.trim();
    const card = code ? getCardById(code) : getCardByName(entry.name);
    if (!card) {
      throw new Error(
        `Cannot encode unrecognized ${sectionDisplayName(section)} entry "${entry.name}"${code ? ` (${code})` : ""}.`,
      );
    }
    const encodable = (candidate: Card) =>
      SET_MAP[candidate.id.split("-", 1)[0] as keyof typeof SET_MAP] !== undefined;
    const resolved = encodable(card)
      ? card
      : (getCardsByNameAll(card.name).find(
          (candidate) => candidate.type === card.type && encodable(candidate),
        ) ?? card);
    return {
      count: entry.count,
      name: resolved.name,
      cardCode: canonicalEncodableCardCode(resolved.id, resolved.baseCardId),
    };
  });
}

/** `encodeDecklistToDeckCode` — the inverse of `decodeDeckCodeToDecklist`. */
export function encodeDecklistToDeckCode(deck: { sections: DeckSections }): string {
  const champion = deck.sections.champion[0];
  const chosenChampion = champion
    ? encodeSectionEntries("champion", [champion])[0]?.cardCode
    : undefined;
  const legends = encodeSectionEntries("legend", deck.sections.legend);
  const additional = hasMultipleLegends(deck.sections) ? legends.slice(1) : [];
  const main = legends
    .slice(0, legends.length - additional.length)
    .concat(encodeSectionEntries("champion", deck.sections.champion))
    .concat(encodeSectionEntries("mainDeck", deck.sections.mainDeck))
    .concat(encodeSectionEntries("battlefields", deck.sections.battlefields))
    .concat(encodeSectionEntries("runes", deck.sections.runes));
  const sideboard = encodeSectionEntries("sideboard", deck.sections.sideboard);
  return additional.length > 0
    ? getCodeFromDeck(
        main,
        sideboard,
        chosenChampion,
        additional.map((entry) => entry.cardCode ?? ""),
      )
    : getCodeFromDeck(main, sideboard, chosenChampion);
}
