import { afterEach } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import type { ComponentChild } from "preact";
import { mediaMatches } from "./dom-environment";
import { installFakeTimers } from "./timers";

interface GeometryRect {
  bottom?: number;
  height?: number;
  left?: number;
  right?: number;
  top?: number;
  width?: number;
  x?: number;
  y?: number;
}

type ScreenQueries = ReturnType<typeof within>;

export const screen = new Proxy({} as ScreenQueries, {
  get(_target, property: keyof ScreenQueries) {
    const queries = within(document.body);
    return (queries as Record<PropertyKey, unknown>)[property];
  },
});

export { fireEvent, userEvent, waitFor, within };
export { installFakeTimers };

export function renderComponent(component: ComponentChild, options?: RenderOptions): RenderResult {
  resetDomState();
  return render(component, {
    container: document.body.appendChild(document.createElement("div")),
    ...options,
  });
}

export function cleanupDom(): void {
  cleanup();
  resetDomState();
}

export function resetDomState(): void {
  document.body.replaceChildren();
  document.head.replaceChildren();
  localStorage.clear();
  sessionStorage.clear();
}

export function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
}

export function setMatchesMedia(query: string, matches: boolean): void {
  mediaMatches.set(query, matches);
}

export function setElementRect(element: Element, rect: GeometryRect): void {
  const fullRect = {
    bottom: rect.bottom ?? (rect.top ?? rect.y ?? 0) + (rect.height ?? 0),
    height: rect.height ?? 0,
    left: rect.left ?? rect.x ?? 0,
    right: rect.right ?? (rect.left ?? rect.x ?? 0) + (rect.width ?? 0),
    top: rect.top ?? rect.y ?? 0,
    width: rect.width ?? 0,
    x: rect.x ?? rect.left ?? 0,
    y: rect.y ?? rect.top ?? 0,
  };

  element.getBoundingClientRect = () =>
    ({
      ...fullRect,
      toJSON: () => fullRect,
    }) as DOMRect;
}

export function pressKey(target: Element, key: string): void {
  fireEvent.keyDown(target, { key });
  fireEvent.keyUp(target, { key });
}

export function pointerTap(target: Element): void {
  fireEvent.pointerDown(target);
  fireEvent.pointerUp(target);
  fireEvent.click(target);
}

export function touchTap(target: Element): void {
  fireEvent.touchStart(target);
  fireEvent.touchEnd(target);
  fireEvent.click(target);
}

afterEach(() => {
  cleanupDom();
  mediaMatches.clear();
});
