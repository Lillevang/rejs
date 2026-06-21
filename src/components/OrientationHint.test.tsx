import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrientationHint } from "./OrientationHint";

// jsdom has no matchMedia; stub it so the hook can read a portrait/landscape state.
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OrientationHint", () => {
  it("shows in portrait when a timeline is present", () => {
    stubMatchMedia(true); // portrait
    render(<OrientationHint show />);
    expect(screen.getByText(/rotate your phone/i)).toBeInTheDocument();
  });

  it("stays hidden when there is no timeline", () => {
    stubMatchMedia(true);
    render(<OrientationHint show={false} />);
    expect(screen.queryByText(/rotate your phone/i)).not.toBeInTheDocument();
  });

  it("stays hidden in landscape", () => {
    stubMatchMedia(false); // landscape
    render(<OrientationHint show />);
    expect(screen.queryByText(/rotate your phone/i)).not.toBeInTheDocument();
  });

  it("dismisses and persists the dismissal so it never returns", () => {
    stubMatchMedia(true);
    const { unmount } = render(<OrientationHint show />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss orientation hint/i }));
    expect(screen.queryByText(/rotate your phone/i)).not.toBeInTheDocument();
    unmount();

    // A fresh mount honors the persisted dismissal.
    render(<OrientationHint show />);
    expect(screen.queryByText(/rotate your phone/i)).not.toBeInTheDocument();
  });
});
