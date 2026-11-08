import { describe, expect, it } from "vitest";

import {
  dimBoardCustomization,
  resolveBoardCustomization,
  sleeveForSlot,
  tokenArtForName,
} from "../customization-resolve";

describe("board customization", () => {
  it("resolves resolved and raw slot documents", () => {
    const customization = resolveBoardCustomization({
      playmat: {
        boardImageSrc: "/cosmetics/playmat.webp",
        playmatIntensity: 0.6,
        playmatContrast: 0.5,
      },
      deckSleeve: { variant: { boardImageSrc: "/cosmetics/sleeve.webp" } },
      runeDeckSleeve: { src: "/cosmetics/rune.webp" },
      battlefieldSleeve: { src: "/cosmetics/bf.webp" },
      boardLines: "ink",
      pointsRail: "default",
      tokenArt: { gold: { src: "/cosmetics/gold.webp" } },
    });
    expect(customization.playmat?.src).toBe("/cosmetics/playmat.webp");
    expect(customization.playmat?.intensity).toBe(0.6);
    expect(sleeveForSlot(customization, "deck")?.src).toBe("/cosmetics/sleeve.webp");
    expect(sleeveForSlot(customization, "runeDeck")?.src).toBe("/cosmetics/rune.webp");
    expect(sleeveForSlot(customization, "battlefield")?.src).toBe("/cosmetics/bf.webp");
    expect(customization.boardLines).toBe("ink");
    expect(customization.pointsRail).toBeUndefined();
    expect(tokenArtForName(customization, "Gold")).toBe("/cosmetics/gold.webp");
  });

  it("dims playmat intensity/saturation and sleeve filter like the original", () => {
    const dimmed = dimBoardCustomization(
      {
        playmat: {
          src: "/playmat.webp",
          intensity: 0.8,
          contrast: 0.7,
        },
        deckSleeve: { src: "/sleeve.webp" },
      },
      50,
    );
    expect(dimmed.playmat?.intensity).toBe(0.5);
    expect(dimmed.playmat?.saturation).toBe(0.75);
    expect(dimmed.sleeveFilter).toBe("saturate(0.750)");
  });

  it("leaves 100% untouched", () => {
    const customization = { playmat: { src: "/playmat.webp", intensity: 0.8, contrast: 0.7 } };
    expect(dimBoardCustomization(customization, 100)).toBe(customization);
  });
});
