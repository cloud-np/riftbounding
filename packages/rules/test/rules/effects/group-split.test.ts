/**
 * R3-engine: group targeting (355.11) and damage splitting (355.14 / 418 / 715.3).
 *
 * The card scripts below are registered by this suite only (the set folders belong to the card
 * agents); each reproduces the printed text of the cited card.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Ability, CardScript } from "@rift/protocol";
import { explainIllegal, lookupAbility, requiredChoices, validateChoices } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, fund, place, registerAll, run, spell, zoneOf } from "./helpers";

type S = ReturnType<typeof scenario>;

function withCards(p1: string[], p2: string[] = []): S {
  const s = scenario({ extraCards: { p1, p2 } });
  for (const [player, names] of [["p1", p1], ["p2", p2]] as const) {
    for (const name of names) {
      if (!boardOf(s, player).hand.some((card) => card.name === name)) s.moveDeckCardToHand(player, name);
    }
  }
  return s;
}

/** Create `count` Recruit unit tokens for `player` at `zone` (440 / 187) and return their ids. */
function recruits(s: S, player: string, zone: string, count: number): string[] {
  const before = new Set(boardOf(s, player)[zone as "base"].map((card) => card.id));
  run(s, { op: "create", token: { name: "Recruit", count }, zone: zone as "base" }, { controller: player });
  return boardOf(s, player)[zone as "base"].filter((card) => !before.has(card.id)).map((card) => card.id);
}

const SCORCHED_EARTH = spell(
  "Scorched Earth",
  {
    op: "deal_split",
    amount: 5,
    target: { chosen: true, cardType: "unit", zone: "battlefield", group: { sameLocation: true } },
  },
  "[Action] Deal 5 damage split among units at a single battlefield.",
);

const FOX_FIRE = spell(
  "Fox-Fire",
  {
    op: "kill",
    target: {
      chosen: true,
      cardType: "unit",
      zone: "battlefield",
      anyNumber: true,
      group: { sameLocation: true, totalMight: { op: "lte", value: 4 } },
    },
  },
  "[HIDDEN] [ACTION] Kill any number of units at a battlefield with total Might 4 or less.",
);

const BELLOWS_BREATH = spell(
  "Bellows Breath",
  { op: "deal", amount: 1, target: { chosen: true, cardType: "unit", maxCount: 3, group: { sameLocation: true } } },
  "[Action] [Repeat][1][Mind] Deal 1 to up to three units at the same location.",
);

const ALPHA_STRIKE = spell(
  "Alpha Strike",
  {
    op: "deal_split",
    amount: { kind: "might", selector: { targetRef: "friend" } },
    source: { chosen: true, targetRef: "friend", cardType: "unit", controller: "self" },
    target: { chosen: true, targetRef: "foes", cardType: "unit", controller: "opponent", zone: "battlefield" },
  },
  "[Action] Choose a friendly unit. It deals damage equal to its Might split among enemy units at battlefields.",
);

const VOLIBEAR: CardScript = {
  name: "Volibear, Furious",
  text: "[DEFLECT 2] When I attack, deal 5 damage split among any number of enemy units here.",
  status: "partial",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: { targetRef: "self" } } },
      effect: {
        op: "deal_split",
        amount: 5,
        target: { chosen: true, cardType: "unit", controller: "opponent", zone: { kind: "chosen", ref: "here" }, anyNumber: true },
      },
    },
  ],
};

beforeAll(() => registerAll([SCORCHED_EARTH, FOX_FIRE, BELLOWS_BREATH, ALPHA_STRIKE, VOLIBEAR]));

function spellAbility(name: string): Ability {
  return lookupAbility(name, "spell")!.ability;
}

