"use client";

import { useState } from "react";

import type { Translator } from "@rift/i18n";
import { promptTitle } from "@rift/i18n";
import type { GameState, Prompt, WireAction } from "@rift/protocol";

import {
  segmentedActive,
  segmentedButton,
  segmentedInactive,
  smallBlueButton,
  smallNeutralButton,
} from "@/components/ui/buttonStyles";

import {
  assignmentAnswer,
  canSubmitAssignment,
  canSubmitSelection,
  cardName,
  chooseIntent,
  damageAssignmentData,
  initialAssignment,
  optionLabel,
  remainingDamage,
  selectionAnswer,
  selectionBounds,
  stepAssignment,
  toggleSelection,
  type AssignmentDraft,
} from "./strict-model";

export const STRICT_SHELL_CLASS =
  "pointer-events-auto rounded-[0.32rem] border border-[rgba(193,210,235,0.42)] bg-[linear-gradient(160deg,rgba(31,49,75,0.97),rgba(16,28,46,0.98))] p-[0.42rem] shadow-[inset_0_1px_0_rgba(234,242,255,0.12),inset_3px_0_0_rgba(226,178,102,0.34),0_0_0_1px_rgba(5,12,25,0.46),0_8px_20px_rgba(2,8,20,0.44)]";

export interface StrictPromptDialogProps {
  room: GameState;
  prompt: Prompt;
  t: Translator;
  /** Sends a `rules_choose` as the prompted seat. */
  onAnswer: (intent: WireAction) => void;
}

/** 411.2 prompt dialog: options (single/multi/order), yes-no, and 467.2.c damage assignment. */
export function StrictPromptDialog({ room, prompt, t, onAnswer }: StrictPromptDialogProps) {
  const title = promptTitle(t, prompt);
  const assignment = damageAssignmentData(prompt);
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-[153] w-[min(26rem,calc(100%-1rem))] -translate-x-1/2 -translate-y-1/2"
      role="dialog"
      aria-label={title}
      data-testid="strict-prompt"
      data-prompt-kind={prompt.kind}
      data-prompt-reason={typeof prompt.data?.reason === "string" ? prompt.data.reason : ""}
    >
      <div className={STRICT_SHELL_CLASS}>
        <p className="m-0 text-[0.56rem] font-semibold uppercase leading-none tracking-[0.1em] text-[#c5d6ee]">
          {t("rules.ui.strictBadge") ?? "Strict rules"}
          {prompt.rule ? ` · ${prompt.rule}` : ""}
        </p>
        <p className="m-0 mt-[0.18rem] text-[0.78rem] font-semibold leading-[1.2] text-[#eef5ff]">
          {title}
        </p>
        {assignment ? (
          <DamageAssignment
            room={room}
            prompt={prompt}
            t={t}
            onAnswer={onAnswer}
            data={assignment}
          />
        ) : (
          <OptionChoice room={room} prompt={prompt} t={t} onAnswer={onAnswer} />
        )}
      </div>
    </div>
  );
}

