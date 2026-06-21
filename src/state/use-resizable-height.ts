import { useCallback, useEffect, useRef, useState } from "react";

const MIN_PX = 96;
const MAX_FRACTION = 0.62; // cap so the map always keeps usable space

/**
 * Track a height in pixels that the user can drag to resize, persisted to
 * localStorage. Returns the current height plus pointer handlers to spread onto
 * a drag handle (it captures the pointer, so dragging over other elements — like
 * the map — keeps working).
 */
export function useResizableHeight(storageKey: string, fallback: number) {
  const [height, setHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved > 0 ? saved : fallback;
  });
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      drag.current = { startY: e.clientY, startH: height };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [height],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const delta = drag.current.startY - e.clientY; // drag up → taller
    const max = window.innerHeight * MAX_FRACTION;
    setHeight(Math.max(MIN_PX, Math.min(max, drag.current.startH + delta)));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  // Persist (debounced) so the chosen split survives a reload.
  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(storageKey, String(Math.round(height))), 300);
    return () => clearTimeout(id);
  }, [height, storageKey]);

  return { height, handleProps: { onPointerDown, onPointerMove, onPointerUp } };
}
