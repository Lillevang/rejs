import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createShortLink, shortenerEnabled, updateShortLink } from "./short-link";

const BASE = "https://s.test";

function mockFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn((url: string, init: RequestInit) => Promise.resolve(impl(url, init)));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("short-link client", () => {
  beforeEach(() => vi.stubEnv("VITE_SHORTENER_URL", BASE));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reports enabled only when a base URL is configured", () => {
    expect(shortenerEnabled()).toBe(true);
    vi.stubEnv("VITE_SHORTENER_URL", "");
    expect(shortenerEnabled()).toBe(false);
  });

  it("POSTs the target and returns the minted slug + short URL", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse({ slug: "abc123", short_url: `${BASE}/abc123` }, 201),
    );
    const result = await createShortLink("https://rejs.test/#plan=xyz");

    expect(result).toEqual({ slug: "abc123", shortUrl: `${BASE}/abc123` });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ target: "https://rejs.test/#plan=xyz" });
  });

  it("PUTs to the slug path to update an existing link", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse({ slug: "abc123", short_url: `${BASE}/abc123` }),
    );
    const result = await updateShortLink("abc123", "https://rejs.test/#plan=new&s=abc123");

    expect(result).toEqual({ slug: "abc123", shortUrl: `${BASE}/abc123` });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/abc123`);
    expect(init.method).toBe("PUT");
  });

  it("returns null when disabled (no base URL), without calling fetch", async () => {
    vi.stubEnv("VITE_SHORTENER_URL", "");
    const fetchMock = mockFetch(() => jsonResponse({}));
    expect(await createShortLink("https://rejs.test/")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a non-2xx response", async () => {
    mockFetch(() => new Response("nope", { status: 404 }));
    expect(await updateShortLink("gone", "https://rejs.test/")).toBeNull();
  });

  it("returns null on a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down"))),
    );
    expect(await createShortLink("https://rejs.test/")).toBeNull();
  });

  it("returns null when the response is missing fields", async () => {
    mockFetch(() => jsonResponse({ slug: "abc123" }));
    expect(await createShortLink("https://rejs.test/")).toBeNull();
  });
});
