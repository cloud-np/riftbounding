"use client";

import { useCallback, useState, type ImgHTMLAttributes } from "react";

/**
 * `<img>` that never shows a broken-image glyph or its alt text. The image stays hidden until it
 * has actually decoded; the ref callback inspects `complete`/`naturalWidth` on mount because a
 * server-rendered image can finish (or fail) before React hydrates, in which case neither
 * `onLoad` nor `onError` ever reaches us. `alt` is preserved for tests and assistive tech.
 */
export function SafeImg({
  src,
  onLoad,
  onError,
  style,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { src?: string }) {
  const [state, setState] = useState<{ src?: string; status: "loaded" | "failed" } | null>(null);
  const status = state && state.src === src ? state.status : "loading";
  const imgRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.complete) return;
      setState({ src, status: img.naturalWidth > 0 ? "loaded" : "failed" });
    },
    [src],
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- generic guarded image
    <img
      {...rest}
      ref={imgRef}
      src={src}
      data-img-state={status}
      onLoad={(event) => {
        setState({ src, status: "loaded" });
        onLoad?.(event);
      }}
      onError={(event) => {
        setState({ src, status: "failed" });
        onError?.(event);
      }}
      style={status === "loaded" ? style : { ...style, visibility: "hidden" }}
    />
  );
}
