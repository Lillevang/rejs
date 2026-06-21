import { useRef, useState } from "react";

interface ToolbarProps {
  plans: string[];
  /** The named slot the buffer is tied to, or null for a never-saved buffer. */
  loadedName: string | null;
  /** Whether the buffer diverges from its saved slot. */
  dirty: boolean;
  /** Overwrite the currently-loaded slot in place. No-op if nothing is loaded. */
  onSave: () => void;
  /** Save the buffer under a (possibly new) name. */
  onSaveAs: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  onLoadExample: () => void;
  onShowHelp: () => void;
  /** Build the self-contained share URL for the current plan, on demand. */
  shareUrl: () => string;
}

export function Toolbar({
  plans,
  loadedName,
  dirty,
  onSave,
  onSaveAs,
  onLoad,
  onDelete,
  onLoadExample,
  onShowHelp,
  shareUrl,
}: ToolbarProps) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [copied, setCopied] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

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
