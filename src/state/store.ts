import { EXAMPLE_DSL } from "../lib/example";

// localStorage-backed persistence: a single autosaved "current" buffer plus a
// set of named save slots. Named slots are the seed for future plan comparison.

const CURRENT_KEY = "rejs.current.v1";
const PLANS_KEY = "rejs.plans.v1";
const HINT_DISMISSED_KEY = "rejs.firstRunHintDismissed.v1";
const ORIENTATION_HINT_DISMISSED_KEY = "rejs.orientationHintDismissed.v1";

type PlanMap = Record<string, string>;

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadCurrent(): string {
  const storage = getStorage();
  const saved = storage?.getItem(CURRENT_KEY);
  return saved ?? EXAMPLE_DSL;
}

export function saveCurrent(text: string): void {
  getStorage()?.setItem(CURRENT_KEY, text);
}

function readPlans(): PlanMap {
  const storage = getStorage();
  try {
    const raw = storage?.getItem(PLANS_KEY);
    return raw ? (JSON.parse(raw) as PlanMap) : {};
  } catch {
    return {};
  }
}

function writePlans(plans: PlanMap): void {
  getStorage()?.setItem(PLANS_KEY, JSON.stringify(plans));
}

/** Names of saved plans, sorted alphabetically. */
export function listPlans(): string[] {
  return Object.keys(readPlans()).sort((a, b) => a.localeCompare(b));
}

export function savePlan(name: string, text: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const plans = readPlans();
  plans[trimmed] = text;
  writePlans(plans);
}

export function loadPlan(name: string): string | null {
  return readPlans()[name] ?? null;
}

/** Whether a named slot exists. Used to branch Save vs. Save as…. */
export function planExists(name: string): boolean {
  return name.trim() in readPlans();
}

export function deletePlan(name: string): void {
  const plans = readPlans();
  delete plans[name];
  writePlans(plans);
}

/** Whether the user has dismissed the one-time first-run hint. */
export function isFirstRunHintDismissed(): boolean {
  return getStorage()?.getItem(HINT_DISMISSED_KEY) === "1";
}

/** Permanently dismiss the first-run hint so it never shows again. */
export function dismissFirstRunHint(): void {
  getStorage()?.setItem(HINT_DISMISSED_KEY, "1");
}

/** Whether the user has dismissed the one-time "rotate for a wider timeline" hint. */
export function isOrientationHintDismissed(): boolean {
  return getStorage()?.getItem(ORIENTATION_HINT_DISMISSED_KEY) === "1";
}

/** Permanently dismiss the orientation hint so it never shows again. */
export function dismissOrientationHint(): void {
  getStorage()?.setItem(ORIENTATION_HINT_DISMISSED_KEY, "1");
}
