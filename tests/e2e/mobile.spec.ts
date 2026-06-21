import { expect, test } from "@playwright/test";

// Drive the phone layout by forcing a narrow viewport (below the 640px swap) with
// a coarse pointer. The same DSL drives the same three views — they just become
// full-bleed tabs instead of a side-by-side split.
test.use({
  viewport: { width: 390, height: 780 },
  hasTouch: true,
  isMobile: true,
});

const TWO_HOP = `trip "Test Trip"
currency: EUR

hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-04
  budget: 320 EUR
  coords: 55.6761, 12.5683

hop Berlin:
  stay: 3d
  budget: 240 EUR
  arrive_by: train
  coords: 52.52, 13.405
`;

test("phone layout shows tabs; map is the default view", async ({ page }) => {
  await page.goto("/");

  // The phone layout renders a bottom tab bar; the desktop split sidebar does not.
  const tabs = page.locator(".app__tabs");
  await expect(tabs).toBeVisible();
  await expect(page.locator(".app__sidebar")).toHaveCount(0);

  // Map is the default tab, so the Leaflet container is on screen.
  await expect(page.locator(".map__container")).toBeVisible();
  await expect(page.getByLabel("Journey DSL")).toHaveCount(0);
});

test("Edit tab reveals the textarea and stays live", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit" }).click();

  const editor = page.getByLabel("Journey DSL");
  await expect(editor).toBeVisible();
  await editor.fill(TWO_HOP);

  // Switching to the Map tab shows both pins — the parse/render stayed live.
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(2);

  // The Plan tab shows the summary and timeline derived from the same DSL.
  await page.getByRole("button", { name: "Plan" }).click();
  await expect(page.locator(".summary")).toContainText("2");
  await expect(page.locator(".timeline__name")).toHaveText(["Copenhagen", "Berlin"]);
});

test("tapping a timeline row selects the hop and jumps to the map", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Journey DSL").fill(TWO_HOP);

  await page.getByRole("button", { name: "Plan" }).click();
  // Tap Berlin's row.
  await page.locator(".timeline__row", { hasText: "Berlin" }).click();

  // We're taken to the Map tab with Berlin marked active.
  await expect(page.locator(".map__container")).toBeVisible();
  await expect(page.locator(".map-pin--active")).toHaveCount(1);
});

test("the Edit tab badge reflects DSL errors", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit" }).click();
  // A bare unknown line with no hop produces at least one diagnostic.
  await page.getByLabel("Journey DSL").fill("hop Copenhagen:\n  stay: not-a-duration\n");

  const editTab = page.getByRole("button", { name: /Edit/ });
  await expect(editTab.locator(".app__tab-badge")).toBeVisible();
});

test("the compact toolbar tucks actions behind the overflow menu", async ({ page }) => {
  await page.goto("/");

  // The always-present desktop "Save as…" field is gone on the phone.
  await expect(page.getByLabel("Plan name")).toHaveCount(0);

  // Infrequent actions live in the ⋯ overflow menu.
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: "DSL guide" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Load example" })).toBeVisible();
});
