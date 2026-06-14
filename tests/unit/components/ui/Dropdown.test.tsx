/** @jsxImportSource preact */
import { describe, expect, mock, test } from "bun:test";
import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";
import {
  fireEvent,
  renderComponent,
  screen,
  userEvent,
  waitFor,
  within,
} from "../../../helpers/dom";

type OutsideRef = RefObject<HTMLElement> | RefObject<HTMLElement>[];

mock.module("@/hooks/useClickOutside", () => ({
  useClickOutside(refs: OutsideRef, onClickOutside: () => void, active: boolean = true) {
    useEffect(() => {
      if (!active) return;

      const handleClickOutside = (event: MouseEvent) => {
        const refArray = Array.isArray(refs) ? refs : [refs];
        const target = event.target as Node;

        if (!refArray.some((ref) => ref.current?.contains(target))) {
          onClickOutside();
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [refs, onClickOutside, active]);
  },
}));

const { Dropdown } = await import("../../../../src/components/ui/Dropdown");

const options = [
  { value: "alpha", label: "Alpha" },
  { value: "beta", label: "Beta" },
  { value: "gamma", label: "Gamma", disabled: true },
];

describe("Dropdown", () => {
  test("opens as a listbox from the keyboard and selects the focused option", async () => {
    const changes: string[] = [];

    renderComponent(
      <Dropdown
        aria-label="Mode"
        value="alpha"
        options={options}
        onChange={(value) => changes.push(value)}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Mode" });
    trigger.focus();
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const listbox = screen.getByRole("listbox", { name: "Mode" });
    const activeOption = within(listbox).getByRole("option", { name: "Alpha" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(listbox.id);
    expect(activeOption.getAttribute("aria-selected")).toBe("true");

    const betaOption = within(listbox).getByRole("option", { name: "Beta" });
    let betaFocusCalls = 0;
    Object.defineProperty(betaOption, "focus", {
      configurable: true,
      value: () => {
        betaFocusCalls += 1;
      },
    });

    fireEvent.keyDown(activeOption, { key: "ArrowDown" });
    await waitFor(() => expect(betaFocusCalls).toBe(1));
    fireEvent.keyDown(betaOption, { key: "Enter" });

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(changes).toEqual(["beta"]);
  });

  test("does not select disabled options by click or keyboard activation", async () => {
    const changes: string[] = [];

    renderComponent(
      <Dropdown
        aria-label="Mode"
        value="alpha"
        options={options}
        onChange={(value) => changes.push(value)}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Mode" });
    await userEvent.click(trigger);

    const disabledOption = within(screen.getByRole("listbox")).getByRole("option", {
      name: "Gamma",
    });
    expect(disabledOption).toHaveProperty("disabled", true);

    await userEvent.click(disabledOption);
    expect(changes).toEqual([]);
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: " " });

    expect(changes).toEqual([]);
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  test("closes on outside click and Escape while preserving the selected aria state", async () => {
    renderComponent(
      <div>
        <Dropdown aria-label="Mode" value="beta" options={options} onChange={() => undefined} />
        <button type="button">Outside</button>
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "Mode" });
    await userEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      within(screen.getByRole("listbox"))
        .getByRole("option", { name: "Beta" })
        .getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement === trigger).toBe(true);
  });
});
