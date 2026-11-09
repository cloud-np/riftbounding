/**
 * Time Warp (OGN-122) — "Take a turn after this one. Banish this."
 *
 * Manual: the turn structure has no extra-turn insertion (the next Turn Player is always the next
 * player in Turn Order), and a resolving spell cannot replace going to the trash with being
 * banished (340/348.2 → 428).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Time Warp",
  text: "Take a turn after this one. Banish this.",
  status: "manual",
  notes:
    "Extra turns are not supported by the turn structure, nor is a resolving spell banishing itself instead of going to the trash (428).",
  abilities: [],
});
