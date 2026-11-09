/**
 * Combat keyword profile — Assault 807, Shield 814, Tank 815, Backline 826 (layers 479.3/479.4).
 *
 * Assault and Shield are passive abilities: "While I am an attacker (defender), I have +X [M]"
 * (807.1.c / 814.1.c). Their bonus is therefore part of the unit's Might in the arithmetic layer
 * (`rawMight` adds `designationMightBonus`), not a combat-only adjustment: every consumer of
 * `effectiveMight` (combat totals, lethal checks, "equal to its Might", Mighty) sees it, and it is
 * applied in exactly this one place.
 *
 * Values: the unit's printed keyword (value from `[ASSAULT 2]`, default 1, 807.1.b.3 /
 * 814.1.b.3) plus **every** granted instance (807.2 / 814.2: Petty Officer + "[Assault 3]" =
 * Assault 4). Tank/Backline are redundant (815.2 / 826.5). Removals (801.3.b) drop the keyword.
 *
 * The catalog `keywords` array is incomplete (Stalwart Poro has `[Shield]` only in its text;
 * LeBlanc, Everywhere at Once has `[Backline]` only in its text), so a printed line that *starts*
 * with the keyword marker counts as the unit's own keyword. Caitlyn, Patrolling and Soraka,
 * Wanderer print Backline's functional text ("I must be assigned combat damage last.", 826.3 /
 * 467.2.c.6 example) without the keyword; that printed sentence is the same passive ability.
 * Card names are never consulted.
 *
 * Pure: reads the room only.
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { grantedKeywordInstances, printedKeywordsOf, removedKeywords } from "./index";

/** "[ASSAULT 2]" / "[Shield]" / "[Tank]" at the start of a printed line (the unit's own keyword). */
const KEYWORD_LINE = /^\s*\[\s*(assault|shield|tank|backline)(?:\s+(\d+))?\s*\]/i;
/** A keyword string: "Assault", "Assault 3", "[Shield 2]". */
const KEYWORD_ENTRY = /^\s*\[?\s*(assault|shield|tank|backline)(?:\s*\[?\s*(\d+)\s*\]?)?\s*\]?\s*$/i;
/** 815.1.b / 826.3 functional text printed as a sentence of its own. */
const FIRST_SENTENCE = /^\s*I must be assigned (?:lethal |combat )?damage first\b/i;
const LAST_SENTENCE = /^\s*I must be assigned (?:lethal |combat )?damage last\b/i;

type CombatKeyword = "assault" | "shield" | "tank" | "backline";

export interface CombatKeywordProfile {
  /** 807.1.b.3 / 807.2: summed Assault value (0 = no Assault). */
  assault: number;
  /** 814.1.b.3 / 814.2: summed Shield value (0 = no Shield). */
  shield: number;
  /** 815: must be assigned lethal damage first. */
  tank: boolean;
  /** 826 (or its printed functional text): must be assigned lethal damage last. */
  backline: boolean;
}

/** The printed lines of a card's rules text (flavor text excluded). */
export function printedLines(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^flavor text$/i.test(line));
}

function applyKeyword(profile: CombatKeywordProfile, keyword: CombatKeyword, value: number, mode: "max" | "sum"): void {
  if (keyword === "tank") profile.tank = true;
  else if (keyword === "backline") profile.backline = true;
  else profile[keyword] = mode === "sum" ? profile[keyword] + value : Math.max(profile[keyword], value);
}

/** The unit's printed combat keywords (text lines) — values default to 1 (807.1.b.3/814.1.b.3). */
function printedProfile(text: string | undefined): CombatKeywordProfile {
  const profile: CombatKeywordProfile = { assault: 0, shield: 0, tank: false, backline: false };
  for (const line of printedLines(text)) {
    if (FIRST_SENTENCE.test(line)) profile.tank = true;
    if (LAST_SENTENCE.test(line)) profile.backline = true;
    // A line may chain several keyword markers: "[Shield] ... " then "[Tank] ..." on later lines.
    let rest = line;
    for (let guard = 0; guard < 4; guard += 1) {
      const match = KEYWORD_LINE.exec(rest);
      if (!match) break;
      const value = match[2] ? Number.parseInt(match[2], 10) : 1;
      applyKeyword(profile, match[1]!.toLowerCase() as CombatKeyword, value, "max");
      rest = rest.slice(match[0].length).replace(/^\s*\([^)]*\)\s*/, "");
    }
  }
  return profile;
}

/** 807 / 814 / 815 / 826: the unit's combat keyword profile (printed + every granted instance). */
export function combatKeywordProfile(room: Room, objectId: string, host: RulesHost): CombatKeywordProfile {
  const info = host.cardInfo(room, objectId);
  const profile = printedProfile(info?.text);
  for (const keyword of printedKeywordsOf(room, objectId, host)) {
    const match = KEYWORD_ENTRY.exec(keyword);
    if (!match) continue;
    // The catalog keyword is the same printed instance as the text line: take the max, not the sum.
    applyKeyword(profile, match[1]!.toLowerCase() as CombatKeyword, match[2] ? Number(match[2]) : 1, "max");
  }
  for (const entry of grantedKeywordInstances(room, objectId, host)) {
    const match = KEYWORD_ENTRY.exec(entry.name);
    if (!match) continue;
    const value = entry.value ?? (match[2] ? Number.parseInt(match[2], 10) : 1);
    // 815.2 / 826.5: redundant; 807.2 / 814.2: additional instances are summed.
    applyKeyword(profile, match[1]!.toLowerCase() as CombatKeyword, value, "sum");
  }
  // 801.3.b: a removed keyword is gone, whatever its sources.
  const removed = removedKeywords(room, objectId, host);
  if (removed.has("assault")) profile.assault = 0;
  if (removed.has("shield")) profile.shield = 0;
  if (removed.has("tank")) profile.tank = false;
  if (removed.has("backline")) profile.backline = false;
  return profile;
}

/**
 * 807.1.c / 814.1.c / 807.1.d.1 / 814.1.d.1: +Assault while the unit holds the Attacker
 * designation, +Shield while it holds the Defender designation; 0 otherwise.
 */
export function designationMightBonus(room: Room, objectId: string, host: RulesHost): number {
  const designation = room.rules?.objects[objectId]?.designation;
  if (!designation) return 0;
  const profile = combatKeywordProfile(room, objectId, host);
  return designation === "attacker" ? profile.assault : profile.shield;
}
