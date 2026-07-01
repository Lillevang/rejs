import { afterEach, describe, expect, it, vi } from "vitest";
import { makeShareLink } from "./share-link";
import * as shortLink from "./short-link";

const DSL = 'trip "Demo"\nhop Oslo:\n  stay: 2d\n';

afterEach(() => vi.restoreAllMocks());

function isLongLink(url: string): boolean {
  return url.startsWith(`${location.origin}${location.pathname}#plan=`);
}

describe("makeShareLink", () => {
  it("returns the long link and keeps the slug when the shortener is disabled", async () => {
    vi.spyOn(shortLink, "shortenerEnabled").mockReturnValue(false);
    const create = vi.spyOn(shortLink, "createShortLink");

    const out = await makeShareLink(DSL, null);

    expect(isLongLink(out.url)).toBe(true);
    expect(out.slug).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("mints then embeds the slug on first share", async () => {
    vi.spyOn(shortLink, "shortenerEnabled").mockReturnValue(true);
    const create = vi
      .spyOn(shortLink, "createShortLink")
      .mockResolvedValue({ slug: "new99", shortUrl: "https://s.test/new99" });
    const update = vi
      .spyOn(shortLink, "updateShortLink")
      .mockResolvedValue({ slug: "new99", shortUrl: "https://s.test/new99" });

    const out = await makeShareLink(DSL, null);

    expect(out).toEqual({ url: "https://s.test/new99", slug: "new99" });
    // First call mints from the slug-less long link...
    expect(isLongLink(create.mock.calls[0][0])).toBe(true);
    // ...then the target is rewritten to embed the new slug.
    expect(update).toHaveBeenCalledWith("new99", expect.stringContaining("&s=new99"));
  });

  it("updates the existing slug in place on a re-share", async () => {
    vi.spyOn(shortLink, "shortenerEnabled").mockReturnValue(true);
    const create = vi.spyOn(shortLink, "createShortLink");
    const update = vi
      .spyOn(shortLink, "updateShortLink")
      .mockResolvedValue({ slug: "keep7", shortUrl: "https://s.test/keep7" });

    const out = await makeShareLink(DSL, "keep7");

    expect(out).toEqual({ url: "https://s.test/keep7", slug: "keep7" });
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("keep7", expect.stringContaining("&s=keep7"));
  });

  it("falls back to the long link but keeps the slug when the update fails", async () => {
    vi.spyOn(shortLink, "shortenerEnabled").mockReturnValue(true);
    vi.spyOn(shortLink, "updateShortLink").mockResolvedValue(null);

    const out = await makeShareLink(DSL, "keep7");

    expect(isLongLink(out.url)).toBe(true);
    expect(out.slug).toBe("keep7");
  });

  it("falls back to the long link with no slug when minting fails", async () => {
    vi.spyOn(shortLink, "shortenerEnabled").mockReturnValue(true);
    vi.spyOn(shortLink, "createShortLink").mockResolvedValue(null);
    const update = vi.spyOn(shortLink, "updateShortLink");

    const out = await makeShareLink(DSL, null);

    expect(isLongLink(out.url)).toBe(true);
    expect(out.slug).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("still returns the working short link when the embed PUT fails", async () => {
    vi.spyOn(shortLink, "shortenerEnabled").mockReturnValue(true);
    vi.spyOn(shortLink, "createShortLink").mockResolvedValue({
      slug: "new99",
      shortUrl: "https://s.test/new99",
    });
    vi.spyOn(shortLink, "updateShortLink").mockResolvedValue(null);

    const out = await makeShareLink(DSL, null);

    expect(out).toEqual({ url: "https://s.test/new99", slug: "new99" });
  });
});
