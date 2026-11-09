/**
 * Noxian Emissary (VEN-128) — "[Empower][1][Order] [Empowered][Deathknell] Play two 1 [Might]
 * Recruit unit tokens to your base."
 *
 * 827.1.c.1 Empower. The Empowered Deathknell ("when I die while Empowered", 808 / 828.1.c)
 * reads the kill event's last-known Empowered status (383.2.c.3.b / 424).
 */
import { registerCardScript } from "../registry";
import type { Trigger } from "@rift/protocol";
import { SELF, token } from "../dsl";
import { empower } from "./shared";

/** 808 / 383.2.c.3.b: "When I die while Empowered" (the kill event carries last-known status). */
const WHEN_I_DIE_EMPOWERED: Trigger = {
  kind: "event",
  event: { type: "die", subject: { ...SELF, cardType: "unit", empowered: true } },
};

registerCardScript({
  name: "Noxian Emissary",
  text: "[Empower][1][Order]([1][Order]: Empower me. Use only if not Empowered.)\n[Empowered][Deathknell] Play two 1 [Might] Recruit unit tokens to your base. (When I die while Empowered, get the effect.)",
  status: "implemented",
  abilities: [
    empower({ energy: 1, power: { Order: 1 } }),
    {
      kind: "triggered",
      trigger: WHEN_I_DIE_EMPOWERED,
      keywords: ["Deathknell"],
      effect: {
        op: "create",
        token: token("Recruit", { count: 2, might: 1, play: true }),
        zone: "base",
      },
    },
  ],
});
