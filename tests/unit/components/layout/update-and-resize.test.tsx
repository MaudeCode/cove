/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { createUpdateSignalsMock } from "../../../helpers/module-mocks";
import { installFakeTimers } from "../../../helpers/timers";

installI18nMock({ t: (key: string) => key });

const updateSignals = createUpdateSignalsMock();
mock.module("@/signals/update", () => updateSignals);

const { ResizeHandle } = await import("../../../../src/components/ui/ResizeHandle");
const { UpdateBanner } = await import("../../../../src/components/layout/UpdateBanner");

describe("ResizeHandle and UpdateBanner", () => {
  beforeEach(() => {
    updateSignals.reset();
  });

  test("ResizeHandle reports incremental horizontal deltas and cleans up on mouseup", () => {
    const events: Array<string | number> = [];
    renderComponent(
      <ResizeHandle
        direction="horizontal"
        onResizeStart={() => events.push("start")}
        onResize={(delta) => events.push(delta)}
        onResizeEnd={() => events.push("end")}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("separator", { name: "Resize handle" }), { clientX: 100 });

    expect(document.body.style.cursor).toBe("col-resize");
    expect(document.body.style.userSelect).toBe("none");

    fireEvent.mouseMove(document, { clientX: 130 });
    fireEvent.mouseMove(document, { clientX: 125 });
    fireEvent.mouseUp(document);
    fireEvent.mouseMove(document, { clientX: 200 });

    expect(events).toEqual(["start", 30, -5, "end"]);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  test("ResizeHandle removes drag listeners and body state when unmounted mid-drag", () => {
    const deltas: number[] = [];
    const rendered = renderComponent(
      <ResizeHandle direction="vertical" onResize={(delta) => deltas.push(delta)} />,
    );

    fireEvent.mouseDown(screen.getByRole("separator", { name: "Resize handle" }), { clientY: 50 });
    rendered.unmount();
    fireEvent.mouseMove(document, { clientY: 100 });
    fireEvent.mouseUp(document);

    expect(deltas).toEqual([]);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  test("UpdateBanner links release tags with a v-prefix and dismisses from the close button", () => {
    updateSignals.updateAvailable.value = {
      channel: "stable",
      currentVersion: "2026.3.1",
      latestVersion: "2026.3.2",
    };

    renderComponent(<UpdateBanner />);

    const releaseLink = screen.getByRole("link");
    expect(releaseLink.getAttribute("href")).toBe(
      "https://github.com/openclaw/openclaw/releases/tag/v2026.3.2",
    );
    expect(releaseLink.getAttribute("target")).toBe("_blank");
    expect(releaseLink.getAttribute("rel")).toBe("noopener noreferrer");

    fireEvent.click(screen.getByRole("button", { name: "actions.dismiss" }));

    expect(updateSignals.dismissedUpdateVersion.value).toBe("2026.3.2");
    expect(localStorage.getItem("cove:dismissed-update-version")).toBe("2026.3.2");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("UpdateBanner preserves existing v-prefixed release tags", () => {
    updateSignals.updateAvailable.value = {
      channel: "stable",
      currentVersion: "v2026.4.1",
      latestVersion: "v2026.4.2",
    };

    renderComponent(<UpdateBanner />);

    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "https://github.com/openclaw/openclaw/releases/tag/v2026.4.2",
    );
  });

  test("UpdateBanner dismisses after upward mobile swipe but snaps back for short swipes", async () => {
    const timers = installFakeTimers();
    try {
      updateSignals.updateAvailable.value = {
        channel: "stable",
        currentVersion: "2026.5.1",
        latestVersion: "2026.5.2",
      };

      renderComponent(<UpdateBanner />);

      const banner = screen.getByRole("alert");
      banner.dispatchEvent(createTouchEvent("touchstart", 200));
      banner.dispatchEvent(createTouchEvent("touchmove", 170));
      banner.dispatchEvent(createTouchEvent("touchend", 170));
      expect(updateSignals.dismissedUpdateVersion.value).toBeNull();
      expect((banner as HTMLElement).style.transform).toBe("translateY(0px)");

      banner.dispatchEvent(createTouchEvent("touchstart", 200));
      banner.dispatchEvent(createTouchEvent("touchmove", 120));
      banner.dispatchEvent(createTouchEvent("touchend", 120));
      expect(updateSignals.dismissedUpdateVersion.value).toBeNull();

      timers.advanceBy(150);

      expect(updateSignals.dismissedUpdateVersion.value).toBe("2026.5.2");
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    } finally {
      timers.uninstall();
    }
  });
});

function createTouchEvent(type: string, clientY: number): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  const touches = type === "touchend" ? [] : [{ clientY }];
  Object.defineProperty(event, "touches", { configurable: true, value: touches });
  Object.defineProperty(event, "changedTouches", {
    configurable: true,
    value: [{ clientY }],
  });
  return event;
}
