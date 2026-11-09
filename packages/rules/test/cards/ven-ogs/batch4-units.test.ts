/**
 * Vendetta units, batch 4: combat-end, move and play triggers.
 */
import { describe, expect, it } from "vitest";
import { fund } from "../../rules/effects/helpers";
import { boardOf, empowered, might, place, setControl, settle, withCards, zoneOf } from "./helpers";

type S = ReturnType<typeof withCards>;

function yes(s: S): void {
  const prompt = s.room.rules!.prompt!;
  s.as(prompt.playerId)
    .choose({ optionIds: ["yes"] })
    .expectOk();
}

describe("Vendetta units — batch 4", () => {
  it("[C:Mournful Witness][R468.7.b][R828.1.c] empowers after a combat I was in; +2 Might while Empowered", () => {
    const s = withCards(["Mournful Witness"], [], { battlefields: { p2: "Bandle Tree" } });
    place(s, "p2", "Treasure Hunter", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    const witness = place(s, "p1", "Mournful Witness", "base");
    expect(empowered(s, witness.id)).toBe(false);
    s.as("p1").move("Mournful Witness", "battlefieldA").expectOk();
    settle(s);
    for (let i = 0; i < 6 && s.room.rules!.combat; i += 1) {
      s.as(s.room.rules!.priority!).pass().expectOk();
      settle(s);
    }
    expect(zoneOf(s, witness.id)).not.toBe("trash");
    expect(empowered(s, witness.id)).toBe(true);
    expect(might(s, witness.id)).toBe(4);
  });

  it("[C:Shadow Order Disciple][R441][R383.4.e] when I move, may burn 1 to get +1 Might this turn", () => {
    const s = withCards(["Shadow Order Disciple"]);
    const unit = place(s, "p1", "Shadow Order Disciple", "base");
    const trash = boardOf(s, "p1").trash.length;
    s.as("p1").move("Shadow Order Disciple", "battlefieldB").expectOk();
    settle(s);
    yes(s);
    settle(s);
    expect(boardOf(s, "p1").trash.length).toBe(trash + 1);
    expect(might(s, unit.id)).toBe(3);
  });

  it("[C:Shadow Order Disciple][R445.2] declining the optional burn gives nothing", () => {
    const s = withCards(["Shadow Order Disciple"]);
    const unit = place(s, "p1", "Shadow Order Disciple", "base");
    const trash = boardOf(s, "p1").trash.length;
    s.as("p1").move("Shadow Order Disciple", "battlefieldB").expectOk();
    settle(s);
    s.as(s.room.rules!.prompt!.playerId)
      .choose({ optionIds: ["no"] })
      .expectOk();
    settle(s);
    expect(boardOf(s, "p1").trash.length).toBe(trash);
    expect(might(s, unit.id)).toBe(2);
  });

  it("[C:Pakaa Protector][R425][R441] when I move, reveal the top card: a unit is drawn, otherwise trashed for +2 Might", () => {
    for (const kind of ["unit", "other"] as const) {
      const s = withCards(["Pakaa Protector", "Treasure Hunter", "Tools of Empire"]);
      const unit = place(s, "p1", "Pakaa Protector", "base");
      const top = place(s, "p1", kind === "unit" ? "Treasure Hunter" : "Tools of Empire", "deck");
      s.as("p1").move("Pakaa Protector", "battlefieldB").expectOk();
      settle(s);
      if (s.room.rules!.prompt) yes(s);
      settle(s);
      if (kind === "unit") {
        expect(zoneOf(s, top.id)).toBe("hand");
        expect(might(s, unit.id)).toBe(4);
      } else {
        expect(zoneOf(s, top.id)).toBe("trash");
        expect(might(s, unit.id)).toBe(6);
      }
    }
  });

  it("[C:Jayce, Brilliant Inventor][R415][R383.4.a] when you play me, may ready something else that is exhausted", () => {
    const s = withCards(["Jayce, Brilliant Inventor", "Tools of Empire"]);
    const gear = place(s, "p1", "Tools of Empire", "base", { exhausted: true });
    fund(s, "p1", "Jayce, Brilliant Inventor");
    s.as("p1").play("Jayce, Brilliant Inventor").expectOk();
    settle(s);
    yes(s);
    // The only exhausted candidate is chosen automatically (355.9).
    settle(s);
    expect(boardOf(s, "p1").base.find((c) => c.id === gear.id)?.exhausted).toBeFalsy();
  });

  it("[C:Jayce, Brilliant Inventor][R383.2.b] the first non-token gear each turn readies something exhausted", () => {
    const s = withCards([
      "Tools of Empire",
      "Tools of Empire",
      "Jayce, Brilliant Inventor",
      "Caitlyn, Patrolling",
      "Treasure Hunter",
    ]);
    place(s, "p1", "Jayce, Brilliant Inventor", "base");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    fund(s, "p1", "Tools of Empire");
    s.as("p1").play("Tools of Empire").expectOk();
    settle(s);
    expect(s.room.rules!.prompt).toBeTruthy();
    yes(s);
    // The only exhausted candidate is chosen automatically (355.9).
    settle(s);
    expect(boardOf(s, "p1").base.find((c) => c.id === unit.id)?.exhausted).toBeFalsy();
    // Second gear this turn: no trigger.
    const other = place(s, "p1", "Treasure Hunter", "base", { exhausted: true });
    fund(s, "p1", "Tools of Empire");
    s.as("p1").play("Tools of Empire").expectOk();
    settle(s);
    expect(s.room.rules!.prompt).toBeFalsy();
    expect(boardOf(s, "p1").base.find((c) => c.id === other.id)?.exhausted).toBe(true);
  });
});
