---
name: e2e-gotchas
description: Playwright pitfalls in rejs — dev-server/port conflicts and ambiguous selectors
metadata:
  type: feedback
---

Two recurring Playwright pitfalls when running `./.agent/scripts/check.sh`:

1. **Don't leave a manual `npm run dev` running on :5173.** Playwright's config (`playwright.config.ts`) has its own `webServer` with `reuseExistingServer: !CI`. A leftover background dev server in a bad state causes every e2e to fail with `browserContext.newPage: Test timeout ... while setting up "page"` — which looks like a code failure but isn't. Kill stray vite/dev processes and confirm the port is free before running the done-gate.

2. **Toolbar plan names appear twice in the DOM** — once in the loaded-plan indicator span and once as an `<option>` in the Saved-plans `<select>`. `getByText("<name>")` triggers strict-mode "resolved to 2 elements". Target the toolbar indicator by its title attribute instead: `getByTitle('Editing “<name>”')`.

3. **The 8-worker parallel cold start is genuinely flaky in this sandbox** — even beyond a stray dev server (#1). With `fullyParallel: true` and default workers (nproc = 32 here, capped), `browserContext.newPage` randomly _hangs_ until the test timeout (a different random test each run), and raising `timeout` just makes the hang waste more time. `workers: 1` runs the whole tiny suite in ~4s and is 100% reliable across many runs — that's now set in `playwright.config.ts`. If e2e fails with "while setting up page" on a random test, it's this, not your code.

4. **Dragging a Leaflet marker in Playwright** (for the pin-drag feature): synthetic `page.mouse.down/move/up` and dispatched pointer events do NOT engage Leaflet's marker `Draggable` reliably (map _panning_ works, marker drag silently no-ops). What works: `locator.dragTo(map, { targetPosition: {x,y}, force: true })` to a point far from the start. Two more requirements: (a) Leaflet ignores a drag that begins mid fit-bounds zoom-animation, so wait for the pin's bounding box to stop changing first; (b) under load even a settled drag occasionally drops, so wrap it in `expect.poll(async () => { await waitForStable(pin); await pin.dragTo(...); return editor.inputValue(); }).not.toMatch(/old coords/)` — the `coords:` writer replaces in place, so re-dragging is safe. Select the specific pin by its number label: `locator(".leaflet-marker-draggable", { has: page.locator(".map-pin span", { hasText: "1" }) })`.

5. **The Playwright browser binary may be missing in a fresh sandbox.** `check.sh`'s Playwright step can fail with `browserType.launch: Executable doesn't exist at .../chromium_headless_shell-XXXX/...` plus a "Please run npx playwright install" banner. This is environment, not code — fix it with `npx playwright install chromium` (already allowlisted), then re-run `check.sh`. Don't mistake it for a test failure.

**Why:** Each cost a full debug cycle. **How to apply:** before declaring done, ensure no manual dev server lingers and keep `workers: 1`; when asserting on a saved/loaded plan name scope the selector; for any map-drag test reach for `dragTo`+poll, never raw mouse events; if Playwright reports a missing executable, install the browser rather than debugging the test. See also [[testing-setup]].