describe("damage splitting [R355.14][R418]", () => {
  it("[R355.14.a][R355.14.b][R355.14.c][EX:355.14.c] split targets are chosen on play, up to the damage available", () => {
    const s = withCards(["Scorched Earth"]);
    const ids = recruits(s, "p2", "battlefieldA", 6);
    const [spec] = requiredChoices(s.room, s.host, spellAbility("Scorched Earth"), { controller: "p1", choices: {} });
    expect(spec).toMatchObject({ key: "target:0", targeted: true, min: 1, max: 5, rule: "355.14" });
    expect(spec!.data).toMatchObject({ split: true, total: 5, group: { sameLocation: true } });
    const ctx = (targets: string[]) => ({ controller: "p1", choices: { "target:0": targets } });
    expect(validateChoices(s.room, s.host, spellAbility("Scorched Earth"), ctx(ids.slice(0, 5))).ok).toBe(true);
    expect(validateChoices(s.room, s.host, spellAbility("Scorched Earth"), ctx(ids))).toMatchObject({ ok: false, code: "invalid_choice" });
    // 355.14.d: each target is individually valid; naming one twice is not two targets.
    expect(validateChoices(s.room, s.host, spellAbility("Scorched Earth"), ctx([ids[0]!, ids[0]!]))).toMatchObject({ ok: false });
  });

  it("[R715.3][EX:715.3][C:Volibear, Furious][C:Annie, Fiery] Bonus Damage is split too and raises the target cap to 6", () => {
    const s = withCards([], []);
    const volibear = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const ability = VOLIBEAR.abilities[0]!;
    recruits(s, "p2", "battlefieldA", 7);
    const ctx = { controller: "p1", sourceObjectId: volibear.id, choices: {} };
    // 355.13: "any number of" allows zero targets.
    expect(requiredChoices(s.room, s.host, ability, ctx)[0]).toMatchObject({ min: 0, max: 5 });
    run(s, {
      op: "continuous",
      modifier: { kind: "custom", id: "bonus-damage", params: { amount: 1 } },
      duration: "this-turn",
    });
    expect(requiredChoices(s.room, s.host, ability, ctx)[0]).toMatchObject({ min: 0, max: 6, data: { total: 6 } });
  });

  it("[R355.14.e][R355.14.f][R355.14.g][C:Scorched Earth] the division is chosen on resolution, at least 1 each", () => {
    const s = withCards(["Scorched Earth"]);
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "battlefieldA");
    const c = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Scorched Earth");
    s.as("p1").play("Scorched Earth", { choices: { "target:0": [a.id, b.id, c.id] } }).expectOk();
    s.as("p2").pass().expectOk();
    const prompt = s.expectPrompt("damage-assignment", "p1").room.rules!.prompt!;
    expect(prompt.rule).toBe("355.14.e");
    expect(prompt.data?.ask).toMatchObject({ answer: "split", total: 5, targets: [a.id, b.id, c.id], minEach: 1 });
    // 355.14.f / 355.14.g: every target gets a positive amount; the shares add up to 5.
    const zero = { assignments: [{ targetId: a.id, amount: 5 }, { targetId: b.id, amount: 0 }, { targetId: c.id, amount: 0 }] };
    expect(explainIllegal(s.room, "p1", { type: "rules_choose", promptId: prompt.id, answer: zero }, s.host)).toMatchObject({
      ok: false,
      rule: "355.14.g",
    });
    s.as("p1").choose(zero).expectError("invalid_choice");
    s.as("p1").choose({ assignments: [{ targetId: a.id, amount: 1 }, { targetId: b.id, amount: 1 }, { targetId: c.id, amount: 1 }] });
    s.expectError("invalid_choice");
    expect(s.room.rules!.prompt?.id).toBe(prompt.id);
    s.as("p1").choose({ assignments: [{ targetId: a.id, amount: 1 }, { targetId: b.id, amount: 1 }, { targetId: c.id, amount: 3 }] }).expectOk();
    expect(s.room.rules!.objects[a.id]?.damage).toBe(1);
    expect(s.room.rules!.objects[b.id]?.damage).toBe(1);
    expect(zoneOf(s, c.id)).toBe("trash");
    expect(boardOf(s, "p1").trash.some((card) => card.name === "Scorched Earth")).toBe(true);
  });

  it("[R418.1.d][R355.14.e] one target takes all the damage; N targets for N damage take 1 each (no prompt)", () => {
    const s = withCards([]);
    const big = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const effect = SCORCHED_EARTH.abilities[0]!.kind === "spell" ? SCORCHED_EARTH.abilities[0]!.effect : null;
    expect(run(s, effect!, { choices: { "target:0": [big.id] } }).status).toBe("resolved");
    expect(s.room.rules!.objects[big.id]?.damage).toBe(5);
    const five = recruits(s, "p2", "battlefieldB", 5);
    const { status, events } = run(s, effect!, { choices: { "target:0": five } });
    expect(status).toBe("resolved");
    expect(events.filter((event) => event.type === "damage").map((event) => event.amount)).toEqual([1, 1, 1, 1, 1]);
  });

  it("[R355.11.a][C:Scorched Earth] units at two battlefields are not \"units at a single battlefield\"", () => {
    const s = withCards(["Scorched Earth"]);
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "battlefieldB");
    fund(s, "p1", "Scorched Earth");
    const intent = { type: "rules_play" as const, cardId: boardOf(s, "p1").hand.find((card) => card.name === "Scorched Earth")!.id, choices: { "target:0": [a.id, b.id] } };
    expect(explainIllegal(s.room, "p1", intent, s.host)).toMatchObject({ ok: false, code: "illegal_target", rule: "355.11.a" });
    s.as("p1").apply(intent).expectError("illegal_target");
    expect(s.lastError()).toMatchObject({ rule: "355.11.a" });
  });

  it("[R355.11.a][R411.2] a play prompt answer whose group does not qualify is rejected and stays pending", () => {
    const s = withCards(["Scorched Earth"]);
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "battlefieldB");
    const c = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Scorched Earth");
    s.as("p1").play("Scorched Earth").expectOk();
    const prompt = s.expectPrompt("choose-target", "p1").room.rules!.prompt!;
    expect(prompt.data?.spec).toMatchObject({ split: true, group: { sameLocation: true } });
    s.as("p1").choose({ optionIds: [a.id, b.id] }).expectError("illegal_target");
    expect(s.room.rules!.prompt?.id).toBe(prompt.id);
    s.as("p1").choose({ optionIds: [a.id, c.id] }).expectOk();
    expect(s.room.rules!.chain.at(-1)?.choices["target:0"]).toEqual([a.id, c.id]);
  });

  it("[R355.14.h][R355.14.h.1][EX:355.14.h.1][C:Alpha Strike] with less damage than targets, exactly one target per point remains", () => {
    const s = withCards(["Alpha Strike"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[friend.id] = { ...(s.room.rules!.objects[friend.id] ?? {}), temporaryMight: 2 };
    const foes = recruits(s, "p2", "battlefieldA", 5);
    fund(s, "p1", "Alpha Strike");
    // 355.14.c: the 5 [M] unit may split among up to 5 targets.
    const specs = requiredChoices(s.room, s.host, spellAbility("Alpha Strike"), { controller: "p1", choices: { friend: friend.id } });
    expect(specs[0]).toMatchObject({ key: "foes", max: 5 });
    s.as("p1").play("Alpha Strike", { choices: { friend: friend.id, foes } }).expectOk();
    // In reaction the friendly unit loses 2 Might (Frigid Touch in the example): 3 damage to split.
    s.room.rules!.objects[friend.id]!.temporaryMight = 0;
    s.as("p2").pass().expectOk();
    const prompt = s.expectPrompt("choose-target", "p1").room.rules!.prompt!;
    expect(prompt).toMatchObject({ rule: "355.14.h", min: 3, max: 3 });
    // 355.14.h.1: they cannot keep fewer targets than they have damage to split.
    s.as("p1").choose({ optionIds: foes.slice(0, 1) }).expectError("invalid_choice");
    s.as("p1").choose({ optionIds: foes.slice(0, 3) }).expectOk();
    // 3 damage among 3 targets: 1 each, no division prompt; 418.6.b.3: dealt by the friendly unit.
    expect(s.room.rules!.prompt).toBeNull();
    const damage = s.events().filter((event) => event.type === "damage");
    expect(damage.map((event) => event.cardId)).toEqual(foes.slice(0, 3));
    expect(damage.every((event) => event.sourceObjectId === friend.id)).toBe(true);
    for (const id of foes.slice(3)) expect(zoneOf(s, id)).toBe("battlefieldA");
  });
});

