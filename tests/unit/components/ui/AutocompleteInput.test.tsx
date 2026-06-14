/** @jsxImportSource preact */
import { describe, expect, mock, test } from "bun:test";
import type { RefObject } from "preact";
import { useEffect, useState } from "preact/hooks";
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

const { AutocompleteInput } = await import("../../../../src/components/ui/AutocompleteInput");

describe("AutocompleteInput", () => {
  test("opens as a combobox listbox, navigates suggestions, and selects the active option", () => {
    const values: string[] = [];
    const selections: string[] = [];

    renderComponent(
      <AutocompleteInput
        aria-label="Skill"
        value="al"
        suggestions={["Alpha", "Alpine", "Altair"]}
        onValueChange={(value) => values.push(value)}
        onSelectSuggestion={(value) => selections.push(value)}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Skill" });
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.keyDown(input, { key: "ArrowDown" });

    const listbox = screen.getByRole("listbox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(input.getAttribute("aria-activedescendant")).toBe(`${listbox.id}-option-0`);
    expect(
      within(listbox).getByRole("option", { name: "Alpha" }).getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(`${listbox.id}-option-1`);

    fireEvent.keyDown(input, { key: "Enter" });

    expect(values).toEqual(["Alpine"]);
    expect(selections).toEqual(["Alpine"]);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
  });

  test("closes on outside click and Escape without selecting a suggestion", async () => {
    const values: string[] = [];

    renderComponent(
      <div>
        <AutocompleteInput
          aria-label="Skill"
          value="al"
          suggestions={["Alpha", "Alpine"]}
          onValueChange={(value) => values.push(value)}
        />
        <button type="button">Outside</button>
      </div>,
    );

    const input = screen.getByRole("combobox", { name: "Skill" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(input.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(values).toEqual([]);
  });

  test("keeps listbox ownership isolated between multiple instances", () => {
    renderComponent(
      <div>
        <AutocompleteInput
          aria-label="First skill"
          value="al"
          suggestions={["Alpha", "Alpine"]}
          onValueChange={() => undefined}
        />
        <AutocompleteInput
          aria-label="Second skill"
          value="be"
          suggestions={["Beta", "Beacon"]}
          onValueChange={() => undefined}
        />
      </div>,
    );

    const firstInput = screen.getByRole("combobox", { name: "First skill" });
    const secondInput = screen.getByRole("combobox", { name: "Second skill" });

    fireEvent.keyDown(firstInput, { key: "ArrowDown" });
    fireEvent.keyDown(secondInput, { key: "ArrowDown" });

    const listboxes = screen.getAllByRole("listbox");
    const firstControls = firstInput.getAttribute("aria-controls");
    const secondControls = secondInput.getAttribute("aria-controls");

    expect(firstControls).toBeTruthy();
    expect(secondControls).toBeTruthy();
    expect(firstControls === secondControls).toBe(false);
    expect(listboxes.map((listbox: Element) => listbox.id).sort()).toEqual(
      [firstControls, secondControls].sort(),
    );

    expect(firstInput.getAttribute("aria-activedescendant")).toBe(`${firstControls}-option-0`);
    expect(secondInput.getAttribute("aria-activedescendant")).toBe(`${secondControls}-option-0`);
  });

  test("clear button resets the value, keeps focus, and leaves collapsed aria state", async () => {
    const values: string[] = [];

    function ClearableAutocomplete() {
      const [value, setValue] = useState("Alpha");

      return (
        <AutocompleteInput
          aria-label="Skill"
          value={value}
          suggestions={["Alpha", "Alpine"]}
          onValueChange={(nextValue) => {
            values.push(nextValue);
            setValue(nextValue);
          }}
          clearable
          clearAriaLabel="Clear skill"
        />
      );
    }

    renderComponent(<ClearableAutocomplete />);

    const input = screen.getByRole("combobox", { name: "Skill" });
    await userEvent.click(screen.getByRole("button", { name: "Clear skill" }));

    expect(values).toEqual([""]);
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
