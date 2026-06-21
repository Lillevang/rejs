import { useEffect, useRef, useState, type RefObject } from "react";

/** Close a popup when it's open and the user clicks outside it or presses Escape. */
function useDismissable(ref: RefObject<HTMLElement>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // `close` is only invoked, and the state setters behind it are stable, so we
    // intentionally omit it to avoid re-attaching listeners on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, open]);
}

interface ToolbarProps {
  plans: string[];
  /** The named slot the buffer is tied to, or null for a never-saved buffer. */
  loadedName: string | null;
  /** Whether the buffer diverges from its saved slot. */
  dirty: boolean;
  /**
   * Mobile layout: collapse the infrequent actions (Save as…, Saved plans,
   * Copy link, Export, DSL guide, Load example) into a single overflow menu,
   * leaving only Save inline. Reclaims scarce vertical space on a phone.
   */
  compact?: boolean;
  /** Overwrite the currently-loaded slot in place. No-op if nothing is loaded. */
  onSave: () => void;
  /** Save the buffer under a (possibly new) name. */
  onSaveAs: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  onLoadExample: () => void;
  onShowHelp: () => void;
  /** Open the browser print dialog (print / save-as-PDF). */
  onPrint: () => void;
  /** Download the current plan as an .ics calendar file. */
  onDownloadIcs: () => void;
  /** Build the self-contained share URL for the current plan, on demand. */
  shareUrl: () => string;
}

