import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CardInstance, Room } from "@rift/protocol";
import { getCardByCode } from "../src/catalog";
import {
  buildAutoPayPaymentBatch,
  normalizeCost,
  planAbilityPayment,
  planPayment,
  planToOperations,
} from "../src/rules/autopay";

const ROOT = path.resolve(__dirname, "../../..");
const ORACLE = path.join(ROOT, ".recon/oracle/load.mjs");
const FIXTURE = path.join(ROOT, ".recon/oracle/fixtures/duel-in-game-t1-main.json");

describe.skipIf(!fs.existsSync(ORACLE) || !fs.existsSync(FIXTURE))("auto-pay (oracle)", () => {
  it("matches the original planner and operation builder", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    const planModule = original.runtime.loadModule(324758).exports;
    const batchModule = original.runtime.loadModule(888811).exports;
    const room = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
    const board = room.players[0]!.board!;
    board.floatingEnergy = 6;
    board.floatingPower = 2;
    const cards = board.hand;
    for (const card of cards) {
      const cost = normalizeCost(card);
      if (cost.energyCost === 0 && cost.powerCost === 0) continue;
      const oracleCost = planModule.l(card);
      const oraclePlan = planModule.q(board, oracleCost, { normalBattlefieldCount: 2 });
      const minePlan = planPayment(board, cost, { normalBattlefieldCount: 2 });
      expect(minePlan, card.name).toEqual(oraclePlan ?? null);
      if (oraclePlan) {
        expect(planToOperations(minePlan!), card.name).toEqual(planModule.Y(oraclePlan));
      }
      const spec = { purpose: "play" as const, zone: "hand" as const, cardId: card.id };
      const oracleBatch = batchModule.M(room, 0, spec);
      const mineBatch = buildAutoPayPaymentBatch(room, 0, spec);
      expect(mineBatch, card.name).toEqual(oracleBatch);
    }

    const costs = [
      { energyCost: 1, powerCost: 0, domains: [], name: "x", type: "Spell" },
      { energyCost: 3, powerCost: 0, domains: [], name: "x", type: "Unit" },
      { energyCost: 2, powerCost: 1, domains: [], name: "x", type: "Spell" },
      { energyCost: 2, powerCost: 1, domains: ["chaos"], name: "x", type: "Spell" },
      { energyCost: 0, powerCost: 2, domains: ["calm"], name: "x", type: "Spell" },
      { energyCost: 5, powerCost: 2, domains: ["calm", "chaos"], name: "x", type: "Unit" },
      { energyCost: 1, powerCost: 1, domains: ["mind"], name: "x", type: "Gear" },
    ];
    for (const cost of costs) {
      for (const energy of [0, 2, 6]) {
        for (const power of [0, 1, 3]) {
          const boardCopy = JSON.parse(JSON.stringify(board)) as typeof board;
          boardCopy.floatingEnergy = energy;
          boardCopy.floatingPower = power;
          const oraclePlan = planModule.q(boardCopy, cost, { normalBattlefieldCount: 2 });
          const minePlan = planPayment(boardCopy, cost, { normalBattlefieldCount: 2 });
          expect(minePlan, JSON.stringify({ cost, energy, power })).toEqual(oraclePlan ?? null);
          if (oraclePlan) {
            expect(planToOperations(minePlan!), JSON.stringify({ cost, energy, power })).toEqual(
              planModule.Y(oraclePlan),
            );
          }
        }
      }
    }
  });

  it("matches the ability-cost planner for empower cards", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    const planModule = original.runtime.loadModule(324758).exports;
    const room = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
    const board = room.players[0]!.board!;
    const codes = ["VEN-014", "VEN-032", "VEN-045", "VEN-074", "RAD-139", "VEN-057", "VEN-050"];
    const cards = codes.map((code) => {
      const record = getCardByCode(code);
      if (!record) throw new Error(`missing ${code}`);
      return {
        id: `synthetic-${code}`,
        name: record.name,
        source: "mainDeck" as const,
        exhausted: false,
        createdAt: room.createdAt,
        ownerPlayerId: "p1",
        cardCode: record.id,
        type: record.type,
        domains: record.domains,
        text: record.text,
        energyCost: record.energyCost,
        powerCost: record.powerCost,
        might: record.might,
        keywords: record.keywords,
        isPlaceholder: false,
      };
    });
    for (const energy of [0, 2, 6, 12]) {
      for (const power of [0, 1, 3]) {
        const boardCopy = JSON.parse(JSON.stringify(board)) as typeof board;
        boardCopy.floatingEnergy = energy;
        boardCopy.floatingPower = power;
        for (const card of cards) {
          const oraclePlan = planModule.p(boardCopy, card, { normalBattlefieldCount: 2 });
          const mine = planAbilityPayment(boardCopy, card, { normalBattlefieldCount: 2 });
          expect(mine, `${card.name} e${energy} p${power}`).toEqual(oraclePlan ?? null);
        }
      }
    }
  });
});
