/** @jsxImportSource preact */
import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, renderComponent, screen, setViewport } from "../../../helpers/dom";
import {
  DOCK_THRESHOLD,
  HEADER_HEIGHT,
  MAX_DOCKED_HEIGHT_PERCENT,
  MAX_DOCKED_WIDTH_PERCENT,
  MIN_HEIGHT,
  MIN_WIDTH,
  dockPosition,
  isInteracting,
  isMinimized,
  panelHeight,
  panelWidth,
  panelX,
  panelY,
} from "../../../../src/components/canvas/canvas-panel-state";
import { usePanelInteraction } from "../../../../src/components/canvas/usePanelInteraction";

function InteractionHarness() {
  const { handleDockedResizeStart, handleDragStart, handleResizeStart } = usePanelInteraction();

  return (
    <div>
      <div data-testid="touch-drag" role="presentation" onTouchStart={handleDragStart}>
        touch drag
      </div>
      <div data-testid="drag" role="presentation" onMouseDown={handleDragStart}>
        drag
        <button type="button" data-testid="nested-button">
          button
        </button>
      </div>
      <div
        data-testid="resize-se"
        role="separator"
        aria-orientation="horizontal"
        tabIndex={-1}
        onMouseDown={(e) => handleResizeStart(e, "se")}
        onTouchStart={(e) => handleResizeStart(e, "se")}
      />
      <div
        data-testid="resize-nw"
        role="separator"
        aria-orientation="horizontal"
        tabIndex={-1}
        onMouseDown={(e) => handleResizeStart(e, "nw")}
        onTouchStart={(e) => handleResizeStart(e, "nw")}
      />
      <div
        data-testid="docked-resize"
        role="separator"
        aria-orientation="vertical"
        tabIndex={-1}
        onMouseDown={handleDockedResizeStart}
      />
    </div>
  );
}

