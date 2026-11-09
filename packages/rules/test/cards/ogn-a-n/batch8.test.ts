/**
 * Origins A–N, batch 8: cards whose text cannot (yet) be automated, plus Garbage Grabber and Kai'Sa.
 */
import { describe, expect, it } from "vitest";
import { getCardScript, listActivatedAbilities } from "../../../src";
import { boardOf, place, zoneOf } from "../../rules/effects/helpers";
import { drain, toTrash, withCards, type S } from "./helpers";

function activate(
  s: S,
  player: string,
  objectId: string,
  name: string,
  extra: Record<string, unknown> = {},
): S {
  const ref = listActivatedAbilities(name)[0]!.ref;
  return s.as(player).apply({ type: "rules_activate", objectId, ability: ref, ...extra } as never);
}

describe("Origins A–N — manual cards (text not automatable; registered honestly)", () => {
  const rows: Array<[string, string]> = [
    ["Ava Achiever", "[R383.4.e][R420.3]"],
    ["Baited Hook", "[R357.2][R420.3]"],
    ["Blind Fury", "[R425][R420.3]"],
    ["Bullet Time", "[R418]"],
    ["Dazzling Aurora", "[R425][R420.3]"],
    ["Divine Judgment", "[R355.18]"],
    ["Ember Monk", "[R811.1.b]"],
    ["Flame Chompers", "[R385][R423]"],
    ["Fox-Fire", "[R355.13]"],
    ["Heimerdinger, Inventor", "[R482]"],
    ["Karthus, Eternal", "[R383.1]"],
    ["Miss Fortune, Buccaneer", "[R355.2]"],
    ["Mystic Reversal", "[R360][R361]"],
    ["Noxus Saboteur", "[R811.1.c]"],
  ];
  for (const [name, tags] of rows) {
    it(`[C:${name}]${tags} is registered as manual and names what is not automated`, () => {
      const script = getCardScript(name)!;
      expect(script.status).toBe("manual");
      expect(script.notes).toMatch(/^Not automated/);
      expect(script.abilities).toHaveLength(0);
    });
  }
});

describe("Origins A–N — batch 8 automated parts", () => {
  it("[C:Garbage Grabber][R417.1][R432] recycle 3 from your trash, [1], [Tap]: draw 1", () => {
    const s = withCards(["Garbage Grabber"]);
    const grabber = place(s, "p1", "Garbage Grabber", "base");
    const trashed = [1, 2, 3].map(() => boardOf(s, "p1").deck.shift()!);
    boardOf(s, "p1").trash.push(...trashed);
    s.room.rules!.pools.p1 = { ...(s.room.rules!.pools.p1 ?? {}), energy: 1 } as never;
    const hand = boardOf(s, "p1").hand.length;
    activate(s, "p1", grabber.id, "Garbage Grabber").expectOk();
    drain(s);
    for (const card of trashed) expect(zoneOf(s, card.id)).toBe("deck");
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
    expect(s.host.isExhausted(s.room, grabber.id)).toBe(true);
    void toTrash;
  });

  it("[C:Kai'Sa, Daughter of the Void][R430.2][R430.5] [Tap]: [Reaction] - [Add] one Power; resolves immediately", () => {
    const s = withCards(["Kai'Sa, Daughter of the Void"]);
    const legend = place(s, "p1", "Kai'Sa, Daughter of the Void", "legend");
    activate(s, "p1", legend.id, "Kai'Sa, Daughter of the Void").expectOk();
    expect(s.room.rules!.pools.p1!.power).toEqual({ any: 1 });
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(getCardScript("Kai'Sa, Daughter of the Void")!.status).toBe("partial");
  });
});
