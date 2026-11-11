import { describe, expect, it } from "vitest";

import { boardTranslator, text } from "../../sidebar/i18n";

describe("VictoryDefeatOverlay locale strings", () => {
  it("resolves French Victory/Defeat via the board translator", () => {
    const tr = boardTranslator("fr");
    expect(text(tr, "rules.ui.gameResult.victory", "Victory")).toBe("Victoire");
    expect(text(tr, "rules.ui.gameResult.defeat", "Defeat")).toBe("Défaite");
  });

  it("falls back to English for an unknown locale", () => {
    const tr = boardTranslator(undefined);
    expect(text(tr, "rules.ui.gameResult.victory", "Victory")).toBe("Victory");
    expect(text(tr, "rules.ui.gameResult.defeat", "Defeat")).toBe("Defeat");
  });
});
