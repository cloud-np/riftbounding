/** Undying Legion. */
import { LEGION, registerCardScript } from "../sdk";

registerCardScript({
  name: "Undying Legion",
  text: "[Legion] You may play me from your trash for [3] [Fury]. (Get the effect if you've played another card this turn.)",
  status: "implemented",
  // 812.2 / 420.1.a: [Legion] "You may play me from your trash for [3] [Fury]."
  playPermissions: [
    {
      id: "unl:undying-legion",
      zone: "trash",
      rule: "812.2",
      cost: { energy: 3, power: { Fury: 1 } },
      condition: LEGION,
    },
  ],
  abilities: [],
});
