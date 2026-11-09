/**
 * RAD wave R4 — status coverage for every card that needs a missing capability, plus the
 * manual-window fallback and the remaining partial scripts.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import { put, resolveAll, withCards } from "./helpers";

const STATUSES: Record<string, "implemented" | "partial" | "manual"> = {
  "Akali, Brash": "implemented",
  "Black Market": "partial",
  "Bloodscent Swarm": "partial",
  "Bushwhack Trap": "partial",
  Chronobreak: "manual",
  "Dune Devourer": "partial",
  "Ekko, Boy Who Shattered Time": "partial",
  "Ekko, Ingenious": "manual",
  Encore: "partial",
  "Entrenched Boar": "implemented",
  "Evelynn, Agony's Embrace": "manual",
  "Evelynn, Consuming": "manual",
  Fanfare: "implemented",
  "Firebrand Raider": "partial",
  "Firelights' Hideout": "partial",
  "Gutter Guardian": "implemented",
  "Heimerdinger, Academy Instructor": "manual",
  "Herald of the Emperor": "partial",
  "Hunters' Circle": "manual",
  "Incorrigible Construct": "implemented",
  "K'Sante, Pride of Nazumah": "implemented",
  "Kai'Sa, Rebel": "partial",
  "Last Caress": "partial",
  "Lingering Animus": "manual",
  "Lulu, Whimsical": "partial",
  "Meticulous Restorationist": "manual",
  "Mordekaiser, Iron Revenant": "partial",
  "Mordekaiser, Twice Slain": "implemented",
  "Neeko, Blending In": "manual",
  "Orianna, Lady of Clockwork": "manual",
  "Orianna, Mechanical Marvel": "partial",
  "Packed Amphitheater": "manual",
  "Parallel Convergence": "manual",
  "Piltovan Guidebot": "partial",
  "Primordial Roar": "implemented",
  "Remember the Fallen": "implemented",
  "Scorched Earth": "implemented",
  "Seraphic Wyvern": "partial",
  "Seraphine, Inspiring": "manual",
  "Seraphine, Starry-Eyed Songstress": "manual",
  "Skystrike Squadron": "partial",
  "Spirit of the Forge": "partial",
  "The Empyrean": "implemented",
};

describe("RAD wave R4 statuses", () => {
  it.each(Object.entries(STATUSES))("[C:%s] is scripted as %s", (name, status) => {
    expect(getCardScript(name)?.status).toBe(status);
  });

  it("[C:Heimerdinger, Academy Instructor] stays manual (permanents do not open the manual window)", () => {
    const s = withCards(["Heimerdinger, Academy Instructor"]);
    fund(s, "p1", "Heimerdinger, Academy Instructor");
    s.as("p1").play("Heimerdinger, Academy Instructor").expectOk();
    resolveAll(s);
    // The manual status is enforced by the table above; a manual *permanent* resolves normally
    // (no §6.4 window), which is why the token replacement remains unautomated.
    expect(s.room.rules!.manual).toBeNull();
  });

  it("[C:Bushwhack Trap][R830] plays as a Deploy gear to a battlefield", () => {
    const s = withCards(["Bushwhack Trap"]);
    fund(s, "p1", "Bushwhack Trap");
    s.as("p1").play("Bushwhack Trap", { location: "battlefieldA" }).expectOk();
    resolveAll(s);
    expect(s.findBoardCardAnywhere("Bushwhack Trap")).toBeTruthy();
    expect(getCardScript("Bushwhack Trap")?.status).toBe("partial");
  });

  it("[C:Black Market] the draw ability is scripted (but a battlefield has no controller)", () => {
    const script = getCardScript("Black Market")!;
    expect(script.abilities.some((ability) => ability.kind === "activated")).toBe(true);
    expect(script.status).toBe("partial");
  });

  it("[C:Ekko, Boy Who Shattered Time][R827.1.c.1] the Empower ability empowers the legend", () => {
    const s = withCards(["Ekko, Boy Who Shattered Time"]);
    const ekko = put(s, "p1", "Ekko, Boy Who Shattered Time", "legend");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1")
      .apply({ type: "rules_activate", objectId: ekko.id, ability: "activated:0" } as never)
      .expectOk();
    resolveAll(s);
    expect(s.room.rules!.objects[ekko.id]?.empowered).toBe(1);
  });
});
