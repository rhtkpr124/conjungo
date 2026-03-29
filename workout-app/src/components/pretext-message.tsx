"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// Pretext is client-side only (needs Canvas for measurement)
let pretextModule: typeof import("@chenglou/pretext") | null = null;

async function loadPretext() {
  if (pretextModule) return pretextModule;
  pretextModule = await import("@chenglou/pretext");
  return pretextModule;
}

interface PretextLine {
  text: string;
  width: number;
}

interface PretextMessageProps {
  text: string;
  className?: string;
  font?: string;
  lineHeight?: number;
  /** If true, renders lines progressively (for streaming) */
  streaming?: boolean;
  /** Callback when layout is computed */
  onLayout?: (info: { lineCount: number; height: number }) => void;
}

/**
 * PretextMessage renders text using Pretext's DOM-free layout engine.
 * This avoids browser reflow during text changes (e.g. streaming tokens).
 * Falls back to regular text rendering if Pretext fails to load.
 */
export function PretextMessage({
  text,
  className = "",
  font = "14px system-ui, -apple-system, sans-serif",
  lineHeight = 20,
  streaming = false,
  onLayout,
}: PretextMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<PretextLine[] | null>(null);
  const [computedHeight, setComputedHeight] = useState<number | null>(null);
  const [fallback, setFallback] = useState(false);
  const prevTextRef = useRef("");

  const computeLayout = useCallback(async () => {
    if (!text || !containerRef.current) return;

    try {
      const pretext = await loadPretext();
      const maxWidth = containerRef.current.clientWidth;
      if (maxWidth <= 0) return;

      const prepared = pretext.prepareWithSegments(text, font);
      const result = pretext.layoutWithLines(prepared, maxWidth, lineHeight);

      setLines(result.lines.map(l => ({ text: l.text, width: l.width })));
      setComputedHeight(result.height);
      onLayout?.({ lineCount: result.lineCount, height: result.height });
    } catch {
      // Fall back to browser rendering
      setFallback(true);
    }
  }, [text, font, lineHeight, onLayout]);

  useEffect(() => {
    // Only recompute if text actually changed
    if (text === prevTextRef.current && lines !== null) return;
    prevTextRef.current = text;
    computeLayout();
  }, [text, computeLayout, lines]);

  // Recompute on resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => computeLayout());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [computeLayout]);

  // Fallback: render text normally
  if (fallback || !lines) {
    return (
      <div ref={containerRef} className={className}>
        <span style={{ font, lineHeight: `${lineHeight}px` }}>{text}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height: computedHeight ? `${computedHeight}px` : undefined,
        font,
        lineHeight: `${lineHeight}px`,
        overflow: "hidden",
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            whiteSpace: "pre",
            height: `${lineHeight}px`,
            // For streaming: fade in last line
            opacity: streaming && i === lines.length - 1 ? 0.8 : 1,
          }}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}

/**
 * Hook to use Pretext layout calculations directly.
 * Returns layout info for given text and container width.
 */
export function usePretextLayout(
  text: string,
  maxWidth: number,
  font = "14px system-ui, -apple-system, sans-serif",
  lineHeight = 20
) {
  const [result, setResult] = useState<{
    lines: PretextLine[];
    lineCount: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!text || maxWidth <= 0) return;

    loadPretext().then(pretext => {
      const prepared = pretext.prepareWithSegments(text, font);
      const layout = pretext.layoutWithLines(prepared, maxWidth, lineHeight);
      setResult({
        lines: layout.lines.map(l => ({ text: l.text, width: l.width })),
        lineCount: layout.lineCount,
        height: layout.height,
      });
    }).catch(() => {
      // Silently fail - component will use fallback
    });
  }, [text, maxWidth, font, lineHeight]);

  return result;
}
