#!/usr/bin/env node
/**
 * build-errata.mjs — fetch the official card errata and Core Rules patch notes
 * linked from https://playriftbound.com/en-us/rules-hub/ and save them as
 * clean, self-contained markdown under corpus/errata/.
 *
 * Zero dependencies. Run from packages/rules:
 *   node scripts/build-errata.mjs
 *
 * The source pages are Riot's Next.js article pages. Their body lives in
 * `__NEXT_DATA__` → props.pageProps.page.blades[] → articleRichText.richText.body.
 * We convert that HTML fragment to markdown, add a provenance header, and
 * regenerate corpus/errata/INDEX.md (including the errata card table).
 *
 * The fetched date is intentionally the run date. The article text is the
 * official current wording; for errata the new text supersedes printed text
 * (Golden Rule 002).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RULES_HUB = "https://playriftbound.com/en-us/rules-hub/";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(SCRIPT_DIR, "..");
const ERRATA_DIR = path.join(PKG_DIR, "corpus", "errata");
const TODAY = new Date().toISOString().slice(0, 10);

const DOCS = [
  {
    file: "origins-errata.md",
    title: "Riftbound: Origins Card Errata",
    kind: "errata",
    set: "Origins",
    url: "https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-origins-card-errata/",
  },
  {
    file: "spiritforged-errata.md",
    title: "Riftbound Spiritforged Errata",
    kind: "errata",
    set: "Spiritforged",
    url: "https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-spiritforged-errata/",
  },
  {
    file: "unleashed-errata.md",
    title: "Unleashed Errata Updates",
    kind: "errata",
    set: "Unleashed",
    url: "https://playriftbound.com/en-us/news/rules-and-releases/unleashed-errata-updates/",
  },
  {
    file: "vendetta-errata.md",
    title: "Vendetta Errata Updates",
    kind: "errata",
    set: "Vendetta",
    url: "https://playriftbound.com/en-us/news/announcements/vendetta-errata-updates",
  },
  {
    file: "radiance-errata.md",
    title: "Radiance Errata Updates",
    kind: "errata",
    set: "Radiance",
    url: "https://playriftbound.com/en-us/news/announcements/radiance-errata-updates",
  },
  {
    file: "core-rules-patch-notes.md",
    title: "Riftbound Core Rules: Patch Notes",
    kind: "patch-notes",
    set: "Core",
    url: "https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-core-rules-patch-notes/",
  },
  {
    file: "spiritforged-patch-notes.md",
    title: "Riftbound Core Rules: Spiritforged Patch Notes",
    kind: "patch-notes",
    set: "Spiritforged",
    url: "https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-core-rules-spiritforged-patch-notes/",
  },
  {
    file: "unleashed-patch-notes.md",
    title: "Riftbound Core Rules: Unleashed Patch Notes",
    kind: "patch-notes",
    set: "Unleashed",
    url: "https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-core-rules-unleashed-patch-notes/",
  },
  {
    file: "vendetta-patch-notes.md",
    title: "Core Rules: Vendetta Patch Notes",
    kind: "patch-notes",
    set: "Vendetta",
    url: "https://playriftbound.com/en-us/news/announcements/core-rules-vendetta-patch-notes",
  },
  {
    file: "radiance-patch-notes.md",
    title: "Core Rules: Radiance Patch Notes (Effective October 16, 2026)",
    kind: "patch-notes",
    set: "Radiance",
    url: "https://playriftbound.com/en-us/news/announcements/core-rules-radiance-patch-notes-effective-october-16-2026/",
  },
];

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
  times: "×",
  middot: "·",
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1] === "x" || entity[1] === "X";
      const value = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (Number.isFinite(value)) {
        try {
          return String.fromCodePoint(value);
        } catch {
          return match;
        }
      }
      return match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Convert the article body HTML fragment to readable markdown. */