function OptionChoice({ room, prompt, t, onAnswer }: StrictPromptDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const options = prompt.options ?? [];
  const { min, max } = selectionBounds(prompt);
  const single = prompt.kind === "yes-no" || (prompt.kind !== "order" && max === 1 && min === 1);
  if (options.length === 0) {
    return (
      <p className="m-0 mt-[0.3rem] text-[0.62rem] text-[#b8cce4]">
        {t("rules.promptKind.manual") ?? prompt.kind}
      </p>
    );
  }
  if (single) {
    // One click answers (yes-no, pick one battlefield / opponent / card).
    return (
      <div className="mt-[0.36rem] grid grid-cols-2 gap-[0.3rem]" data-strict-options="single">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={option.disabled}
            className={`${segmentedButton} ${segmentedInactive}`}
            onClick={() => onAnswer(chooseIntent(prompt, selectionAnswer(prompt, [option.id])))}
          >
            <span className="truncate">{optionLabel(room, t, option)}</span>
          </button>
        ))}
      </div>
    );
  }
  const ordering = prompt.kind === "order";
  return (
    <div
      className="mt-[0.36rem] grid gap-[0.3rem]"
      data-strict-options={ordering ? "order" : "multi"}
    >
      {!ordering ? (
        <p className="m-0 text-[0.6rem] text-[#b8cce4]">
          {t("rules.ui.selectRange", { min, max }) ?? `${min}–${max}`}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-[0.3rem]">
        {options.map((option) => {
          const index = selected.indexOf(option.id);
          const active = index >= 0;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              disabled={option.disabled}
              className={`${segmentedButton} ${active ? segmentedActive : segmentedInactive}`}
              onClick={() => setSelected(toggleSelection(prompt, selected, option.id))}
            >
              <span className="truncate">
                {ordering && active ? `${index + 1}. ` : ""}
                {optionLabel(room, t, option)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className={smallBlueButton}
          disabled={!canSubmitSelection(prompt, selected)}
          onClick={() => onAnswer(chooseIntent(prompt, selectionAnswer(prompt, selected)))}
        >
          {t("rules.ui.confirm") ?? "Confirm"}
        </button>
      </div>
    </div>
  );
}

function DamageAssignment({
  room,
  prompt,
  t,
  onAnswer,
  data,
}: StrictPromptDialogProps & { data: NonNullable<ReturnType<typeof damageAssignmentData>> }) {
  const [draft, setDraft] = useState<AssignmentDraft>(() => initialAssignment(data));
  const remaining = remainingDamage(data, draft);
  return (
    <div className="mt-[0.36rem] grid gap-[0.3rem]" data-strict-assignment={data.battlefield}>
      <p className="m-0 flex justify-between text-[0.62rem] text-[#b8cce4]">
        <span>{t("rules.ui.damageTotal", { total: data.total }) ?? data.total}</span>
        <span data-strict-remaining={remaining}>
          {t("rules.ui.damageRemaining", { remaining }) ?? remaining}
        </span>
      </p>
      {data.targets.map((target) => {
        const amount = draft[target.objectId] ?? 0;
        return (
          <div
            key={target.objectId}
            className="flex items-center justify-between gap-[0.3rem] border border-[rgba(132,150,184,0.2)] px-[0.36rem] py-[0.2rem]"
            data-strict-target={target.objectId}
            data-strict-tier={target.tier}
          >
            <span className="min-w-0 flex-1 truncate text-[0.66rem] text-[#eef5ff]">
              {cardName(room, target.objectId)}
            </span>
            <span className="text-[0.56rem] text-[#8fa6c1]">
              {target.lethal === null
                ? (t("rules.ui.damageCannotBeDealt") ?? "—")
                : (t("rules.ui.damageLethal", { lethal: target.lethal }) ?? target.lethal)}
            </span>
            <button
              type="button"
              aria-label="-1"
              className={smallNeutralButton}
              disabled={amount === 0}
              onClick={() => setDraft(stepAssignment(data, draft, target, -1))}
            >
              −
            </button>
            <span className="min-w-[1.4rem] text-center text-[0.72rem] font-black tabular-nums text-[#e8f2ff]">
              {amount}
            </span>
            <button
              type="button"
              aria-label="+1"
              className={smallNeutralButton}
              disabled={remaining === 0}
              onClick={() => setDraft(stepAssignment(data, draft, target, 1))}
            >
              +
            </button>
          </div>
        );
      })}
      <div className="flex justify-end gap-[0.3rem]">
        {data.suggested ? (
          <button
            type="button"
            className={smallNeutralButton}
            onClick={() => setDraft(initialAssignment(data))}
          >
            {t("rules.ui.useSuggestion") ?? "Use suggestion"}
          </button>
        ) : null}
        <button
          type="button"
          className={smallBlueButton}
          disabled={!canSubmitAssignment(data, draft)}
          onClick={() => onAnswer(chooseIntent(prompt, assignmentAnswer(draft)))}
        >
          {t("rules.ui.confirm") ?? "Confirm"}
        </button>
      </div>
    </div>
  );
}
