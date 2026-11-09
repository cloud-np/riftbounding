import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CardInstance } from "@rift/protocol";

import { CardArt } from "@/components/board/card/CardArt";
import { cardArtUrl, cardImageUrl, tokenArtUrl } from "@/lib/assets";

import { run } from "../../../../../packages/rules/test/rules/effects/helpers";
import { scenario } from "../../../../../packages/rules/test/scenarios/dsl";

function strictToken(name: string): CardInstance {
  const s = scenario();
  run(s, { op: "create", token: { name }, zone: "base" }, { controller: "p1" });
  const token = s.room.players[0]!.board!.base.find((card) => card.name === name);
  if (!token) throw new Error(`token ${name} was not created`);
  expect(token.source).toBe("token");
  return token;
}

describe("shared card art resolver", () => {
  it("[C:Sand Soldier] a real strict-room token uses the same local token art as the board", () => {
    const token = strictToken("Sand Soldier");
    expect(token.imageUrl).toBe("/tokens/SandSoldier.webp");
    expect(cardArtUrl(token, "preview")).toBe("/riftbound/static/tokens/SandSoldier.webp");
    const html = renderToStaticMarkup(createElement(CardArt, { card: token, profile: "preview" }));
    expect(html).toContain("/riftbound/static/tokens/SandSoldier.webp");
    expect(html).not.toContain("placeholder.svg");
  });

  it("[R187] every token type resolves to its catalog art (Bomb uses the card-backed token print)", () => {
    const expected: Record<string, string> = {
      "Sand Soldier": "/riftbound/static/tokens/SandSoldier.webp",
      Recruit: "/riftbound/static/tokens/Recruit.webp",
      "Recruit (NX)": "/riftbound/static/tokens/Recruit.webp",
      Reflection: "/riftbound/static/tokens/Reflection.webp",
      Bomb: "/riftbound/static/cards/RAD-T02.webp",
      Gold: "/riftbound/static/tokens/Gold.webp",
      Bird: "/riftbound/static/tokens/Bird.webp",
      Sprite: "/riftbound/static/tokens/Sprite.webp",
      "Shadow Clone": "/riftbound/static/tokens/ShadowClone.webp",
      Tentacle: "/riftbound/static/tokens/Tentacle.webp",
      Mech: "/riftbound/static/tokens/Mech.webp",
      Brush: "/riftbound/static/tokens/Brush.webp",
    };
    for (const [name, url] of Object.entries(expected)) {
      expect(cardArtUrl(strictToken(name), "preview")).toBe(url);
    }
    expect(tokenArtUrl("Sand Soldier", true)).toBe("/riftbound/static/tokens/thumbs/SandSoldier.webp");
    expect(tokenArtUrl("Bomb", true)).toBe("/riftbound/static/cards/RAD-T02.webp");
  });

  it("non-token cards keep the catalog card art, including name-only strict chain snapshots", () => {
    const card = { cardCode: "OGN-068", imageUrl: "/cards/OGN-068.webp", name: "Caitlyn, Patrolling" };
    expect(cardArtUrl(card, "board")).toBe(cardImageUrl(card, "board"));
    const snapshot = cardArtUrl({ name: "Caitlyn, Patrolling", source: "mainDeck" }, "preview");
    expect(snapshot).toContain("OGN-068");
    expect(snapshot).not.toContain("/tokens/");
  });

  it("an explicit board-customization token art wins over the catalog token art", () => {
    const token = strictToken("Sand Soldier");
    expect(cardArtUrl(token, "board", { tokenArt: "/cosmetics/sand.webp" })).toBe("/cosmetics/sand.webp");
  });
});
