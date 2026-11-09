"use client";

/**
 * Strict play-options dialog (R4-strict-ui): the missing payment-plan / optional-additional-cost /
 * Hide UI from `docs/rules/int.md`.
 *
 * It never applies anything itself: the caller preflights the built `rules_play` with
 * `strictExplainIllegal` (passed as `explain`) and dispatches the intent on confirmation.
 */
import { useMemo, useState } from "react";

import type { Translator } from "@rift/i18n";
import { rulesReasonText } from "@rift/i18n";
import type {
  GameState,
  PaymentPlanWire,
  PlayableCardDetail,
  Verdict,
  WireAction,
} from "@rift/protocol";

import { smallBlueButton, smallNeutralButton } from "@/components/ui/buttonStyles";

import {
  emptyPaymentDraft,
  strictPaymentPlan,
  strictPlayIntent,
  strictRuneChoices,
  type StrictPaymentDraft,
} from "./strict-interaction";
import { cardName, zoneLabel } from "./strict-model";
import { STRICT_SHELL_CLASS } from "./StrictPromptDialog";

export interface StrictPlayDialogProps {
  room: GameState;
  actorId: string;
  cardId: string;
  detail?: PlayableCardDetail;
  /** 811.1.b battlefields this card may be hidden at. */
  hideLocations?: readonly string[];
  t: Translator;
  initialLocation?: string;
  initialHide?: boolean;
  explain: (intent: WireAction) => Verdict;
  onIntent: (intent: WireAction) => void;
  onClose: () => void;
}

function costText(t: Translator, detail: PlayableCardDetail): string {
  const energy = t("sim.energy") ?? "Energy";
  const power = t("sim.power") ?? "Power";
  return `${t("rules.ui.cost") ?? "Cost"}: ${detail.cost.energy} ${energy} · ${detail.cost.power} ${power}`;
}

/** Payment draft + optional costs / location / Hide → a complete `rules_play`. */
export function strictPlayIntentFromDialog(input: {
  cardId: string;
  detail?: PlayableCardDetail;
  hideLocations?: readonly string[];
  location?: string;
  optionalCosts: readonly string[];
  payment: StrictPaymentDraft;
  hide: boolean;
}): WireAction {
  const hideLocation = input.hideLocations?.[0];
  const location = input.hide
    ? (input.location ?? hideLocation)
    : (input.location ?? input.detail?.locations[0]);
  const payment: PaymentPlanWire | undefined = input.hide
    ? undefined
    : strictPaymentPlan(input.payment);
  return strictPlayIntent({
    cardId: input.cardId,
    ...(location ? { location } : {}),
    ...(input.hide ? { hide: true } : {}),
    ...(!input.hide && input.optionalCosts.length > 0
      ? { optionalCosts: [...input.optionalCosts] }
      : {}),
    ...(payment ? { payment } : {}),
  });
}

