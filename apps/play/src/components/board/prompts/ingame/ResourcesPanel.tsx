"use client";

import { useMemo, useState } from "react";

import { buildAutoPayPaymentBatch } from "@rift/engine";
import { createTranslator } from "@rift/i18n";

import { playBoardSound } from "../../interaction/sfx";
import type { GameActionIntent } from "../../slot-types";

const t = createTranslator("en");

export interface PaymentPanelProps {
  room: import("@rift/protocol").Room;
  viewerId: string;
  dispatch: (intent: GameActionIntent) => void;
}

function summarize(operations: Array<{ type: string }>): string {
  const counts = new Map<string, number>();
  for (const operation of operations) counts.set(operation.type, (counts.get(operation.type) ?? 0) + 1);
  const labels: Record<string, string> = {
    toggle_exhausted: "Exhaust",
    adjust_floating_resource: "Floating",
    send_rune_to_deck_bottom: "Recycle",
    recycle_rune_for_floating_energy: "Recycle → energy",
    set_card_label: "Empower",
  };
  return [...counts.entries()]
    .map(([type, count]) => `${labels[type] ?? type} ${count}`)
    .join(" · ");
}

export function PaymentTray({ room, viewerId, dispatch }: PaymentPanelProps) {
  const [open, setOpen] = useState(false);
  const viewer = room.players.find((player) => player.id === viewerId);
  const board = viewer?.board;
  const playerIndex = room.players.findIndex((player) => player.id === viewerId);
  const energy = board?.floatingEnergy ?? 0;
  const power = board?.floatingPower ?? 0;
  const runes = useMemo(
    () => (board?.runeArea ?? []).filter((card) => !card.exhausted && /rune/i.test(card.type ?? card.source)),
    [board?.runeArea],
  );
  const hand = board?.hand ?? [];

  const send = (intent: GameActionIntent) => {
    playBoardSound("ui_click");
    dispatch(intent);
  };

  if (room.phase !== "in_game") return null;
  // Strict rooms auto-plan payment; the sandbox payment tray would only be rejected.
  if (room.rulesMode === "strict") return null;

  return (
    <div className="pointer-events-none absolute left-[0.42rem] bottom-[9.6rem] z-[156]" data-testid="payment-tray">
      <button
        type="button"
        className="pointer-events-auto flex h-[2.2rem] items-center gap-[0.34rem] rounded-[0.24rem] border border-[rgba(174,199,227,0.32)] bg-[rgba(9,19,34,0.9)] px-[0.4rem] text-[#cfe1f8] shadow-[0_8px_18px_rgba(3,8,20,0.42)] backdrop-blur-sm hover:border-[rgba(205,228,255,0.52)]"
        aria-expanded={open}
        aria-label={t("sim.floatingResourcesSummary", { energy, power }) ?? `Floating energy ${energy}, power ${power}`}
        onClick={() => setOpen((value) => !value)}
        data-testid="payment-toggle"
        data-resources-toggle="true"
      >
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#9fb5d3]">
          {t("sim.floating") ?? "Floating"}
        </span>
        <span className="rounded-full bg-[#f3f5f9] px-[0.28rem] text-sm font-black leading-[1.15rem] text-[#0a0f18]" data-resources-summary-energy={energy}>
          {energy}
        </span>
        <span className="text-sm font-black text-[#e7c796]" data-resources-summary-power={power}>
          {power}
        </span>
      </button>

      {open ? (
        <div
          className="pointer-events-auto absolute bottom-[calc(100%+0.38rem)] left-0 w-[min(19rem,calc(100vw-1rem))] overflow-hidden rounded-[0.3rem] border border-[rgba(201,218,249,0.22)] bg-[rgba(8,16,34,0.98)] text-[#d9e6f5] shadow-[0_18px_38px_rgba(2,6,18,0.6),inset_0_1px_0_rgba(230,239,255,0.06)] backdrop-blur-xl"
          data-testid="payment-panel"
          data-resources-popover="true"
        >
          <header className="flex items-center justify-between border-b border-[rgba(174,199,227,0.14)] px-[0.5rem] py-[0.32rem]">
            <strong className="text-xs font-bold uppercase tracking-[0.1em] text-[#dff0ff]">
              {t("sim.floating") ?? "Floating"}
            </strong>
            <button
              type="button"
              className="rounded-[0.16rem] border border-[rgba(201,218,249,0.16)] px-[0.3rem] py-[0.1rem] text-xs text-[#b8cce4] hover:bg-white/5"
              onClick={() => send({ type: "clear_floating_resources" })}
              data-testid="payment-clear"
            >
              Clear
            </button>
          </header>
          <div className="grid gap-[0.1rem] px-[0.5rem] py-[0.36rem]">
            <div className="grid grid-cols-[1.2rem_minmax(0,1fr)_1.5rem_1.2rem] items-center gap-[0.2rem] text-sm">
              <span className="text-[#9fb5d3]">E</span>
              <span>{t("sim.energy") ?? "Energy"}</span>
              <span className="text-right font-bold tabular-nums">{energy}</span>
              <span className="flex gap-[0.12rem]">
                <button
                  type="button"
                  className="h-[1.15rem] w-[1.15rem] rounded-[0.14rem] border border-[rgba(174,199,227,0.24)] bg-[rgba(14,27,47,0.7)] text-sm leading-none"
                  onClick={() => send({ type: "adjust_floating_resource", resource: "energy", delta: -1 })}
                  disabled={energy <= 0}
                  data-testid="payment-energy-decrease"
                >
                  −
                </button>
                <button
                  type="button"
                  className="h-[1.15rem] w-[1.15rem] rounded-[0.14rem] border border-[rgba(174,199,227,0.24)] bg-[rgba(14,27,47,0.7)] text-sm leading-none"
                  onClick={() => send({ type: "adjust_floating_resource", resource: "energy", delta: 1 })}
                  data-testid="payment-energy-increase"
                >
                  +
                </button>
              </span>
            </div>
            <div className="grid grid-cols-[1.2rem_minmax(0,1fr)_1.5rem_1.2rem] items-center gap-[0.2rem] text-sm">
              <span className="text-[#9fb5d3]">P</span>
              <span>{t("sim.power") ?? "Power"}</span>
              <span className="text-right font-bold tabular-nums">{power}</span>
              <span className="flex gap-[0.12rem]">
                <button
                  type="button"
                  className="h-[1.15rem] w-[1.15rem] rounded-[0.14rem] border border-[rgba(174,199,227,0.24)] bg-[rgba(14,27,47,0.7)] text-sm leading-none"
                  onClick={() => send({ type: "adjust_floating_resource", resource: "power", delta: -1 })}
                  disabled={power <= 0}
                  data-testid="payment-power-decrease"
                >
                  −
                </button>
                <button
                  type="button"
                  className="h-[1.15rem] w-[1.15rem] rounded-[0.14rem] border border-[rgba(174,199,227,0.24)] bg-[rgba(14,27,47,0.7)] text-sm leading-none"
                  onClick={() => send({ type: "adjust_floating_resource", resource: "power", delta: 1 })}
                  data-testid="payment-power-increase"
                >
                  +
                </button>
              </span>
            </div>
          </div>

          {runes.length > 0 ? (
            <section className="border-t border-[rgba(174,199,227,0.12)] px-[0.5rem] py-[0.34rem]">
              <p className="m-0 mb-[0.18rem] text-xs font-bold uppercase tracking-[0.1em] text-[#8ea9c9]">
                Recycle for floating energy
              </p>
              <div className="flex flex-wrap gap-[0.16rem]">
                {runes.map((rune) => (
                  <button
                    key={rune.id}
                    type="button"
                    className="rounded-[0.16rem] border border-[rgba(125,218,237,0.28)] bg-[rgba(15,34,52,0.78)] px-[0.3rem] py-[0.14rem] text-xs font-semibold text-[#d7f6fb] hover:bg-[rgba(21,48,65,0.9)]"
                    onClick={() => {
                      playBoardSound("card_recycle");
                      dispatch({
                        type: "recycle_rune_for_floating_energy",
                        cardId: rune.id,
                        paymentGroupOrigin: "payment_tray",
                      });
                    }}
                    data-testid="recycle-rune-for-floating"
                    data-card-id={rune.id}
                  >
                    {rune.name.replace(/\s*Rune$/i, "")}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="border-t border-[rgba(174,199,227,0.12)] px-[0.5rem] py-[0.34rem]">
            <p className="m-0 mb-[0.18rem] text-xs font-bold uppercase tracking-[0.1em] text-[#8ea9c9]">
              Auto-pay
            </p>
            <div className="grid max-h-[9rem] gap-[0.16rem] overflow-y-auto">
              {hand.length === 0 ? (
                <span className="text-xs text-[#8ea9c9]">No cards in hand.</span>
              ) : (
                hand.map((card) => {
                  const batch =
                    playerIndex >= 0
                      ? buildAutoPayPaymentBatch(room, playerIndex, {
                          purpose: "play",
                          zone: "hand",
                          cardId: card.id,
                        })
                      : null;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={!batch}
                      onClick={() => {
                        if (!batch) return;
                        playBoardSound("card_autopay");
                        dispatch(batch as unknown as GameActionIntent);
                      }}
                      className="flex items-center justify-between gap-2 rounded-[0.16rem] border border-[rgba(201,218,249,0.14)] bg-[rgba(14,27,47,0.62)] px-[0.3rem] py-[0.2rem] text-left text-xs text-[#dbe7ff] hover:enabled:border-[rgba(139,222,189,0.5)] hover:enabled:bg-[rgba(20,48,50,0.72)] disabled:opacity-40"
                      data-testid="auto-pay-card"
                      data-card-id={card.id}
                      data-card-cost={`${card.energyCost ?? 0}:${card.powerCost ?? 0}`}
                    >
                      <span className="min-w-0 truncate">{card.name}</span>
                      <span className="shrink-0 text-xs uppercase tracking-[0.04em] text-[#9fb5d3]">
                        {batch ? summarize(batch.operations) : "Not payable"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
