import { afterEach, describe, expect, it } from "vitest";
import {
  executeAbility,
  listActivatedAbilities,
  parseActivatedAbilityTexts,
} from "../../../src";
import { clearCardScripts, registerTestCardScript } from "../../../src/testing";
import { scenario } from "../../scenarios/dsl";
import { stepFor } from "./helpers";

afterEach(() => clearCardScripts());

const CAITLYN_TEXT =
  "I must be assigned combat damage last.\n[Tap]: Deal damage equal to my Might to a unit at a battlefield. Use this ability only while I'm at a battlefield.\n\nFlavor Text\n\n\"I never miss.\"";

describe("activated abilities of unscripted cards [R377.1][§6.4]", () => {
  it("[R377.1][EX:377.1] a \":\" preceded by a cost marks an activated ability", () => {
    expect(parseActivatedAbilityTexts(CAITLYN_TEXT)).toEqual([
      "[Tap]: Deal damage equal to my Might to a unit at a battlefield. Use this ability only while I'm at a battlefield.",
    ]);
    expect(parseActivatedAbilityTexts("When I move, play a Gold gear token exhausted.")).toEqual([]);
    // Reminder text in parentheses (a granted Gold ability) is not the card's own ability.
    expect(
      parseActivatedAbilityTexts(
        "[Accelerate] (You may pay [1] [Chaos] as an additional cost to have me enter ready.)\nWhen I become exhausted, choose one —\n• Play a Gold gear token exhausted. (It has \"[Reaction] Kill this, [Tap]: [Add] [Rune].\")\n• Pay [Chaos] to draw 1.",
      ),
    ).toEqual([]);
  });

  it("[R818.1][R827.1] Equip and Empower keyword lines are activated abilities", () => {
    expect(parseActivatedAbilityTexts("[Equip] — [Rune] or exhaust a friendly unit (Pay the cost: Attach this.)\n+3 [Might]")).toEqual([
      "[Equip] — [Rune] or exhaust a friendly unit",
    ]);
  });

  it("[§6.4][R403.3] unscripted cards list manual:<n> entries that resolve in the manual window", () => {
    const entries = listActivatedAbilities("Some Unscripted Card", "[Reaction] Kill this, [Tap]: [Add] [Rune].\n[2], [Tap]: Draw 1.");
    expect(entries.map((entry) => entry.ref)).toEqual(["manual:0", "manual:1"]);
    expect(entries[0]).toMatchObject({ manual: true, ability: { kind: "activated", keywords: ["reaction"], addsResources: true } });
    expect(entries[1]).toMatchObject({ manual: true, text: "[2], [Tap]: Draw 1." });
    const s = scenario();
    const result = executeAbility(entries[1]!.ability, { room: s.room, step: stepFor(s), controller: "p1" });
    expect(result).toMatchObject({ status: "manual" });
  });

  it("[§6.4] a status:\"manual\" script is treated as unscripted (text parsed from the script)", () => {
    registerTestCardScript({ name: "Probe Manual", text: "[1]: Ready me.", status: "manual", abilities: [] });
    expect(listActivatedAbilities("Probe Manual").map((entry) => entry.ref)).toEqual(["manual:0"]);
  });

  it("[R376][F7] scripted cards list activated:<index> into the full abilities array", () => {
    registerTestCardScript({
      name: "Probe Scripted",
      text: "test",
      status: "implemented",
      abilities: [
        { kind: "triggered", trigger: { kind: "turn-start" }, effect: { op: "seq", effects: [] } },
        { kind: "activated", cost: {}, effect: { op: "draw", amount: 1 } },
      ],
    });
    expect(listActivatedAbilities("Probe Scripted").map((entry) => [entry.ref, entry.manual])).toEqual([["activated:1", false]]);
  });
});
