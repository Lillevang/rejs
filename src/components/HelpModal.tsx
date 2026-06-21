import { useEffect } from "react";
import { DSL_REFERENCE } from "../lib/dsl-reference";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="DSL guide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2>DSL guide</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal__body">
          <p className="modal__intro">
            Describe a journey as plain text. Indentation is just for readability — fields belong to
            the most recent <code>hop</code> or <code>drive</code> above them.
          </p>
          {DSL_REFERENCE.map((section) => (
            <section key={section.title} className="dslref">
              <h3 className="dslref__title">{section.title}</h3>
              <p className="dslref__desc">{section.description}</p>
              <pre className="dslref__code">{section.code}</pre>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
