/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/preact";
import { fireEvent, renderComponent, screen, userEvent, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import type { Command, SubMenuItem } from "../../../../src/components/command/types";

installI18nMock({ t: (key: string) => key });

let commandRegistry: Command[] = [];

mock.module("../../../../src/components/command/commands", () => ({
  getAvailableCommands: () => commandRegistry,
}));

const { CommandPalette, commandPaletteOpen } =
  await import("../../../../src/components/command/CommandPalette");
const { useCommandPaletteShortcut } =
  await import("../../../../src/components/command/useCommandPalette");

const RECENT_KEY = "cove:command-palette:recent";
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

function PaletteWithShortcut() {
  useCommandPaletteShortcut();
  return <CommandPalette />;
}

function expectPaletteClosed() {
  expect(commandPaletteOpen.value).toBe(false);
  expect(screen.queryByRole("combobox") === null).toBe(true);
}

function flushEffects() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function command(id: string, label: string, action: () => void | Promise<void> = () => undefined) {
  return {
    id,
    label,
    action,
    category: "chat",
    keywords: [id],
  } satisfies Command;
}

function submenuCommand(
  id: string,
  label: string,
  getSubmenuItems: () => SubMenuItem[] | Promise<SubMenuItem[]>,
) {
  return {
    id,
    label,
    category: "session",
    hasSubmenu: true,
    getSubmenuItems,
  } satisfies Command;
}

async function openPalette() {
  commandPaletteOpen.value = true;
  renderComponent(<CommandPalette />);
  const input = await screen.findByRole("combobox");
  await flushEffects();
  return input as HTMLInputElement;
}

async function openPaletteWithStorage(seed: () => void) {
  cleanup();
  document.body.replaceChildren();
  document.head.replaceChildren();
  localStorage.clear();
  sessionStorage.clear();
  seed();
  commandPaletteOpen.value = true;
  render(<CommandPalette />, {
    container: document.body.appendChild(document.createElement("div")),
  });
  const input = await screen.findByRole("combobox");
  await flushEffects();
  return input as HTMLInputElement;
}

beforeEach(() => {
  commandPaletteOpen.value = false;
  commandRegistry = [];
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

afterEach(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});

describe("CommandPalette", () => {
  test("toggles from the global Cmd/Ctrl+K shortcut and exposes search combobox wiring", async () => {
    commandRegistry = [command("chat.clear", "Clear chat")];

    renderComponent(<PaletteWithShortcut />);

    const openEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "k",
      metaKey: true,
    });
    document.dispatchEvent(openEvent);

    expect(openEvent.defaultPrevented).toBe(true);
    const input = await screen.findByRole("combobox");
    expect(input.getAttribute("aria-controls")).toBe("command-list");
    expect(input.getAttribute("aria-expanded")).toBe("true");

    const closeEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "k",
    });
    document.dispatchEvent(closeEvent);

    expect(closeEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(commandPaletteOpen.value).toBe(false));
    expect(screen.queryByRole("combobox") === null).toBe(true);
  });

  test("navigates commands with arrows, exposes aria-activedescendant, and persists recents", async () => {
    const executed: string[] = [];
    commandRegistry = [
      command("chat.clear", "Clear chat", () => {
        executed.push("clear");
      }),
      command("chat.search", "Search chat", () => {
        executed.push("search");
      }),
      command("settings.theme", "Change theme", () => {
        executed.push("theme");
      }),
    ];

    const input = await openPalette();

    expect(input.getAttribute("aria-activedescendant")).toBe("cmd-chat.clear");
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("cmd-chat.search");

    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("cmd-settings.theme");

    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe("cmd-chat.search");

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    await waitFor(() => expectPaletteClosed());
    expect(executed).toEqual(["search"]);
    expect(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")).toEqual(["chat.search"]);
  });

  test("filters commands by label and keyword and executes the reset selection immediately", async () => {
    const executed: string[] = [];
    commandRegistry = [
      command("chat.clear", "Clear chat", () => {
        executed.push("clear");
      }),
      command("chat.search", "Search chat", () => {
        executed.push("search");
      }),
      command("settings.theme", "Change theme", () => {
        executed.push("theme");
      }),
    ];

    const input = await openPalette();

    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.input(input, { target: { value: "theme" } });

    expect(screen.getByRole("option", { name: /Change theme/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Clear chat/ })).toBeNull();
    expect(input.getAttribute("aria-activedescendant")).toBe("cmd-settings.theme");

    fireEvent.keyDown(document, { key: "Enter" });

    await waitFor(() => expectPaletteClosed());
    expect(executed).toEqual(["theme"]);
  });

  test("loads async submenu items, filters them, and returns to top-level with Backspace", async () => {
    let resolveItems: (items: SubMenuItem[]) => void = () => undefined;
    const itemsPromise = new Promise<SubMenuItem[]>((resolve) => {
      resolveItems = resolve;
    });

    commandRegistry = [
      submenuCommand("session.switch", "Switch session", () => itemsPromise),
      command("chat.clear", "Clear chat"),
    ];

    const input = await openPalette();

    await userEvent.click(screen.getByRole("option", { name: /Switch session/ }));
    expect(screen.getByText("common.loading")).toBeTruthy();

    resolveItems([
      { id: "alpha", label: "Alpha session", description: "opus", action: () => undefined },
      { id: "beta", label: "Beta session", description: "sonnet", action: () => undefined },
    ]);

    await waitFor(() => expect(screen.getByRole("option", { name: /Alpha session/ })).toBeTruthy());
    expect(input.placeholder).toBe("Switch session...");
    expect(input.getAttribute("aria-activedescendant")).toBe("cmd-sub-alpha");

    await userEvent.type(input, "sonnet");

    expect(screen.queryByRole("option", { name: /Alpha session/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Beta session/ })).toBeTruthy();
    expect(input.getAttribute("aria-activedescendant")).toBe("cmd-sub-beta");

    fireEvent.input(input, { target: { value: "missing" } });

    expect(screen.getByText("commandPalette.noMatches")).toBeTruthy();
    expect(input.getAttribute("aria-activedescendant")).toBeNull();

    fireEvent.input(input, { target: { value: "" } });
    fireEvent.keyDown(document, { key: "Backspace" });

    expect(screen.getByRole("option", { name: /Switch session/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Clear chat/ })).toBeTruthy();
  });

  test("ignores async submenu results after the palette closes", async () => {
    let resolveItems: (items: SubMenuItem[]) => void = () => undefined;
    const itemsPromise = new Promise<SubMenuItem[]>((resolve) => {
      resolveItems = resolve;
    });

    commandRegistry = [
      submenuCommand("session.switch", "Switch session", () => itemsPromise),
      command("chat.clear", "Clear chat"),
    ];

    await openPalette();

    await userEvent.click(screen.getByRole("option", { name: /Switch session/ }));
    expect(screen.getByText("common.loading")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expectPaletteClosed());

    resolveItems([{ id: "alpha", label: "Alpha session", action: () => undefined }]);
    await flushEffects();

    expectPaletteClosed();
    expect(screen.queryByRole("option", { name: /Alpha session/ })).toBeNull();
  });

  test("closes the root palette with Escape", async () => {
    commandRegistry = [command("chat.clear", "Clear chat")];

    await openPalette();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expectPaletteClosed());
  });

  test("executes clicked submenu items and stores the parent command as recent", async () => {
    const executed: string[] = [];
    commandRegistry = [
      submenuCommand("session.switch", "Switch session", () => [
        {
          id: "alpha",
          label: "Alpha session",
          action: () => {
            executed.push("alpha");
          },
        },
        {
          id: "beta",
          label: "Beta session",
          action: () => {
            executed.push("beta");
          },
        },
      ]),
      command("chat.clear", "Clear chat"),
    ];

    await openPalette();

    await userEvent.click(screen.getByRole("option", { name: /Switch session/ }));
    await waitFor(() => expect(screen.getByRole("option", { name: /Alpha session/ })).toBeTruthy());
    await waitFor(() =>
      expect(screen.getByRole("combobox").getAttribute("aria-activedescendant")).toBe(
        "cmd-sub-alpha",
      ),
    );
    await flushEffects();
    await userEvent.click(screen.getByRole("option", { name: /Alpha session/ }));

    await waitFor(() => expectPaletteClosed());
    expect(executed).toEqual(["alpha"]);
    expect(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")).toEqual(["session.switch"]);
  });

  test("renders stored recents first, ignores missing ids, moves duplicates, and caps storage", async () => {
    const ids = ["one", "two", "three", "four", "five", "six"];
    commandRegistry = ids.map((id) => command(id, `Command ${id}`));

    await openPaletteWithStorage(() => {
      localStorage.setItem(RECENT_KEY, JSON.stringify(["three", "missing", "one"]));
    });

    const options = screen.getAllByRole("option");
    expect(options.slice(0, 2).map((option: HTMLElement) => option.textContent)).toEqual([
      "Command three",
      "Command one",
    ]);

    fireEvent.input(screen.getByRole("combobox"), { target: { value: "six" } });
    await userEvent.click(screen.getByRole("option", { name: /Command six/ }));

    await waitFor(() => expectPaletteClosed());
    expect(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")).toEqual([
      "six",
      "three",
      "missing",
      "one",
    ]);

    await openPaletteWithStorage(() => {
      localStorage.setItem(RECENT_KEY, JSON.stringify(["one", "two", "three", "four", "five"]));
    });
    fireEvent.input(screen.getByRole("combobox"), { target: { value: "six" } });
    await userEvent.click(screen.getByRole("option", { name: /Command six/ }));

    await waitFor(() => expectPaletteClosed());
    expect(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")).toEqual([
      "six",
      "one",
      "two",
      "three",
      "four",
    ]);
  });
});
