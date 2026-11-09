/**
 * Lane D — Equip (818).
 *
 * 818.1.c.2: "Equip is functionally short for '[Cost]: Attach this gear to a unit you control.'"
 * The play layer already lists `equip:<n>` as a built-in activated ability and binds its Target
 * (818.1.b.1); R4-engine makes the resolution run the standard attach action (435, 818.2)
 * instead of opening the §6.4 manual window.
 */
import { describe, expect, it } from "vitest";
import { addPool, boardCard, put, settle, withDeck } from "./helpers";

describe("Equip [R818]", () => {
  it("[C:Doran's Blade][R818.1.c.2][R818.2] the built-in equip ability attaches the gear on resolution", () => {
    const s = withDeck(["Doran's Blade"]);
    const gear = put(s, "p1", "Doran's Blade", "base");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    addPool(s, "p1", 0, { Body: 1 });
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: gear.id,
        ability: "equip:0",
        choices: { "target:0": unit.id },
      } as never)
      .expectOk();
    expect(s.room.rules!.manual).toBeNull();
    const events = settle(s);
    expect(s.room.rules!.manual).toBeNull();
    // 818.1.b.2 / 435.4: the chosen unit is the Top-Most card and both are at its location.
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBe(unit.id);
    expect(events.some((event) => event.type === "attach" && event.cardId === gear.id && event.targetIds?.[0] === unit.id)).toBe(true);
    // 818.1.c.2: the [Body] cost was paid.
    expect(s.room.rules!.pools.p1!.power.Body ?? 0).toBe(0);
  });

  it("[C:Nazuman Ntofo][R818.1.c.2] an Energy-only Equip cost attaches too", () => {
    const s = withDeck(["Nazuman Ntofo"]);
    const gear = put(s, "p1", "Nazuman Ntofo", "base");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    addPool(s, "p1", 1);
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: gear.id,
        ability: "equip:0",
        choices: { "target:0": unit.id },
      } as never)
      .expectOk();
    settle(s);
    expect(s.room.rules!.manual).toBeNull();
    expect(boardCard(s, "p1", "Nazuman Ntofo")!.attachedToCardId).toBe(unit.id);
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Doran's Blade][R818.1.b.1] Equip's choice is a Target among units its controller controls", () => {
    const s = withDeck(["Doran's Blade"]);
    const gear = put(s, "p1", "Doran's Blade", "base");
    const friend = put(s, "p1", "Caitlyn, Patrolling", "base");
    const second = put(s, "p1", "Treasure Hunter", "base");
    const enemy = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    addPool(s, "p1", 0, { Body: 1 });
    s.as("p1")
      .apply({ type: "rules_activate", objectId: gear.id, ability: "equip:0" } as never)
      .expectOk();
    const prompt = s.expectPrompt("choose-target", "p1").room.rules!.prompt!;
    expect(prompt.rule).toBe("818.1.b.1");
    const offered = prompt.options!.map((option) => option.id);
    expect(offered).toContain(friend.id);
    expect(offered).toContain(second.id);
    expect(offered).not.toContain(enemy.id);
    expect(offered).not.toContain(gear.id);
    s.as("p1").choose({ optionIds: [second.id] }).expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBe(second.id);
  });
});
