import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FirstRunHint } from "./FirstRunHint";

afterEach(cleanup);

describe("FirstRunHint", () => {
  it("opens the DSL guide via the existing help handler", () => {
    const onShowHelp = vi.fn();
    render(<FirstRunHint onShowHelp={onShowHelp} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open the DSL guide" }));
    expect(onShowHelp).toHaveBeenCalledTimes(1);
  });

  it("dismisses via the × button", () => {
    const onDismiss = vi.fn();
    render(<FirstRunHint onShowHelp={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss hint" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
