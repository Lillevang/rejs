// A stable, visually distinct palette. The same color is used for a hop's map
// marker, its leg, its timeline bar, and its editor accent, so a stop is
// instantly recognizable across every view.
const PALETTE = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#008080",
  "#f032e6",
  "#9a6324",
  "#46a0d0",
  "#808000",
];

export function colorForIndex(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
