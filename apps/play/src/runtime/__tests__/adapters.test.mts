import { describe, expect, it } from "vitest";

import { hasEngineApply } from "../adapters/engine";
import { hasSyncPackagePatchApply } from "../adapters/sync";

describe("runtime adapters", () => {
  it("uses the real @rift/engine applyGameAction export", () => {
    expect(hasEngineApply()).toBe(true);
  });

  it("uses the real @rift/sync runtime patch helpers", () => {
    expect(hasSyncPackagePatchApply()).toBe(true);
  });
});
