/**
 * Rules / prompt text tokenizer (pure). Turns catalog rules text and i18n prompt strings into
 * inline segments so `RulesText` can draw the game's own icons instead of reading `[1][Order]`.
 *
 * Formats found in the data:
 *   - `[1]`, `[3]`            energy cost
 *   - `[Fury]` … `[Order]`    domain rune power (any case)
 *   - `[Rune]` / `[power]`    generic rune power
 *   - `[Might]`               might symbol
 *   - `[Tap]` / `[Exhaust]`   exhaust symbol
 *   - `[ASSAULT 2]`, `[Action]`, `[Level 6]`  keywords (shown as emphasised words)
 *   - `:rb_fury:` style emoji codes and `<tags>` (stripped / mapped)
 */

export type RulesDomain = "Fury" | "Calm" | "Mind" | "Body" | "Chaos" | "Order";

export type RulesSegment =
  | { kind: "text"; value: string }
  | { kind: "energy"; amount: number }
  | { kind: "domain"; domain: RulesDomain }
  | { kind: "rune" }
  | { kind: "might" }
  | { kind: "tap" }
  | { kind: "keyword"; value: string };

const DOMAINS: Record<string, RulesDomain> = {
  fury: "Fury",
  calm: "Calm",
  mind: "Mind",
  body: "Body",
  chaos: "Chaos",
  order: "Order",
};

const KEYWORD_RE = /^[A-Za-z][A-Za-z '\-]{0,24}(?: \d+)?$/;

/** Classifies the inside of one `[...]` (or `:rb_x:`) token; null = leave as plain text. */
export function classifyToken(raw: string): RulesSegment | null {
  const inner = raw.trim();
  if (!inner) return null;
  if (/^\d{1,2}$/.test(inner)) return { kind: "energy", amount: Number(inner) };
  const lower = inner.toLowerCase();
  const domain = DOMAINS[lower];
  if (domain) return { kind: "domain", domain };
  if (lower === "rune" || lower === "power") return { kind: "rune" };
  if (lower === "might") return { kind: "might" };
  if (lower === "tap" || lower === "exhaust") return { kind: "tap" };
  if (KEYWORD_RE.test(inner)) return { kind: "keyword", value: inner };
  return null;
}

/** `:rb_fury:` / `:rb_energy_2:` / `:rb_exhaust:` → the bracket token body. */
function emojiCodeToToken(name: string): string {
  const lower = name.toLowerCase();
  const energy = /^(?:energy|cost)_?(\d+)$/.exec(lower);
  if (energy) return energy[1]!;
  const domain = /^(?:rune_|domain_)?(fury|calm|mind|body|chaos|order)$/.exec(lower);
  if (domain) return domain[1]!;
  return lower.replace(/_/g, " ");
}

export function parseRulesText(input: string | null | undefined): RulesSegment[] {
  if (!input) return [];
  const prepared = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/:rb_([a-z0-9_]+):/gi, (_m, name: string) => `[${emojiCodeToToken(name)}]`)
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  const segments: RulesSegment[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last?.kind === "text") last.value += value;
    else segments.push({ kind: "text", value });
  };
  const re = /\[([^\]\n]{1,30})\]/g;
  let index = 0;
  for (let match = re.exec(prepared); match; match = re.exec(prepared)) {
    pushText(prepared.slice(index, match.index));
    const segment = classifyToken(match[1]!);
    if (segment) segments.push(segment);
    else pushText(match[0]);
    index = match.index + match[0].length;
  }
  pushText(prepared.slice(index));
  return segments;
}

/** Plain-text rendering of segments (aria-label / tests): tokens come back as `[token]`. */
export function rulesSegmentsToPlain(segments: readonly RulesSegment[]): string {
  return segments
    .map((segment) => {
      switch (segment.kind) {
        case "text":
          return segment.value;
        case "energy":
          return `[${segment.amount}]`;
        case "domain":
          return `[${segment.domain}]`;
        case "rune":
          return "[Rune]";
        case "might":
          return "[Might]";
        case "tap":
          return "[Tap]";
        case "keyword":
          return `[${segment.value}]`;
      }
    })
    .join("");
}
