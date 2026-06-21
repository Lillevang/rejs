import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "./download";

afterEach(() => {
  vi.restoreAllMocks();
  // restoreAllMocks doesn't undo stubGlobal — unstub explicitly so the patched
  // URL doesn't leak into other test files.
  vi.unstubAllGlobals();
});

describe("downloadTextFile", () => {
  it("creates an object URL, clicks an anchor with the filename, then revokes", () => {
    const createUrl = vi.fn(() => "blob:fake");
    const revokeUrl = vi.fn();
    // jsdom doesn't implement these on URL; stub them for the test.
    vi.stubGlobal("URL", { ...URL, createObjectURL: createUrl, revokeObjectURL: revokeUrl });

    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    const create = vi.spyOn(document, "createElement").mockReturnValue(anchor);

    downloadTextFile("trip.ics", "BEGIN:VCALENDAR", "text/calendar");

    expect(create).toHaveBeenCalledWith("a");
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(anchor.download).toBe("trip.ics");
    expect(anchor.href).toContain("blob:fake");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith("blob:fake");
    // The transient anchor is removed from the document after the click.
    expect(document.body.contains(anchor)).toBe(false);
  });
});
