/**
 * Lane D — attachment keywords: Quick-Draw (819), Weaponmaster (821), Deploy (830).
 *
 * The keyword trigger tables live in `triggers/keywords.ts`; the Weaponmaster cost/pay/attach
 * resolution is `play/weaponmaster.ts` (821.1.c).
 */
import { describe, expect, it } from "vitest";
import { effectiveMight } from "../../../../src";
import { fund } from "../../effects/helpers";
import { addPool, boardCard, put, resolveAll, settle, withCards, withDeck } from "./helpers";

describe("Deploy [R830]", () => {
  it("[C:Banner of Conquest][R830.1.b] a Deploy gear is killed when an opponent holds here", () => {
    const s = withDeck(["Banner of Conquest"]);
    const banner = put(s, "p1", "Banner of Conquest", "battlefieldB");
    put(s, "p2", "Treasure Hunter", "battlefieldB");
    s.room.rules!.objects["battlefieldB"] = { controller: "p2" };
    s.as("p1").endTurn().expectOk();
    const events = settle(s);
    expect(s.host.findCard(s.room, banner.id)?.zone).toBe("trash");
    expect(
      events.some((event) => event.type === "kill" && event.cardId === banner.id && event.zone === "battlefieldB"),
    ).toBe(true);
  });

  it("[C:Banner of Conquest][R830.1.b] Deploy does not trigger when its controller holds here", () => {
    const s = withDeck(["Banner of Conquest"]);
    const banner = put(s, "p1", "Banner of Conquest", "battlefieldB");
    put(s, "p1", "Treasure Hunter", "battlefieldB");
    s.room.rules!.objects["battlefieldB"] = { controller: "p1" };
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    // P1's Beginning Phase Scoring Step: P1 holds B — "When an opponent holds here" does not fire.
    expect(s.host.findCard(s.room, banner.id)?.zone).toBe("battlefieldB");
  });

  it("[C:Banner of Conquest][R830.2] multiple instances of Deploy are redundant", () => {
    const s = withDeck(["Banner of Conquest"]);
    const banner = put(s, "p1", "Banner of Conquest", "battlefieldB");
    s.room.rules!.objects[banner.id] = {
      ...(s.room.rules!.objects[banner.id] ?? {}),
      keywordGrants: [
        { id: "d1", keyword: "Deploy", duration: "permanent", turn: 1 },
        { id: "d2", keyword: "Deploy", duration: "permanent", turn: 1 },
      ],
    };
    put(s, "p2", "Treasure Hunter", "battlefieldB");
    s.room.rules!.objects["battlefieldB"] = { controller: "p2" };
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(s.host.findCard(s.room, banner.id)?.zone).toBe("trash");
  });
});

