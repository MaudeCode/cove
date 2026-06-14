/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { signal } from "@preact/signals";
import { fireEvent, installFakeTimers, renderComponent, screen, waitFor } from "../../helpers/dom";
import {
  pushQueryState,
  toggleSetValue,
  useQueryParam,
  useQueryParamSet,
} from "../../../src/hooks/useQueryParam";
import { useExpandableFromQueryParamSet } from "../../../src/hooks/useExpandableFromQueryParamSet";

function resetUrl(search = ""): void {
  window.history.replaceState({}, "", `/${search}`);
}

describe("useQueryParam", () => {
  beforeEach(() => {
    resetUrl();
  });

  afterEach(() => {
    resetUrl();
  });

  test("initializes from URL, deletes params with replaceState, and syncs on popstate", async () => {
    resetUrl("?q=initial");
    const replaceCalls: string[] = [];
    const pushCalls: string[] = [];
    const originalReplaceState = window.history.replaceState;
    const originalPushState = window.history.pushState;
    window.history.replaceState = ((...args: Parameters<typeof window.history.replaceState>) => {
      replaceCalls.push(String(args[2]));
      return originalReplaceState.apply(window.history, args);
    }) as typeof window.history.replaceState;
    window.history.pushState = ((...args: Parameters<typeof window.history.pushState>) => {
      pushCalls.push(String(args[2]));
      return originalPushState.apply(window.history, args);
    }) as typeof window.history.pushState;

    function Harness() {
      const [param, setParam, initialized] = useQueryParam("q", { defaultValue: "fallback" });
      return (
        <div>
          <span data-testid="value">{param.value}</span>
          <span data-testid="initialized">{String(initialized.value)}</span>
          <button type="button" onClick={() => setParam("updated")}>
            update
          </button>
          <button type="button" onClick={() => setParam(null)}>
            clear
          </button>
        </div>
      );
    }

    try {
      renderComponent(<Harness />);

      expect(screen.getByTestId("value").textContent).toBe("initial");
      await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));
      replaceCalls.length = 0;
      pushCalls.length = 0;

      fireEvent.click(screen.getByText("update"));
      expect(new URL(window.location.href).searchParams.get("q")).toBe("updated");
      expect(replaceCalls.at(-1)).toContain("?q=updated");
      expect(pushCalls).toEqual([]);

      fireEvent.click(screen.getByText("clear"));
      expect(new URL(window.location.href).searchParams.has("q")).toBe(false);
      expect(replaceCalls.at(-1)).not.toContain("q=");
      expect(pushCalls).toEqual([]);

      window.history.pushState({}, "", "/?q=from-popstate");
      window.dispatchEvent(new window.PopStateEvent("popstate"));
      await waitFor(() => expect(screen.getByTestId("value").textContent).toBe("from-popstate"));
    } finally {
      window.history.replaceState = originalReplaceState;
      window.history.pushState = originalPushState;
    }
  });

  test("gates default-value URL sync until ready", async () => {
    function Harness({ ready }: { ready: boolean }) {
      const [param, , initialized] = useQueryParam("job", {
        defaultValue: "job-1",
        ready,
      });
      return (
        <div>
          <span data-testid="value">{param.value}</span>
          <span data-testid="initialized">{String(initialized.value)}</span>
        </div>
      );
    }

    const rendered = renderComponent(<Harness ready={false} />);

    expect(screen.getByTestId("value").textContent).toBe("job-1");
    expect(screen.getByTestId("initialized").textContent).toBe("false");
    expect(new URL(window.location.href).searchParams.has("job")).toBe(false);

    rendered.rerender(<Harness ready />);

    await waitFor(() => expect(screen.getByTestId("initialized").textContent).toBe("true"));
    expect(new URL(window.location.href).searchParams.get("job")).toBe("job-1");
  });

  test("cleans up shared query param signals after the last subscriber unmounts", async () => {
    resetUrl("?item=first");

    function Subscriber({ label }: { label: string }) {
      const [param] = useQueryParam("item");
      return <span data-testid={label}>{param.value}</span>;
    }

    function Harness({ showSecond }: { showSecond: boolean }) {
      return (
        <>
          <Subscriber label="one" />
          {showSecond && <Subscriber label="two" />}
        </>
      );
    }

    const first = renderComponent(<Harness showSecond />);

    expect(screen.getByTestId("one").textContent).toBe("first");
    expect(screen.getByTestId("two").textContent).toBe("first");

    first.rerender(<Harness showSecond={false} />);
    resetUrl("?item=remaining");
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await waitFor(() => expect(screen.getByTestId("one").textContent).toBe("remaining"));

    first.unmount();
    resetUrl("?item=second");

    renderComponent(<Subscriber label="fresh" />);

    await waitFor(() => expect(screen.getByTestId("fresh").textContent).toBe("second"));
  });

  test("does not drop the shared signal while another subscriber remains", async () => {
    resetUrl("?shared=first");

    function Subscriber({ label }: { label: string }) {
      const [param] = useQueryParam("shared");
      return <span data-testid={label}>{param.value}</span>;
    }

    function Harness({ showSecond }: { showSecond: boolean }) {
      return (
        <>
          <Subscriber label="one" />
          {showSecond && <Subscriber label="two" />}
        </>
      );
    }

    const rendered = renderComponent(
      <>
        <Harness showSecond />
      </>,
    );

    expect(screen.getByTestId("one").textContent).toBe("first");
    expect(screen.getByTestId("two").textContent).toBe("first");

    rendered.rerender(<Harness showSecond={false} />);
    resetUrl("?shared=next");
    window.dispatchEvent(new window.PopStateEvent("popstate"));

    await waitFor(() => expect(screen.getByTestId("one").textContent).toBe("next"));
  });
});

