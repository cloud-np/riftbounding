import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RulesText } from "../RulesText";

describe("RulesText icon fallbacks", () => {
  it("renders a visible glyph beside every static icon image (might, rune, exhaust)", () => {
    const html = renderToStaticMarkup(<RulesText text="[Might] [Rune] [tap]" />);
    for (const kind of ["might", "rune", "tap"]) {
      expect(html).toMatch(new RegExp(`<svg[^>]*data-rules-glyph="${kind}"[^>]*>\\s*(<g>)?<`));
      expect(html).toContain(`data-rules-icon="${kind}"`);
    }
    expect(html.match(/<path/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("hides the glyph only through a loaded-image rule (a missing image never leaves a gap)", () => {
    const css = readFileSync(join(__dirname, "../../../../styles/cards.css"), "utf8");
    expect(css).toMatch(/\.rules-icon-wrap:has\(> img\[data-img-state="loaded"\]\) > \.rules-icon-glyph/);
  });

  it("keeps the energy badge as a numbered circle", () => {
    const html = renderToStaticMarkup(<RulesText text="Pay [2]" />);
    expect(html).toMatch(/data-rules-icon="energy"[^>]*>2</);
  });
});
