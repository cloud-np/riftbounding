"use client";

import type { Card } from "@rift/cards";

import { CardArt } from "./CardArt";
import { BuilderIcon } from "./BuilderIcon";
import { BuilderModal, DomainChip } from "./ui";

function renderRules(text: string | undefined) {
  if (!text) return null;
  const nodes: React.ReactNode[] = [];
  let index = 0;
  const pattern = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > index) nodes.push(text.slice(index, match.index));
    nodes.push(
      <strong key={`${match.index}-${match[1]}`} className="font-semibold text-foreground">
        {match[1]}
      </strong>,
    );
    index = match.index + match[0].length;
  }
  if (index < text.length) nodes.push(text.slice(index));
  return nodes;
}

export function CardDetailDialog({
  card,
  open,
  onClose,
}: {
  card: Card | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!card) return null;
  const tcgplayer = (card as Card & { tcgplayerUrl?: string }).tcgplayerUrl;
  return (
    <BuilderModal
      open={open}
      onClose={onClose}
      ariaLabel={`${card.name} card details`}
      className="max-h-[min(92vh,56rem)] max-w-5xl overflow-y-auto"
    >
      <div className="db-thin-scrollbar max-h-[min(92vh,56rem)] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border/60 bg-background/95 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight">{card.name}</h2>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {card.type}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close card details"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <BuilderIcon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 px-5 py-5 min-[700px]:grid-cols-[360px_minmax(0,1fr)]">
          <div data-testid="card-detail-hero" className="mx-auto w-full max-w-[360px]">
            <div className="overflow-hidden rounded-xl border border-black/50 shadow-[0_10px_30px_rgba(9,10,19,0.25)]">
              <CardArt card={card} sizes="360px" className="h-auto w-full" />
            </div>
          </div>

          <div className="grid content-start gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Energy
              </p>
              <p className="mt-1 text-base font-semibold">{card.energyCost}</p>
            </div>
            {(card.subtypes?.length ?? 0) > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Subtypes
                </p>
                <p className="mt-1 text-sm">{card.subtypes?.join(" · ")}</p>
              </div>
            ) : null}
            {card.text ? (
              <div className="border-t border-border/60 pt-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Rules
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                  {renderRules(card.text)}
                </p>
              </div>
            ) : null}

            <div className="border-t border-border/60 pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Card information
              </p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1">
                  <dt className="text-muted-foreground">Set</dt>
                  <dd className="font-medium">{card.set}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1">
                  <dt className="text-muted-foreground">Rarity</dt>
                  <dd className="font-medium">{card.rarity}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1">
                  <dt className="text-muted-foreground">Domains</dt>
                  <dd className="inline-flex items-center gap-1.5 font-medium">
                    <DomainChip domains={card.domains} />
                    <span>{card.domains.join(" / ")}</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1">
                  <dt className="text-muted-foreground">Card number</dt>
                  <dd className="font-medium">{card.id}</dd>
                </div>
                {card.might > 0 ? (
                  <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1">
                    <dt className="text-muted-foreground">Might</dt>
                    <dd className="font-medium">{card.might}</dd>
                  </div>
                ) : null}
                {(card.powerCost ?? 0) > 0 ? (
                  <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1">
                    <dt className="text-muted-foreground">Power</dt>
                    <dd className="font-medium">{card.powerCost}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {tcgplayer ? (
              <a
                href={tcgplayer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#0073d2] px-4 text-sm font-semibold text-white hover:bg-[#0064b8]"
              >
                Buy on TCGPlayer
                <BuilderIcon name="external" className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <a
              href={`https://riftatlas.com/card/${encodeURIComponent(card.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[#0073d2] hover:underline"
            >
              Full card page
              <BuilderIcon name="external" className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </BuilderModal>
  );
}
