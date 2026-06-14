/** @jsxImportSource preact */
import { describe, expect, test } from "bun:test";
import {
  pointerTap,
  pressKey,
  renderComponent,
  screen,
  setElementRect,
  setMatchesMedia,
  setViewport,
  touchTap,
} from "../../helpers/dom";

describe("DOM test helpers", () => {
  test("controls viewport and media query state", () => {
    setViewport(390, 844);
    setMatchesMedia("(max-width: 640px)", true);

    expect(window.innerWidth).toBe(390);
    expect(window.innerHeight).toBe(844);
    expect(matchMedia("(max-width: 640px)").matches).toBe(true);
  });

  test("stubs geometry and interaction helpers", () => {
    const events: string[] = [];

    renderComponent(
      <button
        onClick={() => events.push("click")}
        onKeyDown={(event) => events.push(`key:${event.key}`)}
        onPointerDown={() => events.push("pointer")}
        onTouchStart={() => events.push("touch")}
      >
        Target
      </button>,
    );

    const button = screen.getByRole("button", { name: "Target" });
    setElementRect(button, { height: 20, left: 10, top: 15, width: 30 });
    pressKey(button, "Escape");
    pointerTap(button);
    touchTap(button);

    expect(button.getBoundingClientRect()).toMatchObject({
      bottom: 35,
      height: 20,
      left: 10,
      right: 40,
      top: 15,
      width: 30,
    });
    expect(events).toEqual(["key:Escape", "pointer", "click", "touch", "click"]);
  });
});