function htmlToMarkdown(html) {
  let text = html;
  text = text.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style\b[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<picture\b[\s\S]*?<\/picture>/gi, "");
  text = text.replace(/<svg\b[\s\S]*?<\/svg>/gi, "");
  text = text.replace(/<(img|iframe|video|source|meta|link)\b[^>]*\/?>/gi, "");
  text = text.replace(/<br\s*\/?>/gi, "\n\n");
  text = text.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  text = text.replace(/<h1\b[^>]*>/gi, "\n\n# ");
  text = text.replace(/<h2\b[^>]*>/gi, "\n\n## ");
  text = text.replace(/<h3\b[^>]*>/gi, "\n\n### ");
  text = text.replace(/<h4\b[^>]*>/gi, "\n\n#### ");
  text = text.replace(/<h5\b[^>]*>/gi, "\n\n##### ");
  text = text.replace(/<h6\b[^>]*>/gi, "\n\n###### ");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");

  text = text.replace(/<li\b[^>]*>/gi, "\n- ");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<(ul|ol)\b[^>]*>/gi, "\n");
  text = text.replace(/<\/(ul|ol)>/gi, "\n");

  text = text.replace(/<p\b[^>]*>/gi, "\n\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<div\b[^>]*>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n\n");

  text = text.replace(/<(strong|b)\b[^>]*>/gi, "**");
  text = text.replace(/<\/(strong|b)>/gi, "**");
  text = text.replace(/<(em|i)\b[^>]*>/gi, "*");
  text = text.replace(/<\/(em|i)>/gi, "*");

  text = text.replace(
    /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, label) => {
      const cleanLabel = decodeEntities(label.replace(/<[^>]+>/g, "")).trim();
      return cleanLabel ? `[${cleanLabel}](${href})` : "";
    },
  );

  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text);

  // Normalise line-by-line while preserving paragraph blocks.
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => {
      const blockLines = block
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .filter(Boolean);
      // Keep list blocks multi-line; join prose paragraphs into one line.
      if (blockLines.length > 1 && blockLines.every((l) => /^[-*] /.test(l))) {
        return blockLines.join("\n");
      }
      return blockLines.join(" ");
    })
    .filter(Boolean);

  const lines = [];
  for (const block of blocks) {
    lines.push(block, "");
  }

  let md = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // Errata presentation: drop the ▲ divider headings and make the text
  // markers compact; keep the --- separators between cards.
  md = md
    .split("\n")
    .map((line) => {
      if (/^#{1,6}\s*\*{0,2}\s*▲\s*\*{0,2}\s*$/.test(line)) return "";
      if (/^\*{2}\s*▲\s*\*{2}$/.test(line)) return "";
      if (/^▲$/.test(line)) return "";
      if (/^#{1,6}\s*\*{0,2}\s*\[NEW TEXT\]\s*\*{0,2}\s*$/i.test(line)) {
        return "**[NEW TEXT]**";
      }
      if (/^#{1,6}\s*\*{0,2}\s*\[OLD TEXT\]\s*\*{0,2}\s*$/i.test(line)) {
        return "**[OLD TEXT]**";
      }
      if (/^\*{2}\s*\[NEW TEXT\]\s*\*{2}$/i.test(line)) return "**[NEW TEXT]**";
      if (/^\*{2}\s*\[OLD TEXT\]\s*\*{2}$/i.test(line)) return "**[OLD TEXT]**";
      return line;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Trim stray spaces inside emphasis spans (the CMS often emits
  // "<em>Vendetta </em>" which would become "*Vendetta *").
  md = md
    .replace(/\*\*([^*\n]+?)\*\*/g, (_, inner) => `**${inner.trim()}**`)
    .replace(/\*([^*\n]+?)\*/g, (_, inner) => `*${inner.trim()}*`)
    .replace(/\*\*([^*\n]+)\*\*\[/g, "**$1** [")
    .replace(/\*([^*\n]+)\*\[/g, "*$1* [")
    .replace(/\*\*([^*\n]+)\*\*([A-Za-z])/g, "**$1** $2")
    .replace(/\*([^*\n]+)\*([A-Za-z])/g, "*$1* $2")
    .replace(/(^|[\s(])\*\*[ \t]+([^*\n]+?)\*\*/gm, "$1**$2**")
    .replace(/(^|[\s(])\*[ \t]+([^*\n]+?)\*/gm, "$1*$2*");

  // Final tidy: drop empty headings / empty bold artifacts and strip
  // emphasis markers from heading text (they add noise, not meaning).
  md = md
    .replace(/\[\[([^\]]+)\]\]\(/g, "[$1](")
    .split("\n")
    .map((line) => {
      if (/^#{1,6}\s*$/.test(line)) return "";
      if (/^\*{1,2}\s*$/.test(line)) return "";
      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const title = heading[2]
          .replace(/\*+/g, "")
          .replace(/\s+/g, " ")
          .trim();
        return title ? `${heading[1]} ${title}` : "";
      }
      return line;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Demote card headings (# Card) to ## so they sit below set headings.
  const mdLines = md.split("\n");
  for (let i = 0; i < mdLines.length; i += 1) {
    const heading = mdLines[i].match(/^(#{1,6})\s+(.*)$/);
    if (!heading || heading[1].length !== 1) continue;
    let j = i + 1;
    while (j < mdLines.length && !mdLines[j].trim()) j += 1;
    if (mdLines[j] && mdLines[j].trim() === "**[NEW TEXT]**") {
      mdLines[i] = `## ${heading[2]}`;
    }
  }
  md = mdLines.join("\n");

  return `${md}\n`;
}

function extractArticle(html) {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error("no __NEXT_DATA__ in page");
  const data = JSON.parse(match[1]);
  const page = data?.props?.pageProps?.page;
  if (!page) throw new Error("no pageProps.page in __NEXT_DATA__");
  const blades = (page.blades || []).filter(
    (b) => b?.type === "articleRichText" && b?.richText?.body,
  );
  if (blades.length === 0) throw new Error("no articleRichText blade");
  return {
    title: page.title || blades[0].title || "Untitled",
    published: page.displayedPublishDate || page.publishDate || null,
    // Some articles split the body across several articleRichText blades
    // (the Spiritforged patch notes has two).
    html: blades.map((b) => b.richText.body).join("\n\n"),
  };
}

async function fetchDoc(doc) {
  const res = await fetch(doc.url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${doc.url}`);
  return res.text();
}

function header(doc, article) {
  const published = article.published
    ? `\n- **Published:** ${article.published.slice(0, 10)}`
    : "";
  const note =
    doc.kind === "errata"
      ? "Card text below is the official current wording. It supersedes the printed card text (Golden Rule 002)."
      : "These notes explain the Core Rules changes; the authoritative rules text is `corpus/rules.json`.";
  return `# ${article.title}

- **Source:** ${doc.url}
- **Rules hub:** ${RULES_HUB}${published}
- **Fetched:** ${TODAY}
- **Type:** ${doc.kind === "errata" ? "Official card errata" : "Official Core Rules patch notes"}
- **Note:** ${note}

---

`;
}

/**
 * Parse the converted errata markdown into card records.
 * A card is a heading immediately followed (within a few lines) by a
 * [NEW TEXT] marker. Set headings ("Origins Cards", etc.) update the set.
 */
function parseErrataCards(markdown, defaultSet) {
  const lines = markdown.split("\n");
  const cards = [];
  let currentSet = defaultSet;
  let lastHeading = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const title = heading[2]
        .replace(/\*\*/g, "")
        .replace(/^\*|\*$/g, "")
        .trim();
      if (/^(Origins|Spiritforged|Unleashed|Vendetta|Radiance) Cards$/i.test(title)) {
        currentSet = title.replace(/\s+Cards$/i, "");
        lastHeading = null;
      } else if (title) {
        lastHeading = title;
      }
      continue;
    }

    if (
      /^\*{2}\s*\[NEW TEXT\]\s*\*{2}$/i.test(line) ||
      /^\[NEW TEXT\]$/i.test(line)
    ) {
      if (!lastHeading) continue;
      const newLines = [];
      let oldLines = [];
      let mode = "new";
      let j = i + 1;
      for (; j < lines.length; j += 1) {
        const l = lines[j].trim();
        if (
          /^\*{2}\s*\[OLD TEXT\]\s*\*{2}$/i.test(l) ||
          /^\[OLD TEXT\]$/i.test(l)
        ) {
          mode = "old";
          continue;
        }
        if (/^---$/.test(l)) break;
        if (/^#{1,6}\s+/.test(l)) break;
        if (!l) continue;
        if (mode === "new") newLines.push(l);
        else oldLines.push(l);
      }
      const newText = newLines.join(" ").replace(/\s+/g, " ").trim();
      const oldText = oldLines.join(" ").replace(/\s+/g, " ").trim();
      if (newText) {
        cards.push({
          set: currentSet,
          name: lastHeading,
          newText,
          oldText,
          file: null,
        });
      }
      lastHeading = null;
      i = j - 1;
    }
  }

  return cards;
}

function indexMarkdown(results) {
  const errata = results.filter((r) => r.doc.kind === "errata");
  const notes = results.filter((r) => r.doc.kind === "patch-notes");

  const lines = [];
  lines.push("# Riftbound rules errata & patch notes — index");
  lines.push("");
  lines.push(`- **Rules hub:** ${RULES_HUB}`);
  lines.push(`- **Fetched:** ${TODAY}`);
  lines.push(
    "- **Use:** later card scripts must be written against the errata'd (new) text, not the printed text. The Core Rules corpus is in `corpus/rules.json`.",
  );
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push("| File | Type | Source | Cards |");
  lines.push("| --- | --- | --- | ---: |");
  for (const r of results) {
    lines.push(
      `| [\`${r.doc.file}\`](${r.doc.file}) | ${r.doc.kind === "errata" ? "Card errata" : "Core Rules patch notes"} | ${r.doc.url} | ${r.cards.length} |`,
    );
  }
  lines.push("");
  lines.push("## Card errata — new text");
  lines.push("");
  lines.push(
    "This is the current official wording for every card corrected by the five errata articles. The printed text is in the old-text section of each linked file.",
  );
  lines.push("");
  lines.push("| Set | Card | New text | File |");
  lines.push("| --- | --- | --- | --- |");
  const seen = new Set();
  for (const r of errata) {
    for (const card of r.cards) {
      const key = `${card.set}\u0000${card.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const text = card.newText.replace(/\|/g, "\\|");
      lines.push(
        `| ${card.set} | ${card.name.replace(/\|/g, "\\|")} | ${text} | [\`${r.doc.file}\`](${r.doc.file}) |`,
      );
    }
  }
  lines.push("");
  lines.push("## Core Rules patch notes");
  lines.push("");
  for (const r of notes) {
    lines.push(`- [\`${r.doc.file}\`](${r.doc.file}) — ${r.doc.title}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  fs.mkdirSync(ERRATA_DIR, { recursive: true });
  const results = [];

  for (const doc of DOCS) {
    process.stdout.write(`Fetching ${doc.file} ... `);
    const html = await fetchDoc(doc);
    const article = extractArticle(html);
    const body = htmlToMarkdown(article.html);
    const markdown = `${header(doc, article)}${body}`;
    const outPath = path.join(ERRATA_DIR, doc.file);
    fs.writeFileSync(outPath, markdown);
    const cards =
      doc.kind === "errata" ? parseErrataCards(body, doc.set) : [];
    for (const card of cards) card.file = doc.file;
    results.push({ doc, cards, markdown });
    console.log(`${cards.length} card(s), ${body.length} chars`);
  }

  fs.writeFileSync(path.join(ERRATA_DIR, "INDEX.md"), indexMarkdown(results));

  console.log("");
  console.log("Summary:");
  let total = 0;
  for (const r of results) {
    total += r.cards.length;
    console.log(
      `  ${r.doc.file}: ${r.doc.kind === "errata" ? `${r.cards.length} card(s)` : "patch notes"}`,
    );
  }
  console.log(`  errata cards: ${total}`);
  console.log(`  index: ${path.relative(PKG_DIR, path.join(ERRATA_DIR, "INDEX.md"))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
