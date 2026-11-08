import { describe, expect, it } from "vitest";

import {
  boardModeFor,
  isCompactViewport,
  isPhonePortraitViewport,
  type BoardViewport,
} from "../use-board-viewport";

function viewport(overrides: Partial<BoardViewport>): BoardViewport {
  return {
    widthPx: 1440,
    heightPx: 900,
    layoutHeightPx: 900,
    visibleHeightPx: 900,
    visibleTopPx: 0,
    orientation: "landscape",
    keyboardOpen: false,
    coarsePointer: false,
    ...overrides,
  };
}

describe("board viewport detection (original 637428)", () => {
  it("keeps fine pointers on the desktop layout even in narrow windows", () => {
    expect(boardModeFor(viewport({ widthPx: 1000, heightPx: 800 }))).toBe("desktop");
    expect(boardModeFor(viewport({ widthPx: 390, heightPx: 844 }))).toBe("desktop");
  });

  it("uses touch below 1440 wide or 800 tall on coarse pointers", () => {
    expect(boardModeFor(viewport({ widthPx: 1440, heightPx: 900, coarsePointer: true }))).toBe(
      "desktop",
    );
    expect(boardModeFor(viewport({ widthPx: 1439, heightPx: 900, coarsePointer: true }))).toBe(
      "touch",
    );
    expect(boardModeFor(viewport({ widthPx: 1920, heightPx: 799, coarsePointer: true }))).toBe(
      "touch",
    );
  });

  it("detects phone portrait at 390x844", () => {
    const phone = viewport({
      widthPx: 390,
      heightPx: 844,
      layoutHeightPx: 844,
      visibleHeightPx: 844,
      orientation: "portrait",
      coarsePointer: true,
    });
    const mode = boardModeFor(phone);
    expect(mode).toBe("touch");
    expect(isPhonePortraitViewport(phone, mode)).toBe(true);
    expect(isCompactViewport(phone, mode)).toBe(true);
  });

  it("uses the touch (but not phone) layout on an 820x1180 tablet", () => {
    const tablet = viewport({
      widthPx: 820,
      heightPx: 1180,
      layoutHeightPx: 1180,
      visibleHeightPx: 1180,
      orientation: "portrait",
      coarsePointer: true,
    });
    const mode = boardModeFor(tablet);
    expect(mode).toBe("touch");
    // 1180 < 1.72 * 820 (1410), so this is a tablet arrangement, not phone.
    expect(isPhonePortraitViewport(tablet, mode)).toBe(false);
    expect(isCompactViewport(tablet, mode)).toBe(true);
  });

  it("uses touch landscape on a 1000x800 tablet", () => {
    const tablet = viewport({
      widthPx: 1000,
      heightPx: 800,
      layoutHeightPx: 800,
      visibleHeightPx: 800,
      coarsePointer: true,
    });
    const mode = boardModeFor(tablet);
    expect(mode).toBe("touch");
    expect(isPhonePortraitViewport(tablet, mode)).toBe(false);
    expect(isCompactViewport(tablet, mode)).toBe(false);
  });

  it("treats a 600x1000 phone as portrait and a short 900x500 viewport as non-portrait", () => {
    const tallPhone = viewport({
      widthPx: 600,
      heightPx: 1000,
      layoutHeightPx: 1000,
      orientation: "portrait",
      coarsePointer: true,
    });
    expect(isPhonePortraitViewport(tallPhone, "touch")).toBe(true);

    const shortLandscape = viewport({
      widthPx: 900,
      heightPx: 500,
      layoutHeightPx: 500,
      coarsePointer: true,
    });
    expect(isPhonePortraitViewport(shortLandscape, "touch")).toBe(false);
    expect(isCompactViewport(shortLandscape, "touch")).toBe(false);
  });
});
