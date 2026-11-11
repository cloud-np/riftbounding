"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { Translator } from "@rift/i18n";
import { promptTitle } from "@rift/i18n";
import type { GameState, Prompt, WireAction } from "@rift/protocol";

import { RulesText } from "../text/RulesText";
import { useAnimationLevel } from "../theme/motion";
import { assignmentHint, canStepUp, validateDraft } from "./damage-assignment";
import { promptAllowsSimilar } from "./strict-auto-pass";
import {
  assignmentAnswer,
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


/** Shared look of the readable prompt dialogs: near-black surface, gold accents, large type. */
export const PROMPT_PRIMARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-[0.4rem] border border-[var(--rb-gold,#c8aa6e)] bg-[linear-gradient(180deg,#d9bd7f,#b08f4c)] px-6 text-base font-semibold text-[#15110a] shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-[filter,transform] duration-150 enabled:hover:brightness-110 enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-gold-bright,#f0d48a)]";
export const PROMPT_SECONDARY_BUTTON =
  "inline-flex min-h-12 min-w-0 items-center justify-center rounded-[0.4rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface-2,#15171b)] px-5 text-base font-semibold text-[var(--rb-text,#ece6da)] transition-[border-color,background-color,color] duration-150 enabled:hover:border-[var(--rb-gold-bright,#f0d48a)] enabled:hover:bg-[#1d2026] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-gold-bright,#f0d48a)]";
export const PROMPT_TOGGLED_BUTTON =
  "border-[var(--rb-gold-bright,#f0d48a)] bg-[#2a2415] text-[var(--rb-gold-bright,#f0d48a)]";
const STEP_BUTTON =
  "inline-grid h-11 w-11 shrink-0 place-items-center rounded-[0.35rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface-2,#15171b)] text-xl font-bold leading-none text-[var(--rb-gold-bright,#f0d48a)] transition-colors enabled:hover:bg-[#232730] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[var(--rb-gold-bright,#f0d48a)]";

/**
 * Viewport-centred prompt frame (fixed, not inside a board region): large Cinzel title, Inter body,
 * soft entrance. The wrapper ignores pointer events so the board stays hoverable around it.
 */
export function PromptDialogFrame({
  title,
  ariaLabel,
  badge,
  children,
  testId,
  dataAttrs,
  wide,
}: {
  title: ReactNode;
  ariaLabel?: string;
  badge?: ReactNode;
  children: ReactNode;
  testId: string;
  dataAttrs?: Record<string, string | undefined>;
  wide?: boolean;
}) {
  const level = useAnimationLevel();
  const label = ariaLabel ?? (typeof title === "string" ? title : undefined);
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[153] grid place-items-center p-4"
      role="dialog"
      aria-label={label}
      data-testid={testId}
      {...dataAttrs}
    >
      <style>{`
        @keyframes rb-prompt-in { from { opacity: 0; transform: translateY(0.6rem) scale(0.97); } to { opacity: 1; transform: none; } }
        .rb-prompt-card[data-motion="full"] { animation: rb-prompt-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        @media (prefers-reduced-motion: reduce) { .rb-prompt-card { animation: none !important; } }
      `}</style>
      <div
        className={`rb-prompt-card pointer-events-auto max-h-[calc(100dvh-2rem)] ${wide ? "w-[min(42rem,100%)]" : "w-[min(38rem,100%)]"} overflow-y-auto rounded-[0.7rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface,#0e0f12)] p-6 text-[var(--rb-text,#ece6da)] shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_24px_60px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(240,212,138,0.14)] max-sm:p-4`}
        style={{ fontFamily: "var(--font-ui), system-ui, sans-serif" }}
        data-motion={level}
      >
        {badge ? (
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--rb-gold,#c8aa6e)]">{badge}</p>
        ) : null}
        <h2
          className="m-0 mt-1 text-[1.5rem] font-semibold leading-[1.25] text-[var(--rb-gold-bright,#f0d48a)]"
          style={{ fontFamily: "var(--font-heading), ui-serif, Georgia, serif" }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

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
    <PromptDialogFrame
      title={<RulesText text={title} />}
      ariaLabel={title}
      badge={`${t("rules.ui.strictBadge") ?? "Strict rules"}${prompt.rule ? ` · ${prompt.rule}` : ""}`}
      testId="strict-prompt"
      wide={!!assignment}
      dataAttrs={{
        "data-prompt-kind": prompt.kind,
        "data-prompt-reason": typeof prompt.data?.reason === "string" ? prompt.data.reason : "",
      }}
    >
      {assignment ? (
        <DamageAssignment room={room} prompt={prompt} t={t} onAnswer={onAnswer} data={assignment} />
      ) : (
        <OptionChoice room={room} prompt={prompt} t={t} onAnswer={onAnswer} />
      )}
    </PromptDialogFrame>
  );
}

/** Auto-pass "yes to all": remember this answer for identical prompts this turn. */
function SimilarToggle({ t, checked, onChange }: { t: Translator; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label
      className="flex cursor-pointer items-center gap-2 text-base text-[var(--rb-text-dim,#a39d92)]"
      data-testid="strict-prompt-similar"
    >
      <input
        type="checkbox"
        className="h-5 w-5 accent-[#c8aa6e]"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{t("rules.ui.autoPass.applyToSimilar") ?? "Same answer for identical prompts this turn"}</span>
    </label>
  );
}

function OptionChoice({ room, prompt, t, onAnswer }: StrictPromptDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [similar, setSimilar] = useState(false);
  const options = prompt.options ?? [];
  const { min, max } = selectionBounds(prompt);
  const single = prompt.kind === "yes-no" || (prompt.kind !== "order" && max === 1 && min === 1);
  const allowsSimilar = promptAllowsSimilar(prompt);
  if (options.length === 0) {
    return (
      <p className="m-0 mt-4 text-base text-[var(--rb-text-dim,#a39d92)]">
        {t("rules.promptKind.manual") ?? prompt.kind}
      </p>
    );
  }
  const columns = options.length === 2 || options.length === 4 ? "grid-cols-2 max-sm:grid-cols-1" : "grid-cols-1";
  if (single) {
    // One click answers (yes-no, pick one battlefield / opponent / card).
    return (
      <div className="mt-5 grid gap-4">
        <div className={`grid gap-3 ${columns}`} data-strict-options="single">
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              className={index === 0 && prompt.kind === "yes-no" ? PROMPT_PRIMARY_BUTTON : PROMPT_SECONDARY_BUTTON}
              onClick={() =>
                onAnswer(chooseIntent(prompt, selectionAnswer(prompt, [option.id]), allowsSimilar && similar))
              }
            >
              <RulesText text={optionLabel(room, t, option)} />
            </button>
          ))}
        </div>
        {allowsSimilar ? <SimilarToggle t={t} checked={similar} onChange={setSimilar} /> : null}
      </div>
    );
  }
  const ordering = prompt.kind === "order";
  return (
    <div className="mt-5 grid gap-4" data-strict-options={ordering ? "order" : "multi"}>
      {!ordering ? (
        <p className="m-0 text-base text-[var(--rb-text-dim,#a39d92)]">
          {t("rules.ui.selectRange", { min, max }) ?? `${min}–${max}`}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const index = selected.indexOf(option.id);
          const active = index >= 0;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              disabled={option.disabled}
              className={`${PROMPT_SECONDARY_BUTTON} ${active ? PROMPT_TOGGLED_BUTTON : ""}`}
              onClick={() => setSelected(toggleSelection(prompt, selected, option.id))}
            >
              <span>
                {ordering && active ? `${index + 1}. ` : ""}
                <RulesText text={optionLabel(room, t, option)} />
              </span>
            </button>
          );
        })}
      </div>
      {ordering && allowsSimilar ? <SimilarToggle t={t} checked={similar} onChange={setSimilar} /> : null}
      <div className="flex flex-wrap justify-end gap-3">
        {ordering ? (
          // 383.3.d: listing nothing keeps the detection order — one click instead of N.
          <button
            type="button"
            className={PROMPT_SECONDARY_BUTTON}
            data-testid="strict-prompt-default-order"
            onClick={() => onAnswer(chooseIntent(prompt, selectionAnswer(prompt, []), allowsSimilar && similar))}
          >
            {t("rules.ui.autoPass.defaultOrder") ?? "Default order"}
          </button>
        ) : null}
        <button
          type="button"
          className={PROMPT_PRIMARY_BUTTON}
          disabled={!canSubmitSelection(prompt, selected)}
          onClick={() =>
            onAnswer(chooseIntent(prompt, selectionAnswer(prompt, selected), ordering && allowsSimilar && similar))
          }
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
  const nameOf = (id: string) => cardName(room, id);
  const verdict = useMemo(() => validateDraft(data.targets, data.total, draft), [data.targets, data.total, draft]);
  const hint = useMemo(
    () => assignmentHint(data.targets, data.total, draft, (id) => cardName(room, id)),
    [data.targets, data.total, draft, room],
  );
  const valid = remaining === 0 && verdict.ok;
  return (
    <div className="mt-4 grid gap-3" data-strict-assignment={data.battlefield}>
      <p className="m-0 flex justify-between gap-3 text-base text-[var(--rb-text-dim,#a39d92)]">
        <span>{t("rules.ui.damageTotal", { total: data.total }) ?? data.total}</span>
        <span
          className="font-semibold text-[var(--rb-gold-bright,#f0d48a)]"
          data-strict-remaining={remaining}
        >
          {t("rules.ui.damageRemaining", { remaining }) ?? remaining}
        </span>
      </p>
      {data.targets.map((target) => {
        const amount = draft[target.objectId] ?? 0;
        const canAdd = canStepUp(data.targets, data.total, draft, target);
        return (
          <div
            key={target.objectId}
            className="flex items-center gap-3 rounded-[0.45rem] border border-[var(--rb-border,rgba(255,255,255,0.08))] bg-[var(--rb-surface-2,#15171b)] px-3 py-2"
            data-strict-target={target.objectId}
            data-strict-tier={target.tier}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-semibold leading-tight text-[var(--rb-text,#ece6da)]">
                {nameOf(target.objectId)}
              </span>
              <span className="block text-sm text-[var(--rb-text-dim,#a39d92)]">
                {target.lethal === null
                  ? (t("rules.ui.damageCannotBeDealt") ?? "—")
                  : (t("rules.ui.damageLethal", { lethal: target.lethal }) ?? target.lethal)}
              </span>
            </span>
            <button
              type="button"
              aria-label="-1"
              className={STEP_BUTTON}
              disabled={amount === 0}
              onClick={() => setDraft(stepAssignment(data, draft, target, -1))}
            >
              −
            </button>
            <span className="min-w-[2rem] text-center text-2xl font-bold tabular-nums text-[var(--rb-text,#ece6da)]">
              {amount}
            </span>
            <button
              type="button"
              aria-label="+1"
              className={STEP_BUTTON}
              disabled={!canAdd}
              data-strict-blocked={remaining > 0 && !canAdd ? "true" : undefined}
              onClick={() => setDraft(stepAssignment(data, draft, target, 1))}
            >
              +
            </button>
          </div>
        );
      })}
      {hint ? (
        <p
          className="m-0 rounded-[0.4rem] border border-[rgba(240,212,138,0.35)] bg-[#1b1710] px-3 py-2 text-base leading-[1.45] text-[var(--rb-gold-bright,#f0d48a)]"
          role="status"
          data-testid="strict-assignment-hint"
        >
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3 pt-1">
        {data.suggested ? (
          <button type="button" className={PROMPT_SECONDARY_BUTTON} onClick={() => setDraft(initialAssignment(data))}>
            {t("rules.ui.useSuggestion") ?? "Use suggestion"}
          </button>
        ) : null}
        <button
          type="button"
          className={PROMPT_PRIMARY_BUTTON}
          disabled={!valid}
          data-testid="strict-assignment-confirm"
          onClick={() => onAnswer(chooseIntent(prompt, assignmentAnswer(draft)))}
        >
          {t("rules.ui.confirm") ?? "Confirm"}
        </button>
      </div>
    </div>
  );
}
