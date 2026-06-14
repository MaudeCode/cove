import { beforeEach, describe, expect, test } from "bun:test";
import { setViewport } from "../../../helpers/dom";
import {
  dockPosition,
  getPointerCoords,
  isMinimized,
  panelHeight,
  panelStyle,
  panelWidth,
  panelX,
  panelY,
} from "../../../../src/components/canvas/canvas-panel-state";

const STORAGE_KEY = "cove:canvasPanel";

beforeEach(() => {
  setViewport(1200, 800);
  localStorage.clear();
  dockPosition.value = "floating";
  isMinimized.value = false;
  panelX.value = 100;
  panelY.value = 100;
  panelWidth.value = 400;
  panelHeight.value = 350;
});

describe("canvas panel state", () => {
  test("derives panel styles for floating, docked, and minimized states", () => {
    panelX.value = 25;
    panelY.value = 50;
    panelWidth.value = 500;
    panelHeight.value = 320;

    expect(panelStyle.value).toEqual({
      borderRadius: "12px",
      height: "320px",
      left: "25px",
      top: "50px",
      width: "500px",
    });

    dockPosition.value = "left";
    expect(panelStyle.value).toMatchObject({
      borderRadius: "0 12px 12px 0",
      height: "100%",
      left: "0",
      top: "0",
      width: "500px",
    });

    dockPosition.value = "right";
    expect(panelStyle.value).toMatchObject({
      borderRadius: "12px 0 0 12px",
      height: "100%",
      right: "0",
      top: "0",
      width: "500px",
    });

    dockPosition.value = "top";
    expect(panelStyle.value).toMatchObject({
      borderRadius: "0 0 12px 12px",
      height: "320px",
      left: "0",
      top: "var(--topbar-height)",
      width: "100%",
    });

    isMinimized.value = true;
    expect(panelStyle.value).toMatchObject({
      borderRadius: "9999px",
      height: "44px",
      left: "25px",
      top: "50px",
      width: "auto",
    });
  });

  test("persists panel geometry changes", () => {
    dockPosition.value = "right";
    panelX.value = 240;
    panelY.value = 180;
    panelWidth.value = 520;
    panelHeight.value = 360;

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      dockPosition: "right",
      height: 360,
      width: 520,
      x: 240,
      y: 180,
    });
  });

  test("repairs persisted bounds when imported", async () => {
    setViewport(500, 300);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dockPosition: "floating",
        height: 999,
        width: 999,
        x: -20,
        y: 500,
      }),
    );

    const repaired = await import(
      `../../../../src/components/canvas/canvas-panel-state.ts?bounds=${Date.now()}`
    );

    expect(repaired.panelX.value).toBe(100);
    expect(repaired.panelY.value).toBe(100);
    expect(repaired.panelWidth.value).toBe(400);
    expect(repaired.panelHeight.value).toBe(350);
  });

  test("falls back to defaults for invalid persisted state", async () => {
    localStorage.setItem(STORAGE_KEY, "{not-json");

    const fresh = await import(
      `../../../../src/components/canvas/canvas-panel-state.ts?invalid=${Date.now()}`
    );

    expect(fresh.dockPosition.value).toBe("floating");
    expect(fresh.panelX.value).toBe(100);
    expect(fresh.panelY.value).toBe(100);
    expect(fresh.panelWidth.value).toBe(400);
    expect(fresh.panelHeight.value).toBe(350);
  });

  test("reads pointer coordinates from mouse, active touch, and changed touch events", () => {
    expect(getPointerCoords(new MouseEvent("mousemove", { clientX: 11, clientY: 22 }))).toEqual({
      x: 11,
      y: 22,
    });

    expect(
      getPointerCoords({
        touches: [{ clientX: 33, clientY: 44 }],
        changedTouches: [],
      } as unknown as TouchEvent),
    ).toEqual({ x: 33, y: 44 });

    expect(
      getPointerCoords({
        touches: [],
        changedTouches: [{ clientX: 55, clientY: 66 }],
      } as unknown as TouchEvent),
    ).toEqual({ x: 55, y: 66 });
  });
});
