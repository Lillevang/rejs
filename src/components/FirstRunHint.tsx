interface FirstRunHintProps {
  /** Open the existing DSL guide (the same modal the toolbar opens). */
  onShowHelp: () => void;
  /** Permanently dismiss the hint. */
  onDismiss: () => void;
}

/**
 * A one-line, dismissible nudge shown above the editor on a genuine first visit
 * (no saved plans yet, never dismissed). It sets the unusual text-as-UI mental
 * model and points to the existing DSL guide — no modal, no tour. Visibility is
 * decided by the caller; this component only renders the hint itself.
 */
export function FirstRunHint({ onShowHelp, onDismiss }: FirstRunHintProps) {
  return (
    <div className="first-run-hint" role="note">
      <span className="first-run-hint__text">
        Edit this text to change your trip — the map updates live. New here?{" "}
        <button type="button" className="first-run-hint__link" onClick={onShowHelp}>
          Open the DSL guide
        </button>
        .
      </span>
      <button
        type="button"
        className="first-run-hint__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss hint"
      >
        ×
      </button>
    </div>
  );
}