describe("useQueryParamSet and query state helpers", () => {
  beforeEach(() => {
    resetUrl();
  });

  afterEach(() => {
    resetUrl();
  });

  test("parses and serializes comma-separated Set params", async () => {
    resetUrl("?ids=0,1");

    function Harness() {
      const [items, setItems] = useQueryParamSet("ids", {
        parse: Number,
        serialize: String,
      });
      return (
        <div>
          <span data-testid="items">{Array.from(items.value).join("|")}</span>
          <button type="button" onClick={() => setItems(new Set([2, 4]))}>
            set
          </button>
          <button type="button" onClick={() => setItems(new Set())}>
            clear
          </button>
        </div>
      );
    }

    renderComponent(<Harness />);

    expect(screen.getByTestId("items").textContent).toBe("0|1");
    fireEvent.click(screen.getByText("set"));
    expect(new URL(window.location.href).searchParams.get("ids")).toBe("2,4");

    window.history.pushState({}, "", "/?ids=0,3");
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("0|3"));

    fireEvent.click(screen.getByText("clear"));
    expect(new URL(window.location.href).searchParams.has("ids")).toBe(false);
  });

  test("toggleSetValue pushes history only when adding values", () => {
    const expanded = signal(new Set(["existing"]));
    const pushed: string[] = [];
    const originalPushState = window.history.pushState;
    window.history.pushState = ((...args: Parameters<typeof window.history.pushState>) => {
      pushed.push(String(args[2]));
      return originalPushState.apply(window.history, args);
    }) as typeof window.history.pushState;

    try {
      expect(toggleSetValue(expanded, "new", { pushHistory: true })).toBe(true);
      expect(expanded.value.has("new")).toBe(true);
      expect(pushed).toHaveLength(1);

      expect(toggleSetValue(expanded, "new", { pushHistory: true })).toBe(false);
      expect(expanded.value.has("new")).toBe(false);
      expect(pushed).toHaveLength(1);

      pushQueryState();
      expect(pushed).toHaveLength(2);
    } finally {
      window.history.pushState = originalPushState;
    }
  });
});

