"use client";

import { useEffect, useRef, useState } from "react";

import { BuilderIcon } from "./BuilderIcon";
import { T } from "./strings";
import { BuilderModal } from "./ui";

type Tool =
  | "paragraph"
  | "heading"
  | "subheading"
  | "bold"
  | "italic"
  | "bullets"
  | "numbers"
  | "quote"
  | "link"
  | "clear";

const TOOLS: { tool: Tool; label: string; text: string }[] = [
  { tool: "paragraph", label: T.richTextParagraph, text: "¶" },
  { tool: "heading", label: T.richTextHeading, text: "H2" },
  { tool: "subheading", label: T.richTextSubheading, text: "H3" },
  { tool: "quote", label: T.richTextQuote, text: "❞" },
  { tool: "bold", label: T.richTextBold, text: "B" },
  { tool: "italic", label: T.richTextItalic, text: "I" },
  { tool: "bullets", label: T.richTextBulletedList, text: "•" },
  { tool: "numbers", label: T.richTextNumberedList, text: "1." },
  { tool: "link", label: T.richTextLink, text: "⇗" },
  { tool: "clear", label: T.richTextClearFormatting, text: "⌫" },
];

export function GuideDialog({
  open,
  deckName,
  initialHtml,
  onClose,
  onSave,
}: {
  open: boolean;
  deckName: string;
  initialHtml: string;
  onClose: () => void;
  onSave: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    if (!open) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = initialHtml;
    setEmpty(editor.innerText.trim().length === 0);
  }, [open, initialHtml]);

  const exec = (tool: Tool) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    switch (tool) {
      case "paragraph":
        document.execCommand("formatBlock", false, "p");
        break;
      case "heading":
        document.execCommand("formatBlock", false, "h2");
        break;
      case "subheading":
        document.execCommand("formatBlock", false, "h3");
        break;
      case "quote":
        document.execCommand("formatBlock", false, "blockquote");
        break;
      case "bold":
        document.execCommand("bold");
        break;
      case "italic":
        document.execCommand("italic");
        break;
      case "bullets":
        document.execCommand("insertUnorderedList");
        break;
      case "numbers":
        document.execCommand("insertOrderedList");
        break;
      case "link": {
        const url = window.prompt(T.richTextUrlPrompt);
        if (url) document.execCommand("createLink", false, url);
        break;
      }
      case "clear":
        document.execCommand("removeFormat");
        document.execCommand("formatBlock", false, "p");
        break;
    }
    setEmpty((editor.innerText ?? "").trim().length === 0);
  };

  return (
    <BuilderModal
      open={open}
      onClose={onClose}
      ariaLabel={`${T.deckGuide}: ${deckName}`}
      className="max-h-[min(90vh,52rem)] max-w-4xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {T.deckGuide}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{deckName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{T.deckGuideDescription}</p>
        </div>
        <button
          type="button"
          aria-label={T.closeDeckGuide}
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <BuilderIcon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-border/60 bg-secondary/40 px-1.5 py-1">
          {TOOLS.map((item) => (
            <button
              key={item.tool}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => exec(item.tool)}
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-[11px] font-semibold text-foreground/75 transition-colors hover:bg-background hover:text-foreground ${
                item.tool === "bold" ? "font-black" : ""
              } ${item.tool === "italic" ? "italic" : ""}`}
            >
              {item.text}
            </button>
          ))}
        </div>
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={T.deckGuide}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={T.richTextPlaceholder}
          onInput={() => setEmpty((editorRef.current?.innerText ?? "").trim().length === 0)}
          className="db-exec-content db-thin-scrollbar min-h-[16rem] max-h-[42vh] overflow-y-auto rounded-b-md border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-foreground/25"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-3">
        <p className="text-xs text-muted-foreground">{empty ? T.noGuide : T.guideSavedWithDeck}</p>
        <button
          type="button"
          onClick={() => {
            onSave(editorRef.current?.innerHTML ?? "");
            onClose();
          }}
          className="inline-flex h-9 min-w-20 items-center justify-center rounded bg-[#0073d2] px-4 text-sm font-semibold text-white hover:bg-[#0064b8]"
        >
          {T.done}
        </button>
      </div>
    </BuilderModal>
  );
}
