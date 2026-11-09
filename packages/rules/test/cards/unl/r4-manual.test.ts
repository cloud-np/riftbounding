/**
 * Unleashed (UNL) R4 — cards that remain on the §6.4 manual window.
 *
 * A script is registered for every one of them so the lane and the coverage report know why the
 * card is manual (the notes name the missing capability); the engine still opens the manual
 * window when the card resolves.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";

const MANUAL = [
  "Bone Skewer",
  "Conscription",
  "Determined Sentry",
  "Forgotten Library",
  "Forgotten Signpost",
  "Frigid Jewel",
  "Gardens of Becoming",
  "Heedless Resurrection",
  "Ivern, Green Father",
  "Jhin, Virtuoso",
  "Lotus Trap",
  "Mageseeker Investigator",
  "Prepared Neophyte",
  "Shadow Watcher",
  "Syndra, Transcendent",
  "The Academy",
  "The List",
  "Towering Pairofant",
  "Trapping Grounds",
  "Undying Loyalty",
  "Vi, Piltover Enforcer",
  "Zilean, Time Mage",
] as const;

describe("Unleashed R4 — manual cards", () => {
  for (const name of MANUAL) {
    it(`[C:${name}] is registered with a manual status and a note`, () => {
      const script = getCardScript(name);
      expect(script, `${name} is not registered`).toBeTruthy();
      expect(script?.status).toBe("manual");
      expect((script?.notes ?? "").length).toBeGreaterThan(0);
    });
  }
});