describe("Quick-Draw [R819]", () => {
  it("[C:Long Sword][R819.1.d] when you play it, attach it to a unit you control", () => {
    const s = withCards(["Long Sword"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Long Sword");
    s.as("p1").play("Long Sword").expectOk();
    const events = settle(s);
    expect(boardCard(s, "p1", "Long Sword")!.attachedToCardId).toBe(unit.id);
    expect(events.some((event) => event.type === "attach" && event.targetIds?.[0] === unit.id)).toBe(true);
  });

  it("[C:Long Sword][R819.2] multiple instances of Quick-Draw do not trigger separately", () => {
    const s = withCards(["Long Sword"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const card = s.handCard("p1", "Long Sword")!;
    s.room.rules!.objects[card.id] = {
      keywordGrants: [
        { id: "q1", keyword: "Quick-Draw", duration: "permanent", turn: 1 },
        { id: "q2", keyword: "Quick-Draw", duration: "permanent", turn: 1 },
      ],
    };
    fund(s, "p1", "Long Sword");
    s.as("p1").play("Long Sword").expectOk();
    const triggers = s.room.rules!.chain.filter((item) => item.abilityRef?.startsWith("keyword:quick-draw"));
    expect(triggers).toHaveLength(1);
    settle(s);
    expect(boardCard(s, "p1", "Long Sword")!.attachedToCardId).toBe(unit.id);
  });
});

describe("Weaponmaster [R821]", () => {
  it("[C:Combat Chef][R821.1.b] playing a Weaponmaster unit offers its Equip trigger", () => {
    const s = withCards(["Combat Chef", "Long Sword"]);
    put(s, "p1", "Long Sword", "base");
    fund(s, "p1", "Combat Chef");
    s.as("p1").play("Combat Chef").expectOk();
    const chef = boardCard(s, "p1", "Combat Chef")!;
    const trigger =
      s.room.rules!.chain.find((item) => item.abilityRef?.startsWith("keyword:weaponmaster")) ??
      s.room.rules!.triggers.find((entry) => entry.abilityRef?.startsWith("keyword:weaponmaster"));
    expect(trigger).toMatchObject({ sourceObjectId: chef.id });
    // 821.1.b: "you may" — the trigger is optional.
    expect(s.room.rules!.prompt).toMatchObject({ kind: "yes-no", rule: "403.1" });
  });

  it("[C:Combat Chef][C:Spinning Axe][R821.1.c.2][R821.1.c.3] the Equip cost is reduced by [A]", () => {
    const s = withCards(["Combat Chef", "Spinning Axe"]);
    put(s, "p1", "Spinning Axe", "base");
    fund(s, "p1", "Combat Chef");
    s.as("p1").play("Combat Chef").expectOk();
    settle(s);
    const chef = boardCard(s, "p1", "Combat Chef")!;
    // [Equip] [Rune] = [A]; Weaponmaster pays it reduced by [A] for free (821.1.c.2/.c.3).
    expect(boardCard(s, "p1", "Spinning Axe")!.attachedToCardId).toBe(chef.id);
    expect(s.room.rules!.pools.p1!.power.any ?? 0).toBe(0);
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Combat Chef][C:Long Sword][R821.1.c.3] an Equip cost without [A] is paid but not reduced", () => {
    const s = withCards(["Combat Chef", "Long Sword"]);
    put(s, "p1", "Long Sword", "base");
    fund(s, "p1", "Combat Chef");
    addPool(s, "p1", 0, { Fury: 1 });
    s.as("p1").play("Combat Chef").expectOk();
    settle(s);
    const chef = boardCard(s, "p1", "Combat Chef")!;
    expect(boardCard(s, "p1", "Long Sword")!.attachedToCardId).toBe(chef.id);
    expect(s.room.rules!.pools.p1!.power.Fury ?? 0).toBe(0);
  });

  it("[C:Combat Chef][R821.1.c.7] multiple instances of Weaponmaster trigger separately", () => {
    const s = withCards(["Combat Chef", "Spinning Axe"]);
    put(s, "p1", "Spinning Axe", "base");
    const card = s.handCard("p1", "Combat Chef")!;
    s.room.rules!.objects[card.id] = {
      keywordGrants: [
        { id: "w1", keyword: "Weaponmaster", duration: "permanent", turn: 1 },
        { id: "w2", keyword: "Weaponmaster", duration: "permanent", turn: 1 },
      ],
    };
    fund(s, "p1", "Combat Chef");
    s.as("p1").play("Combat Chef").expectOk();
    const prompt = s.expectPrompt("order", "p1").room.rules!.prompt!;
    // The printed instance plus the two grants: 821.1.c.7 triggers each separately.
    expect(prompt.options).toHaveLength(3);
  });

  it("[C:Combat Chef][C:Jagged Cutlass][R821.1.c.4] an Equipment without an Equip cost cannot be chosen to pay", () => {
    const s = withCards(["Combat Chef", "Jagged Cutlass"]);
    const cutlass = put(s, "p1", "Jagged Cutlass", "base");
    fund(s, "p1", "Combat Chef");
    s.as("p1").play("Combat Chef").expectOk();
    settle(s);
    expect(s.host.findCard(s.room, cutlass.id)?.zone).toBe("base");
  });

  it("[C:Combat Chef][C:Guardian Angel][R821.1.c.5] an unpayable Equip cost leaves the Equipment where it is", () => {
    const s = withCards(["Combat Chef", "Guardian Angel"]);
    const angel = put(s, "p1", "Guardian Angel", "base");
    fund(s, "p1", "Combat Chef");
    s.as("p1").play("Combat Chef").expectOk();
    settle(s);
    expect(s.host.findCard(s.room, angel.id)?.zone).toBe("base");
    expect(boardCard(s, "p1", "Guardian Angel")!.attachedToCardId).toBeUndefined();
    expect(effectiveMight(s.room, boardCard(s, "p1", "Combat Chef")!.id, s.host)).toBe(5);
  });
});
