"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { BoardMenuState } from "../interaction/types";

const PANEL_CLASS =
  "fixed z-170 m-0 flex w-max min-w-[12.5rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[0.22rem] border border-[rgba(201,218,249,0.24)] bg-[rgba(8,16,34,0.98)] text-(--text-soft) shadow-[0_14px_28px_rgba(2,6,18,0.54),inset_0_1px_0_rgba(230,239,255,0.06)] backdrop-blur-xl";

const ITEM_CLASS =
  "grid min-h-[2.2rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.42rem] rounded-[0.1rem] px-[0.52rem] py-[0.3rem] text-left text-[0.72rem] font-semibold uppercase tracking-[0.035em] text-[#e8f4ff] transition-[background-color,color] duration-120 hover:bg-[rgba(38,65,91,0.54)] focus-visible:bg-[rgba(45,74,101,0.62)] focus-visible:outline-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent";

export interface ContextMenuProps {
  menu: BoardMenuState | null;
  onClose: () => void;
}

export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu) {
      setPosition(null);
      return;
    }
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const left = Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(menu.y, window.innerHeight - rect.height - 8));
    setPosition({ left, top });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("contextmenu", onPointerDown, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("contextmenu", onPointerDown, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [menu, onClose]);

  useEffect(() => {
    if (!menu) return;
    const first = ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    first?.focus({ preventScroll: true });
  }, [menu]);

  if (!menu || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={menu.title ?? "Context menu"}
      className={PANEL_CLASS}
      style={{ left: position?.left ?? menu.x, top: position?.top ?? menu.y, visibility: position ? "visible" : "hidden" }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.title ? (
        <div className="border-b border-[rgba(174,199,227,0.14)] px-[0.55rem] py-[0.4rem] text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[#a9c2e2]">
          {menu.title}
        </div>
      ) : null}
      {menu.sections.map((section, sectionIndex) => (
        <div
          key={`${section.title ?? "section"}-${sectionIndex}`}
          className="flex flex-col border-t border-[rgba(174,199,227,0.12)] p-[0.22rem] first:border-t-0"
        >
          {section.title ? (
            <div className="px-[0.48rem] pb-[0.16rem] pt-[0.24rem] text-[0.56rem] font-bold uppercase tracking-[0.12em] text-[#7f96bb]">
              {section.title}
            </div>
          ) : null}
          {section.items.map((item, itemIndex) => (
            <div key={item.id}>
              {itemIndex > 0 && sectionIndex >= 0 ? null : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                aria-checked={item.checked}
                className={
                  ITEM_CLASS +
                  (item.tone === "danger" ? " text-[#ffd9d4]" : "") +
                  (item.tone === "positive" ? " text-[#d4ffe7]" : "")
                }
                onClick={() => {
                  if (item.disabled) return;
                  onClose();
                  item.onSelect();
                }}
              >
                <span className="min-w-0 truncate">{item.label}</span>
                {item.hint ? (
                  <span className="rounded-[0.1rem] border border-[rgba(190,214,235,0.26)] px-[0.2rem] py-[0.04rem] text-[0.52rem] font-semibold tracking-[0.04em] text-[#a9c2e2]">
                    {item.hint}
                  </span>
                ) : null}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}
