"use client";

import { AnimatePresence, motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";
import type { DieRoll } from "@rift/protocol";

const t = createTranslator("en");
const DIE_SHAPES: Record<number, string> = {
  4: "M12 2 22 20H2Z",
  6: "M4 4h16v16H4Z",
  8: "M12 2 22 12 12 22 2 12Z",
  10: "M12 2 22 9 18 21H6L2 9Z",
  12: "M12 1 21 6.5v11L12 23 3 17.5v-11Z",
  20: "M12 1 22 8.2l-3.8 12.6H5.8L2 8.2Z",
};

export function DiceResultOverlay({ roll }: { roll: DieRoll | null }) {
  return (
    <AnimatePresence>
      {roll ? (
        <motion.div
          key={roll.id}
          className="pointer-events-none absolute left-1/2 top-[16%] z-[165] -translate-x-1/2"
          initial={{ opacity: 0, y: -10, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          data-die-roll={roll.sides}
          data-die-result={roll.result}
          data-testid="dice-roll-result"
        >
          <div className="flex items-center gap-2 rounded-[0.34rem] border border-[rgba(224,194,135,0.55)] bg-[linear-gradient(165deg,rgba(22,38,62,0.96),rgba(8,16,30,0.96))] px-[0.6rem] py-[0.34rem] text-[#fff1d4] shadow-[inset_0_0_0_1px_rgba(255,236,190,0.08),0_14px_28px_rgba(2,8,19,0.5)]">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-[#e8c98f]">
              <path d={DIE_SHAPES[roll.sides] ?? DIE_SHAPES[20]} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            <div className="grid leading-none">
              <span className="text-[0.5rem] uppercase tracking-[0.12em] text-[#b9cde3]">
                {t("sim.rollDieType", { sides: roll.sides }) ?? `d${roll.sides}`}
              </span>
              <span className="text-[1.25rem] font-black tabular-nums text-[#fff4d9]">{roll.result}</span>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
