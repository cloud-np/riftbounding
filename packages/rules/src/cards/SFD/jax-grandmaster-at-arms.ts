/** Jax, Grandmaster at Arms. */
import { custom, registerCardScript, SELF } from "../sdk";
import { EQUIPMENT, target } from "./custom";

registerCardScript({
  name: "Jax, Grandmaster at Arms",
  text: "[1], [Tap]: Attach a detached Equipment you control to a unit you control.\n[Tap]: Attach an attached Equipment you control to a unit you control.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "attach",
        gear: {
          ...EQUIPMENT,
          chosen: true,
          controller: "self",
          where: custom("sfd:it-attached", { attached: false }),
        },
        to: target({ controller: "self" }),
      },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "attach",
        gear: {
          ...EQUIPMENT,
          chosen: true,
          controller: "self",
          where: custom("sfd:it-attached", { attached: true }),
        },
        to: target({ controller: "self" }),
      },
    },
  ],
});
