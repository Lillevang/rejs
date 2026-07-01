// Coordinates the share flow: turn the current plan into the best available
// share URL — a short link when the url-shortener answers, the long
// self-contained link otherwise. The long link is always the failsafe.

import { buildShareUrl } from "./share";
import { createShortLink, shortenerEnabled, updateShortLink } from "./short-link";

export interface ShareOutcome {
  /** The URL to present/copy: the short link when available, else the long one. */
  url: string;
  /** The slug now tied to this buffer (persist it so edits update the same link). */
  slug: string | null;
}

/**
 * Produce a shareable URL for `dsl`, preferring a stable short link.
 *
 * `knownSlug` is the slug already associated with this buffer — from a prior
 * share, or learned from the short link the buffer was opened with. When
 * present we update that slug in place so the short link never changes; when
 * absent we mint a new one. The slug is embedded in the shortener's target so a
 * recipient who opens the short link can, in turn, update it on their own edits.
 *
 * Any failure falls back to the long link; the returned slug reflects what a
 * later retry should target.
 */
export async function makeShareLink(dsl: string, knownSlug: string | null): Promise<ShareOutcome> {
  const longUrl = buildShareUrl(dsl); // failsafe, and the base target we shorten
  if (!shortenerEnabled()) return { url: longUrl, slug: knownSlug };

  if (knownSlug) {
    const updated = await updateShortLink(knownSlug, buildShareUrl(dsl, knownSlug));
    // Keep the slug even on failure so a later share can retry against it.
    return updated
      ? { url: updated.shortUrl, slug: updated.slug }
      : { url: longUrl, slug: knownSlug };
  }

  // First share of this buffer: mint a slug, then rewrite the target to embed it.
  const created = await createShortLink(longUrl);
  if (!created) return { url: longUrl, slug: null };
  const embedded = await updateShortLink(created.slug, buildShareUrl(dsl, created.slug));
  // Even if the embed PUT fails the short link already resolves (to the
  // slug-less target); return it and remember the slug locally.
  return { url: (embedded ?? created).shortUrl, slug: created.slug };
}
