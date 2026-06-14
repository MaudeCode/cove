/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { fireEvent, renderComponent, screen } from "../../../helpers/dom";

const sidebarDragOffset = signal<number | null>(null);
const isDraggingSidebar = signal(false);
const dockPosition = signal<"bottom" | "floating" | "left" | "right" | "top">("floating");
const panelWidth = signal(420);
const panelHeight = signal(320);
const isMinimized = signal(false);

mock.module("@/signals/ui", () => ({
  SIDEBAR_MAX_WIDTH: 480,
  SIDEBAR_MIN_WIDTH: 200,
  SIDEBAR_WIDTH_MOBILE: 288,
  canvasPanelOpen: signal(false),
  previousRoute: signal("/"),
  sidebarOpen: signal(false),
  sidebarResizing: signal(false),
  sidebarWidth: signal(280),
}));

mock.module("@/hooks/useEdgeSwipe", () => ({
  isDraggingSidebar,
  sidebarDragOffset,
  useEdgeSwipe: () => undefined,
}));

mock.module("@/components/canvas/canvas-panel-state", () => ({
  dockPosition,
  isMinimized,
  panelHeight,
  panelWidth,
}));

mockLayoutChild("../../../../src/components/layout/TopBar.tsx", "TopBar", "topbar");
mockLayoutChild(
  "../../../../src/components/layout/UpdateBanner.tsx",
  "UpdateBanner",
  "update-banner",
);
mockLayoutChild("../../../../src/components/layout/Sidebar.tsx", "Sidebar", "sidebar");

mock.module("@/components/ui/ResizeHandle", () => ({
  ResizeHandle: ({
    class: className,
    onResizeStart,
  }: {
    class?: string;
    onResizeStart: () => void;
  }) => (
    <button class={className} type="button" onClick={onResizeStart}>
      resize
    </button>
  ),
}));

const { AppShell } =
  // @ts-ignore Query suffix isolates AppShell from aggregate-test module cache.
  await import("../../../../src/components/layout/AppShell.tsx?unit=shell");
const ui = await import("@/signals/ui");

describe("AppShell", () => {
  beforeEach(() => {
    ui.sidebarOpen.value = false;
    ui.sidebarWidth.value = 280;
    ui.sidebarResizing.value = false;
    ui.canvasPanelOpen.value = false;
    sidebarDragOffset.value = null;
    isDraggingSidebar.value = false;
    dockPosition.value = "floating";
    panelWidth.value = 420;
    panelHeight.value = 320;
    isMinimized.value = false;
  });

  test("renders a skip link that targets the main content landmark", () => {
    renderComponent(<AppShell>workspace</AppShell>);

    const skipLink = screen.getByText("Skip to content") as HTMLAnchorElement;
    expect(skipLink.getAttribute("href")).toBe("#main-content");
    expect(document.querySelector("#main-content")?.tagName).toBe("MAIN");
    expect(screen.getByText("workspace")).toBeTruthy();
  });

  test("shows the mobile sidebar overlay while open and closes it on click", () => {
    ui.sidebarOpen.value = true;
    renderComponent(<AppShell>workspace</AppShell>);

    const overlay = document.querySelector('div[aria-hidden="true"]') as HTMLDivElement | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.style.opacity).toBe("0.5");

    fireEvent.click(overlay!);

    expect(ui.sidebarOpen.value).toBe(false);
  });

  test("uses drag offset opacity while the mobile sidebar is being dragged", () => {
    isDraggingSidebar.value = true;
    sidebarDragOffset.value = 144;

    renderComponent(<AppShell>workspace</AppShell>);

    const overlay = document.querySelector('div[aria-hidden="true"]') as HTMLDivElement | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.style.opacity).toBe("0.25");
    expect(overlay?.style.transition).toBe("none");
  });
});

function mockLayoutChild(relativePath: string, exportName: string, testId: string): void {
  const modulePath = new URL(relativePath, import.meta.url).pathname;

  mock.module(modulePath, () => ({
    [exportName]: () => <div data-testid={testId} />,
  }));
}
