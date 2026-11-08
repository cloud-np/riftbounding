"use client";

import { useEffect, useState } from "react";

import { strings } from "./strings";

const ROTATE_MS = 11_000;

export interface PromoRailProps {
  onOpenMembership?: () => void;
}

export function PromoRail({ onOpenMembership }: PromoRailProps) {
  const [active, setActive] = useState<"tcgplayer" | "metafy">("tcgplayer");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((value) => (value === "tcgplayer" ? "metafy" : "tcgplayer"));
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      data-testid="lobby-rail-promo-rotator"
      className="w-44 sticky top-[max(0.75rem,calc(50vh-20.625rem))] hidden self-start min-[1280px]:grid min-[1280px]:col-start-1 min-[1280px]:row-start-1"
    >
      <div
        data-testid="lobby-rail-promo-tcgplayer"
        data-active={active === "tcgplayer" ? "true" : "false"}
        aria-hidden={active === "tcgplayer" ? "false" : "true"}
        className={`col-start-1 row-start-1 self-start transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${
          active === "tcgplayer" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <aside className="w-44" aria-label={strings["promo.tcgplayerAria"]}>
          <div className="relative w-44">
            <a
              href="https://partner.tcgplayer.com/c/6933192/3841236/21018?u=https%3A%2F%2Fwww.tcgplayer.com%2Fcategories%2Ftrading-and-collectible-card-games%2Friftbound-league-of-legends-trading-card-game%2Funleashed"
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="group block w-44 overflow-hidden border border-[rgba(145,169,199,0.22)] bg-[rgba(5,10,18,0.86)] shadow-[0_18px_44px_rgba(0,0,0,0.26)] transition-[border-color,filter,transform] duration-150 hover:-translate-y-px hover:border-[rgba(190,226,255,0.38)] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.44)]"
              aria-label={strings["promo.shopTcgplayer"]}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={strings["promo.shopTcgplayer"]}
                loading="eager"
                width={176}
                height={660}
                className="block h-auto w-44"
                src="/riftbound/static/ads/tcgplayer-international-shipping-skyscraper.jpeg"
              />
            </a>
          </div>
        </aside>
      </div>

      <div
        data-testid="lobby-rail-promo-metafy"
        data-active={active === "metafy" ? "true" : "false"}
        aria-hidden={active === "metafy" ? "false" : "true"}
        className={`col-start-1 row-start-1 self-start transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${
          active === "metafy" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <aside
          data-testid="lobby-metafy-emotes-banner"
          className="w-44"
          aria-label={strings["promo.metafyAria"]}
        >
          <button
            type="button"
            data-testid="lobby-metafy-emotes-banner-cta"
            onClick={onOpenMembership}
            className="group relative flex h-[40.9rem] w-44 cursor-pointer flex-col overflow-hidden rounded-xl border border-[rgba(145,169,199,0.22)] bg-[linear-gradient(180deg,rgba(14,22,38,0.96),rgba(6,11,20,0.98))] text-left shadow-[0_18px_44px_rgba(0,0,0,0.26)] transition-[border-color] duration-150 hover:border-[rgba(255,231,183,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,231,183,0.6)]"
          >
            <span className="relative block px-3 pt-4">
              <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#ffe7b7]">
                {strings["promo.membersOnly"]}
              </span>
              <span className="mt-1.5 block text-[1.3rem] font-semibold leading-tight text-[#f7fbff]">
                {strings["promo.sayPoros"]}
              </span>
              <span className="mt-1.5 block text-[0.7rem] leading-snug text-[#9fb2c9]">
                {strings["promo.animated"]}
              </span>
            </span>
            <span className="relative mt-3 block min-h-0 flex-1 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                loading="lazy"
                className="scale-[1.34] object-cover object-[58%_50%] blur-[2px] brightness-[0.92]"
                style={{ position: "absolute", height: "100%", width: "100%", inset: 0 }}
                src="/riftbound/static/cosmetics/creators/lootpixie/playmats/table_skin_loot_pixie_poro_pack/preview.webp"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[#1f4fb8] opacity-85 mix-blend-color"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(122%_48%_at_24%_18%,rgba(255,206,150,0.22),transparent_66%),radial-gradient(110%_54%_at_82%_78%,rgba(120,94,214,0.3),transparent_74%),linear-gradient(180deg,rgba(14,44,104,0.34),rgba(10,24,60,0.46))]"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(116%_72%_at_48%_46%,transparent_42%,rgba(4,10,24,0.56)_100%)]"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                loading="lazy"
                width={120}
                height={168}
                className="absolute h-auto w-[6.2rem] rounded-[0.4rem] border border-white/20 shadow-[5px_14px_26px_rgba(0,0,0,0.55)]"
                style={{ left: "0.2rem", top: "0rem", transform: "rotate(-7deg)" }}
                src="https://play.riftatlas.com/cosmetics/creators/nickangerpng/sleeves/sleeve_pack_super_galaxy_snack_force_radiant/variants/yellow/thumb.webp"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                loading="lazy"
                width={120}
                height={168}
                className="absolute h-auto w-[6.2rem] rounded-[0.4rem] border border-white/20 shadow-[5px_14px_26px_rgba(0,0,0,0.55)]"
                style={{ right: "0.2rem", top: "5.6rem", transform: "rotate(7deg)" }}
                src="https://play.riftatlas.com/cosmetics/creators/glitchedgoober/tokens/tentacle/thumb.webp"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                loading="lazy"
                width={120}
                height={168}
                className="absolute h-auto w-[6.2rem] rounded-[0.4rem] border border-white/20 shadow-[5px_14px_26px_rgba(0,0,0,0.55)]"
                style={{ left: "0.2rem", top: "11.2rem", transform: "rotate(-7deg)" }}
                src="/riftbound/static/cosmetics/creators/lootpixie/tokens/gold/thumb.webp"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                loading="lazy"
                width={120}
                height={168}
                className="absolute h-auto w-[6.2rem] rounded-[0.4rem] border border-white/20 shadow-[5px_14px_26px_rgba(0,0,0,0.55)]"
                style={{ right: "0.2rem", top: "16.8rem", transform: "rotate(7deg)" }}
                src="https://play.riftatlas.com/cosmetics/creators/lootpixie/tokens/shadow-clone/thumb.webp"
              />
              <span
                className="absolute text-[2.3rem] brightness-110 drop-shadow-[2px_5px_7px_rgba(0,0,0,0.6)]"
                style={{ right: "0.1rem", top: "2.5rem" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/riftbound/static/metafy/poro-wave.svg" alt="" className="h-14 w-14" />
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(196deg,rgba(255,206,164,0.12),rgba(255,206,164,0)_46%,rgba(24,40,72,0.16)_100%)] mix-blend-soft-light"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(6,11,20,0)_0%,rgba(6,11,20,0.82)_58%,rgba(6,11,20,0.99)_100%)]"
              />
            </span>
            <span className="relative -mt-8 block px-3 pb-4">
              <span className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-[rgba(255,231,183,0.42)] bg-[linear-gradient(180deg,rgba(255,231,183,0.18),rgba(255,231,183,0.08))] px-1 text-[0.76rem] font-semibold text-[#fff3d6] shadow-[0_10px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-[background,border-color] duration-150 group-hover:border-[rgba(255,231,183,0.7)] group-hover:bg-[linear-gradient(180deg,rgba(255,231,183,0.26),rgba(255,231,183,0.12))]">
                <span
                  aria-hidden="true"
                  data-membership-mark="true"
                  className="riftatlas-mark h-5"
                  style={{
                    ["--riftatlas-mark-light" as string]:
                      "url(/riftbound/static/membership/rift-atlas-membership-layers.webp)",
                    ["--riftatlas-mark-dark" as string]:
                      "url(/riftbound/static/membership/rift-atlas-membership-layers-dark.webp)",
                  }}
                >
                  <span className="riftatlas-mark-crest" />
                  <span className="riftatlas-mark-glow" />
                  <span className="riftatlas-mark-star" />
                </span>
                {strings["promo.becomeMember"]}
              </span>
              <span className="mt-2 block text-[0.6rem] leading-snug text-[#7f91a8]">
                {strings["promo.artBy"]}
              </span>
            </span>
          </button>
        </aside>
      </div>
    </div>
  );
}
