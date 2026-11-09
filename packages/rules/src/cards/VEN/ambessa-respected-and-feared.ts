/**
 * Ambessa, Respected and Feared (VEN-136) — "[Empower][1][Order][Order] [Empowered] I have
 * [Assault 2]. [Empowered] When I attack, kill an enemy unit here with less Might than me."
 *
 * 828.1.c: both Dependent abilities apply only while I'm Empowered; the Might comparison is
 * part of the target's requirements (355.9) and re-checked on resolution (359.3.e.2).
 */
import { SELF_EMPOWERED, WHEN_I_ATTACK, empower, notIntrinsic, whileEmpowered } from "./shared";
import { aUnit, HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ambessa, Respected and Feared",
  text: "[Empower][1][Order][Order] ([1][Order][Order]: Empower me. Use only if not Empowered.)\n[Empowered] I have [Assault 2]. (+2 [Might] while I'm an attacker.)\n[Empowered] When I attack, kill an enemy unit here with less Might than me.",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Assault"),
    empower({ energy: 1, power: { Order: 2 } }),
    whileEmpowered({ kind: "keyword", keyword: "Assault", value: 2, target: SELF }),
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      condition: SELF_EMPOWERED,
      effect: {
        op: "kill",
        target: aUnit({
          controller: "opponent",
          zone: HERE,
          might: { op: "lt", value: { kind: "might", selector: SELF } },
        }),
      },
    },
  ],
});
