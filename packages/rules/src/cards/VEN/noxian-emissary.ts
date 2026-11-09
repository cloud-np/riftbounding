/**
 * Noxian Emissary (VEN-128) — "[Empower][1][Order] [Empowered][Deathknell] Play two 1 [Might]
 * Recruit unit tokens to your base."
 *
 * 827.1.c.1 Empower. The Empowered Deathknell ("when I die while Empowered", 808 / 828.1.c) is
 * not scripted: see notes.
 */
import { registerCardScript } from "../registry";
import { empower } from "./shared";

registerCardScript({
  name: "Noxian Emissary",
  text: "[Empower][1][Order]([1][Order]: Empower me. Use only if not Empowered.)\n[Empowered][Deathknell] Play two 1 [Might] Recruit unit tokens to your base. (When I die while Empowered, get the effect.)",
  status: "partial",
  notes:
    "[Empowered][Deathknell] is not automated: the kill event carries no last-known Empowered status (the rules object is deleted on kill), so 'when I die while Empowered' cannot be checked (808, 828.1.c, 359.3.e.13).",
  abilities: [empower({ energy: 1, power: { Order: 1 } })],
});