beforeEach(() => {
  setViewport(1200, 800);
  dockPosition.value = "floating";
  isInteracting.value = false;
  isMinimized.value = false;
  panelX.value = 100;
  panelY.value = 100;
  panelWidth.value = 400;
  panelHeight.value = 350;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

describe("usePanelInteraction", () => {
  test("drags into dock zones and back to floating with cleanup", () => {
    renderComponent(<InteractionHarness />);

    fireEvent.mouseDown(screen.getByTestId("drag"), { clientX: 100, clientY: 100 });
    expect(isInteracting.value).toBe(true);
    expect(document.body.style.cursor).toBe("grabbing");

    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: DOCK_THRESHOLD - 1, clientY: 300 }),
    );
    expect(dockPosition.value).toBe("left");

    document.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: window.innerWidth - DOCK_THRESHOLD + 1,
        clientY: 300,
      }),
    );
    expect(dockPosition.value).toBe("right");

    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 500, clientY: DOCK_THRESHOLD - 1 }),
    );
    expect(dockPosition.value).toBe("top");

    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 500, clientY: 300 }));
    expect(dockPosition.value).toBe("floating");
    expect(panelX.value).toBe(300);
    expect(panelY.value).toBe(278);

    document.dispatchEvent(new MouseEvent("mouseup"));
    expect(isInteracting.value).toBe(false);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  test("does not start dragging from button descendants", () => {
    renderComponent(<InteractionHarness />);

    fireEvent.mouseDown(screen.getByTestId("nested-button"), { clientX: 100, clientY: 100 });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 0 }));

    expect(isInteracting.value).toBe(false);
    expect(dockPosition.value).toBe("floating");
    expect(panelX.value).toBe(100);
    expect(panelY.value).toBe(100);
  });

  test("minimized dragging clamps to the viewport without docking", () => {
    isMinimized.value = true;
    renderComponent(<InteractionHarness />);

    fireEvent.mouseDown(screen.getByTestId("drag"), { clientX: 100, clientY: 100 });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 5000, clientY: 5000 }));

    expect(dockPosition.value).toBe("floating");
    expect(panelX.value).toBe(1000);
    expect(panelY.value).toBe(window.innerHeight - HEADER_HEIGHT);
  });

  test("touch dragging uses dock zones and cleans up interaction state", () => {
    renderComponent(<InteractionHarness />);

    screen.getByTestId("touch-drag").dispatchEvent(createTouchEvent("touchstart", 100, 100));
    document.dispatchEvent(createTouchEvent("touchmove", DOCK_THRESHOLD - 1, 300));
    expect(dockPosition.value).toBe("left");

    document.dispatchEvent(createTouchEvent("touchmove", 500, 300));
    expect(dockPosition.value).toBe("floating");
    expect(isInteracting.value).toBe(true);

    document.dispatchEvent(createTouchEvent("touchend", 500, 300));
    expect(isInteracting.value).toBe(false);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  test("floating resize clamps to minimum size and adjusts north-west origin", () => {
    renderComponent(<InteractionHarness />);

    fireEvent.mouseDown(screen.getByTestId("resize-se"), { clientX: 500, clientY: 450 });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 200, clientY: 100 }));
    expect(panelWidth.value).toBe(MIN_WIDTH);
    expect(panelHeight.value).toBe(MIN_HEIGHT);
    document.dispatchEvent(new MouseEvent("mouseup"));

    panelX.value = 100;
    panelY.value = 100;
    panelWidth.value = 400;
    panelHeight.value = 350;
    fireEvent.mouseDown(screen.getByTestId("resize-nw"), { clientX: 100, clientY: 100 });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 0 }));

    expect(panelX.value).toBe(0);
    expect(panelY.value).toBe(0);
    expect(panelWidth.value).toBe(500);
    expect(panelHeight.value).toBe(450);
  });

  test("touch resize clamps floating panel and cleans up", () => {
    renderComponent(<InteractionHarness />);

    screen.getByTestId("resize-se").dispatchEvent(createTouchEvent("touchstart", 500, 450));
    document.dispatchEvent(createTouchEvent("touchmove", 200, 100));

    expect(panelWidth.value).toBe(MIN_WIDTH);
    expect(panelHeight.value).toBe(MIN_HEIGHT);
    expect(isInteracting.value).toBe(true);

    document.dispatchEvent(createTouchEvent("touchend", 200, 100));
    expect(isInteracting.value).toBe(false);
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  test("docked resize clamps left, right, and top dimensions", () => {
    setViewport(1000, 700);
    renderComponent(<InteractionHarness />);

    dockPosition.value = "left";
    panelWidth.value = 400;
    fireEvent.mouseDown(screen.getByTestId("docked-resize"), { clientX: 400, clientY: 0 });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 900, clientY: 0 }));
    expect(panelWidth.value).toBe(window.innerWidth * MAX_DOCKED_WIDTH_PERCENT);
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 0 }));
    expect(panelWidth.value).toBe(MIN_WIDTH);
    document.dispatchEvent(new MouseEvent("mouseup"));

    dockPosition.value = "right";
    panelWidth.value = 400;
    fireEvent.mouseDown(screen.getByTestId("docked-resize"), { clientX: 600, clientY: 0 });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 0 }));
    expect(panelWidth.value).toBe(window.innerWidth * MAX_DOCKED_WIDTH_PERCENT);
    document.dispatchEvent(new MouseEvent("mouseup"));

    dockPosition.value = "top";
    panelHeight.value = 300;
    fireEvent.mouseDown(screen.getByTestId("docked-resize"), { clientX: 0, clientY: 300 });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 700 }));
    expect(panelHeight.value).toBe(window.innerHeight * MAX_DOCKED_HEIGHT_PERCENT);
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 0 }));
    expect(panelHeight.value).toBe(MIN_HEIGHT);
    document.dispatchEvent(new MouseEvent("mouseup"));
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
