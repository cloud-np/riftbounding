import { describe, expect, it } from "vitest";

import type { CombatDamageTarget } from "@rift/protocol";
// Cross-check against the authoritative validator (relative import: apps/play does not depend on @rift/rules).
import { validateAssignment } from "../../../../../../../packages/rules/src/combat/assignment";

import { assignmentHint, canComplete, canStepUp, validateDraft, type AssignTarget, type Draft } from "../damage-assignment";

const t = (objectId: string, lethal: number | null, tier = 1, exclusiveChoices?: string[]): AssignTarget & CombatDamageTarget =>
  ({ objectId, lethal, tier, ...(exclusiveChoices ? { exclusiveChoices } : {}) }) as AssignTarget & CombatDamageTarget;

const SAND = t("sand", 3);
const RECRUIT = t("recruit", 1);
const nameOf = (id: string) => ({ sand: "Sand Soldier", recruit: "Recruit", tank: "Tank Guy" })[id] ?? id;

const boards: Array<[string, AssignTarget[]]> = [
  ["two units", [SAND, RECRUIT]],
  ["tank first", [t("tank", 2, 0), SAND, RECRUIT]],
  ["backline last", [t("a", 2), t("b", 2, 2), t("c", 1)]],
  ["untouchable", [t("a", 2), t("b", null)]],
  ["exclusive", [t("a", 2, 0, ["tank", "backline"]), t("b", 2), t("c", 1)]],
];

function* drafts(targets: AssignTarget[], total: number): Generator<Draft> {
  const rec = function* (i: number, left: number, acc: Draft): Generator<Draft> {
    if (i === targets.length - 1) {
      yield { ...acc, [targets[i]!.objectId]: left };
      return;
    }
    for (let a = 0; a <= left; a += 1) yield* rec(i + 1, left - a, { ...acc, [targets[i]!.objectId]: a });
  };
  yield* rec(0, total, {});
}

describe("[467.2.c] client validator mirrors the engine", () => {
  for (const [name, targets] of boards) {
    for (const total of [1, 2, 3, 4, 5, 6, 8]) {
      it(`${name}, total ${total}: same verdict on every split`, () => {
        for (const draft of drafts(targets, total)) {
          const engine = validateAssignment(
            targets as CombatDamageTarget[],
            total,
            Object.entries(draft).map(([targetId, amount]) => ({ targetId, amount })),
          );
          const mine = validateDraft(targets, total, draft);
          expect({ draft, ok: mine.ok }).toEqual({ draft, ok: engine.ok });
          if (!engine.ok && !mine.ok) expect(mine.violation.rule).toBe(engine.rule);
        }
      });
    }
  }
});

describe("[467.2.c.4] the owner's Sand Soldier / Recruit case", () => {
  const targets = [SAND, RECRUIT];
  it("rejects Recruit 3 / Sand Soldier 0 with a plain explanation", () => {
    const draft = { sand: 0, recruit: 3 };
    expect(validateDraft(targets, 3, draft).ok).toBe(false);
    expect(assignmentHint(targets, 3, draft, nameOf)).toBe(
      "Recruit already has lethal damage (1). The rest must go to Sand Soldier (rule 467.2.c.4).",
    );
  });
  it("allows Recruit 1 + Sand Soldier 2 and Sand Soldier 3", () => {
    expect(validateDraft(targets, 3, { sand: 2, recruit: 1 }).ok).toBe(true);
    expect(validateDraft(targets, 3, { sand: 3, recruit: 0 }).ok).toBe(true);
  });
  it("disables + on Recruit once it has lethal, but not on Sand Soldier", () => {
    const draft = { sand: 0, recruit: 1 };
    expect(canStepUp(targets, 3, draft, RECRUIT)).toBe(false);
    expect(canStepUp(targets, 3, draft, SAND)).toBe(true);
    expect(assignmentHint(targets, 3, draft, nameOf)).toContain("The remaining 2 must go to Sand Soldier");
  });
  it("keeps every legal split reachable", () => {
    expect(canComplete(targets, 3, { sand: 0, recruit: 0 })).toBe(true);
    expect(canComplete(targets, 3, { sand: 0, recruit: 2 })).toBe(false);
  });
});
