import { expect, test, type Locator } from "@playwright/test";

/** Resolve once a locator's bounding box stops changing (e.g. a map animation). */
async function waitForStablePosition(locator: Locator): Promise<void> {
  let last = "";
  await expect
    .poll(
      async () => {
        const current = JSON.stringify(await locator.boundingBox());
        const stable = current === last;
        last = current;
        return stable;
      },
      { timeout: 5000, intervals: [100, 100, 150, 200] },
    )
    .toBe(true);
}

// Use explicit coords so the test never depends on the live geocoding service.
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

// Each Playwright test runs in an isolated context with empty localStorage, so
// no manual clearing is needed — and clearing on every navigation would defeat
// the reload-persistence test below.

test("renders markers and timeline from the DSL", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByLabel("Journey DSL");
  await expect(editor).toBeVisible();

  await editor.fill(TWO_HOP);

  // Two colored pins on the map.
  await expect(page.locator(".map-pin")).toHaveCount(2);
  // Two timeline rows with the right names.
  await expect(page.locator(".timeline__row")).toHaveCount(2);
  await expect(page.locator(".timeline__name")).toHaveText(["Copenhagen", "Berlin"]);

  // Summary reflects 2 stops and the summed EUR budget.
  await expect(page.locator(".summary")).toContainText("2");
  await expect(page.locator(".summary")).toContainText("560");
});

test("autosaves and restores the journey on reload", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Journey DSL").fill(TWO_HOP);
  // Wait past the autosave debounce.
  await page.waitForTimeout(600);

  await page.reload();
  await expect(page.getByLabel("Journey DSL")).toHaveValue(/Copenhagen/);
  await expect(page.locator(".map-pin")).toHaveCount(2);
});

// base64url of UTF-8 bytes — must match src/lib/share.ts so a real link opens.
function encodePlanHash(dsl: string): string {
  const token = Buffer.from(dsl, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `#plan=${token}`;
}

test("opens a shared plan from the URL hash, then clears it", async ({ page }) => {
  await page.goto(`/${encodePlanHash(TWO_HOP)}`);

  await expect(page.getByLabel("Journey DSL")).toHaveValue(/Copenhagen/);
  await expect(page.locator(".map-pin")).toHaveCount(2);

  // The hash is stripped so a reload restores local edits, not the shared link.
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
});

test("copies a share link for the current plan", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByLabel("Journey DSL").fill(TWO_HOP);

  await page.getByRole("button", { name: "Copy share link" }).click();
  await expect(page.getByRole("button", { name: "Link copied!" })).toBeVisible();

  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain("#plan=");

  // The copied link opens the same plan in a fresh navigation.
  await page.goto(link);
  await expect(page.getByLabel("Journey DSL")).toHaveValue(/Berlin/);
});

test("saves and loads a named plan", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Journey DSL").fill(TWO_HOP);

  await page.getByLabel("Plan name").fill("My Trip");
  await page.getByRole("button", { name: "Save as…" }).click();

  // Replace the editor content, then load the saved plan back.
  await page.getByLabel("Journey DSL").fill("hop Paris:\n  coords: 48.85, 2.35\n");
  await expect(page.locator(".map-pin")).toHaveCount(1);

  await page.getByLabel("Saved plans").selectOption("My Trip");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByLabel("Journey DSL")).toHaveValue(/Berlin/);
  await expect(page.locator(".map-pin")).toHaveCount(2);
});

test("quick-adds a hop from the timeline affordance", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByLabel("Journey DSL");
  await editor.fill(TWO_HOP);
  await expect(page.locator(".timeline__row")).toHaveCount(2);

  // The "+ Add hop" button appends a correctly-formed hop block to the DSL.
  await page.getByRole("button", { name: "+ Add hop" }).first().click();

  await expect(editor).toHaveValue(/hop New stop:\n {2}stay: 2d/);
  // The new hop shows up in the timeline and the summary stop count.
  await expect(page.locator(".timeline__name")).toHaveText(["Copenhagen", "Berlin", "New stop"]);
  await expect(page.locator(".summary")).toContainText("3");

  // The placeholder name is selected so the user can type a real one immediately.
  const selected = await editor.evaluate((el) => {
    const ta = el as HTMLTextAreaElement;
    return ta.value.slice(ta.selectionStart, ta.selectionEnd);
  });
  expect(selected).toBe("New stop");
});

test("dragging a hop pin writes coords back into the DSL", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByLabel("Journey DSL");
  await editor.fill(TWO_HOP);
  await expect(page.locator(".map-pin")).toHaveCount(2);

  // Drag Copenhagen's pin (labeled "1") to a far spot on the map. dragTo drives
  // the hover→down→move→up sequence Leaflet's marker drag needs; force skips the
  // actionability wait on the divIcon overlay. Leaflet drops a drag that begins
  // mid fit-bounds animation or when the machine is busy, so retry until the
  // coords actually change (the writer replaces in place, so retries are safe).
  const map = page.locator(".map__container");
  const pin = page
    .locator(".leaflet-marker-draggable", {
      has: page.locator(".map-pin span", { hasText: "1" }),
    })
    .first();
  await expect
    .poll(
      async () => {
        await waitForStablePosition(pin);
        await pin.dragTo(map, { targetPosition: { x: 700, y: 60 }, force: true });
        return editor.inputValue();
      },
      { timeout: 15000, intervals: [200, 300, 500] },
    )
    .not.toMatch(/coords: 55\.6761, 12\.5683/);

  // The drag wrote a new coords: line for Copenhagen, and left Berlin untouched.
  await expect(editor).toHaveValue(/hop Copenhagen:[\s\S]*coords:/);
  await expect(editor).toHaveValue(/coords: 52\.52, 13\.405/);
});

