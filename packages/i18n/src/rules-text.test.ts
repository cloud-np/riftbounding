/**
 * Every strict-rules code the engine can emit has an English string (R2-int).
 *
 * The lists are derived from the source, never hand-copied, so a new ReasonCode, prompt kind,
 * prompt reason or promptKey fails this suite until `data/i18n-en.json` covers it:
 *
 *  - ReasonCode / PromptKind: string-literal members of every `*ReasonCode` / `*PromptKind`
 *    alias in `@rift/protocol` (`src/rules/core.ts` + `src/rules/domains/*.ts`);
 *  - prompt reasons: the values of `PROMPT_REASONS` and the per-domain `*_PROMPT_REASONS`
 *    constants in `@rift/rules` (`src/prompts/**\/reasons.ts`);
 *  - promptKeys: every `"rules.prompt.*"` literal in `@rift/rules/src`, plus the
 *    `rules.prompt.cost.<CostCategory>` template.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTranslator } from "./translator";
import { promptReasonText, promptTitle, rulesReasonText } from "./rules-text";

const PACKAGES = path.resolve(__dirname, "../..");
const PROTOCOL_RULES = path.join(PACKAGES, "protocol/src/rules");
const RULES_SRC = path.join(PACKAGES, "rules/src");

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/[^\n]*/gu, "");
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

/** String literals of every `export type <Prefix…><suffix> = …;` alias in the given files. */
function unionLiterals(files: string[], suffix: string): string[] {
  const literals = new Set<string>();
  const alias = new RegExp(`export type (\\w*${suffix})\\s*=([^;]*);`, "gu");
  for (const file of files) {
    for (const match of stripComments(read(file)).matchAll(alias)) {
      for (const literal of match[2]!.matchAll(/"([^"]+)"/gu)) literals.add(literal[1]!);
    }
  }
  return [...literals].sort();
}