export function StrictPlayDialog({
  room,
  actorId,
  cardId,
  detail,
  hideLocations = [],
  t,
  initialLocation,
  initialHide = false,
  explain,
  onIntent,
  onClose,
}: StrictPlayDialogProps) {
  const [hide, setHide] = useState(initialHide);
  const [location, setLocation] = useState<string | undefined>(
    initialLocation ?? detail?.locations[0] ?? hideLocations[0],
  );
  const [optionalCosts, setOptionalCosts] = useState<string[]>([]);
  const [payment, setPayment] = useState<StrictPaymentDraft>(() => emptyPaymentDraft());
  const runes = useMemo(() => strictRuneChoices(room, actorId), [room, actorId]);

  const hideAvailable = hideLocations.length > 0;
  if (!detail && !hideAvailable) return null;
  const zones = hide ? hideLocations : (detail?.locations ?? []);
  const effectiveLocation = hide ? (location && hideLocations.includes(location) ? location : hideLocations[0]) : location;

  const intent = strictPlayIntentFromDialog({
    cardId,
    detail,
    hideLocations,
    location: effectiveLocation,
    optionalCosts,
    payment,
    hide,
  });
  const verdict = explain(intent);
  const name = cardName(room, cardId);
  const toggleCost = (id: string) =>
    setOptionalCosts((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  const toggleRune = (id: string, role: "exhaust" | "recycle") =>
    setPayment((current) => {
      const other = role === "exhaust" ? current.recycleRunes : current.exhaustRunes;
      const same = role === "exhaust" ? current.exhaustRunes : current.recycleRunes;
      const nextSame = same.includes(id)
        ? same.filter((entry) => entry !== id)
        : [...same.filter((entry) => !other.includes(id)), id];
      return role === "exhaust"
        ? { ...current, exhaustRunes: nextSame }
        : { ...current, recycleRunes: nextSame };
    });

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-1/2 z-[154] w-[min(25rem,calc(100%-1rem))] -translate-x-1/2 -translate-y-1/2"
      role="dialog"
      aria-label={t("rules.ui.playWithOptions") ?? "Play with options"}
      data-testid="strict-play-dialog"
      data-card-id={cardId}
      data-mode={hide ? "hide" : "play"}
    >
      <div className={STRICT_SHELL_CLASS}>
        <p className="m-0 text-[0.56rem] font-semibold uppercase leading-none tracking-[0.1em] text-[#c5d6ee]">
          {t("rules.ui.strictBadge") ?? "Strict rules"}
        </p>
        <p className="m-0 mt-[0.18rem] text-[0.78rem] font-semibold leading-[1.2] text-[#eef5ff]">
          {hide ? (t("rules.ui.hide") ?? "Hide") : (t("rules.ui.play") ?? "Play")}: {name}
        </p>
        {detail && !hide ? (
          <p className="m-0 mt-[0.16rem] text-[0.6rem] text-[#b8cce4]" data-testid="strict-play-cost">
            {costText(t, detail)}
          </p>
        ) : null}

        {hideAvailable ? (
          <div className="mt-[0.32rem] flex gap-[0.24rem]">
            <button
              type="button"
              aria-pressed={!hide}
              className={!hide ? smallBlueButton : smallNeutralButton}
              data-testid="strict-mode-play"
              onClick={() => {
                setHide(false);
                setLocation(detail?.locations[0] ?? location);
              }}
            >
              {t("rules.ui.play") ?? "Play"}
            </button>
            <button
              type="button"
              aria-pressed={hide}
              className={hide ? smallBlueButton : smallNeutralButton}
              data-testid="strict-mode-hide"
              onClick={() => {
                setHide(true);
                setLocation(hideLocations[0] ?? location);
              }}
            >
              {t("rules.ui.hide") ?? "Hide"}
            </button>
          </div>
        ) : null}

        {zones.length > 1 ? (
          <div className="mt-[0.32rem] grid grid-cols-2 gap-[0.24rem]" data-testid="strict-locations">
            {zones.map((zone) => (
              <button
                key={zone}
                type="button"
                aria-pressed={effectiveLocation === zone}
                className={effectiveLocation === zone ? smallBlueButton : smallNeutralButton}
                data-strict-location={zone}
                onClick={() => setLocation(zone)}
              >
                {zoneLabel(t, zone)}
              </button>
            ))}
          </div>
        ) : effectiveLocation ? (
          <p className="m-0 mt-[0.24rem] text-[0.6rem] text-[#b8cce4]" data-strict-location={effectiveLocation}>
            {hideLabelText(t, hide, effectiveLocation)}
          </p>
        ) : null}

        {!hide && detail && detail.optionalCosts.length > 0 ? (
          <div className="mt-[0.32rem]" data-testid="strict-optional-costs">
            <p className="m-0 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-[#a9c2e2]">
              {t("rules.ui.optionalCosts") ?? "Additional costs"}
            </p>
            <div className="mt-[0.18rem] flex flex-wrap gap-[0.2rem]">
              {detail.optionalCosts.map((id) => {
                const active = optionalCosts.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    className={active ? smallBlueButton : smallNeutralButton}
                    data-strict-optional-cost={id}
                    onClick={() => toggleCost(id)}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {!hide && detail ? (
          <div className="mt-[0.32rem]" data-testid="strict-payment">
            <p className="m-0 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-[#a9c2e2]">
              {t("rules.ui.paymentPlan") ?? "Payment"}
            </p>
            <div className="mt-[0.18rem] flex gap-[0.24rem]">
              <button
                type="button"
                aria-pressed={payment.auto}
                className={payment.auto ? smallBlueButton : smallNeutralButton}
                data-testid="strict-payment-auto"
                onClick={() => setPayment((current) => ({ ...current, auto: true }))}
              >
                {t("rules.ui.paymentAuto") ?? "Auto-pay"}
              </button>
              <button
                type="button"
                aria-pressed={!payment.auto}
                className={!payment.auto ? smallBlueButton : smallNeutralButton}
                data-testid="strict-payment-manual"
                onClick={() => setPayment((current) => ({ ...current, auto: false }))}
              >
                {t("rules.ui.paymentManual") ?? "Choose runes"}
              </button>
            </div>
            {!payment.auto ? (
              <div className="mt-[0.24rem] grid gap-[0.2rem]" data-testid="strict-payment-plan">
                <div className="flex items-center justify-between gap-[0.3rem]">
                  <span className="text-[0.6rem] text-[#b8cce4]">
                    {t("rules.ui.floatingEnergy") ?? "Use floating Energy"}
                  </span>
                  <span className="flex items-center gap-[0.2rem]">
                    <button
                      type="button"
                      className={smallNeutralButton}
                      aria-label="-1"
                      disabled={payment.poolEnergy <= 0}
                      onClick={() =>
                        setPayment((current) => ({
                          ...current,
                          poolEnergy: Math.max(0, current.poolEnergy - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <span className="min-w-[1.2rem] text-center text-[0.68rem] font-bold tabular-nums text-[#e8f2ff]">
                      {payment.poolEnergy}
                    </span>
                    <button
                      type="button"
                      className={smallNeutralButton}
                      aria-label="+1"
                      onClick={() =>
                        setPayment((current) => ({ ...current, poolEnergy: current.poolEnergy + 1 }))
                      }
                    >
                      +
                    </button>
                  </span>
                </div>
                {runes.length > 0 ? (
                  <div className="grid max-h-[6.5rem] gap-[0.16rem] overflow-y-auto">
                    {runes.map((rune) => {
                      const exhaust = payment.exhaustRunes.includes(rune.id);
                      const recycle = payment.recycleRunes.includes(rune.id);
                      return (
                        <div
                          key={rune.id}
                          className="flex items-center justify-between gap-[0.24rem]"
                          data-strict-rune={rune.id}
                        >
                          <span className="min-w-0 flex-1 truncate text-[0.6rem] text-[#dbe7ff]">
                            {rune.name}
                          </span>
                          <button
                            type="button"
                            aria-pressed={exhaust}
                            className={exhaust ? smallBlueButton : smallNeutralButton}
                            disabled={!rune.available}
                            onClick={() => toggleRune(rune.id, "exhaust")}
                          >
                            {t("rules.ui.exhaustRune") ?? "Exhaust"}
                          </button>
                          <button
                            type="button"
                            aria-pressed={recycle}
                            className={recycle ? smallBlueButton : smallNeutralButton}
                            disabled={!rune.available}
                            onClick={() => toggleRune(rune.id, "recycle")}
                          >
                            {t("rules.ui.recycleRune") ?? "Recycle"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="m-0 text-[0.6rem] text-[#8fa6c1]">
                    {t("rules.ui.noReadyRunes") ?? "No ready runes."}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {!verdict.ok ? (
          <p
            className="m-0 mt-[0.3rem] text-[0.6rem] font-semibold text-[#ffb8ae]"
            data-testid="strict-play-rejection"
            data-strict-code={verdict.code}
            data-strict-rule={verdict.rule ?? ""}
          >
            {rulesReasonText(t, verdict.code, verdict.rule)}
          </p>
        ) : null}

        <div className="mt-[0.34rem] flex justify-end gap-[0.24rem]">
          <button type="button" className={smallNeutralButton} onClick={onClose}>
            {t("rules.ui.cancel") ?? "Cancel"}
          </button>
          <button
            type="button"
            className={smallBlueButton}
            data-testid="strict-play-confirm"
            disabled={!verdict.ok}
            onClick={() => onIntent(intent)}
          >
            {hide ? (t("rules.ui.hide") ?? "Hide") : (t("rules.ui.play") ?? "Play")}
          </button>
        </div>
      </div>
    </div>
  );
}

function hideLabelText(t: Translator, hide: boolean, zone: string): string {
  return `${hide ? (t("rules.ui.hide") ?? "Hide") : (t("rules.ui.play") ?? "Play")} → ${zoneLabel(t, zone)}`;
}
