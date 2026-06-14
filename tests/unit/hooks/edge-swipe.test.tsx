/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { renderComponent, setViewport } from "../../helpers/dom";

mock.module("@/lib/storage", () => ({
  getSidebarWidth: () => 280,
  setSidebarWidth: () => undefined,
}));

const isolatedUi = await import("../../../src/signals/ui");
mock.module("@/signals/ui", () => isolatedUi);
const ui = await import("@/signals/ui");
const edgeSwipe = await import("../../../src/hooks/useEdgeSwipe");

function Harness() {
  edgeSwipe.useEdgeSwipe();
  return <div>edge swipe</div>;
}

describe("useEdgeSwipe", () => {
  beforeEach(() => {
    setViewport(390, 844);
    ui.sidebarOpen.value = false;
    edgeSwipe.sidebarDragOffset.value = null;
    edgeSwipe.isDraggingSidebar.value = false;
  });

  test("opens the sidebar when a mobile edge swipe passes the snap threshold", () => {
    renderComponent(<Harness />);

    document.dispatchEvent(createTouchEvent("touchstart", 30, 120));
    const move = createTouchEvent("touchmove", 140, 125);
    document.dispatchEvent(move);

    expect(move.defaultPrevented).toBe(true);
    expect(edgeSwipe.isDraggingSidebar.value).toBe(true);
    expect(edgeSwipe.sidebarDragOffset.value).toBe(110);

    document.dispatchEvent(createTouchEvent("touchend", 140, 125));

    expect(ui.sidebarOpen.value).toBe(true);
    expect(edgeSwipe.isDraggingSidebar.value).toBe(false);
    expect(edgeSwipe.sidebarDragOffset.value).toBeNull();
  });

  test("keeps the sidebar closed for short drags and vertical scroll gestures", () => {
    renderComponent(<Harness />);

    document.dispatchEvent(createTouchEvent("touchstart", 30, 120));
    document.dispatchEvent(createTouchEvent("touchmove", 70, 124));
    document.dispatchEvent(createTouchEvent("touchend", 70, 124));

    expect(ui.sidebarOpen.value).toBe(false);

    document.dispatchEvent(createTouchEvent("touchstart", 30, 120));
    document.dispatchEvent(createTouchEvent("touchmove", 35, 220));
    document.dispatchEvent(createTouchEvent("touchend", 35, 220));

    expect(ui.sidebarOpen.value).toBe(false);
    expect(edgeSwipe.isDraggingSidebar.value).toBe(false);
    expect(edgeSwipe.sidebarDragOffset.value).toBeNull();
  });

  test("closes an open sidebar when dragged left past the threshold", () => {
    ui.sidebarOpen.value = true;
    renderComponent(<Harness />);

    document.dispatchEvent(createTouchEvent("touchstart", 250, 120));
    document.dispatchEvent(createTouchEvent("touchmove", 120, 125));
    document.dispatchEvent(createTouchEvent("touchend", 120, 125));

    expect(ui.sidebarOpen.value).toBe(false);
    expect(edgeSwipe.isDraggingSidebar.value).toBe(false);
    expect(edgeSwipe.sidebarDragOffset.value).toBeNull();
  });

  test("ignores edge swipes on desktop width", () => {
    setViewport(1280, 900);
    renderComponent(<Harness />);

    document.dispatchEvent(createTouchEvent("touchstart", 30, 120));
    document.dispatchEvent(createTouchEvent("touchmove", 180, 120));
    document.dispatchEvent(createTouchEvent("touchend", 180, 120));

    expect(ui.sidebarOpen.value).toBe(false);
    expect(edgeSwipe.isDraggingSidebar.value).toBe(false);
    expect(edgeSwipe.sidebarDragOffset.value).toBeNull();
  });
});

function createTouchEvent(type: string, clientX: number, clientY: number): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  const touches = type === "touchend" ? [] : [{ clientX, clientY }];
  Object.defineProperty(event, "touches", { configurable: true, value: touches });
  Object.defineProperty(event, "changedTouches", {
    configurable: true,
    value: [{ clientX, clientY }],
  });
  return event;
}
