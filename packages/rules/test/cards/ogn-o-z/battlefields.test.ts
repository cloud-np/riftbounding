/** Origins O–Z: battlefields (conquer / hold / defend triggers). */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { boardOf, place, zoneOf } from "../../rules/effects/helpers";
import { resolveAll, withCards } from "./helpers";

type S = ReturnType<typeof withCards>;

/** P1 moves a unit from base to the empty battlefieldA (P1's battlefield) and conquers it. */
function conquerA(s: S): void {
  place(s, "p1", "Caitlyn, Patrolling", "base");
  s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
  resolveAll(s);
}

/** P1 holds battlefieldA at the start of P1's next turn. */
function holdA(s: S): void {
  place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
  s.as("p1").endTurn().expectOk();
  s.as("p2").endTurn().expectOk();
}

describe("Origins O–Z battlefields", () => {
  it("[C:Zaun Warrens][R383.4.c.2.b] when you conquer here, discard 1, then draw 1", () => {
    const s = withCards(["Progress Day"], [], { battlefields: { p1: "Zaun Warrens" } });
    const only = boardOf(s, "p1").hand.map((card) => card.id);
    conquerA(s);
    expect(boardOf(s, "p1").trash.map((card) => card.id)).toEqual(only);
    expect(boardOf(s, "p1").hand).toHaveLength(1);
  });

  it("[C:Sigil of the Storm][R417.1.b][R355.18] when you conquer here, you recycle one of your runes", () => {
    const s = withCards([], [], { battlefields: { p1: "Sigil of the Storm" } });
    const runes = boardOf(s, "p1").runeArea.map((rune) => rune.id);
    conquerA(s);
    if (s.room.rules!.prompt) {
      s.expectPrompt("choose-card", "p1");
      s.as("p1")
        .choose({ optionIds: [runes[0]!] })
        .expectOk();
    }
    resolveAll(s);
    expect(boardOf(s, "p1").runeArea).toHaveLength(runes.length - 1);
    const recycled = runes.find((id) => !boardOf(s, "p1").runeArea.some((rune) => rune.id === id))!;
    expect(boardOf(s, "p1").runeDeck.map((rune) => rune.id)).toContain(recycled);
  });

  it("[C:Targon's Peak][R391.2][R355.5.b] when you conquer here, ready up to 2 runes at the end of this turn", () => {
    const s = withCards([], [], { battlefields: { p1: "Targon's Peak" } });
    const runes = boardOf(s, "p1").runeArea;
    for (const rune of runes) rune.exhausted = true;
    conquerA(s);
    expect(runes.every((rune) => rune.exhausted)).toBe(true);
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    s.expectPrompt("choose-target", "p1");
    expect(s.room.rules!.prompt!.max).toBe(2);
    const pick = s.room.rules!.prompt!.options!.slice(0, 2).map((option) => option.id);
    s.as("p1").choose({ optionIds: pick }).expectOk();
    resolveAll(s);
    for (const id of pick) expect(s.host.isExhausted(s.room, id)).toBe(false);
  });

  it("[C:The Candlelit Sanctum][R425][R417] when you conquer here, look at the top 2 and recycle any of them", () => {
    const s = withCards([], [], { battlefields: { p1: "The Candlelit Sanctum" } });
    const top = s.host.lookAtTop(s.room, "p1", "deck", 2).map((card) => card.id);
    conquerA(s);
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.options!.map((option) => option.id).sort()).toEqual(
      [...top].sort(),
    );
    s.as("p1")
      .choose({ optionIds: [top[0]!] })
      .expectOk();
    resolveAll(s);
    // The recycled card went to the bottom; the kept one is still on top.
    expect(s.host.lookAtTop(s.room, "p1", "deck", 1)[0]!.id).toBe(top[1]);
    expect(boardOf(s, "p1").deck.map((card) => card.id)).toContain(top[0]);
    expect(s.events().some((event) => event.type === "recycle" && event.cardId === top[0])).toBe(
      true,
    );
    expect(getCardScript("The Candlelit Sanctum")?.status).toBe("partial");
  });

  it("[C:Startipped Peak][R403.1][R431.2.a] when you hold here, you may channel 1 rune exhausted", () => {
    const s = withCards([], [], { battlefields: { p1: "Startipped Peak" } });
    holdA(s);
    const runes = boardOf(s, "p1").runeArea.length;
    resolveAll(s);
    s.expectPrompt(undefined, "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    resolveAll(s);
    expect(boardOf(s, "p1").runeArea.length).toBeGreaterThanOrEqual(runes + 1);
    expect(s.events().some((event) => event.type === "channel")).toBe(true);
  });

  it("[C:The Grand Plaza][R383.2.a.1][R195] when you hold here with 7+ units here, you win the game", () => {
    const s = withCards([], [], { battlefields: { p1: "The Grand Plaza" } });
    const names = ["Caitlyn, Patrolling", "Treasure Hunter", "Stellacorn Herder"];
    for (let index = 0; index < 7; index += 1) place(s, "p1", names[index % 3]!, "battlefieldA");
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    expect(s.room.gameOutcome?.winnerPlayerIds).toEqual(["p1"]);
  });

  it("[C:The Grand Plaza][R383.2.a.1] with fewer than 7 units here it does not trigger", () => {
    const s = withCards([], [], { battlefields: { p1: "The Grand Plaza" } });
    const names = ["Caitlyn, Patrolling", "Treasure Hunter", "Stellacorn Herder"];
    for (let index = 0; index < 6; index += 1) place(s, "p1", names[index % 3]!, "battlefieldA");
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    expect(s.room.gameOutcome).toBeFalsy();
  });

  it("[C:Reaver's Row][R383.4.f][R403.1] when you defend here, you may move a friendly unit here to base", () => {
    const s = withCards([], [], { firstPlayer: "p2", battlefields: { p1: "Reaver's Row" } });
    const defender = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p2", "Treasure Hunter", "base");
    s.as("p2").move("Treasure Hunter", "battlefieldA").expectOk();
    for (let guard = 0; guard < 12; guard += 1) {
      const prompt = s.room.rules!.prompt;
      if (prompt?.playerId === "p1") {
        if (prompt.options?.some((option) => option.id === "yes"))
          s.as("p1")
            .choose({ optionIds: ["yes"] })
            .expectOk();
        else
          s.as("p1")
            .choose({ optionIds: [defender.id] })
            .expectOk();
        continue;
      }
      if (prompt) break;
      if (
        !s.room.rules!.chain.some((item) => item.cardName === "Reaver's Row") &&
        zoneOf(s, defender.id) === "base"
      )
        break;
      const who = s.room.rules!.priority ?? s.room.rules!.focus;
      if (!who) break;
      s.as(who).pass();
    }
    expect(zoneOf(s, defender.id)).toBe("base");
  });

  it("[C:Obelisk of Power][C:The Arena's Greatest][C:Reckoner's Arena][C:The Dreaming Tree][C:Void Gate] blocked battlefields are manual with notes", () => {
    for (const name of [
      "Obelisk of Power",
      "The Arena's Greatest",
      "Reckoner's Arena",
      "The Dreaming Tree",
      "Void Gate",
    ]) {
      const script = getCardScript(name);
      expect(script?.status).toBe("manual");
      expect(script?.notes?.length ?? 0).toBeGreaterThan(20);
    }
  });
});
