/**
 * Strict-rules strings exist in every non-English locale (R2-int leftovers).
 *
 * `rules-text.test.ts` derives the English key list from `@rift/protocol` / `@rift/rules`; this
 * suite takes that English list and fails when fr / ko / zh-CN is missing any `rules.*` key or
 * changes its placeholder set. The localized catalogs are compiled message trees, so the check
 * reads `ui.exact` + `ui.patterns` directly (a key that only falls back to English is not
 * covered).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTranslator } from "./translator";

const DATA = path.resolve(__dirname, "../data");
const LOCALES = ["fr", "ko", "zh-CN"] as const;

type Node = string | number | Node[];

interface Catalog {
  ui: { exact: Record<string, Node>; patterns: Record<string, Node> };
}

function readCatalog(locale: string): Catalog {
  return JSON.parse(fs.readFileSync(path.join(DATA, `i18n-${locale}.json`), "utf8"));
}

const en = readCatalog("en");

/** Dot paths of every leaf in the English `ui.rules` subtree (arrays are compiled messages). */
function flatten(node: unknown, prefix: string, out: Map<string, Node>): void {
  if (Array.isArray(node)) {
    out.set(prefix, node as Node);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, node as Node);
}

const EN_RULES = new Map<string, Node>();
flatten((en.ui as unknown as { rules: unknown }).rules, "rules", EN_RULES);

/** Argument names used by a compiled message (`["name"]` interpolation / selector args). */
function paramsOf(node: Node, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    if (node.length === 1 && typeof node[0] === "string") out.add(node[0]);
    else if (node.length === 3 && typeof node[0] === "string" && typeof node[1] === "number") {
      out.add(node[0]);
      for (const option of Object.values(node[2] as unknown as Record<string, Node>))
        paramsOf(option, out);
    } else for (const part of node) paramsOf(part, out);
  }
  return out;
}

/** Non-empty translation: a string with visible text, or a compiled array with a string part. */
function isTranslated(node: Node): boolean {
  if (typeof node === "string") return node.trim().length > 0;
  if (Array.isArray(node))
    return node.some((part) => typeof part === "string" && part.trim().length > 0);
  return false;
}

describe("strict-rules translations (R2-int leftovers)", () => {
  it("finds the English strict key list (guards the flattener)", () => {
    expect(EN_RULES.size).toBeGreaterThanOrEqual(120);
    expect(EN_RULES.has("rules.reason.not_your_priority")).toBe(true);
    expect(EN_RULES.has("rules.prompt.chooseSearch")).toBe(true);
    expect(EN_RULES.has("rules.prompt.cost.exhaust")).toBe(true);
    expect(EN_RULES.has("rules.ui.done")).toBe(true);
  });

  for (const locale of LOCALES) {
    describe(locale, () => {
      const catalog = readCatalog(locale);
      // `patterns` holds readable keys; `exact` keeps the generated ones. Check both so the
      // suite does not depend on which compiled map the translations use.
      const translated: Record<string, Node> = { ...catalog.ui.exact, ...catalog.ui.patterns };

      it("has every English strict-rules key", () => {
        const missing = [...EN_RULES.keys()].filter((key) => !(key in translated));
        expect(missing).toEqual([]);
      });

      it("keeps every placeholder of the English message", () => {
        const mismatched = [...EN_RULES.entries()]
          .filter(([key]) => key in translated)
          .map(([key, node]) => {
            const enParams = [...paramsOf(node)].sort();
            const localeParams = [...paramsOf(translated[key]!)].sort();
            return enParams.join(",") === localeParams.join(",") ? null : key;
          })
          .filter((key): key is string => key !== null);
        expect(mismatched).toEqual([]);
      });

      it("does not leave a strict-rules key empty", () => {
        const empty = [...EN_RULES.keys()].filter(
          (key) => key in translated && !isTranslated(translated[key]!),
        );
        expect(empty).toEqual([]);
      });

      it("resolves strict-rules strings through the locale translator", () => {
        const t = createTranslator(locale);
        const samples: Record<string, Record<string, string | number>> = {
          "rules.ui.moveTo": { zone: "base" },
          "rules.ui.selectRange": { min: 1, max: 2 },
          "rules.ui.priorityOf": { player: "Bob" },
          "rules.ui.focusOf": { player: "Bob" },
          "rules.ui.waitingForChoice": { player: "Bob", reason: "x" },
          "rules.ui.manualWindow": { card: "Rebuke" },
          "rules.ui.manualWindowOther": { player: "Bob", card: "Rebuke" },
          "rules.ui.reasonWithRule": { reason: "x", rule: "312" },
          "rules.ui.damageTotal": { total: 3 },
          "rules.ui.damageRemaining": { remaining: 2 },
          "rules.ui.damageLethal": { lethal: 3 },
        };
        for (const key of EN_RULES.keys()) {
          expect(t(key, samples[key] ?? {}), key).toBeTruthy();
        }
      });

      it("uses the localized value, not the English fallback, for spot keys", () => {
        const t = createTranslator(locale);
        const expected = {
          fr: {
            "rules.reason.not_your_turn": "Ce n’est pas votre tour.",
            "rules.ui.done": "Terminé",
            "rules.prompt.chooseSearch": "Choisissez une carte que vous avez trouvée",
          },
          ko: {
            "rules.reason.not_your_turn": "당신의 턴이 아닙니다.",
            "rules.ui.done": "완료",
            "rules.prompt.chooseSearch": "찾은 카드를 선택하세요",
          },
          "zh-CN": {
            "rules.reason.not_your_turn": "还没轮到你。",
            "rules.ui.done": "完成",
            "rules.prompt.chooseSearch": "选择你找到的一张卡牌",
          },
        }[locale]!;
        for (const [key, value] of Object.entries(expected)) expect(t(key)).toBe(value);
      });
    });
  }
});
