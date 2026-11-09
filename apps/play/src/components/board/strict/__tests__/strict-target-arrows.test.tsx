/**
 * Arrow targeting from real strict prompts: target resolution/snapping, fan-out options,
 * multi-target pin/auto-confirm, battlefield targets and public chain-target arrows.
 */
import { describe, expect, it } from "vitest";

import type { Prompt } from "@rift/protocol";

import {
  aimTargetForIds,
  collectChainTargetArrows,
} from "@/components/board/hover/TargetArrowOverlay";
import {
  nextPromptOptionAnchor,
  promptAutoConfirms,
  promptChooseIntent,
  promptOptionAnchor,
  promptOptionForPlayer,
  promptOptionMatchIds,
  togglePromptSelection,
} from "../strict-interaction";
import { promptSourceAnchor } from "../strict-model";
import { addPool } from "../../../../../../../packages/rules/test/rules/engine-r4/d/helpers";
import { placeUnit } from "../../../../../../../packages/rules/test/rules/combat/helpers";
import { scenario, type RulesScenario } from "../../../../../../../packages/rules/test/scenarios/dsl";
import {
  activate,
  addPool as addVenPool,
  place as placeVenCard,
} from "../../../../../../../packages/rules/test/cards/ven-ogs/helpers";
import { withCards } from "../../../../../../../packages/rules/test/cards/helpers";
import {
  addSyntheticCard,
  EVELYNN_ENTRANCING,
} from "../../../../../../../packages/engine/test/strict-gestures-fixture";

function singleTarget(): { s: RulesScenario; prompt: Prompt; targetId: string } {
  const s = scenario({ p1: { hand: ["Gust"], energy: 2 } });
  const target = placeUnit(s, "p2", "Treasure Hunter", "battlefieldA", "arrow-target");
  placeUnit(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "arrow-target-2");
  s.as("p1").play("Gust").expectOk();
  const prompt = s.room.rules!.prompt!;
  return { s, prompt, targetId: target.id };
}

function multiTarget(): { s: RulesScenario; prompt: Prompt } {
  const s = scenario({
    p1: { hand: ["Back to Back"], energy: 5 },
    extraCards: { p1: ["Back to Back"] },
  });
  placeUnit(s, "p1", "Treasure Hunter", "base", "pin-a");
  placeUnit(s, "p1", "Caitlyn, Patrolling", "base", "pin-b");
  placeUnit(s, "p1", "Treasure Hunter", "base", "pin-c");
  s.as("p1").play("Back to Back").expectOk();
  return { s, prompt: s.room.rules!.prompt! };
}

function battlefieldTarget(): { s: RulesScenario; prompt: Prompt } {
  const s = scenario({
    p1: { hand: ["Amateur Demolitionist"], energy: 8 },
    extraCards: { p1: ["Amateur Demolitionist"] },
  });
  addPool(s, "p1", 8, { Fury: 3, Calm: 3, Mind: 3, Body: 3, Chaos: 3, Order: 3 });
  s.as("p1").play("Amateur Demolitionist").expectOk();
  for (let step = 0; step < 8 && !s.room.rules?.prompt; step += 1) {
    const actor = s.room.rules?.priority;
    if (!actor) break;
    s.as(actor).pass().expectOk();
  }
  return { s, prompt: s.room.rules!.prompt! };
}

