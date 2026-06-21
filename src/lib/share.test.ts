import { describe, expect, it } from "vitest";
import { buildShareUrl, decodePlanHash, encodePlanHash } from "./share";

const SAMPLE = `trip "Round trip"
currency: EUR

hop København:
  stay: 3d
  budget: 320 EUR
`;

describe("share links", () => {
  it("round-trips a plan through the hash", () => {
    expect(decodePlanHash(encodePlanHash(SAMPLE))).toBe(SAMPLE);
  });

  it("preserves non-ASCII characters (UTF-8)", () => {
    const text = "hop Mörbisch · 北京 · café";
    expect(decodePlanHash(encodePlanHash(text))).toBe(text);
  });

  it("produces a URL-safe token (no +, /, = or # inside the payload)", () => {
    const token = encodePlanHash(SAMPLE).slice(1 + "plan=".length);
    expect(token).not.toMatch(/[+/=]/);
  });

  it("decodes whether or not the leading # is present", () => {
    const withHash = encodePlanHash(SAMPLE);
    expect(decodePlanHash(withHash)).toBe(SAMPLE);
    expect(decodePlanHash(withHash.slice(1))).toBe(SAMPLE);
  });

  it("returns null for hashes without a plan token", () => {
    expect(decodePlanHash("")).toBeNull();
    expect(decodePlanHash("#")).toBeNull();
    expect(decodePlanHash("#section")).toBeNull();
    expect(decodePlanHash("#plan=")).toBeNull();
  });

  it("returns null for a malformed token instead of throwing", () => {
    expect(decodePlanHash("#plan=@@not base64@@")).toBeNull();
  });

  it("builds a self-contained URL on the current origin and path", () => {
    const url = buildShareUrl(SAMPLE);
    expect(url.startsWith(`${location.origin}${location.pathname}#plan=`)).toBe(true);
    const hash = url.slice(url.indexOf("#"));
    expect(decodePlanHash(hash)).toBe(SAMPLE);
  });
});
