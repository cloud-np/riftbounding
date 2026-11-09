/** Jayce, Hammer in Hand. */
import { notIntrinsic, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Jayce, Hammer in Hand",
  text: "When I become ready, choose one to give me this turn --\n• [Assault 2] (+2 [Might] while I'm an attacker)\n• [Deflect 2] (Opponents must pay [Rune][Rune] to choose me with a spell or ability.)\n• [Ganking] (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Assault"),
    ...notIntrinsic("Deflect"),
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "ready", subject: SELF } },
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "assault",
            label: "[Assault 2]",
            effect: {
              op: "grant_keyword",
              keyword: "Assault",
              value: 2,
              target: SELF,
              duration: "this-turn",
            },
          },
          {
            id: "deflect",
            label: "[Deflect 2]",
            effect: {
              op: "grant_keyword",
              keyword: "Deflect",
              value: 2,
              target: SELF,
              duration: "this-turn",
            },
          },
          {
            id: "ganking",
            label: "[Ganking]",
            effect: {
              op: "grant_keyword",
              keyword: "Ganking",
              target: SELF,
              duration: "this-turn",
            },
          },
        ],
      },
    },
  ],
});