const protocolFiles = [
  path.join(PROTOCOL_RULES, "core.ts"),
  ...fs
    .readdirSync(path.join(PROTOCOL_RULES, "domains"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(PROTOCOL_RULES, "domains", name)),
];

const REASON_CODES = unionLiterals(protocolFiles, "ReasonCode");
const PROMPT_KINDS = unionLiterals(protocolFiles, "PromptKind");

const PROMPT_REASONS = (() => {
  const values = new Set<string>();
  const reasonFiles = walk(path.join(RULES_SRC, "prompts")).filter((file) =>
    file.endsWith("reasons.ts"),
  );
  for (const file of reasonFiles) {
    const source = stripComments(read(file));
    for (const block of source.matchAll(
      /export const \w*PROMPT_REASONS = \{([\s\S]*?)\} as const/gu,
    )) {
      for (const value of block[1]!.matchAll(/:\s*"([^"]+)"/gu)) values.add(value[1]!);
    }
  }
  return [...values].sort();
})();

const PROMPT_KEYS = (() => {
  const keys = new Set<string>();
  for (const file of walk(RULES_SRC)) {
    for (const match of read(file).matchAll(/"(rules\.prompt\.[A-Za-z.]+)"/gu)) keys.add(match[1]!);
  }
  const categories = unionLiterals([path.join(RULES_SRC, "play/cost-objects.ts")], "CostCategory");
  for (const category of categories) keys.add(`rules.prompt.cost.${category}`);
  return [...keys].sort();
})();

/** Labels the strict board UI renders (apps/play `components/board/strict`). */
const UI_LABELS = [
  "rulesMode",
  "modeSandbox",
  "modeStrict",
  "activate",
  "activateManual",
  "pass",
  "endTurn",
  "concede",
  "done",
  "confirm",
  "reasonWithRule",
  "waitingForChoice",
  "manualWindow",
  "damageTotal",
  "damageRemaining",
];

const en = createTranslator("en");

describe("strict-rules strings (R2-int) [R411.2]", () => {
  it("derives the code lists from the source (guards the parser itself)", () => {
    expect(REASON_CODES).toEqual(
      expect.arrayContaining([
        "not_your_priority",
        "invalid_payment",
        "combat_active",
        "invalid_choice",
      ]),
    );
    expect(REASON_CODES.length).toBeGreaterThanOrEqual(33);
    expect(PROMPT_KINDS).toEqual(
      expect.arrayContaining(["choose-target", "order", "choose-cost", "damage-assignment"]),
    );
    expect(PROMPT_REASONS).toEqual(
      expect.arrayContaining([
        "burn_out",
        "stage_showdown",
        "stage_combat",
        "combat.damage_assignment",
        "play.trigger",
        "play.choice",
        "effects.resume",
      ]),
    );
    expect(PROMPT_KEYS).toEqual(
      expect.arrayContaining(["rules.prompt.chooseSearch", "rules.prompt.cost.exhaust"]),
    );
  });

  it.each(REASON_CODES)("[§5] ReasonCode %s has an English message", (code) => {
    expect(en.has(`rules.reason.${code}`)).toBe(true);
    expect(rulesReasonText(en, code)).not.toBe(code);
  });

  it.each(PROMPT_KINDS)("[R411.2] prompt kind %s has an English label", (kind) => {
    expect(en(`rules.promptKind.${kind}`)).toBeTruthy();
  });

  it.each(PROMPT_REASONS)("[R411.2] prompt reason %s has an English label", (reason) => {
    expect(promptReasonText(en, reason)).toBeTruthy();
  });

  it.each(PROMPT_KEYS)("[R411.2] promptKey %s has an English label", (key) => {
    expect(en(key)).toBeTruthy();
  });

  it.each(UI_LABELS)("strict UI label %s has an English string", (label) => {
    expect(en.has(`rules.ui.${label}`)).toBe(true);
  });

  it("[§5] formats a rejection with its rule, with a fallback for unknown codes", () => {
    expect(rulesReasonText(en, "not_your_priority", "312")).toBe(
      "You don't have priority. (rule 312)",
    );
    expect(rulesReasonText(en, "some_future_code")).toBe("That isn't allowed right now.");
    expect(en("rules.ui.manualWindow", { card: "Rebuke" })).toBe(
      "Resolve Rebuke manually, then press Done.",
    );
  });

  it("[R411.2] titles a prompt from its promptKey, then its reason, then its kind", () => {
    expect(promptTitle(en, { kind: "choose-card", promptKey: "rules.prompt.chooseSearch" })).toBe(
      "Choose a card you found",
    );
    expect(promptTitle(en, { kind: "choose-card", promptKey: "Choose a unit to ready" })).toBe(
      "Choose a unit to ready",
    );
    expect(
      promptTitle(en, { kind: "damage-assignment", data: { reason: "combat.damage_assignment" } }),
    ).toBe("Assign combat damage");
    expect(promptTitle(en, { kind: "order" })).toBe("Choose the order");
    expect(promptTitle(en, { kind: "brand-new-kind" })).toBe("brand-new-kind");
    // 355.1.a: the optional-cost title interpolates the prompt data (cost + card).
    expect(
      promptTitle(en, {
        kind: "yes-no",
        promptKey: "rules.prompt.playOptionalCostEnterReady",
        data: { params: { cost: "Accelerate [1][Order]", card: "Azir, Sovereign" } },
      }),
    ).toBe("Pay Accelerate [1][Order] as an additional cost to have Azir, Sovereign enter ready?");
  });

  it("uses the localized strict-rules strings in fr / ko / zh-CN", () => {
    const expected = {
      fr: { reason: "Ce n’est pas votre tour.", done: "Terminé" },
      ko: { reason: "당신의 턴이 아닙니다.", done: "완료" },
      "zh-CN": { reason: "还没轮到你。", done: "完成" },
    } as const;
    for (const locale of ["fr", "ko", "zh-CN"] as const) {
      const t = createTranslator(locale);
      expect(rulesReasonText(t, "not_your_turn")).toBe(expected[locale].reason);
      expect(t("rules.ui.done")).toBe(expected[locale].done);
    }
  });
});
