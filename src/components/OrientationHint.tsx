import { useState } from "react";
import { dismissOrientationHint, isOrientationHintDismissed } from "../state/store";
import { useMediaQuery } from "../state/use-media-query";

interface OrientationHintProps {
  /** Only nudge when there's actually a timeline that benefits from width. */
  show: boolean;
}

/**
 * A gentle, one-time, dismissible nudge to rotate the phone for a wider timeline.
 * Never blocks or locks orientation — it's a single sentence shown once, with the
 * dismissal persisted to localStorage (mirroring the first-run hint).
 */
export function OrientationHint({ show }: OrientationHintProps) {
  const portrait = useMediaQuery("(orientation: portrait)");
  const [dismissed, setDismissed] = useState(() => isOrientationHintDismissed());

  if (!show || !portrait || dismissed) return null;

  return (
    <div className="orientation-hint" role="note">
      <span className="orientation-hint__text">Rotate your phone for a wider timeline.</span>
      <button
        type="button"
        className="orientation-hint__dismiss"
        aria-label="Dismiss orientation hint"
        onClick={() => {
          dismissOrientationHint();
          setDismissed(true);
        }}
      >
        ×
      </button>
    </div>
  );
}
