/** Format a budget amount + currency, e.g. `1,200 DKK`. Falls back gracefully. */
export function formatMoney(amount: number, currency: string): string {
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      // Unknown ISO code — fall through to the plain form.
    }
  }
  const n = new Intl.NumberFormat("en-GB").format(amount);
  return currency ? `${n} ${currency}` : n;
}

export function pluralizeDays(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}
