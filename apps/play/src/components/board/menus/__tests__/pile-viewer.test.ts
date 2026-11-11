import { describe, expect, it } from "vitest";

import { isPileViewerReadOnly } from "../PileViewer";

describe("PileViewer strict gating", () => {
  it("is read-only in strict mode, editable in sandbox and strict manual mode", () => {
    expect(isPileViewerReadOnly({ strictView: {}, strictManual: false })).toBe(true);
    expect(isPileViewerReadOnly({ strictView: {}, strictManual: true })).toBe(false);
    expect(isPileViewerReadOnly({ strictView: null, strictManual: false })).toBe(false);
    expect(isPileViewerReadOnly(null)).toBe(false);
  });
});