export function Toolbar({
  plans,
  loadedName,
  dirty,
  compact = false,
  onSave,
  onSaveAs,
  onLoad,
  onDelete,
  onLoadExample,
  onShowHelp,
  onPrint,
  onDownloadIcs,
  shareUrl,
}: ToolbarProps) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const exportMenu = useRef<HTMLDivElement>(null);
  const overflowMenu = useRef<HTMLDivElement>(null);

  // Close a menu on an outside click or Escape — the smallest accessible
  // dropdown behavior, no extra dependency. Shared by the Export and (mobile)
  // overflow menus.
  useDismissable(exportMenu, exportOpen, () => setExportOpen(false));
  useDismissable(overflowMenu, overflowOpen, () => setOverflowOpen(false));

  async function copyShareLink() {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable (insecure context) or denied — fall
      // back to a prompt so the user can still copy the link manually.
      window.prompt("Copy this share link:", url);
    }
  }

  // "Save" overwrites the loaded slot in place; with no slot loaded there's
  // nothing to overwrite, so steer the user to the "Save as…" name input.
  function handleSave() {
    if (loadedName == null) {
      nameInput.current?.focus();
      return;
    }
    onSave();
  }

  function handleSaveAs() {
    const trimmed = name.trim();
    if (trimmed === "") return;
    onSaveAs(trimmed);
    setSelected(trimmed);
    setName("");
  }

  // Mobile "Save as…": no always-present text field (a poor phone affordance),
  // so prompt for the name on demand. window.prompt is the smallest no-dependency
  // input; the desktop path keeps its inline field.
  function handleSaveAsPrompt() {
    setOverflowOpen(false);
    const entered = window.prompt("Save plan as…", loadedName ?? "")?.trim();
    if (entered) {
      onSaveAs(entered);
      setSelected(entered);
    }
  }

  if (compact) {
    return (
      <div className="toolbar toolbar--compact">
        <div className="toolbar__brand">
          <span className="toolbar__logo">rejs</span>
        </div>

        <button
          className="btn"
          // Compact mode has no inline name field to focus, so a never-saved
          // buffer falls back to the name prompt instead of being a dead button.
          onClick={() => (loadedName == null ? handleSaveAsPrompt() : onSave())}
        >
          Save{dirty && <span className="toolbar__dirty-dot" aria-label="unsaved changes" />}
        </button>

        <div className="toolbar__export" ref={overflowMenu}>
          <button
            className="btn btn--ghost"
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            aria-label="More actions"
            onClick={() => setOverflowOpen((open) => !open)}
          >
            ⋯
          </button>
          {overflowOpen && (
            <div className="toolbar__menu" role="menu" aria-label="More actions">
              <button className="toolbar__menu-item" role="menuitem" onClick={handleSaveAsPrompt}>
                Save as…
              </button>
              {plans.length > 0 && (
                <>
                  <div className="toolbar__menu-label">Saved plans</div>
                  {plans.map((p) => (
                    <div key={p} className="toolbar__menu-plan">
                      <button
                        className="toolbar__menu-item toolbar__menu-plan-load"
                        role="menuitem"
                        onClick={() => {
                          setOverflowOpen(false);
                          onLoad(p);
                        }}
                      >
                        {p}
                      </button>
                      <button
                        className="toolbar__menu-plan-delete"
                        aria-label={`Delete ${p}`}
                        onClick={() => onDelete(p)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </>
              )}
              <div className="toolbar__menu-sep" role="separator" />
              <button
                className="toolbar__menu-item"
                role="menuitem"
                onClick={() => {
                  setOverflowOpen(false);
                  copyShareLink();
                }}
              >
                {copied ? "Link copied!" : "Copy share link"}
              </button>
              <button
                className="toolbar__menu-item"
                role="menuitem"
                onClick={() => {
                  setOverflowOpen(false);
                  onPrint();
                }}
              >
                Print / Save as PDF
              </button>
              <button
                className="toolbar__menu-item"
                role="menuitem"
                onClick={() => {
                  setOverflowOpen(false);
                  onDownloadIcs();
                }}
              >
                Download .ics
              </button>
              <div className="toolbar__menu-sep" role="separator" />
              <button
                className="toolbar__menu-item"
                role="menuitem"
                onClick={() => {
                  setOverflowOpen(false);
                  onShowHelp();
                }}
              >
                DSL guide
              </button>
              <button
                className="toolbar__menu-item"
                role="menuitem"
                onClick={() => {
                  setOverflowOpen(false);
                  onLoadExample();
                }}
              >
                Load example
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo">rejs</span>
        <span className="toolbar__tagline">journey planner</span>
      </div>

      <div className="toolbar__group">
        <button className="btn" onClick={handleSave}>
          Save
        </button>
        {loadedName != null && (
          <span className="toolbar__loaded" title={`Editing “${loadedName}”`}>
            {loadedName}
            {dirty && <span className="toolbar__dirty"> • unsaved changes</span>}
          </span>
        )}
      </div>

      <div className="toolbar__group">
        <input
          ref={nameInput}
          className="toolbar__input"
          placeholder="Save as…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveAs();
          }}
          aria-label="Plan name"
        />
        <button className="btn btn--ghost" disabled={name.trim() === ""} onClick={handleSaveAs}>
          Save as…
        </button>
      </div>

      <div className="toolbar__group">
        <select
          className="toolbar__select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Saved plans"
        >
          <option value="">Saved plans…</option>
          {plans.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button className="btn" disabled={selected === ""} onClick={() => onLoad(selected)}>
          Load
        </button>
        <button
          className="btn btn--ghost"
          disabled={selected === ""}
          onClick={() => {
            onDelete(selected);
            setSelected("");
          }}
        >
          Delete
        </button>
      </div>

      <div className="toolbar__group">
        <button className="btn" onClick={copyShareLink}>
          {copied ? "Link copied!" : "Copy share link"}
        </button>
        <div className="toolbar__export" ref={exportMenu}>
          <button
            className="btn"
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen((open) => !open)}
          >
            Export ▾
          </button>
          {exportOpen && (
            <div className="toolbar__menu" role="menu" aria-label="Export options">
              <button
                className="toolbar__menu-item"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  onPrint();
                }}
              >
                Print / Save as PDF
              </button>
              <button
                className="toolbar__menu-item"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  onDownloadIcs();
                }}
              >
                Download .ics
              </button>
            </div>
          )}
        </div>
        <button className="btn btn--ghost" onClick={onShowHelp}>
          DSL guide
        </button>
        <button className="btn btn--ghost toolbar__example" onClick={onLoadExample}>
          Load example
        </button>
      </div>
    </div>
  );
}
