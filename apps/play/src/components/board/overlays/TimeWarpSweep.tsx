"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const JAGGED =
  "polygon(0% 0%, 7% 0%, 12% 10%, 9% 24%, 18% 38%, 15% 52%, 23% 66%, 19% 84%, 28% 100%, 0% 100%)";

/** Time-warp / rewind card sweep: 0.78 s jagged clip-path reveal. */
export function TimeWarpSweep({ trigger }: { trigger: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger <= 0) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 860);
    return () => window.clearTimeout(timer);
  }, [trigger]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key={trigger}
          className="pointer-events-none absolute inset-0 z-[168] overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          data-time-warp-sweep="true"
          data-testid="time-warp-sweep"
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-0 bg-[linear-gradient(105deg,rgba(8,29,32,0.18),rgba(34,104,95,0.28)_36%,rgba(226,177,95,0.22)_52%,rgba(36,100,109,0.26)_68%,rgba(8,22,32,0.14))] mix-blend-screen"
            initial={{ clipPath: JAGGED }}
            animate={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
            transition={{ duration: 0.78, ease: [0.16, 0.78, 0.22, 1] }}
          />
          <motion.div
            className="absolute inset-y-[-10%] left-[-22%] w-[36%] rounded-[0.8rem] bg-[linear-gradient(90deg,rgba(9,20,21,0)_0%,rgba(24,54,48,0.2)_28%,rgba(42,92,80,0.38)_44%,rgba(222,146,61,0.18)_54%,rgba(27,61,52,0.48)_64%,rgba(15,32,30,0.18)_76%,rgba(9,20,21,0)_100%)] blur-[6px] mix-blend-screen"
            initial={{ x: "-12%", opacity: 0.18, rotate: -4 }}
            animate={{ x: ["-12%", "245%"], opacity: [0.18, 0.86, 0], rotate: [-4, 2, 6] }}
            transition={{ duration: 0.78, ease: [0.18, 0.8, 0.22, 1] }}
          />
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(98,177,156,0.46)_0_1.7%,rgba(98,177,156,0)_2.1%),radial-gradient(circle_at_48%_62%,rgba(58,118,125,0.28)_0_1.2%,rgba(58,118,125,0)_1.7%),radial-gradient(circle_at_76%_56%,rgba(77,145,135,0.34)_0_1.4%,rgba(77,145,135,0)_1.8%)] mix-blend-screen"
            initial={{ opacity: 0.52, clipPath: JAGGED }}
            animate={{ opacity: [0.52, 0.18, 0], clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" }}
            transition={{ duration: 0.66, ease: [0.16, 0.76, 0.22, 1] }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
