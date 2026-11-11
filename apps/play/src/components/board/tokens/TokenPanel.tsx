"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createTranslator } from "@rift/i18n";
import type { Zone } from "@rift/protocol";

import { useBoardInteractionOptional } from "../interaction/context";
import { playBoardSound } from "../interaction/sfx";
import { filterTokenPresets, tokenPresetsForZone } from "./token-presets";
import { SafeImg } from "../card/SafeImg";

const t = createTranslator("en");

const ZONE_LABEL_KEYS: Record<string, string> = {
  base: "sim.base",
  battlefieldA: "sim.tablet.battlefieldA",
  battlefieldB: "sim.tablet.battlefieldB",
  battlefieldC: "sim.tablet.battlefieldC",
  battlefieldToken: "sim.tablet.battlefieldToken",
  hand: "sim.hand",
  trash: "sim.trash",
};

export interface TokenPanelProps {
  zone: "base" | "battlefieldA" | "battlefieldB" | "battlefieldC" | "battlefieldToken" | "hand" | "trash" | string;
  owner?: "self" | "opponent";
  className?: string;
}

export function TokenPanel({ zone, owner = "self", className }: TokenPanelProps) {
  const interaction = useBoardInteractionOptional();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const presets = useMemo(() => filterTokenPresets(tokenPresetsForZone(zone), query), [zone, query]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const button = buttonRef.current;
      const panel = panelRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = panel?.offsetWidth ?? 232;
      const height = panel?.offsetHeight ?? 150;
      let left = rect.right - width;
      let top = rect.top - height - 8;
      if (top < 8) top = rect.bottom + 8;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
      setPosition({ left, top });
    };
    update();
    const raf = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  // Quick-add tokens are a manual tool: hidden in strict play (the rules engine creates tokens).
  if (!interaction || owner !== "self" || (interaction.strictView && !interaction.strictManual)) return null;

  const zoneLabel = t(ZONE_LABEL_KEYS[zone] ?? "sim.battlefield") ?? zone;
  const panel = open ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t("sim.tokenPanel") ?? "Token Panel"}
      data-testid="token-quick-panel"
      className="fixed z-[2147483000] w-[15.2rem] max-w-[calc(100vw-1rem)] overflow-visible rounded-[0.22rem] border border-[rgba(174,199,227,0.28)] bg-[rgba(11,20,35,0.96)] p-[0.4rem] text-[#dbe7ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.065),0_14px_30px_rgba(2,6,18,0.6)] backdrop-blur-xl"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
    >
      <div className="mb-[0.32rem] flex items-center justify-between gap-[0.3rem]">
        <strong className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#bfe0ff]">
          {t("sim.tokenPanel") ?? "Token Panel"}
        </strong>
        <span className="text-[0.5rem] uppercase tracking-[0.06em] text-[#8ea9c9]">{zoneLabel}</span>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search tokens"
        aria-label="Search tokens"
        className="mb-[0.34rem] w-full rounded-[0.2rem] border border-[rgba(144,172,197,0.28)] bg-[rgba(7,16,29,0.8)] px-[0.34rem] py-[0.22rem] text-[0.64rem] text-[#eef6ff] outline-none placeholder:text-[#6f8ba9] focus:border-[rgba(190,225,255,0.58)]"
      />
      <div className="grid grid-cols-5 gap-[0.24rem]">
        {presets.map((preset) => (
          <button
            key={preset.name}
            type="button"
            title={preset.name}
            aria-label={t("sim.addTokenTo", { tokenName: preset.name, zone: zoneLabel }) ?? preset.name}
            className="group/token-option relative h-10 w-10 shrink-0 overflow-hidden rounded-[0.14rem] border border-[rgba(177,201,228,0.16)] bg-[rgba(14,26,45,0.76)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow,background-color] duration-120 hover:border-[rgba(207,229,251,0.36)] hover:bg-[rgba(22,39,64,0.84)]"
            onClick={() => {
              playBoardSound("ui_click");
              interaction.sendIntent({ type: "create_token", zone: zone as Zone, name: preset.name, count: 1 });
              setOpen(false);
            }}
          >
            <SafeImg src={preset.panelImageUrl} alt="" className="h-full w-full object-cover" />
            <span className="pointer-events-none absolute left-1/2 bottom-[calc(100%+0.16rem)] z-20 inline-flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-[0.1rem] border border-[rgba(171,191,238,0.34)] bg-[rgba(17,30,50,0.96)] px-[0.3rem] py-[0.13rem] text-[0.5rem] font-semibold leading-none tracking-[0.035em] text-[#dbe7ff] opacity-0 shadow-[0_8px_18px_rgba(3,8,20,0.4)] transition-opacity duration-120 group-hover/token-option:opacity-100">
              {preset.name}
            </span>
          </button>
        ))}
        {presets.length === 0 ? (
          <p className="col-span-5 py-[0.4rem] text-center text-[0.58rem] text-[#8ea9c9]">No matching tokens.</p>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <div className={"group/token-bar relative flex items-start gap-[0.16rem] " + (className ?? "")} data-token-quick-bar="true">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={t("sim.openTokenPanelFor", { zone: zoneLabel }) ?? "Open token panel"}
        className={
          "group/action grid h-[1.52rem] w-[1.52rem] place-items-center rounded-[0.14rem] border text-[0.7rem] font-black leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_5px_12px_rgba(3,8,18,0.18)] backdrop-blur-md transition-[border-color,background-color,color] duration-120 " +
          (open
            ? "border-[rgba(204,226,249,0.42)] bg-[rgba(29,47,72,0.82)] text-[#f0f7ff]"
            : "border-[rgba(181,205,234,0.26)] bg-[rgba(18,31,51,0.72)] text-[#cfe2f7] hover:border-[rgba(204,226,249,0.42)] hover:bg-[rgba(29,47,72,0.8)] hover:text-[#f0f7ff]")
        }
        onClick={() => {
          playBoardSound("ui_click");
          setOpen((value) => !value);
        }}
      >
        ✦
        <span className="pointer-events-none absolute bottom-[calc(100%+0.2rem)] left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-[0.12rem] border border-[rgba(171,191,238,0.42)] bg-[linear-gradient(168deg,rgba(27,44,72,0.96),rgba(36,56,88,0.94))] px-[0.32rem] py-[0.18rem] text-[0.52rem] font-semibold uppercase tracking-[0.03em] text-[#dbe7ff] shadow-[0_8px_18px_rgba(3,8,20,0.45)] group-hover/token-bar:block">
          {t("sim.tokenPanel") ?? "Token Panel"}
        </span>
      </button>
      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
