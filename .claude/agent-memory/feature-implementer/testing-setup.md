---
name: testing-setup
description: How unit/component/e2e tests are configured in rejs and which test libs are actually installed
metadata:
  type: project
---

Unit + component tests run under Vitest (jsdom, `globals: true`, setup `src/test-setup.ts` which imports `@testing-library/jest-dom/vitest`). Config in `vite.config.ts` excludes `tests/e2e/**` from Vitest — those are Playwright-only.

**Installed test libs:** `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `vitest`. NOT installed: `@testing-library/user-event`. Use `fireEvent` from `@testing-library/react` for interactions instead (don't add the dep without approval).

Component render tests live next to code as `*.test.tsx` (first one added was `src/components/Toolbar.test.tsx`). Store/logic tests are `*.test.ts` and use `localStorage` directly under jsdom (call `localStorage.clear()` in `afterEach`).

**record-feature.sh caveat:** `.agent/scripts/record-feature.sh` builds an inline Playwright config via process substitution (`--config=<(...)`). In this sandbox Playwright fails to read the `/proc/<pid>/fd/pipe` path (ENOENT), so the script can't record. Workaround that works: write a small real config file **inside the repo root** (relative import resolution fails from /tmp) that spreads `./playwright.config` and sets `use.video: "on"`, run `npx playwright test tests/e2e/plan.spec.ts -g "<test name>" --config ./that.config.ts --output .agent/recordings/<feature>/raw`, then ffmpeg the resulting `video.webm` to mp4. Delete the temp config after. (The script's default test path `tests/<feature>.spec.ts` is wrong — specs live in `tests/e2e/`.)

**Recording reliably:** the temp-config run kept hanging on `browserContext.newPage ... while setting up "page"` (the [[e2e-gotchas]] #1/#3 cold-start flake) even at workers:1. Fix that worked first try: start `npm run dev` yourself in the background, `curl` :5173 until it's up, then run the recording — Playwright's `reuseExistingServer: !CI` reuses it and the hang disappears. The recorded clip is very short (~0.3s for a 333ms test); grab the end state with `ffmpeg -sseof -0.1 -i video.webm -update 1 last.png` and Read that PNG to review (the Read tool can't open webm/mp4 directly).

**Why:** [[e2e-gotchas]]. Knowing user-event is absent avoids a failed first attempt; knowing the recorder quirk avoids re-debugging it.
