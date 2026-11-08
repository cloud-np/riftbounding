import { describe, expect, it } from "vitest";

import * as sync from "./index";

describe("@rift/sync public surface", () => {
  it("exports the wire, patch, diff and redaction helpers", () => {
    expect(typeof sync.parseRealtimeMessage).toBe("function");
    expect(typeof sync.applyRuntimePatch).toBe("function");
    expect(typeof sync.applyPatch).toBe("function");
    expect(typeof sync.diffRuntimeState).toBe("function");
    expect(typeof sync.diffRoom).toBe("function");
    expect(typeof sync.redactRoomForViewer).toBe("function");
    expect(typeof sync.snapshotForViewer).toBe("function");
    expect(sync.MATCH_PARTY).toBe("match");
  });
});
