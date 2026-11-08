"use client";

import { useEffect, useRef, useState } from "react";

import { PauseIcon, PlayIcon, RotateCcwIcon } from "./icons";

type MotionPreviewProps = {
  label: string;
  posterSrc: string;
  motionSrc: string;
  alt: string;
  width: number;
  height: number;
};

/**
 * Port of the original `PlayFeatureMotionPreview`:
 * - lazy: the mp4 src is attached once the block has been ≥30% in view;
 * - muted autoplay while in view, the tab is visible, and reduced motion is off;
 * - the circle button overrides autoplay (play / pause / retry after error);
 * - poster webp stays rendered underneath and the video is only revealed once it played.
 */
export function MotionPreview({
  label,
  posterSrc,
  motionSrc,
  alt,
  width,
  height,
}: MotionPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [inView, setInView] = useState(false);
  const [activated, setActivated] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [userPreference, setUserPreference] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.dataset.motionInteractive = "true";

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(motionQuery.matches);
    const syncVisibility = () => setPageVisible(!document.hidden);
    syncMotion();
    syncVisibility();
    motionQuery.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.3);
        setInView(visible);
        if (visible) setActivated(true);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      motionQuery.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
      delete el.dataset.motionInteractive;
    };
  }, []);

  const shouldPlay = inView && pageVisible && !error && (userPreference ?? !reducedMotion);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!shouldPlay) {
      video.pause();
      return;
    }
    let cancelled = false;
    void video.play().catch(() => {
      if (!cancelled) setUserPreference(false);
    });
    return () => {
      cancelled = true;
      video.pause();
    };
  }, [shouldPlay]);

  const onButtonClick = () => {
    if (isPlaying) {
      setUserPreference(false);
      return;
    }
    if (error) videoRef.current?.load();
    setError(false);
    setUserPreference(true);
  };

  const state = error ? "Motion unavailable" : isPlaying ? "Motion preview" : "Still preview";
  const buttonLabel = isPlaying
    ? `Pause ${label} motion preview`
    : error
      ? `Retry ${label} motion preview`
      : `Play ${label} motion preview`;

  return (
    <div ref={containerRef} className="relative" data-motion-state={state}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        loading="lazy"
        width={width}
        height={height}
        decoding="async"
        className="block h-auto w-full object-cover"
        style={{ color: "transparent" }}
        src={posterSrc}
      />
      <video
        ref={videoRef}
        src={activated ? motionSrc : undefined}
        aria-label={alt}
        muted
        loop
        playsInline
        preload="none"
        width={width}
        height={height}
        onPlaying={() => {
          setIsPlaying(true);
          setHasPlayed(true);
        }}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setError(true);
          setIsPlaying(false);
          setHasPlayed(false);
        }}
        className={`absolute inset-0 h-full w-full object-cover ${hasPlayed ? "opacity-100" : "opacity-0"}`}
      />
      <div className="absolute bottom-3 right-3">
        <button
          type="button"
          aria-label={buttonLabel}
          aria-pressed={isPlaying}
          onClick={onButtonClick}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white backdrop-blur transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {isPlaying ? (
            <PauseIcon className="h-4 w-4" />
          ) : error ? (
            <RotateCcwIcon className="h-4 w-4" />
          ) : (
            <PlayIcon className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
