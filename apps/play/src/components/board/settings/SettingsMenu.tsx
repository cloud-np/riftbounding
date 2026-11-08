"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SFX_VOLUME_MAX, SFX_VOLUME_MIN, SFX_VOLUME_STEP, useSettings } from "@/runtime";

import { GearIcon } from "../header/icons";
import { useBoardTranslator } from "../sidebar/i18n";
import {
  CARD_SIZE_MAX,
  CARD_SIZE_MIN,
  CARD_SIZE_STEP,
  OPPONENT_COSMETICS_MAX,
  OPPONENT_COSMETICS_MIN,
  OPPONENT_COSMETICS_STEP,
  PREVIEW_SIZE_MAX,
  PREVIEW_SIZE_MIN,
  PREVIEW_SIZE_STEP,
  setLocalGameSettings,
  useLocalGameSettings,
  type LocalGameSettings,
} from "./settings-values";

export interface SettingsMenuProps {
  locale?: string;
  compact?: boolean;
  /** Optional overrides for tests / integration (otherwise the stores are used). */
  cardSizePercent?: number;
  previewSizePercent?: number;
  opponentCosmeticsPercent?: number;
  sfxVolume?: number;
  onCardSizePercentChange?: (value: number) => void;
  onPreviewSizePercentChange?: (value: number) => void;
  onOpponentCosmeticsPercentChange?: (value: number) => void;
  onSfxVolumeChange?: (value: number) => void;
  onOpen?: () => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueText: string;
  id: string;
  onChange: (value: number) => void;
  minLabel?: string;
  maxLabel?: string;
}