describe("useExpandableFromQueryParamSet", () => {
  beforeEach(() => {
    resetUrl();
  });

  afterEach(() => {
    resetUrl();
  });

  test("gates URL-driven expansion until ready, filters invalid IDs, opens mobile first, and scrolls visible element", async () => {
    const expandedParam = signal(new Set(["missing", "valid"]));
    const expandedState = signal(new Set<string>());
    const expandedInitialized = signal(false);
    const synced: Array<Set<string>> = [];
    const mobileOpened: string[] = [];
    const scrolled: Element[] = [];
    const visibleParent = document.createElement("div");
    const hidden = document.createElement("div");
    const visible = document.createElement("div");
    hidden.dataset.itemId = "valid";
    visible.dataset.itemId = "valid";
    Object.defineProperty(hidden, "offsetParent", { configurable: true, value: null });
    Object.defineProperty(visible, "offsetParent", { configurable: true, value: visibleParent });
    visible.scrollIntoView = () => scrolled.push(visible);

    function Harness({ ready }: { ready: boolean }) {
      useExpandableFromQueryParamSet({
        expandedInitialized,
        expandedParam,
        expandedState,
        getItemSelector: (id) => `[data-item-id="${id}"]`,
        isMobile: () => true,
        isValid: (id) => id === "valid",
        onMobileOpenFirst: (id) => mobileOpened.push(id),
        ready,
        scrollDelayMs: 0,
        setExpandedParam: (set) => synced.push(new Set(set)),
      });
      return <span data-testid="expanded">{Array.from(expandedState.value).join("|")}</span>;
    }

    const rendered = renderComponent(<Harness ready={false} />);
    document.body.append(hidden, visible);

    expect(screen.getByTestId("expanded").textContent).toBe("");
    expect(mobileOpened).toEqual([]);

    rendered.rerender(<Harness ready />);

    await waitFor(() => expect(screen.getByTestId("expanded").textContent).toBe("valid"));
    expect(expandedState.value).toEqual(new Set(["valid"]));
    expect(mobileOpened).toEqual(["valid"]);
    await waitFor(() => expect(scrolled).toHaveLength(1));
    expect(scrolled[0]).toBe(visible);
    expect(synced).toEqual([]);

    expandedInitialized.value = true;
    expandedState.value = new Set(["valid", "second"]);

    await waitFor(() => expect(synced.at(-1)).toEqual(new Set(["valid", "second"])));
  });

  test("does not scroll on mobile when scrollOnMobile is disabled", async () => {
    const expandedParam = signal(new Set(["item-1"]));
    const expandedState = signal(new Set<string>());
    const expandedInitialized = signal(true);
    const scrolled: Element[] = [];
    const element = document.createElement("div");
    element.dataset.itemId = "item-1";
    Object.defineProperty(element, "offsetParent", {
      configurable: true,
      value: document.body,
    });
    element.scrollIntoView = () => scrolled.push(element);
    document.body.append(element);

    function Harness() {
      useExpandableFromQueryParamSet({
        expandedInitialized,
        expandedParam,
        expandedState,
        getItemSelector: (id) => `[data-item-id="${id}"]`,
        isMobile: () => true,
        ready: true,
        scrollDelayMs: 0,
        scrollOnMobile: false,
        setExpandedParam: () => undefined,
      });
      return <span data-testid="expanded">{Array.from(expandedState.value).join("|")}</span>;
    }

    renderComponent(<Harness />);

    await waitFor(() => expect(screen.getByTestId("expanded").textContent).toBe("item-1"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scrolled).toEqual([]);
  });

  test("clears pending scroll timers when unmounted before the delay", () => {
    const timers = installFakeTimers();
    const expandedParam = signal(new Set(["item-1"]));
    const expandedState = signal(new Set<string>());
    const expandedInitialized = signal(true);
    const scrolled: Element[] = [];
    const element = document.createElement("div");
    element.dataset.itemId = "item-1";
    Object.defineProperty(element, "offsetParent", {
      configurable: true,
      value: document.body,
    });
    element.scrollIntoView = () => scrolled.push(element);

    function Harness() {
      useExpandableFromQueryParamSet({
        expandedInitialized,
        expandedParam,
        expandedState,
        getItemSelector: (id) => `[data-item-id="${id}"]`,
        isMobile: () => false,
        ready: true,
        scrollDelayMs: 100,
        setExpandedParam: () => undefined,
      });
      return null;
    }

    try {
      const rendered = renderComponent(<Harness />);
      document.body.append(element);

      rendered.unmount();
      timers.advanceBy(100);

      expect(scrolled).toEqual([]);
    } finally {
      timers.uninstall();
    }
  });

  test("does not cancel a pending scroll when initialized sync is already equivalent", () => {
    const timers = installFakeTimers();
    const expandedParam = signal(new Set(["item-1"]));
    const expandedState = signal(new Set<string>());
    const expandedInitialized = signal(true);
    const synced: Array<Set<string>> = [];
    const scrolled: Element[] = [];
    const element = document.createElement("div");
    element.dataset.itemId = "item-1";
    Object.defineProperty(element, "offsetParent", {
      configurable: true,
      value: document.body,
    });
    element.scrollIntoView = () => scrolled.push(element);

    function Harness() {
      useExpandableFromQueryParamSet({
        expandedInitialized,
        expandedParam,
        expandedState,
        getItemSelector: (id) => `[data-item-id="${id}"]`,
        isMobile: () => false,
        ready: true,
        scrollDelayMs: 100,
        setExpandedParam: (set) => {
          synced.push(new Set(set));
          expandedParam.value = new Set(set);
        },
      });
      return null;
    }

    try {
      renderComponent(<Harness />);
      document.body.append(element);
      timers.advanceBy(100);

      expect(synced).toEqual([]);
      expect(scrolled).toHaveLength(1);
    } finally {
      timers.uninstall();
    }
  });
});
