import { describe, expect, it } from "vitest";

import {
  TOKEN_ART,
  TOKEN_CARD_IDS,
  allTokenArtPaths,
  isGoldToken,
  isSpawnableToken,
  tokenArtOf,
  tokenImage,
  tokenMightOf,
  tokenThumb,
  tokenTypeOf,
} from "./index";

describe("token catalog", () => {
  it("maps token names to art", () => {
    expect(tokenArtOf("Bird")).toBe("/tokens/Bird.webp");
    expect(tokenArtOf("bird token")).toBe("/tokens/Bird.webp");
    expect(tokenArtOf("Gold Gear")).toBe("/tokens/Gold.webp");
    expect(tokenArtOf("Sand Soldier token")).toBe("/tokens/SandSoldier.webp");
    expect(tokenArtOf("Gold")).toBe("/tokens/Gold.webp");
    expect(tokenArtOf("Unknown Thing")).toBeUndefined();
    expect(allTokenArtPaths()).toHaveLength(11);
  });

  it("infers token type and might", () => {
    expect(tokenTypeOf("Gold")).toBe("Gear");
    expect(tokenTypeOf("Bomb")).toBe("Gear");
    expect(tokenTypeOf("Bird")).toBe("Unit");
    expect(tokenMightOf("Mech")).toBe(3);
    expect(tokenMightOf("Sand Soldier")).toBe(2);
    expect(tokenMightOf("Shadow Clone")).toBe(0);
    expect(tokenMightOf("Gold")).toBeUndefined();
  });

  it("detects gold and spawnable tokens", () => {
    expect(isGoldToken("Gold Gear Token")).toBe(true);
    expect(isGoldToken("Bird")).toBe(false);
    expect(isSpawnableToken("Sprite")).toBe(false);
    expect(isSpawnableToken("Reflection")).toBe(false);
    expect(isSpawnableToken("Bomb")).toBe(false);
    expect(isSpawnableToken("Bird")).toBe(true);
  });

  it("builds token image paths", () => {
    expect(tokenImage("Bird")).toBe("/tokens/Bird.webp");
    expect(tokenThumb("Bird")).toBe("/tokens/thumbs/Bird.webp");
  });

  it("exposes the token art map and token card ids", () => {
    expect(TOKEN_ART.Bird).toBe("UNL-T02");
    expect(TOKEN_ART.Gold).toBe("SFD-T03");
    expect(TOKEN_CARD_IDS.has("OGN-271")).toBe(true);
    expect(TOKEN_CARD_IDS.has("UNL-T01")).toBe(true);
  });
});
