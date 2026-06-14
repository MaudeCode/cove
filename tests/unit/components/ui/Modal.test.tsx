/** @jsxImportSource preact */
import { describe, expect, mock, test } from "bun:test";
import { useState } from "preact/hooks";
import {
  fireEvent,
  installFakeTimers,
  renderComponent,
  screen,
  waitFor,
} from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";

installI18nMock({ t: (key: string) => key });
mock.module("@/hooks/useFocusTrap", () => import("../../../../src/hooks/useFocusTrap"));
mock.module("@/components/ui/icons", () => import("../../../../src/components/ui/icons"));
mock.module("@/components/ui/IconButton", () => import("../../../../src/components/ui/IconButton"));

const { Modal } = await import("../../../../src/components/ui/Modal");

describe("Modal", () => {
  test("renders in a portal, locks body scroll, and restores both scroll and focus after Escape", async () => {
    const closeCalls: string[] = [];

    function Harness() {
      const [open, setOpen] = useState(false);

      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Modal
            open={open}
            onClose={() => {
              closeCalls.push("close");
              setOpen(false);
            }}
            title="Settings"
          >
            <button type="button">Confirm</button>
          </Modal>
        </div>
      );
    }

    renderComponent(<Harness />);

    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    expect(dialog.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 260));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
      expect(closeCalls).toEqual(["close"]);
      expect(document.body.style.overflow).toBe("");
      expect(document.activeElement).toBe(trigger);
    });
  });

  test("respects backdrop and Escape close options", () => {
    const timers = installFakeTimers();
    const closeCalls: string[] = [];

    try {
      renderComponent(
        <Modal
          open
          onClose={() => closeCalls.push("close")}
          title="Pinned"
          closeOnBackdrop={false}
          closeOnEscape={false}
        >
          Content
        </Modal>,
      );

      const dialog = screen.getByRole("dialog", { name: "Pinned" });
      const backdrop = dialog.querySelector("[aria-hidden='true']");
      expect(backdrop).toBeTruthy();

      fireEvent.click(backdrop as Element);
      fireEvent.keyDown(document, { key: "Escape" });
      timers.advanceBy(500);

      expect(closeCalls).toEqual([]);
      expect(screen.getByRole("dialog", { name: "Pinned" })).toBeTruthy();
      expect(document.body.style.overflow).toBe("hidden");
    } finally {
      timers.uninstall();
    }
  });

  test("closes from the backdrop after the dismissal animation", async () => {
    const timers = installFakeTimers();
    const closeCalls: string[] = [];

    try {
      renderComponent(
        <Modal open onClose={() => closeCalls.push("close")} title="Dismissible">
          Content
        </Modal>,
      );

      const dialog = screen.getByRole("dialog", { name: "Dismissible" });
      fireEvent.click(dialog.querySelector("[aria-hidden='true']") as Element);

      expect(closeCalls).toEqual([]);
      timers.advanceBy(249);
      expect(closeCalls).toEqual([]);
      timers.advanceBy(1);

      await waitFor(() => expect(closeCalls).toEqual(["close"]));
    } finally {
      timers.uninstall();
    }
  });
});
