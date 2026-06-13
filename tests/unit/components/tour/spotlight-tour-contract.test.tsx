/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act } from "@testing-library/preact";
import { renderComponent, screen, setElementRect, setViewport } from "../../../helpers/dom";
import { installFakeTimers, type FakeTimers } from "../../../helpers/timers";

mock.module("@/lib/i18n", () => ({ t: (key: string) => key }));

mock.module("@/components/ui/Button", () => ({
  Button: ({ children, onClick }: { children: preact.ComponentChildren; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

mock.module("@/components/ui/LinkButton", () => ({
  LinkButton: ({
    children,
    onClick,
  }: {
    children: preact.ComponentChildren;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const { SpotlightTour } =
  // @ts-ignore Query suffix isolates the component from other module-cache mocks.
  await import("../../../../src/components/tour/SpotlightTour.tsx?unit=spotlight-runtime");

describe("SpotlightTour runtime contract", () => {
  let timers: FakeTimers;
  let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;
  let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    timers = installFakeTimers();
    setViewport(200, 140);
    originalRect = HTMLElement.prototype.getBoundingClientRect;
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const rect = {
        bottom: 120,
        height: 120,
        left: 0,
        right: 180,
        top: 0,
        width: 180,
        x: 0,
        y: 0,
      };
      return { ...rect, toJSON: () => rect } as DOMRect;
    };
    HTMLElement.prototype.scrollIntoView = () => undefined;
  });

  afterEach(() => {
    timers.uninstall();
    HTMLElement.prototype.getBoundingClientRect = originalRect;
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  test("runs beforeShow before selecting the first visible target and clamps tooltip placement", async () => {
    let visible: HTMLButtonElement | undefined;
    renderComponent(
      <SpotlightTour
        steps={[
          {
            target: "[data-tour='target']",
            title: "Target step",
            content: "Highlights visible target",
            placement: "right",
            beforeShow: () => {
              visible = document.createElement("button");
              visible.dataset.tour = "target";
              Object.defineProperty(visible, "offsetParent", {
                configurable: true,
                get: () => document.body,
              });
              setElementRect(visible, {
                bottom: 140,
                height: 20,
                left: 180,
                right: 200,
                top: 120,
                width: 20,
              });
              document.body.appendChild(visible);
            },
          },
        ]}
        onComplete={() => undefined}
      />,
    );
    const hidden = document.createElement("button");
    hidden.dataset.tour = "target";
    Object.defineProperty(hidden, "offsetParent", { configurable: true, get: () => null });
    document.body.appendChild(hidden);

    await runTargetUpdate(timers);

    expect(visible).toBeDefined();
    expect(visible!.style.zIndex).toBe("10000");
    expect(hidden.style.zIndex).toBe("");
    const tooltip = screen.getByText("Target step").closest("div") as HTMLElement;
    expect(tooltip.style.left).toBe("16px");
    expect(tooltip.style.top).toBe("16px");
  });

  test("ignores Enter from editable targets and handles global tour navigation keys", async () => {
    const completed: string[] = [];
    renderComponent(
      <SpotlightTour
        steps={[
          {
            target: "[data-tour='chat-input']",
            title: "Input step",
            content: "Type without advancing",
          },
          {
            target: "[data-tour='second']",
            title: "Second step",
            content: "Keyboard navigation target",
          },
        ]}
        onComplete={() => completed.push("done")}
      />,
    );
    const textarea = document.createElement("textarea");
    textarea.dataset.tour = "chat-input";
    Object.defineProperty(textarea, "offsetParent", {
      configurable: true,
      get: () => document.body,
    });
    setElementRect(textarea, {
      bottom: 120,
      height: 20,
      left: 20,
      right: 180,
      top: 100,
      width: 160,
    });
    document.body.appendChild(textarea);

    const second = document.createElement("button");
    second.dataset.tour = "second";
    Object.defineProperty(second, "offsetParent", { configurable: true, get: () => document.body });
    setElementRect(second, { bottom: 80, height: 20, left: 20, right: 120, top: 60, width: 100 });
    document.body.appendChild(second);
    await runTargetUpdate(timers);

    await dispatchWindowKey("Enter", textarea);
    expect(screen.getByText("Input step")).toBeTruthy();

    await dispatchWindowKey("ArrowRight", window);
    await runTargetUpdate(timers);
    expect(screen.getByText("Second step")).toBeTruthy();

    await dispatchWindowKey("ArrowLeft", window);
    await runTargetUpdate(timers);
    expect(screen.getByText("Input step")).toBeTruthy();

    await dispatchWindowKey("Escape", textarea);
    expect(completed).toEqual(["done"]);
  });

  test("auto-advances when the current step condition becomes true", async () => {
    let ready = false;
    const completed: string[] = [];
    renderComponent(
      <SpotlightTour
        steps={[
          {
            target: "[data-tour='auto']",
            title: "Auto step",
            content: "Completes when ready",
            autoAdvanceWhen: () => ready,
          },
        ]}
        onComplete={() => completed.push("done")}
      />,
    );
    const target = document.createElement("button");
    target.dataset.tour = "auto";
    Object.defineProperty(target, "offsetParent", { configurable: true, get: () => document.body });
    setElementRect(target, { bottom: 80, height: 20, left: 20, right: 120, top: 60, width: 100 });
    document.body.appendChild(target);
    await runTargetUpdate(timers);

    timers.advanceBy(499);
    expect(completed).toEqual([]);
    ready = true;
    timers.advanceBy(1);
    expect(completed).toEqual(["done"]);
  });
});

async function runTargetUpdate(timers: FakeTimers): Promise<void> {
  await act(async () => {
    await flushPromises();
    timers.advanceBy(150);
    await flushPromises();
    timers.advanceBy(50);
    await flushPromises();
    timers.advanceBy(300);
    await flushPromises();
  });
}

async function dispatchWindowKey(key: string, target: EventTarget): Promise<void> {
  await act(async () => {
    const event = new KeyboardEvent("keydown", { bubbles: true, key });
    Object.defineProperty(event, "target", { configurable: true, value: target });
    window.dispatchEvent(event);
    await flushPromises();
  });
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}
