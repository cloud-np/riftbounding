"use client";

import type { DeckEntry, DeckSections } from "./types";
import { strings } from "./strings";

export interface DeckListProps {
  sections: DeckSections;
}

function chunk<T>(entries: T[], count: number): T[][] {
  if (count <= 1) return [entries];
  const size = Math.ceil(entries.length / count);
  return Array.from({ length: count }, (_, index) =>
    entries.slice(index * size, index * size + size),
  ).filter((column) => column.length > 0);
}

function DeckEntryRow({ entry }: { entry: DeckEntry }) {
  return (
    <div className="group/deck-entry grid min-w-0 grid-cols-[2.58rem_auto_minmax(0,1fr)] items-center gap-x-2 rounded-[0.24rem] text-[0.82rem] leading-[1.35] text-[#e6edf8] transition-[background-color,box-shadow] duration-150 hover:bg-[rgba(32,46,68,0.3)] hover:shadow-[inset_0_0_0_1px_rgba(154,198,231,0.18)]">
      <span className="relative h-[1.88rem] w-[2.58rem] overflow-hidden rounded-[0.18rem] bg-[linear-gradient(180deg,rgba(24,31,48,0.86),rgba(10,14,24,0.92))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
        {entry.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.imageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-top opacity-[0.95] saturate-[0.92]"
          />
        ) : null}
        <span className="pointer-events-none absolute inset-0 rounded-[0.18rem] shadow-[inset_0_0_0_2px_rgba(22,27,36,0.94)]" />
      </span>
      <span className="font-semibold text-[#9fdff2]">{entry.count}x</span>
      <span className="min-w-0 font-semibold [text-shadow:0_1px_1px_rgba(3,8,17,0.92)]">
        {entry.name}
      </span>
    </div>
  );
}

function DeckGroup({
  title,
  entries,
  emptyLabel,
  columns = 1,
}: {
  title: string;
  entries: DeckEntry[];
  emptyLabel?: string;
  columns?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#d9c28e]">
        {title}
      </p>
      {entries.length > 0 ? (
        columns > 1 ? (
          <div className="grid gap-x-6 grid-cols-2">
            {chunk(entries, columns).map((column, index) => (
              <div key={`${title}-column-${index}`} className="grid content-start gap-y-0">
                {column.map((entry) => (
                  <DeckEntryRow
                    key={`${entry.cardCode ?? entry.name}-${entry.count}`}
                    entry={entry}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-x-4 gap-y-0 grid-cols-1">
            {entries.map((entry) => (
              <DeckEntryRow key={`${entry.cardCode ?? entry.name}-${entry.count}`} entry={entry} />
            ))}
          </div>
        )
      ) : (
        <p className="text-[0.8rem] text-[#8f8499]">{emptyLabel}</p>
      )}
    </div>
  );
}

export function DeckList({ sections }: DeckListProps) {
  return (
    <div
      id="deck-list-panel"
      role="tabpanel"
      aria-labelledby="deck-list-tab"
      className="grid items-start gap-6 md:grid-cols-3"
    >
      <div className="grid content-start gap-5 md:col-span-2">
        <div className="grid gap-5 sm:grid-cols-2">
          <DeckGroup
            title={strings["sim.deckProfile.legend"]}
            entries={sections.legend.slice(0, 1)}
            emptyLabel={strings["sim.noLegend"]}
          />
          <DeckGroup
            title={strings["sim.deckProfile.champion"]}
            entries={sections.champion}
            emptyLabel={strings["sim.noChampion"]}
          />
        </div>
        {sections.legend.length > 1 ? (
          <DeckGroup title="Additional Legends" entries={sections.legend.slice(1)} emptyLabel="" />
        ) : null}
        <DeckGroup
          title={strings["sim.deckProfile.mainDeck"]}
          entries={sections.mainDeck}
          emptyLabel={strings["sim.noMainDeckCards"]}
          columns={2}
        />
      </div>
      <div className="grid content-start gap-5">
        <DeckGroup
          title={strings["sim.deckProfile.sideboard"]}
          entries={sections.sideboard}
          emptyLabel={strings["sim.noSideboard"]}
        />
        <DeckGroup
          title={strings["sim.deckProfile.battlefields"]}
          entries={sections.battlefields}
          emptyLabel={strings["sim.noBattlefields"]}
        />
        <DeckGroup
          title={strings["sim.deckProfile.runes"]}
          entries={sections.runes}
          emptyLabel={strings["sim.noRunes"]}
        />
      </div>
    </div>
  );
}
