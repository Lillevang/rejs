import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Diagnostic } from "../dsl/types";
import { getCompletionContext, type Suggestion } from "./editor-suggest";

interface EditorProps {
  value: string;
  diagnostics: Diagnostic[];
  /** When set, the editor scrolls/selects this 1-based line (e.g. from a diagnostic click). */
  focusLine: number | null;
  /** When set, the editor focuses and selects this `[start, end]` character range. */
  focusRange: [number, number] | null;
  onChange: (value: string) => void;
}

const INDENT = "  ";

interface SuggestState {
  items: Suggestion[];
  activeIndex: number;
  /** Range in the text the accepted suggestion replaces. */
  tokenStart: number;
  tokenEnd: number;
  top: number;
  left: number;
}

// CSS properties copied onto the mirror element so it lays text out exactly like
// the textarea, letting us measure the caret's pixel position.
const MIRROR_PROPS = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "tabSize",
] as const;

/** Pixel position of the caret (at `position`) within the textarea's border box. */
function caretCoordinates(
  el: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; height: number } {
  const computed = window.getComputedStyle(el);
  const mirror = document.createElement("div");
  const style = mirror.style;
  style.position = "absolute";
  style.visibility = "hidden";
  style.whiteSpace = "pre-wrap";
  style.overflowWrap = "break-word";
  for (const prop of MIRROR_PROPS) {
    style[prop] = computed[prop];
  }
  mirror.textContent = el.value.slice(0, position);
  const marker = document.createElement("span");
  // A non-empty marker so it has layout even at end-of-text.
  marker.textContent = el.value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop + parseFloat(computed.borderTopWidth);
  const left = marker.offsetLeft + parseFloat(computed.borderLeftWidth);
  const height = parseFloat(computed.lineHeight) || marker.offsetHeight;
  document.body.removeChild(mirror);
  return { top, left, height };
}

export function Editor({ value, diagnostics, focusLine, focusRange, onChange }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [suggest, setSuggest] = useState<SuggestState | null>(null);
  // Caret to restore after a programmatic edit re-renders the controlled value.
  const pendingCaret = useRef<[number, number] | null>(null);
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;

  // Move the caret to a requested line when asked (diagnostics list click).
  useEffect(() => {
    const el = ref.current;
    if (focusLine == null || !el) return;
    const lines = value.split("\n");
    let pos = 0;
    for (let i = 0; i < focusLine - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    el.focus();
    el.setSelectionRange(pos, pos + (lines[focusLine - 1]?.length ?? 0));
    setSuggest(null);
  }, [focusLine, value]);

  // Focus and select an exact character range (e.g. a quick-added hop's name).
  // Depends on `value` too so the selection lands after the new text renders.
  useEffect(() => {
    const el = ref.current;
    if (focusRange == null || !el) return;
    el.focus();
    el.setSelectionRange(focusRange[0], focusRange[1]);
    setSuggest(null);
  }, [focusRange, value]);

  // Apply a caret position queued by a programmatic edit, after the value renders.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !pendingCaret.current) return;
    const [start, end] = pendingCaret.current;
    pendingCaret.current = null;
    el.setSelectionRange(start, end);
    refreshSuggestions();
  }, [value]);

  function refreshSuggestions() {
    const el = ref.current;
    if (!el || el.selectionStart !== el.selectionEnd) {
      setSuggest(null);
      return;
    }
    const caret = el.selectionStart;
    const ctx = getCompletionContext(el.value, caret);
    if (!ctx) {
      setSuggest(null);
      return;
    }
    const coords = caretCoordinates(el, ctx.start);
    setSuggest({
      items: ctx.items,
      activeIndex: 0,
      tokenStart: ctx.start,
      tokenEnd: caret,
      top: coords.top - el.scrollTop + coords.height + 2,
      left: coords.left - el.scrollLeft,
    });
  }

  /** Replace a text range and queue the resulting caret position. */
  function commit(next: string, caretStart: number, caretEnd = caretStart) {
    pendingCaret.current = [caretStart, caretEnd];
    onChange(next);
  }

  function accept(s: Suggestion) {
    const el = ref.current;
    if (!el || !suggest) return;
    const next =
      el.value.slice(0, suggest.tokenStart) + s.insert + el.value.slice(suggest.tokenEnd);
    const caret = suggest.tokenStart + s.insert.length;
    setSuggest(null);
    commit(next, caret);
  }

  function indent(shift: boolean) {
    const el = ref.current;
    if (!el) return;
    const { value: text, selectionStart: s, selectionEnd: e } = el;
    const spansLines = text.slice(s, e).includes("\n");

    // Simple case: a caret (or single-line selection) with Tab inserts indentation.
    if (!shift && !spansLines) {
      commit(text.slice(0, s) + INDENT + text.slice(e), s + INDENT.length);
      return;
    }

    // Block case: indent/outdent every line touched by the selection.
    const lineStart = text.lastIndexOf("\n", s - 1) + 1;
    const lines = text.slice(lineStart, e).split("\n");
    let firstDelta = 0;
    let totalDelta = 0;
    const out = lines.map((ln, i) => {
      if (shift) {
        const cut = ln.match(/^ {1,2}/)?.[0].length ?? 0;
        if (i === 0) firstDelta = -cut;
        totalDelta -= cut;
        return ln.slice(cut);
      }
      if (i === 0) firstDelta = INDENT.length;
      totalDelta += INDENT.length;
      return INDENT + ln;
    });
    const next = text.slice(0, lineStart) + out.join("\n") + text.slice(e);
    commit(next, Math.max(lineStart, s + firstDelta), e + totalDelta);
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggest) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setSuggest((p) => p && { ...p, activeIndex: (p.activeIndex + 1) % p.items.length });
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setSuggest(
          (p) => p && { ...p, activeIndex: (p.activeIndex - 1 + p.items.length) % p.items.length },
        );
        return;
      }
      if (ev.key === "Enter" || ev.key === "Tab") {
        ev.preventDefault();
        accept(suggest.items[suggest.activeIndex]);
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        setSuggest(null);
        return;
      }
    }
    if (ev.key === "Tab") {
      ev.preventDefault();
      indent(ev.shiftKey);
    }
  }

  return (
    <div className="editor">
      <div className="editor__header">
        <span>Journey</span>
        <span className="editor__counts">
          {errors > 0 && <span className="badge badge--error">{errors} errors</span>}
          {warnings > 0 && <span className="badge badge--warning">{warnings} warnings</span>}
          {errors === 0 && warnings === 0 && <span className="badge badge--ok">valid</span>}
        </span>
      </div>
      <div className="editor__field">
        <textarea
          ref={ref}
          className="editor__textarea"
          value={value}
          spellCheck={false}
          onChange={(e) => {
            onChange(e.target.value);
            refreshSuggestions();
          }}
          onKeyDown={onKeyDown}
          onClick={refreshSuggestions}
          onBlur={() => setSuggest(null)}
          onScroll={() => setSuggest(null)}
          aria-label="Journey DSL"
        />
        {suggest && (
          <ul className="editor__suggest" style={{ top: suggest.top, left: suggest.left }}>
            {suggest.items.map((item, i) => (
              <li
                key={item.label}
                aria-selected={i === suggest.activeIndex}
                // mousedown (not click) so the textarea doesn't blur first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(item);
                }}
              >
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