describe("group targeting requirements [R355.11]", () => {
  it("[R355.11.a][R355.13][C:Fox-Fire] any group with total Might 4 or less at one battlefield may be chosen", () => {
    const s = withCards(["Fox-Fire"]);
    const ids = recruits(s, "p2", "battlefieldA", 4);
    const other = recruits(s, "p2", "battlefieldB", 1);
    const ability = spellAbility("Fox-Fire");
    const [spec] = requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} });
    expect(spec).toMatchObject({ min: 0, data: { group: { sameLocation: true, totalMight: { op: "lte", value: 4 } } } });
    const ok = (targets: string[]) => validateChoices(s.room, s.host, ability, { controller: "p1", choices: { "target:0": targets } });
    expect(ok(ids).ok).toBe(true);
    expect(ok([]).ok).toBe(true);
    expect(ok([...ids.slice(0, 3), ...other])).toMatchObject({ ok: false, rule: "355.11.a" });
    s.room.rules!.objects[ids[0]!]!.temporaryMight = 1;
    expect(ok(ids)).toMatchObject({ ok: false, rule: "355.11.a" });
  });

  it("[R355.11.b][R355.11.b.1][EX:355.11.b][C:Fox-Fire] a group that no longer qualifies is reduced to a maximal legal subset", () => {
    const s = withCards(["Fox-Fire"]);
    const ids = recruits(s, "p2", "battlefieldA", 4);
    fund(s, "p1", "Fox-Fire");
    s.as("p1").play("Fox-Fire", { choices: { "target:0": ids } }).expectOk();
    // As a Reaction two of the Recruits get +1 [M]: Mights 1, 1, 2, 2.
    s.room.rules!.objects[ids[2]!]!.temporaryMight = 1;
    s.room.rules!.objects[ids[3]!]!.temporaryMight = 1;
    s.as("p2").pass().expectOk();
    const prompt = s.expectPrompt("choose-target", "p1").room.rules!.prompt!;
    expect(prompt.rule).toBe("355.11.b");
    expect(prompt.data?.ask).toMatchObject({ answer: "objects" });
    const subsets = (prompt.data!.ask as { subsets: string[][] }).subsets.map((subset) => [...subset].sort());
    expect(subsets).toHaveLength(3);
    expect(subsets).toContainEqual([ids[2]!, ids[3]!].sort());
    expect(subsets).toContainEqual([ids[0]!, ids[1]!, ids[2]!].sort());
    // A 1 [M] and a 2 [M] Recruit is legal as a group but not maximal (another 1 [M] fits).
    s.as("p1").choose({ optionIds: [ids[0]!, ids[2]!] }).expectError("invalid_choice");
    expect(s.lastError()).toMatchObject({ rule: "355.11.b.1" });
    s.as("p1").choose({ optionIds: [ids[2]!, ids[3]!] }).expectOk();
    expect(zoneOf(s, ids[2]!)).toBeNull();
    expect(zoneOf(s, ids[3]!)).toBeNull();
    expect(zoneOf(s, ids[0]!)).toBe("battlefieldA");
    expect(s.events().some((event) => event.type === "group_subset")).toBe(true);
  });

  it("[R355.11.b.1][EX:355.11.b.1][C:Bellows Breath][C:Flash] after two targets move to base, either subset may be chosen but not a partial one", () => {
    const s = withCards(["Bellows Breath"]);
    const ids = recruits(s, "p2", "battlefieldA", 3);
    fund(s, "p1", "Bellows Breath");
    s.as("p1").play("Bellows Breath", { choices: { "target:0": ids } }).expectOk();
    // In reaction their controller plays Flash, moving two of them to base.
    s.host.moveCard(s.room, "p2", "battlefieldA", "base", ids[0]!);
    s.host.moveCard(s.room, "p2", "battlefieldA", "base", ids[1]!);
    s.as("p2").pass().expectOk();
    const prompt = s.expectPrompt("choose-target", "p1").room.rules!.prompt!;
    expect(prompt).toMatchObject({ min: 1, max: 2 });
    s.as("p1").choose({ optionIds: [ids[0]!] }).expectError("invalid_choice");
    s.as("p1").choose({ optionIds: [ids[0]!, ids[1]!] }).expectOk();
    expect(zoneOf(s, ids[0]!)).toBeNull();
    expect(zoneOf(s, ids[1]!)).toBeNull();
    expect(zoneOf(s, ids[2]!)).toBe("battlefieldA");
  });

  it("[R355.11.b] a single maximal subset is kept without a prompt", () => {
    const s = withCards(["Fox-Fire"]);
    const ids = recruits(s, "p2", "battlefieldA", 3);
    fund(s, "p1", "Fox-Fire");
    s.as("p1").play("Fox-Fire", { choices: { "target:0": ids } }).expectOk();
    // One Recruit becomes 5 [M]: it cannot be part of any legal group, so the other two are the
    // only maximal legal subset.
    s.room.rules!.objects[ids[0]!]!.temporaryMight = 4;
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.prompt).toBeNull();
    expect(zoneOf(s, ids[0]!)).toBe("battlefieldA");
    expect(zoneOf(s, ids[1]!)).toBeNull();
    expect(zoneOf(s, ids[2]!)).toBeNull();
  });
});