describe("strict arrow targeting [R355.7][R355.8][R355.9]", () => {
  it("a single-target spell snaps to the enemy unit, rejects non-options, and answers", () => {
    const { s, prompt, targetId } = singleTarget();
    expect(prompt.kind).toBe("choose-target");
    const optionIds = promptOptionMatchIds(prompt);
    expect(aimTargetForIds([targetId], optionIds)).toEqual({
      targetId,
      status: "valid",
    });
    expect(aimTargetForIds(["not-a-target"], optionIds)).toEqual({
      targetId: null,
      status: "invalid",
    });
    expect(promptSourceAnchor(s.room, prompt)?.anchor).toBe("chain");
    const first = nextPromptOptionAnchor(prompt, null, 1);
    expect(first).toBeTruthy();
    expect(optionIds.has(first!)).toBe(true);
    const second = nextPromptOptionAnchor(prompt, first, 1);
    expect(second).toBeTruthy();
    expect(nextPromptOptionAnchor(prompt, second, -1)).toBe(first);
    const answer = promptChooseIntent(prompt, [targetId]);
    expect(answer).toMatchObject({ type: "rules_choose", promptId: prompt.id });
    s.as("p1").apply(answer).expectOk();
    expect(s.room.rules?.prompt).toBe(null);
  });

  it("a multi-target prompt pins, unpins, and auto-confirms at max", () => {
    const { s, prompt } = multiTarget();
    expect(prompt.kind).toBe("choose-target");
    expect(prompt.min).toBe(2);
    expect(prompt.max).toBe(2);
    const ids = (prompt.options ?? []).map((option) => option.id);
    const first = togglePromptSelection(prompt, [], ids[0]!);
    expect(first).toEqual([ids[0]]);
    expect(promptAutoConfirms(prompt, first)).toBe(false);
    const second = togglePromptSelection(prompt, first, ids[1]!);
    expect(second).toHaveLength(2);
    expect(promptAutoConfirms(prompt, second)).toBe(true);
    const unpinned = togglePromptSelection(prompt, second, ids[0]!);
    expect(unpinned).toEqual([ids[1]]);
    expect(promptAutoConfirms(prompt, unpinned)).toBe(false);
    s.as("p1").apply(promptChooseIntent(prompt, second)).expectOk();
    expect(s.room.rules?.prompt).toBe(null);
  });

  it("a battlefield prompt snaps to battlefield zones", () => {
    const { prompt } = battlefieldTarget();
    expect(prompt.kind).toBe("choose-battlefield");
    const optionIds = promptOptionMatchIds(prompt);
    const zone = [...optionIds].find((id) => id.startsWith("battlefield"));
    expect(zone).toBeTruthy();
    expect(aimTargetForIds([zone!], optionIds).status).toBe("valid");
    expect(aimTargetForIds(["not-a-battlefield"], optionIds).status).toBe("invalid");
  });

  it("a player prompt snaps to a seat (Glowstone)", () => {
    const s = withCards(["Glowstone"]);
    const stone = placeVenCard(s, "p1", "Glowstone", "base");
    addVenPool(s, "p1", 2, { any: 2 });
    activate(s, "p1", stone, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    activate(s, "p1", stone, "activated:1").expectOk();
    const prompt = s.room.rules!.prompt!;
    expect(prompt.kind).toBe("choose-player");
    const optionIds = promptOptionMatchIds(prompt);
    expect(promptOptionForPlayer(prompt, "p2")).toBeTruthy();
    const option = promptOptionForPlayer(prompt, "p2")!;
    expect(promptOptionAnchor(option)).toBe("p2");
    expect(aimTargetForIds(["p2"], optionIds).status).toBe("valid");
  });

  it("draws public chain-target arrows for the bot's chosen target in the human's view", () => {
    const s = scenario({ firstPlayer: "p2", p1: {}, p2: { hand: ["Gust"], energy: 2 } });
    const target = placeUnit(s, "p1", "Treasure Hunter", "battlefieldA", "human-unit");
    s.room.players[1]!.isBot = true;
    s.as("p2").play("Gust", { hold: true, choices: { "target:0": target.id } }).expectOk();
    const item = s.room.rules!.chain.at(-1)!;
    expect(item.controller).toBe("p2");
    const points = new Map([
      [item.id, { x: 20, y: 20 }],
      [target.id, { x: 220, y: 120 }],
    ]);
    const arrows = collectChainTargetArrows(
      s.room,
      "p1",
      (id) => points.get(id) ?? null,
    );
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toMatchObject({ owner: "opponent", playerId: "p2" });
    expect(arrows[0]?.path).toContain("220.00 120.00");

    // A hidden/redacted target never gets a passive arrow (would reveal hidden information).
    const hidden = addSyntheticCard(s.room, "p1", EVELYNN_ENTRANCING, "battlefieldA");
    hidden.hidden = true;
    item.choices["target:1"] = hidden.id;
    points.set(hidden.id, { x: 300, y: 300 });
    const guarded = collectChainTargetArrows(
      s.room,
      "p1",
      (id) => points.get(id) ?? null,
    );
    expect(guarded).toHaveLength(1);
  });
});
