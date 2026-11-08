/**
 * Combat keywords — Assault 807, Shield 814, Tank 815, Backline 826; 143.2.c, 424.1.b.
 *
 * Keywords are read from the layers (`effectiveKeywords`, 475–479) plus the unit's own printed
 * keyword lines. The catalog `keywords` array is incomplete (e.g. Stalwart Poro has `[Shield]`
 * only in its text; LeBlanc, Everywhere at Once has `[Backline]` only in its text), so a printed
 * line that *starts* with the keyword marker counts as the unit's own keyword. Caitlyn,
 * Patrolling and Soraka, Wanderer print Backline's functional text ("I must be assigned combat
 * damage last.", 826.3 / 467.2.c.6 example) without the keyword; that printed sentence is the
 * same passive ability and is read here too. Card names are never consulted.
 *
 * Pure: reads the room only.
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { effectiveKeywords, effectiveMight } from "../layers";

/** "[ASSAULT 2]" / "[Shield]" / "[Tank]" at the start of a printed line (the unit's own keyword). */
const KEYWORD_LINE = /^\s*\[\s*(assault|shield|tank|backline)(?:\s+(\d+))?\s*\]/i;
/** A keyword string from the layers: "Assault", "Assault 3", "[Shield 2]". */
const KEYWORD_ENTRY = /^\s*\[?\s*(assault|shield|tank|backline)(?:\s*\[?\s*(\d+)\s*\]?)?\s*\]?\s*$/i;
/** 815.1.b / 826.3 functional text printed as a sentence of its own. */
const FIRST_SENTENCE = /^\s*I must be assigned (?:lethal |combat )?damage first\b/i;
const LAST_SENTENCE = /^\s*I must be assigned (?:lethal |combat )?damage last\b/i;
/** Printed passive "I don't deal combat damage." (unconditional sentence only). */
const NO_COMBAT_DAMAGE_SENTENCE = /(?:^|[.!?]\s+)I don['’]t deal combat damage\.(?:\s|$)/i;

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

function printedLines(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^flavor text$/i.test(line));
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
      const keyword = match[1]!.toLowerCase() as CombatKeyword;
      const value = match[2] ? Number.parseInt(match[2], 10) : 1;
      applyKeyword(profile, keyword, value, "max");
      rest = rest.slice(match[0].length).replace(/^\s*\([^)]*\)\s*/, "");
    }
  }
  return profile;
}

function applyKeyword(
  profile: CombatKeywordProfile,
  keyword: CombatKeyword,
  value: number,
  mode: "max" | "sum",
): void {
  if (keyword === "tank") profile.tank = true;
  else if (keyword === "backline") profile.backline = true;
  else profile[keyword] = mode === "sum" ? profile[keyword] + value : Math.max(profile[keyword], value);
}

/**
 * 807 / 814 / 815 / 826: the unit's combat keyword profile.
 *
 * - Printed: the unit's own keyword lines (value from `[ASSAULT 2]`, default 1) and the bare
 *   catalog keywords (value 1 when the text gives none).
 * - Granted: every valued entry the layers report beyond the printed ones is **added**
 *   (807.2 / 814.2: Petty Officer + "[Assault 3]" = Assault 4). A bare granted "Assault" adds 1.
 */
export function combatKeywordProfile(room: Room, objectId: string, host: RulesHost): CombatKeywordProfile {
  const info = host.cardInfo(room, objectId);
  const profile = printedProfile(info?.text);
  const printedKeywords = new Set((info?.keywords ?? []).map((keyword) => keyword.toLowerCase()));
  for (const keyword of printedKeywords) {
    const match = KEYWORD_ENTRY.exec(keyword);
    if (!match) continue;
    // The catalog keyword is the same printed instance as the text line: take the max, not the sum.
    applyKeyword(profile, match[1]!.toLowerCase() as CombatKeyword, match[2] ? Number(match[2]) : 1, "max");
  }
  for (const entry of effectiveKeywords(room, objectId, host)) {
    if (printedKeywords.has(entry.toLowerCase())) continue;
    const match = KEYWORD_ENTRY.exec(entry);
    if (!match) continue;
    const keyword = match[1]!.toLowerCase() as CombatKeyword;
    const value = match[2] ? Number.parseInt(match[2], 10) : 1;
    // 815.2 / 826.5: redundant; 807.2 / 814.2: additional sources are summed.
    applyKeyword(profile, keyword, value, "sum");
  }
  return profile;
}

/**
 * 807.1.c / 814.1.c: "While I am an attacker/defender, I have +X [M]". The bonus only applies
 * while the unit keeps the designation (807.1.d.1 / 814.1.d.1).
 */
export function combatMightBonus(room: Room, objectId: string, host: RulesHost): number {
  const designation = room.rules?.objects[objectId]?.designation;
  if (!designation) return 0;
  const profile = combatKeywordProfile(room, objectId, host);
  return designation === "attacker" ? profile.assault : profile.shield;
}

/**
 * The unit's Might as combat and lethal-damage checks see it: effective Might (143.2, layers)
 * plus the Assault/Shield arithmetic-layer bonus.
 *
 * TODO(R2-combat, merge): Assault/Shield are passive arithmetic-layer abilities (807.1.c,
 * 814.1.c, 433.1.a example). Once R2-effects folds `combatMightBonus` into `effectiveMight`, this
 * must return `effectiveMight` alone; the `[R807.1.c]` tripwire test fails on double counting.
 */
export function combatMight(room: Room, objectId: string, host: RulesHost): number {
  return Math.max(0, effectiveMight(room, objectId, host) + combatMightBonus(room, objectId, host));
}

/* ---------------------------------------------------------------- contribution (424.1.b) */

/**
 * Extension point: return `false` when a unit does not contribute its Might to combat damage
 * (cards like "Enemy units here with less Might than me don't deal combat damage"). Module-level
 * registry of pure functions (N2 exemption); R2-effects registers card text here.
 */
export type CombatContributionFilter = (room: Room, unitId: string, host: RulesHost) => boolean;

const CONTRIBUTION_FILTERS: CombatContributionFilter[] = [];

export function registerCombatContributionFilter(filter: CombatContributionFilter): () => void {
  CONTRIBUTION_FILTERS.push(filter);
  return () => {
    const index = CONTRIBUTION_FILTERS.indexOf(filter);
    if (index >= 0) CONTRIBUTION_FILTERS.splice(index, 1);
  };
}

/**
 * 424.1.b: a Stunned Unit does not contribute its Might to damage in the Combat Damage Step.
 * Printed "I don't deal combat damage." (unconditional) and registered filters do the same.
 */
export function dealsCombatDamage(room: Room, unitId: string, host: RulesHost): boolean {
  if (room.rules?.objects[unitId]?.stunned) return false;
  const text = host.cardInfo(room, unitId)?.text;
  if (text && printedLines(text).some((line) => NO_COMBAT_DAMAGE_SENTENCE.test(line))) return false;
  return CONTRIBUTION_FILTERS.every((filter) => filter(room, unitId, host));
}

/**
 * 467.2.a / 467.2.b / 143.2.c: a unit's contribution to its side's summed Might (negative Might
 * counts as 0; `combatMight` already clamps).
 */
export function combatContribution(room: Room, unitId: string, host: RulesHost): number {
  return dealsCombatDamage(room, unitId, host) ? combatMight(room, unitId, host) : 0;
}
