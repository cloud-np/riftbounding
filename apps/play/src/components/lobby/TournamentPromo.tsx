"use client";

import { useEffect, useState } from "react";

import { strings } from "./strings";
import { Icon } from "@/components/ui/Icon";

const STORAGE_KEY = "riftbound_simulator_tournament_promo_collapsed_v4";

export function TournamentPromo() {
  const [collapsed, setCollapsed] = useState(false);
  const [timeZoneOpen, setTimeZoneOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="hidden min-[1280px]:block min-[1280px]:col-start-3 min-[1280px]:row-start-1">
      <aside
        className="sticky shrink-0 overflow-visible transition-[top,width,min-width,max-width,height,min-height,max-height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        aria-label={strings["tournament.aria"]}
        style={{
          top: "max(0.75rem, -330px + 50vh)",
          width: collapsed ? 0 : 208,
          minWidth: collapsed ? 0 : 208,
          maxWidth: collapsed ? 0 : 208,
          height: collapsed ? 0 : 660,
          minHeight: collapsed ? 0 : 660,
          maxHeight: collapsed ? 0 : 660,
        }}
      >
        <div
          id="lobby-tournament-promo-panel"
          className="relative h-full w-full overflow-hidden border border-[rgba(116,239,255,0.24)] bg-[radial-gradient(circle_at_50%_10%,rgba(116,239,255,0.12),transparent_36%),radial-gradient(circle_at_50%_82%,rgba(231,201,139,0.12),transparent_34%),linear-gradient(180deg,rgba(13,20,34,0.96),rgba(8,9,18,0.98))] shadow-[0_18px_44px_rgba(0,0,0,0.28)] transition-[border-color,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[rgba(146,248,255,0.4)] hover:brightness-105"
        >
          <div
            className="absolute inset-y-0 left-0 w-full"
            style={{ opacity: 1, transform: "none" }}
          >
            <div className="grid h-full content-between gap-5 px-4 py-5">
              <div className="grid gap-3 text-center">
                <div className="grid gap-2">
                  <h2 className="lobby-tournament-title text-[1.46rem] font-bold leading-[0.98] text-[#f8fbff]">
                    RiftAtlas
                    <span className="block">Convergence #4</span>
                  </h2>
                  <span className="mx-auto h-px w-14 bg-[linear-gradient(90deg,rgba(116,239,255,0),rgba(116,239,255,0.82),rgba(116,239,255,0))]" />
                  <p className="text-[0.7rem] font-semibold uppercase leading-relaxed tracking-[0.16em] text-[#bda7ff]">
                    {strings["tournament.series"]}
                  </p>
                  <button
                    type="button"
                    aria-label={strings["tournament.timeAria"]}
                    aria-controls="lobby-tournament-promo-time-zone-details"
                    aria-expanded={timeZoneOpen}
                    data-testid="tournament-promo-time-zone-trigger"
                    onClick={() => setTimeZoneOpen((value) => !value)}
                    className="group/time-zone inline-grid justify-items-center text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgba(116,239,255,0.62)] mx-auto gap-0.5 uppercase transition-[filter] duration-150 hover:brightness-110"
                  >
                    <time
                      dateTime="2026-10-31T15:15:00.000Z"
                      className="grid justify-items-center gap-0.5"
                    >
                      <span className="text-[1.14rem] font-semibold leading-tight tracking-[0.14em] text-[#f2ddb0]">
                        {strings["tournament.date"]}
                      </span>
                      <span className="text-[1.14rem] font-semibold leading-tight tracking-[0.14em] text-[#fff2d7]">
                        {strings["tournament.time"]}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[0.58rem] font-semibold leading-tight tracking-[0.14em] text-[#9fdff2]">
                        {strings["tournament.yourTime"]}
                        <Icon name="info" className="h-2.5 w-2.5 shrink-0" strokeWidth={2.4} />
                      </span>
                    </time>
                  </button>
                  {timeZoneOpen ? (
                    <p
                      id="lobby-tournament-promo-time-zone-details"
                      className="border border-[rgba(116,239,255,0.2)] bg-[rgba(7,16,30,0.66)] px-2 py-1.5 text-[0.62rem] leading-snug text-[#b9c7da]"
                    >
                      Saturday, October 31, 2026 at 5:15 PM · UTC+02:00
                    </p>
                  ) : null}
                  <a
                    href="https://www.turnemsideways.gg/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-auto mt-1 inline-flex w-full max-w-full items-center justify-center gap-2 border border-[rgba(116,239,255,0.22)] bg-[rgba(7,16,30,0.58)] px-2 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[background-color,border-color,filter] duration-150 hover:border-[rgba(146,248,255,0.42)] hover:bg-[rgba(12,28,46,0.74)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.5)]"
                    aria-label="Official broadcast produced by Turn'em Sideways"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      loading="lazy"
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0"
                      src="/riftbound/static/turnem-sideways-logo-v1.webp"
                    />
                    <span className="grid shrink-0 gap-0.5 leading-none">
                      <span className="whitespace-nowrap text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#9fb2c8]">
                        {strings["tournament.broadcast"]}
                      </span>
                      <span className="whitespace-nowrap text-[0.74rem] font-semibold tracking-[0.08em] text-[#f7fbff]">
                        {strings["tournament.broadcaster"]}
                      </span>
                    </span>
                  </a>
                </div>
              </div>

              <div className="border-y border-[rgba(176,188,206,0.18)] py-1">
                <PromoStat
                  icon={<Icon name="trophy" className="h-4 w-4" strokeWidth={2.1} />}
                  label={strings["tournament.prize"]}
                  value={strings["tournament.prizeValue"]}
                />
                <PromoStat
                  icon={<Icon name="ticket" className="h-4 w-4" strokeWidth={2.1} />}
                  label={strings["tournament.entry"]}
                  value={strings["tournament.entryValue"]}
                />
                <PromoStat
                  icon={<Icon name="users" className="h-4 w-4" strokeWidth={2.1} />}
                  label={strings["tournament.cap"]}
                  value={strings["tournament.capValue"]}
                />
              </div>

              <div className="grid gap-3">
                <section className="grid gap-2 border-b border-[rgba(176,188,206,0.16)] pb-3">
                  <p className="text-center text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[#9fb2c8]">
                    {strings["tournament.details"]}
                  </p>
                  <dl className="grid gap-0">
                    <PromoDetail
                      label={strings["tournament.format"]}
                      value={strings["tournament.formatValue"]}
                      valueClass="text-[#e8ddff]"
                    />
                    <PromoDetail
                      label={strings["tournament.matches"]}
                      value={strings["tournament.matchesValue"]}
                      valueClass="text-[#bdefff]"
                    />
                    <PromoDetail
                      label={strings["tournament.round"]}
                      value={strings["tournament.roundValue"]}
                      valueClass="text-[#f2ddb0]"
                    />
                  </dl>
                </section>
                <a
                  href="https://topdeck.gg/event/convergence-4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 border border-[rgba(116,239,255,0.54)] bg-[linear-gradient(180deg,rgba(120,78,255,0.94),rgba(39,101,207,0.96))] px-4 text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-[#f7fbff] shadow-[0_0_22px_rgba(74,173,255,0.24),inset_0_0_24px_rgba(204,106,255,0.18)] transition-[transform,filter,border-color,box-shadow] duration-150 hover:-translate-y-px hover:border-[rgba(147,248,255,0.68)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.5)]"
                  aria-label={strings["tournament.registerAria"]}
                >
                  {strings["tournament.register"]}
                  <Icon name="external-link" className="h-3.5 w-3.5" strokeWidth={2.2} />
                </a>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="absolute -right-3.5 top-1/2 z-2 inline-flex h-14 w-7 -translate-y-1/2 items-center justify-center border border-[rgba(116,239,255,0.34)] bg-[rgba(7,13,24,0.9)] text-[#d5e9ff] shadow-[0_10px_24px_rgba(0,0,0,0.34)] transition-[background-color,border-color,color,transform] duration-150 hover:-translate-y-1/2 hover:translate-x-0.5 hover:border-[rgba(146,248,255,0.54)] hover:bg-[rgba(12,28,46,0.96)] hover:text-[#f7fbff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(116,239,255,0.5)]"
          aria-label={collapsed ? "Expand tournament promotion" : strings["tournament.collapse"]}
          aria-controls="lobby-tournament-promo-panel"
          aria-expanded={!collapsed}
          title={collapsed ? "Expand tournament promotion" : strings["tournament.collapse"]}
          onClick={toggleCollapsed}
        >
          <Icon
            name={collapsed ? "chevron-right" : "chevron-left"}
            className="h-4 w-4"
            strokeWidth={2.4}
          />
        </button>
      </aside>
    </div>
  );
}

function PromoStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[1.85rem_minmax(0,1fr)] gap-2 border-t border-[rgba(176,188,206,0.14)] py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-7 w-7 items-center justify-center border border-[rgba(116,239,255,0.22)] bg-[rgba(12,28,46,0.62)] text-[#9fdff2]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#9fb2c8]">
          {label}
        </span>
        <span className="mt-0.5 block text-[1.06rem] font-semibold leading-tight text-[#f7fbff]">
          {value}
        </span>
      </span>
    </div>
  );
}

function PromoDetail({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 border-t border-[rgba(176,188,206,0.12)] py-1.5 first:border-t-0 first:pt-0">
      <dt className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-[#8fa3be]">
        {label}
      </dt>
      <dd className={`text-[0.75rem] font-semibold uppercase tracking-[0.08em] ${valueClass}`}>
        {value}
      </dd>
    </div>
  );
}
