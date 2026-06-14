/** @jsxImportSource preact */
import { describe, expect, mock, test } from "bun:test";
import { Search } from "lucide-preact";
import { fireEvent, renderComponent, screen, setElementRect } from "../../../helpers/dom";

mock.module("@/hooks/useClickOutside", () => ({
  useClickOutside: () => undefined,
}));

const { DatePicker } = await import("../../../../src/components/ui/DatePicker");
const { Input } = await import("../../../../src/components/ui/Input");
const { TabNav } = await import("../../../../src/components/ui/TabNav");
const { Toggle } = await import("../../../../src/components/ui/Toggle");

describe("shared form and tab primitives", () => {
  test("DatePicker aligns near the viewport edge and blocks dates outside bounds", () => {
    const selected: Array<Date | null> = [];
    renderComponent(
      <DatePicker
        value={new Date(2026, 5, 15)}
        onChange={(date) => selected.push(date)}
        minDate={new Date(2026, 5, 10)}
        maxDate={new Date(2026, 5, 20)}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Jun 15, 2026" });
    setElementRect(trigger.parentElement!, { left: window.innerWidth - 100, width: 100 });
    fireEvent.click(trigger);

    expect(screen.getByText("June 2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "9" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "21" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "15" }).className).toContain(
      "bg-[var(--color-accent)]",
    );
    expect(document.querySelector(".right-0")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "16" }));

    expect(selected.at(-1)).toEqual(new Date(2026, 5, 16));
    expect(screen.queryByText("June 2026")).toBeNull();
  });

  test("DatePicker navigates months and clears selected values", () => {
    const selected: Array<Date | null> = [];
    renderComponent(
      <DatePicker value={new Date(2026, 0, 31)} onChange={(date) => selected.push(date)} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Jan 31, 2026" }));
    fireEvent.click(screen.getAllByRole("button")[2]);

    expect(screen.getByText("February 2026")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(selected.at(-1)).toBeNull();
    expect(screen.queryByText("February 2026")).toBeNull();
  });

  test("Input wires error state, described-by text, and adornment padding", () => {
    renderComponent(
      <Input
        id="gateway-url"
        aria-label="Gateway URL"
        error="URL is required"
        fullWidth
        leftElement={<Search aria-hidden="true" />}
        rightElement={<span>⌘K</span>}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Gateway URL" });
    const error = screen.getByRole("alert");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("gateway-url-error");
    expect(error.id).toBe("gateway-url-error");
    expect(error.textContent).toBe("URL is required");
    expect(input.className).toContain("pl-10");
    expect(input.className).toContain("pr-10");
  });

  test("Input avoids dangling descriptions for boolean or idless error states", () => {
    renderComponent(<Input aria-label="API token" error />);

    const booleanErrorInput = screen.getByRole("textbox", { name: "API token" });
    expect(booleanErrorInput.getAttribute("aria-invalid")).toBe("true");
    expect(booleanErrorInput.hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();

    renderComponent(<Input id="password" aria-label="Password" error />);

    const booleanErrorWithIdInput = screen.getByRole("textbox", { name: "Password" });
    expect(booleanErrorWithIdInput.getAttribute("aria-invalid")).toBe("true");
    expect(booleanErrorWithIdInput.hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();

    renderComponent(<Input aria-label="Gateway URL" error="URL is required" />);

    const idlessErrorInput = screen.getByRole("textbox", { name: "Gateway URL" });
    const alert = screen.getByRole("alert");
    expect(idlessErrorInput.getAttribute("aria-invalid")).toBe("true");
    expect(idlessErrorInput.hasAttribute("aria-describedby")).toBe(false);
    expect(alert.textContent).toBe("URL is required");
    expect(alert.hasAttribute("id")).toBe(false);
  });

  test("Toggle exposes switch semantics and reports the next checked value", () => {
    const changes: boolean[] = [];
    renderComponent(
      <Toggle
        id="notifications"
        checked={false}
        onChange={(checked) => changes.push(checked)}
        label="Notifications"
        description="Send desktop alerts"
      />,
    );

    const toggle = screen.getByRole("switch", { name: "Notifications" });

    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.getAttribute("aria-labelledby")).toBe("notifications-label");
    expect(toggle.getAttribute("aria-describedby")).toBe("notifications-desc");

    fireEvent.click(toggle);

    expect(changes).toEqual([true]);
  });

  test("Toggle does not emit changes while disabled", () => {
    const changes: boolean[] = [];
    renderComponent(
      <Toggle
        id="disabled-notifications"
        checked
        disabled
        onChange={(checked) => changes.push(checked)}
        label="Notifications"
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Notifications" }));

    expect(changes).toEqual([]);
  });

  test("TabNav marks the active tab and emits clicked tab ids", () => {
    const changes: string[] = [];
    renderComponent(
      <TabNav
        activeId="logs"
        onChange={(id) => changes.push(id)}
        items={[
          { id: "overview", label: "Overview" },
          { id: "logs", label: "Logs", icon: <span aria-hidden="true">L</span> },
        ]}
      />,
    );

    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Logs" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe(
      "false",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));

    expect(changes).toEqual(["overview"]);
  });
});
