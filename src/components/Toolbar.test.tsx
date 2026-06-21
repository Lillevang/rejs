import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toolbar } from "./Toolbar";

afterEach(cleanup);

function setup(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const props = {
    plans: [] as string[],
    loadedName: null as string | null,
    dirty: false,
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onLoad: vi.fn(),
    onDelete: vi.fn(),
    onLoadExample: vi.fn(),
    onShowHelp: vi.fn(),
    onPrint: vi.fn(),
    onDownloadIcs: vi.fn(),
    shareUrl: () => "https://example.test/#plan=abc",
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe("Toolbar save behavior", () => {
  it("overwrites the loaded plan in place when Save is clicked", () => {
    const props = setup({ loadedName: "Trip" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSaveAs).not.toHaveBeenCalled();
  });

  it("focuses the name input instead of saving when no plan is loaded", () => {
    const props = setup({ loadedName: null });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Plan name")).toHaveFocus();
  });

  it("saves under a new name via the Save as… path", () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "New Trip" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as…" }));
    expect(props.onSaveAs).toHaveBeenCalledWith("New Trip");
  });

  it("saves via Save as… on Enter and clears the input", () => {
    const props = setup();
    const input = screen.getByLabelText("Plan name");
    fireEvent.change(input, { target: { value: "Quick" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSaveAs).toHaveBeenCalledWith("Quick");
    expect(input).toHaveValue("");
  });

  it("disables Save as… for a blank name", () => {
    setup();
    expect(screen.getByRole("button", { name: "Save as…" })).toBeDisabled();
  });
});

describe("Toolbar dirty indicator", () => {
  it("shows the loaded plan name without the dirty hint when clean", () => {
    setup({ loadedName: "Trip", dirty: false });
    expect(screen.getByText("Trip")).toBeInTheDocument();
    expect(screen.queryByText(/unsaved changes/)).not.toBeInTheDocument();
  });

  it("shows the unsaved-changes hint when the buffer is dirty", () => {
    setup({ loadedName: "Trip", dirty: true });
    expect(screen.getByText(/unsaved changes/)).toBeInTheDocument();
  });

  it("shows neither name nor hint for a never-saved buffer", () => {
    setup({ loadedName: null, dirty: false });
    expect(screen.queryByText(/unsaved changes/)).not.toBeInTheDocument();
  });
});

describe("Toolbar export menu", () => {
  it("is closed until the Export button is clicked", () => {
    setup();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("fires onPrint and closes when Print / Save as PDF is chosen", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Print / Save as PDF" }));
    expect(props.onPrint).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("fires onDownloadIcs and closes when Download .ics is chosen", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Download .ics" }));
    expect(props.onDownloadIcs).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape without firing an action", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(props.onPrint).not.toHaveBeenCalled();
    expect(props.onDownloadIcs).not.toHaveBeenCalled();
  });

  it("closes on an outside click", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("Toolbar compact (mobile) mode", () => {
  it("keeps Save inline but tucks infrequent actions behind an overflow menu", () => {
    setup({ compact: true });
    // Save stays inline; the always-present Save as… text field is gone.
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Plan name")).not.toBeInTheDocument();
    // Infrequent actions are hidden until the overflow menu is opened.
    expect(screen.queryByRole("menuitem", { name: "DSL guide" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "DSL guide" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Load example" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Copy share link/ })).toBeInTheDocument();
  });

  it("prompts for a name from the overflow Save as… item", () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Promised Trip");
    const props = setup({ compact: true });
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Save as…" }));
    expect(props.onSaveAs).toHaveBeenCalledWith("Promised Trip");
    promptSpy.mockRestore();
  });

  it("loads a saved plan from the overflow menu", () => {
    const props = setup({ compact: true, plans: ["My Trip"] });
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "My Trip" }));
    expect(props.onLoad).toHaveBeenCalledWith("My Trip");
  });

  it("shows a dirty dot on Save when the buffer diverges", () => {
    setup({ compact: true, loadedName: "Trip", dirty: true });
    expect(screen.getByLabelText("unsaved changes")).toBeInTheDocument();
  });
});
