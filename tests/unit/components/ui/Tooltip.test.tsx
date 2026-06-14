/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "@testing-library/preact";
import {
  fireEvent,
  renderComponent,
  screen,
  setElementRect,
  setViewport,
} from "../../../helpers/dom";
import { installFakeTimers, type FakeTimers } from "../../../helpers/timers";

const { Tooltip, TooltipProvider } = await import("../../../../src/components/ui/Tooltip");

describe("Tooltip", () => {
  let timers: FakeTimers;
  let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;
  let originalWindowSetTimeout: typeof window.setTimeout;
  let originalWindowClearTimeout: typeof window.clearTimeout;

  beforeEach(() => {
    timers = installFakeTimers();
    setViewport(400, 300);

    originalWindowSetTimeout = window.setTimeout;
    originalWindowClearTimeout = window.clearTimeout;
    window.setTimeout = globalThis.setTimeout as typeof window.setTimeout;
    window.clearTimeout = globalThis.clearTimeout as typeof window.clearTimeout;

    originalRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if ((this as HTMLElement).getAttribute("role") === "tooltip") {
        return domRect({ bottom: 30, height: 30, left: 0, right: 80, top: 0, width: 80 });
      }
      return originalRect.call(this);
    };
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect;
    window.setTimeout = originalWindowSetTimeout;
    window.clearTimeout = originalWindowClearTimeout;
    timers.uninstall();
  });

  test("renders tooltip content through a document body portal", async () => {
    const rendered = renderComponent(
      <TooltipProvider>
        <Tooltip content="Portal tooltip" delay={0}>
          <button type="button">Open portal tooltip</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Open portal tooltip" });
    setElementRect(trigger.parentElement!, {
      bottom: 120,
      height: 20,
      left: 100,
      right: 140,
      top: 100,
      width: 40,
    });

    await showTooltip(trigger, timers);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Portal tooltip");
    expect(tooltip.parentElement).toBe(document.body);
    expect(rendered.container.contains(tooltip)).toBe(false);
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
  });

  test("waits for the configured delay before showing", async () => {
    renderComponent(
      <TooltipProvider>
        <Tooltip content="Delayed tooltip" delay={75}>
          <button type="button">Delayed trigger</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Delayed trigger" });
    setElementRect(trigger.parentElement!, {
      bottom: 120,
      height: 20,
      left: 100,
      right: 140,
      top: 100,
      width: 40,
    });

    await act(async () => {
      fireEvent.mouseEnter(trigger.parentElement!);
      timers.advanceBy(74);
      await flushPromises();
    });

    expect(screen.queryByRole("tooltip")).toBeNull();

    await act(async () => {
      timers.advanceBy(1);
      await flushPromises();
      timers.advanceBy(16);
      await flushPromises();
    });

    expect(screen.getByRole("tooltip").textContent).toContain("Delayed tooltip");
  });

  test("keeps the tooltip mounted during hide transition and removes it after fade-out", async () => {
    renderComponent(
      <TooltipProvider>
        <Tooltip content="Hide tooltip" delay={0}>
          <button type="button">Hide trigger</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Hide trigger" });
    setElementRect(trigger.parentElement!, {
      bottom: 120,
      height: 20,
      left: 100,
      right: 140,
      top: 100,
      width: 40,
    });
    await showTooltip(trigger, timers);

    await act(async () => {
      fireEvent.mouseLeave(trigger.parentElement!);
      await flushPromises();
    });

    expect(screen.getByRole("tooltip").className).toContain("opacity-0");

    await act(async () => {
      timers.advanceBy(149);
      await flushPromises();
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    await act(async () => {
      timers.advanceBy(1);
      await flushPromises();
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("hides the visible tooltip when Escape is pressed", async () => {
    renderComponent(
      <TooltipProvider>
        <Tooltip content="Escape tooltip" delay={0}>
          <button type="button">Escape trigger</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Escape trigger" });
    setElementRect(trigger.parentElement!, {
      bottom: 120,
      height: 20,
      left: 100,
      right: 140,
      top: 100,
      width: 40,
    });
    await showTooltip(trigger, timers);

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
      await flushPromises();
      timers.advanceBy(150);
      await flushPromises();
    });

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("shows and hides on keyboard focus and blur", async () => {
    renderComponent(
      <TooltipProvider>
        <Tooltip content="Keyboard tooltip" delay={0}>
          <button type="button">Keyboard trigger</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Keyboard trigger" });
    setElementRect(trigger.parentElement!, {
      bottom: 120,
      height: 20,
      left: 100,
      right: 140,
      top: 100,
      width: 40,
    });

    await showTooltipByFocus(trigger, timers);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Keyboard tooltip");
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);

    await act(async () => {
      fireEvent.focusOut(trigger);
      await flushPromises();
      timers.advanceBy(150);
      await flushPromises();
    });

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("cancels duplicate pending focus timers before blur", async () => {
    renderComponent(
      <TooltipProvider>
        <Tooltip content="Duplicate focus tooltip" delay={75}>
          <button type="button">Duplicate focus trigger</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Duplicate focus trigger" });
    setElementRect(trigger.parentElement!, {
      bottom: 120,
      height: 20,
      left: 100,
      right: 140,
      top: 100,
      width: 40,
    });

    await act(async () => {
      fireEvent.focus(trigger);
      fireEvent.focusIn(trigger);
      timers.advanceBy(30);
      fireEvent.focusOut(trigger);
      await flushPromises();
      timers.advanceBy(75);
      await flushPromises();
    });

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("does not let a stale owner hide another owner's tooltip", async () => {
    renderComponent(
      <TooltipProvider>
        <Tooltip content="First owner tooltip" delay={0}>
          <button type="button">First owner</button>
        </Tooltip>
        <Tooltip content="Second owner tooltip" delay={0}>
          <button type="button">Second owner</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const first = screen.getByRole("button", { name: "First owner" });
    const second = screen.getByRole("button", { name: "Second owner" });
    setElementRect(first.parentElement!, {
      bottom: 70,
      height: 20,
      left: 50,
      right: 90,
      top: 50,
      width: 40,
    });
    setElementRect(second.parentElement!, {
      bottom: 170,
      height: 20,
      left: 200,
      right: 240,
      top: 150,
      width: 40,
    });

    await showTooltip(first, timers);
    expect(screen.getByRole("tooltip").textContent).toContain("First owner tooltip");

    await showTooltip(second, timers);
    expect(screen.getByRole("tooltip").textContent).toContain("Second owner tooltip");

    await act(async () => {
      fireEvent.mouseLeave(first.parentElement!);
      await flushPromises();
      timers.advanceBy(150);
      await flushPromises();
    });

    expect(screen.getByRole("tooltip").textContent).toContain("Second owner tooltip");
  });

  test("positions the tooltip from trigger and tooltip geometry", async () => {
    renderComponent(
      <TooltipProvider>
        <Tooltip content="Positioned tooltip" delay={0} placement="top">
          <button type="button">Positioned trigger</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Positioned trigger" });
    setElementRect(trigger.parentElement!, {
      bottom: 120,
      height: 20,
      left: 100,
      right: 140,
      top: 100,
      width: 40,
    });

    await showTooltip(trigger, timers);

    const tooltip = screen.getByRole("tooltip") as HTMLElement;
    const top = parseFloat(tooltip.style.top);
    const left = parseFloat(tooltip.style.left);

    expect(top).toBeLessThan(100);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(left).toBeLessThanOrEqual(312);
    expect(left).toBeLessThan(120);
    expect(left + 80).toBeGreaterThan(120);
  });

  test("falls back to the opposite placement when the preferred side does not fit", async () => {
    renderComponent(
      <TooltipProvider>
        <Tooltip content="Fallback tooltip" delay={0} placement="top">
          <button type="button">Fallback trigger</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Fallback trigger" });
    setElementRect(trigger.parentElement!, {
      bottom: 24,
      height: 20,
      left: 100,
      right: 140,
      top: 4,
      width: 40,
    });

    await showTooltip(trigger, timers);

    const tooltip = screen.getByRole("tooltip") as HTMLElement;
    const top = parseFloat(tooltip.style.top);

    expect(top).toBeGreaterThan(24);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top).toBeLessThanOrEqual(262);
  });
});

async function showTooltip(trigger: Element, timers: FakeTimers): Promise<void> {
  await act(async () => {
    fireEvent.mouseEnter(trigger.parentElement ?? trigger);
    await flushPromises();
    timers.advanceBy(0);
    await flushPromises();
    timers.advanceBy(16);
    await flushPromises();
  });
}

async function showTooltipByFocus(trigger: Element, timers: FakeTimers): Promise<void> {
  await act(async () => {
    fireEvent.focusIn(trigger);
    await flushPromises();
    timers.advanceBy(0);
    await flushPromises();
    timers.advanceBy(16);
    await flushPromises();
  });
}

function domRect(rect: {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}): DOMRect {
  return {
    ...rect,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  } as DOMRect;
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}
