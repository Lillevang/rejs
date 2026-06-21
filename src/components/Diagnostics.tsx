import type { Diagnostic } from "../dsl/types";

interface DiagnosticsProps {
  diagnostics: Diagnostic[];
  onSelect: (line: number) => void;
}

export function Diagnostics({ diagnostics, onSelect }: DiagnosticsProps) {
  if (diagnostics.length === 0) {
    return (
      <div className="diagnostics diagnostics--empty">No problems — your journey looks good.</div>
    );
  }

  return (
    <ul className="diagnostics">
      {diagnostics.map((d, i) => (
        <li
          key={`${d.line}-${i}`}
          className={`diagnostics__item diagnostics__item--${d.severity}`}
          onClick={() => onSelect(d.line)}
          title="Jump to line"
        >
          <span className="diagnostics__line">L{d.line}</span>
          <span className="diagnostics__message">{d.message}</span>
        </li>
      ))}
    </ul>
  );
}
