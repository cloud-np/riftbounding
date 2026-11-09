import { describe, expect, it } from "vitest";
import { cards } from "./catalog";
import { CATALOG_KEYWORD_OVERRIDES, keywordsInText, unexplainedCatalogKeywords } from "./catalog-keywords";

describe("catalog keywords vs printed text (G6)", () => {
  const playable = cards().filter((card) => !card._isToken);

  it("every catalog keyword is named by the card's own text or listed in CATALOG_KEYWORD_OVERRIDES", () => {
    const missing: string[] = [];
    for (const card of playable) {
      for (const keyword of unexplainedCatalogKeywords(card)) {
        if (!CATALOG_KEYWORD_OVERRIDES[card.name]?.[keyword]) missing.push(`${card.id} ${card.name}: ${keyword}`);
      }
    }
    expect(missing, "classify each in CATALOG_KEYWORD_OVERRIDES (intrinsic / not-intrinsic)").toEqual([]);
  });

  it("every override still matches a catalog mismatch (no stale entries)", () => {
    const stale: string[] = [];
    for (const [name, keywords] of Object.entries(CATALOG_KEYWORD_OVERRIDES)) {
      const printings = playable.filter((card) => card.name === name);
      for (const keyword of Object.keys(keywords)) {
        if (!printings.some((card) => unexplainedCatalogKeywords(card).includes(keyword))) stale.push(`${name}: ${keyword}`);
      }
    }
    expect(stale).toEqual([]);
  });

  it("keywordsInText ignores reminder text, quoted grants, errata banners and flavor text", () => {
    expect([...keywordsInText("[Ambush] (You may play me as a [Reaction] …)")]).toEqual(["ambush"]);
    expect([...keywordsInText('Play a Gold gear token. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")')]).toEqual([]);
    expect([...keywordsInText("[Assault 2] (+2 [Might] while I'm an attacker.)\n\nFlavor Text\n\n[Shield]")]).toEqual(["assault"]);
    expect([...keywordsInText("Hidden (Hide now.)\nEquip [Body] ([Body]: Attach this.)")].sort()).toEqual(["body", "equip", "hidden"]);
  });
});
