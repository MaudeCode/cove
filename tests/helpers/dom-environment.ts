import { Window } from "happy-dom";

type DomGlobal = typeof globalThis & {
  matchMedia: (query: string) => MediaQueryList;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
};

export const mediaMatches = new Map<string, boolean>();

let installed = false;

export function installDomGlobals(): void {
  if (installed) return;
  installed = true;

  const testWindow = new Window({
    url: "http://localhost/",
  });
  const global = globalThis as DomGlobal;

  defineGlobal("window", testWindow);
  defineGlobal("document", testWindow.document);
  defineGlobal("navigator", testWindow.navigator);
  defineGlobal("history", testWindow.history);
  defineGlobal("localStorage", testWindow.localStorage);
  defineGlobal("sessionStorage", testWindow.sessionStorage);
  defineGlobal("Node", testWindow.Node);
  defineGlobal("Element", testWindow.Element);
  defineGlobal("HTMLElement", testWindow.HTMLElement);
  defineGlobal("DocumentFragment", testWindow.DocumentFragment);
  defineGlobal("Event", testWindow.Event);
  defineGlobal("KeyboardEvent", testWindow.KeyboardEvent);
  defineGlobal("MouseEvent", testWindow.MouseEvent);
  defineGlobal("PointerEvent", testWindow.PointerEvent);
  defineGlobal("TouchEvent", testWindow.TouchEvent);
  defineGlobal("ResizeObserver", testWindow.ResizeObserver);
  defineGlobal("IntersectionObserver", testWindow.IntersectionObserver);
  defineGlobal(
    "requestAnimationFrame",
    (callback: FrameRequestCallback) =>
      setTimeout(() => callback(Date.now()), 16) as unknown as number,
  );
  defineGlobal("cancelAnimationFrame", (handle: number) => {
    clearTimeout(handle);
  });
  global.matchMedia = (query: string) => {
    const mediaQueryList = {
      matches: mediaMatches.get(query) ?? false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    } satisfies MediaQueryList;

    return mediaQueryList;
  };
}

installDomGlobals();

function defineGlobal(key: string, value: unknown): void {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}
