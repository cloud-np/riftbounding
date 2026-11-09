/**
 * Unleashed R4b — [Weaponmaster] in this set. UNL-223 "Veteran poro" shares its name with the
 * Spiritforged printing, whose script is the registered one; R4-engine lane D supplies the
 * Weaponmaster play trigger (821.1.b/c), so the UNL card now works without a second script.
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywords } from "../../../src";
import { fund, place } from "../../rules/effects/helpers";
import { withCards } from "./helpers";

describe("Unleashed R4b — attached-card keywords [R821]", () => {
  it("[C:Veteran poro][R821.1.b] playing the UNL Weaponmaster offers its Equip trigger", () => {
    const s = withCards(["Veteran poro", "Long Sword"]);
    place(s, "p1", "Long Sword", "base");
    fund(s, "p1", "Veteran poro");
    s.as("p1").play("Veteran poro").expectOk();
    const unit = s.findBoardCardAnywhere("Veteran poro")!;
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Weaponmaster");
    const queued =
      s.room.rules!.chain.find((item) => item.abilityRef?.startsWith("keyword:weaponmaster")) ??
      s.room.rules!.triggers.find((entry) => entry.abilityRef?.startsWith("keyword:weaponmaster"));
    expect(queued).toMatchObject({ sourceObjectId: unit.id });
    // 821.1.b: "you may [Equip]" — the trigger is optional (403.1).
    expect(s.room.rules!.prompt).toMatchObject({ kind: "yes-no", rule: "403.1" });
  });
});