test("picking a disambiguation candidate writes that hop's coords", async ({ page }) => {
  // Seed the geocode cache so "Venice" resolves to two far-apart, similarly
  // important matches — the app should offer a chooser instead of auto-picking.
  await page.goto("/");
  await page.evaluate(() => {
    const cache = {
      venice: {
        found: true,
        candidates: [
          { lat: 45.4371, lng: 12.3326, label: "Venice, Veneto, Italy", importance: 0.8 },
          { lat: 27.0998, lng: -82.4543, label: "Venice, Florida, USA", importance: 0.65 },
        ],
      },
    };
    localStorage.setItem("rejs.geocode.v2", JSON.stringify(cache));
  });
  await page.reload();

  const editor = page.getByLabel("Journey DSL");
  await editor.fill("hop Venice:\n  stay: 2d\n");

  // The chooser appears for the ambiguous name.
  await expect(page.locator(".app__disambig")).toBeVisible();
  await page.getByRole("button", { name: "Venice, Florida, USA" }).click();

  // Picking the Florida match wrote its coords into the Venice hop.
  await expect(editor).toHaveValue(/coords: 27\.0998, -82\.4543/);
  // Once coords are set the hop is no longer geocoded, so the chooser clears.
  await expect(page.locator(".app__disambig")).toHaveCount(0);
});

test("exports the plan as an .ics download from the Export menu", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Journey DSL").fill(TWO_HOP);

  await page.getByRole("button", { name: /Export/ }).click();

  // The browser fires a download; capture it and read the .ics back.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download .ics" }).click();
  const download = await downloadPromise;

  // Filename is derived (sanitized) from the trip title.
  expect(download.suggestedFilename()).toBe("Test-Trip.ics");

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const ics = Buffer.concat(chunks).toString("utf-8");

  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("SUMMARY:Copenhagen");
  expect(ics).toContain("SUMMARY:Berlin");
  // All-day exclusive DTEND for Copenhagen (1–4 Jul → checkout the 4th).
  expect(ics).toContain("DTEND;VALUE=DATE:20260704");
});

test("invokes window.print for the Print / Save as PDF action", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Journey DSL").fill(TWO_HOP);

  // Stub print so the action can be observed without opening a real dialog.
  await page.evaluate(() => {
    (window as unknown as { __printed: boolean }).__printed = false;
    window.print = () => {
      (window as unknown as { __printed: boolean }).__printed = true;
    };
  });

  await page.getByRole("button", { name: /Export/ }).click();
  await page.getByRole("menuitem", { name: "Print / Save as PDF" }).click();

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __printed: boolean }).__printed))
    .toBe(true);
});

test("first-run hint appears on a fresh visit and stays gone once dismissed", async ({ page }) => {
  await page.goto("/");
  // Fresh context = empty localStorage = no saved plans, so the nudge shows.
  const hint = page.locator(".first-run-hint");
  await expect(hint).toBeVisible();

  await page.getByRole("button", { name: "Dismiss hint" }).click();
  await expect(hint).toHaveCount(0);

  // Dismissal persists: it doesn't return after a reload.
  await page.reload();
  await expect(page.locator(".first-run-hint")).toHaveCount(0);
});

test("flags a date-sanity warning for an activity outside its hop window", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Journey DSL").fill(`hop Copenhagen:
  dates: 2026-07-05 .. 2026-07-08
  activity: Tivoli @ 2026-07-20
`);

  // The gentle warning lands in the existing diagnostics list as a warning item.
  const warning = page.locator(".diagnostics__item--warning");
  await expect(warning).toContainText(/outside/);
});

test("Save overwrites the loaded plan in place, with a dirty indicator", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Journey DSL").fill(TWO_HOP);

  // First save establishes the loaded slot.
  await page.getByLabel("Plan name").fill("My Trip");
  await page.getByRole("button", { name: "Save as…" }).click();

  // The toolbar now shows which plan is being edited, with no unsaved hint yet.
  await expect(page.getByTitle("Editing “My Trip”")).toBeVisible();
  await expect(page.getByText(/unsaved changes/)).toHaveCount(0);

  // Edit the buffer: it now diverges from the saved slot.
  await page.getByLabel("Journey DSL").fill(TWO_HOP + "\nhop Prague:\n  coords: 50.08, 14.44\n");
  await expect(page.getByText(/unsaved changes/)).toBeVisible();

  // "Save" overwrites in place (no name prompt) and clears the dirty hint.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/unsaved changes/)).toHaveCount(0);

  // Diverge again, then reload the saved slot: dirty clears and content matches.
  await page.getByLabel("Journey DSL").fill("hop Paris:\n  coords: 48.85, 2.35\n");
  await expect(page.getByText(/unsaved changes/)).toBeVisible();
  await page.getByLabel("Saved plans").selectOption("My Trip");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByLabel("Journey DSL")).toHaveValue(/Prague/);
  await expect(page.getByText(/unsaved changes/)).toHaveCount(0);
});
