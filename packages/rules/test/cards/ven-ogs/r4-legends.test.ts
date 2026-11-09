/**
 * Wave R4 — Vendetta legends, Lux Crownguard and the remaining battlefield scripts.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  activate,
  addPool,
  answer,
  boardOf,
  exhaustRunes,
  keywordValue,
  place,
  setRunes,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("Wave R4 Vendetta legends", () => {
  it("[C:Akali, Rogue Assassin][R806][R828.1.c] Action: move a unit in a showdown to base, ready it if Empowered", () => {
    const s = withCards(["Akali, Rogue Assassin"]);
    const akali = place(s, "p1", "Akali, Rogue Assassin", "legend");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p2", "Treasure Hunter", "battlefieldA");
    addPool(s, "p1", 3, { any: 1 });
    activate(s, "p1", akali, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect((s.room.rules!.objects[akali.id]?.empowered ?? 0) > 0).toBe(true);
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    activate(s, "p1", akali, "activated:1").expectOk();
    settle(s);
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.host.isExhausted(s.room, unit.id)).toBe(false);
  });

  it("[C:Kennen, Heart of the Tempest][R420.4][R828.1.d] playing from the trash empowers; Action gives Assault 2", () => {
    const s = withCards(["Kennen, Heart of the Tempest", "Dredge Up"]);
    const kennen = place(s, "p1", "Kennen, Heart of the Tempest", "legend");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const dredge = place(s, "p1", "Dredge Up", "trash");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 2);
    s.as("p1").apply({ type: "rules_play", cardId: dredge.id }).expectOk();
    settle(s);
    expect((s.room.rules!.objects[kennen.id]?.empowered ?? 0) > 0).toBe(true);
    activate(s, "p1", kennen, "activated:1", { "target:0": unit.id }).expectOk();
    s.as("p2").pass().expectOk();
    expect(keywordValue(s, unit.id, "Assault")).toBe(2);
    expect(getCardScript("Kennen, Heart of the Tempest")?.status).toBe("partial");
  });

  it("[C:Nasus, Curator of the Sands][R383.3.b] playing a 7+ Energy unit may exhaust me to ready 2 runes", () => {
    const s = withCards(["Nasus, Curator of the Sands", "Whiteflame Protector"]);
    const nasus = place(s, "p1", "Nasus, Curator of the Sands", "legend");
    setRunes(s, "p1", 2);
    exhaustRunes(s, "p1");
    fund(s, "p1", "Whiteflame Protector");
    s.as("p1").play("Whiteflame Protector").expectOk();
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("yes-no");
    answer(s, ["yes"]);
    settle(s);
    expect(s.host.isExhausted(s.room, nasus.id)).toBe(true);
    expect(boardOf(s, "p1").runeArea.every((rune) => !rune.exhausted)).toBe(true);
  });

  it("[C:Nasus, Curator of the Sands][R383.1] an activated ability with 7+ Energy also triggers the ready", () => {
    const s = withCards(["Nasus, Curator of the Sands", "Steel Paws"]);
    const nasus = place(s, "p1", "Nasus, Curator of the Sands", "legend");
    const paws = place(s, "p1", "Steel Paws", "base");
    setRunes(s, "p1", 2);
    exhaustRunes(s, "p1");
    addPool(s, "p1", 7);
    activate(s, "p1", paws, "activated:0").expectOk();
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("yes-no");
    answer(s, ["yes"]);
    settle(s);
    expect(s.host.isExhausted(s.room, nasus.id)).toBe(true);
    expect(boardOf(s, "p1").runeArea.every((rune) => !rune.exhausted)).toBe(true);
  });

  it("[C:Renekton, Butcher of the Sands][R430] Reaction Add 2 (spend restriction missing)", () => {
    const s = withCards(["Renekton, Butcher of the Sands"]);
    const legend = place(s, "p1", "Renekton, Butcher of the Sands", "legend");
    addPool(s, "p1", 0, { any: 2 });
    activate(s, "p1", legend, "activated:0").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(2);
    expect(getCardScript("Renekton, Butcher of the Sands")?.status).toBe("partial");
  });

  it("[C:Lux, Crownguard][R430] [Tap]: [Reaction] - [Add] 2", () => {
    const s = withCards(["Lux, Crownguard"]);
    const lux = place(s, "p1", "Lux, Crownguard", "base");
    activate(s, "p1", lux, "activated:0").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(2);
    expect(getCardScript("Lux, Crownguard")?.status).toBe("partial");
  });

  it("[C:Jayce, Hammer in Hand][R416] when I become ready choose Assault 2 / Deflect 2 / Ganking", () => {
    const s = withCards(["Jayce, Hammer in Hand", "Acceleration Gate"]);
    const jayce = place(s, "p1", "Jayce, Hammer in Hand", "base", { exhausted: true });
    fund(s, "p1", "Acceleration Gate");
    s.as("p1").play("Acceleration Gate").expectOk();
    settle(s);
    if (s.room.rules!.prompt?.kind === "choose-card") answer(s, [jayce.id]);
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("choose-mode");
    answer(s, ["ganking"]);
    settle(s);
    expect(s.room.rules!.objects[jayce.id]?.keywordGrants?.some((grant) => grant.keyword === "Ganking")).toBe(true);
    expect(getCardScript("Jayce, Hammer in Hand")?.status).toBe("partial");
  });

  it("[C:Dragon Roost][C:Heisho, Shell of the World][C:Mystic Vortex][C:Piltovan Forge][C:Risen Altar][C:Sandswept Tomb] battlefield scripts are registered", () => {
    for (const name of [
      "Dragon Roost",
      "Heisho, Shell of the World",
      "Mystic Vortex",
      "Piltovan Forge",
      "Risen Altar",
      "Sandswept Tomb",
    ])
      expect(getCardScript(name)?.status, name).toBe("partial");
  });
});