function SettingsSlider({
  label,
  value,
  min,
  max,
  step,
  valueText,
  id,
  onChange,
  minLabel,
  maxLabel,
}: SliderProps) {
  return (
    <label htmlFor={id} className="grid gap-[0.18rem]">
      <span className="flex items-baseline justify-between gap-[0.4rem] text-[0.62rem] font-semibold text-[#dbe7ff]">
        <span>{label}</span>
        <span className="shrink-0 text-[0.56rem] font-medium tabular-nums text-[#9db5d4]">
          {value}%
        </span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        aria-valuenow={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-[0.34rem] w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(90deg,rgba(125,195,255,0.72),rgba(86,132,190,0.38))] accent-[#9fd4ff] outline-none focus-visible:ring-2 focus-visible:ring-[rgba(159,212,255,0.55)]"
      />
      {minLabel || maxLabel ? (
        <span className="flex justify-between text-[0.5rem] uppercase tracking-[0.06em] text-[#7088a8]">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </span>
      ) : null}
    </label>
  );
}

/**
 * Game settings popover (`u9` in the original board chunk):
 * card size 50–150/5, preview size 50–150/5, opponent cosmetics 25–100/5,
 * SFX volume 0–200/5 (runtime settings store).
 */
export function SettingsMenu({
  locale,
  compact = false,
  cardSizePercent,
  previewSizePercent,
  opponentCosmeticsPercent,
  sfxVolume,
  onCardSizePercentChange,
  onPreviewSizePercentChange,
  onOpponentCosmeticsPercentChange,
  onSfxVolumeChange,
  onOpen,
}: SettingsMenuProps) {
  const t = useBoardTranslator(locale);
  const local = useLocalGameSettings();
  const runtimeSettings = useSettings();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const values = {
    cardSizePercent: cardSizePercent ?? local.cardSizePercent,
    previewSizePercent: previewSizePercent ?? local.previewSizePercent,
    opponentCosmeticsPercent: opponentCosmeticsPercent ?? local.opponentCosmeticsPercent,
    sfxVolume: sfxVolume ?? runtimeSettings.sfxVolume,
  };

  const update = useCallback(
    (patch: Partial<LocalGameSettings>) => {
      if (patch.cardSizePercent !== undefined) {
        if (onCardSizePercentChange) onCardSizePercentChange(patch.cardSizePercent);
        else setLocalGameSettings({ cardSizePercent: patch.cardSizePercent });
      }
      if (patch.previewSizePercent !== undefined) {
        if (onPreviewSizePercentChange) onPreviewSizePercentChange(patch.previewSizePercent);
        else setLocalGameSettings({ previewSizePercent: patch.previewSizePercent });
      }
      if (patch.opponentCosmeticsPercent !== undefined) {
        if (onOpponentCosmeticsPercentChange)
          onOpponentCosmeticsPercentChange(patch.opponentCosmeticsPercent);
        else
          setLocalGameSettings({
            opponentCosmeticsPercent: patch.opponentCosmeticsPercent,
          });
      }
    },
    [onCardSizePercentChange, onOpponentCosmeticsPercentChange, onPreviewSizePercentChange],
  );

  const updateSfx = useCallback(
    (value: number) => {
      if (onSfxVolumeChange) onSfxVolumeChange(value);
      else runtimeSettings.setSfxVolume(value);
    },
    [onSfxVolumeChange, runtimeSettings],
  );

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(272, window.innerWidth - 12);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const top = Math.min(rect.bottom + 7, window.innerHeight - 80);
    setPosition({ left, top });
  }, []);

  const toggle = useCallback(() => {
    if (!open) {
      place();
      onOpen?.();
    }
    setOpen((current) => !current);
  }, [onOpen, open, place]);

  useEffect(() => {
    if (!open) return;
    place();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const triggerClass = compact
    ? "tablet-icon-button"
    : "group relative inline-flex min-h-6 w-[1.6rem] min-w-[1.6rem] items-center justify-center self-stretch rounded-[0.28rem] border transition-colors " +
      (open
        ? "border-[rgba(188,216,251,0.48)] bg-[rgba(34,56,91,0.96)] text-[#edf4ff]"
        : "border-[rgba(178,198,229,0.22)] bg-[rgba(17,31,58,0.72)] text-[#cfe0fb] hover:border-[rgba(207,222,245,0.36)] hover:bg-[rgba(26,43,72,0.92)] hover:text-[#edf4ff]");

  return (
    <div className="relative flex items-stretch">
      <button
        ref={triggerRef}
        type="button"
        data-testid="game-settings-trigger"
        aria-label={t("current.gameSettings") ?? "Game settings"}
        title={t("current.gameSettings") ?? "Game settings"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={triggerClass}
        onClick={toggle}
      >
        <GearIcon className={compact ? "h-[1.125rem] w-[1.125rem]" : "h-[0.78rem] w-[0.78rem]"} />
      </button>

      {open ? (
        <section
          ref={panelRef}
          data-game-settings-panel
          data-compact={compact || undefined}
          role="dialog"
          aria-label={t("current.gameSettings") ?? "Game settings"}
          className="game-settings-panel pointer-events-auto fixed z-135 grid max-h-[calc(100dvh-1rem)] w-[17rem] max-w-[calc(100vw-1rem)] gap-2 overflow-y-auto rounded-[0.5rem] border border-[rgba(212,227,251,0.34)] bg-[linear-gradient(180deg,rgba(20,34,59,0.99),rgba(12,23,43,0.99))] p-[0.6rem] text-left shadow-[0_16px_38px_rgba(3,8,20,0.48)]"
          style={{ top: position.top, left: position.left }}
        >
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.5rem] border-b border-[rgba(181,207,241,0.14)] px-[0.08rem] pb-2">
            <div className="min-w-0">
              <h2 className="m-0 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[#edf4ff]">
                {t("current.gameSettings") ?? "Game settings"}
              </h2>
              <p className="m-0 mt-[0.12rem] text-[0.52rem] leading-[1.3] text-[#8298b9]">
                {t("current.personalPreferencesSavedInThisBrowser") ??
                  "Personal preferences saved in this browser"}
              </p>
            </div>
          </header>

          <section aria-labelledby="game-settings-display" className="grid gap-1">
            <h3
              id="game-settings-display"
              className="m-0 text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[#7991b5]"
            >
              {t("current.display") ?? "Display"}
            </h3>
            <SettingsSlider
              id="game-settings-card-size"
              label={t("current.cardSize") ?? "Card size"}
              value={values.cardSizePercent}
              min={CARD_SIZE_MIN}
              max={CARD_SIZE_MAX}
              step={CARD_SIZE_STEP}
              valueText={
                t("sim.cardSizePercentage", { percent: values.cardSizePercent }) ??
                `${values.cardSizePercent}%`
              }
              onChange={(value) => update({ cardSizePercent: value })}
              minLabel={t("current.smaller") ?? "Smaller"}
              maxLabel={t("current.larger") ?? "Larger"}
            />
            <SettingsSlider
              id="game-settings-preview-size"
              label={t("current.previewSize") ?? "Preview size"}
              value={values.previewSizePercent}
              min={PREVIEW_SIZE_MIN}
              max={PREVIEW_SIZE_MAX}
              step={PREVIEW_SIZE_STEP}
              valueText={
                t("sim.previewSizePercentage", { percent: values.previewSizePercent }) ??
                `${values.previewSizePercent}%`
              }
              onChange={(value) => update({ previewSizePercent: value })}
            />
          </section>

          <section
            aria-labelledby="game-settings-cosmetics"
            className="grid gap-1 border-t border-[rgba(181,207,241,0.14)] pt-2"
          >
            <h3
              id="game-settings-cosmetics"
              className="m-0 text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[#7991b5]"
            >
              {t("current.opponentCosmetics") ?? "Opponent cosmetics"}
            </h3>
            <SettingsSlider
              id="game-settings-opponent-cosmetics"
              label={t("current.intensity") ?? "Intensity"}
              value={values.opponentCosmeticsPercent}
              min={OPPONENT_COSMETICS_MIN}
              max={OPPONENT_COSMETICS_MAX}
              step={OPPONENT_COSMETICS_STEP}
              valueText={
                t("sim.opponentCosmeticsPercentage", {
                  percent: values.opponentCosmeticsPercent,
                }) ?? `${values.opponentCosmeticsPercent}%`
              }
              onChange={(value) => update({ opponentCosmeticsPercent: value })}
            />
          </section>

          <section
            aria-labelledby="game-settings-audio"
            className="grid gap-1 border-t border-[rgba(181,207,241,0.14)] pt-2"
          >
            <h3
              id="game-settings-audio"
              className="m-0 text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[#7991b5]"
            >
              {t("current.audio") ?? "Audio"}
            </h3>
            <SettingsSlider
              id="game-settings-sfx-volume"
              label={t("current.soundEffects") ?? "Sound effects"}
              value={values.sfxVolume}
              min={SFX_VOLUME_MIN}
              max={SFX_VOLUME_MAX}
              step={SFX_VOLUME_STEP}
              valueText={
                t("sim.soundEffectsVolumePercentage", { percent: values.sfxVolume }) ??
                `${values.sfxVolume}%`
              }
              onChange={updateSfx}
              minLabel={t("current.muted") ?? "Muted"}
              maxLabel={t("current.fullMix") ?? "Full mix"}
            />
          </section>
        </section>
      ) : null}
    </div>
  );
}
