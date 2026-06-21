// Trigger a client-side file download from an in-memory string, no backend. Used
// by the .ics export. Isolated here so the DOM-touching bit is easy to stub in
// tests and the pure string building (ics.ts) stays pure.

/**
 * Download `content` as a file named `filename` with the given MIME `type`.
 * Creates a Blob + object URL, clicks a transient anchor, then revokes the URL.
 */
export function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
