/** The Zero Drive. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "The Zero Drive",
  text: "[Equip][1][Mind] ([1][Mind]: Attach this to a unit you control.)\n[3][Mind], Banish this: Play all units banished with this, ignoring their costs. (Use only if unattached.)\n\n[Deathknell] — Banish me. (When I die, get the effect.)\n+2 [Might]",
  status: "partial",
  notes: `Deathknell "[Deathknell] — Banish me" is not scripted; "[3][Mind], Banish this: Play all units banished with this" needs cards banished with a specific object tracked and a payable "Banish this" cost (357.2).`,
  abilities: [...notIntrinsic("Deathknell"), mightBonus(2)],
});
