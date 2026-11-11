import { describe, expect, it } from "vitest";

import { computeScoreTrack } from "../board-metrics";
import { scoreRailGeometry } from "../ScoreTrack";

describe("straight score track", () => {
  it("builds one column of 0..victory nodes for both sides, from the real victory score", () => {
    for (const max of [8, 9, 11]) {
      const t = computeScoreTrack({ maxValue: max, baseTrackNodeSize: "2.7rem" });
      expect(t.nodeCount).toBe(max + 1);
      expect(t.rowCount).toBe(max + 1);
      expect(t.playerValues).toEqual(Array.from({ length: max + 1 }, (_, i) => max - i));
      expect(t.opponentValues).toEqual(Array.from({ length: max + 1 }, (_, i) => i));
      expect(t.trackHeight).toContain(`* ${max + 1}`);
    }
  });

  it("shrinks rows with viewport height so the column fits small screens", () => {
    const t = computeScoreTrack({ maxValue: 8, baseTrackNodeSize: "2.7rem" });
    expect(t.trackRowSize).toContain("100dvh");
    expect(t.trackRowSize).toContain("/ 9");
    expect(t.trackNodeSize).toContain("var(--track-row-size)");
  });

  it("lights the connector from the 0 node up to the score, anchored per side", () => {
    const values = Array.from({ length: 9 }, (_, i) => 8 - i);
    const self = scoreRailGeometry(values, 3, "self");
    expect(self).toMatchObject({ nodeCount: 9, railRows: 8, litRows: 3, litAnchor: "bottom" });
    const opp = scoreRailGeometry([...values].reverse(), 5, "opponent");
    expect(opp).toMatchObject({ litRows: 5, litAnchor: "top" });
    expect(scoreRailGeometry(values, 99, "self").litRows).toBe(8);
    expect(scoreRailGeometry(values, -2, "self").litRows).toBe(0);
  });
});
