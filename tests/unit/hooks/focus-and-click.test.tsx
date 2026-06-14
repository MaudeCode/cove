/** @jsxImportSource preact */
import { describe, expect, test } from "bun:test";
import { useRef, useState } from "preact/hooks";
import { fireEvent, renderComponent, screen, waitFor } from "../../helpers/dom";
import { useClickOutside } from "../../../src/hooks/useClickOutside";
import { useFocusTrap } from "../../../src/hooks/useFocusTrap";

describe("useFocusTrap", () => {
  test("auto-focuses the first focusable element and cycles Tab within the container", async () => {
    function Harness() {
      const containerRef = useRef<HTMLDivElement>(null);
      useFocusTrap(containerRef);

      return (
        <div>
          <button type="button">Outside</button>
          <div ref={containerRef}>
            <button type="button">First</button>
            <button type="button">Last</button>
          </div>
        </div>
      );
    }

    renderComponent(<Harness />);

    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    const outside = screen.getByRole("button", { name: "Outside" });

    await waitFor(() => expect(document.activeElement).toBe(first));

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    outside.focus();
    await waitFor(() => expect(document.activeElement).toBe(first));
  });

  test("returns focus to the requested element when disabled", async () => {
    function Harness() {
      const [enabled, setEnabled] = useState(true);
      const containerRef = useRef<HTMLDivElement>(null);
      const triggerRef = useRef<HTMLButtonElement>(null);
      useFocusTrap(containerRef, { enabled, returnFocusTo: triggerRef });

      return (
        <div>
          <button ref={triggerRef} type="button">
            Trigger
          </button>
          <button type="button" onClick={() => setEnabled(false)}>
            Disable
          </button>
          <div ref={containerRef}>
            <button type="button">Inside</button>
          </div>
        </div>
      );
    }

    renderComponent(<Harness />);

    const inside = screen.getByRole("button", { name: "Inside" });
    await waitFor(() => expect(document.activeElement).toBe(inside));

    fireEvent.click(screen.getByRole("button", { name: "Disable" }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Trigger" })),
    );
  });

  test("cancels pending autofocus when the trap unmounts before the next frame", () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const canceledFrames: number[] = [];

    function Harness() {
      const containerRef = useRef<HTMLDivElement>(null);
      const triggerRef = useRef<HTMLButtonElement>(null);
      useFocusTrap(containerRef, { returnFocusTo: triggerRef });

      return (
        <div>
          <button ref={triggerRef} type="button">
            Trigger
          </button>
          <div ref={containerRef}>
            <button type="button">Inside</button>
          </div>
        </div>
      );
    }

    try {
      globalThis.requestAnimationFrame = (() => 123) as typeof requestAnimationFrame;
      globalThis.cancelAnimationFrame = ((handle: number) => {
        canceledFrames.push(handle);
      }) as typeof cancelAnimationFrame;

      const rendered = renderComponent(<Harness />);
      const inside = screen.getByRole("button", { name: "Inside" });
      let staleFocusCalls = 0;
      inside.focus = () => {
        staleFocusCalls += 1;
      };

      rendered.unmount();

      expect(canceledFrames).toEqual([123]);
      expect(staleFocusCalls).toBe(0);
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });
});

describe("useClickOutside", () => {
  test("ignores clicks in any owned ref and closes for outside clicks only while active", () => {
    const outsideClicks: string[] = [];

    function Harness() {
      const [active, setActive] = useState(true);
      const triggerRef = useRef<HTMLButtonElement>(null);
      const menuRef = useRef<HTMLDivElement>(null);
      useClickOutside([triggerRef, menuRef], () => outsideClicks.push("outside"), active);

      return (
        <div>
          <button ref={triggerRef} type="button">
            Trigger
          </button>
          <div ref={menuRef}>
            <button type="button">Menu Item</button>
          </div>
          <button type="button" onClick={() => setActive(false)}>
            Disable
          </button>
          <button type="button">Outside</button>
        </div>
      );
    }

    renderComponent(<Harness />);

    fireEvent.mouseDown(screen.getByRole("button", { name: "Trigger" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Menu Item" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));

    expect(outsideClicks).toEqual(["outside"]);
  });
});
