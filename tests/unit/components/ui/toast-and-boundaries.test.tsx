/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { installFakeTimers } from "../../../helpers/timers";

const loggedErrors: unknown[][] = [];

mock.module("@/lib/i18n", () => ({
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

mock.module("@/lib/logger", () => ({
  log: {
    ui: {
      error: (...args: unknown[]) => loggedErrors.push(args),
    },
  },
}));

const toastModule = await import("../../../../src/components/ui/Toast");
const errorBoundaryModule = await import("../../../../src/components/ui/ErrorBoundary");
const viewErrorBoundaryModule = await import("../../../../src/components/ui/ViewErrorBoundary");

const { ToastContainer, toast } = toastModule;
const { ErrorBoundary } = errorBoundaryModule;
const { ViewErrorBoundary } = viewErrorBoundaryModule;

const originalClipboard = navigator.clipboard;

beforeEach(() => {
  loggedErrors.length = 0;
  shouldThrowOnce = true;
});

afterEach(() => {
  dismissRenderedToasts();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: originalClipboard,
  });
});

describe("toast and error boundary primitives", () => {
  test("ToastContainer caps the queue, exposes alert live regions, and dismisses manually", async () => {
    renderComponent(<ToastContainer />);

    for (let i = 1; i <= 6; i++) {
      toast.info(`Toast ${i}`, 0);
    }

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(5));
    expect(screen.getByLabelText("Notifications")).toBeTruthy();
    expect(screen.getByText("Toast 6").closest('[role="alert"]')?.getAttribute("aria-live")).toBe(
      "polite",
    );
    expect(screen.queryByText("Toast 1")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "actions.close" })[0]);

    expect(screen.queryByText("Toast 2")).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(4);

    for (const closeButton of screen.getAllByRole("button", { name: "actions.close" })) {
      fireEvent.click(closeButton);
    }
  });

  test("ToastContainer auto-dismisses duration-bound toasts", async () => {
    const timers = installFakeTimers();
    const originalWindowSetTimeout = window.setTimeout;
    const originalWindowClearTimeout = window.clearTimeout;
    window.setTimeout = globalThis.setTimeout as typeof window.setTimeout;
    window.clearTimeout = globalThis.clearTimeout as typeof window.clearTimeout;

    try {
      renderComponent(<ToastContainer />);

      await act(async () => {
        toast.success("Saved", 100);
        await flushPromises();
        timers.advanceBy(0);
        await flushPromises();
      });

      expect(screen.getByText("Saved")).toBeTruthy();

      await act(async () => {
        timers.advanceBy(99);
        await flushPromises();
      });
      expect(screen.getByText("Saved")).toBeTruthy();

      await act(async () => {
        timers.advanceBy(1);
        await flushPromises();
      });
      expect(screen.queryByText("Saved")).toBeNull();
    } finally {
      window.setTimeout = originalWindowSetTimeout;
      window.clearTimeout = originalWindowClearTimeout;
      timers.uninstall();
    }
  });

  test("ErrorBoundary renders fallback, calls retry, and can render children again", async () => {
    const retryCalls: string[] = [];
    renderComponent(
      <ErrorBoundary onRetry={() => retryCalls.push("retry")}>
        <ThrowOnce />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("errors.generic")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "actions.retry" }));

    expect(retryCalls).toEqual(["retry"]);
    await waitFor(() => expect(screen.getByText("safe child")).toBeTruthy());
  });

  test("ErrorBoundary uses custom fallback content", () => {
    renderComponent(
      <ErrorBoundary fallback={<div role="alert">Custom fallback</div>}>
        <AlwaysThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Custom fallback");
  });

  test("ViewErrorBoundary toggles details and copies error text", async () => {
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => copied.push(text),
      },
    });

    renderComponent(
      <>
        <ToastContainer />
        <ViewErrorBoundary viewName="Logs">
          <AlwaysThrow />
        </ViewErrorBoundary>
      </>,
    );

    expect(screen.getByText("errors.errorPage.title").closest('[role="alert"]')).toBeTruthy();
    expect(screen.getByText("errors.errorPage.title")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "errors.errorPage.details" }));
    expect(screen.getByText(/Error: boom/)).toBeTruthy();

    fireEvent.click(screen.getByTitle("actions.copy"));

    await waitFor(() => expect(copied[0]).toContain("Error: boom"));
    expect(screen.getByText("actions.copied")).toBeTruthy();
  });

  test("ViewErrorBoundary reports copy failures and retries children", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const retryCalls: string[] = [];

    renderComponent(
      <>
        <ToastContainer />
        <ViewErrorBoundary viewName="Debug" onRetry={() => retryCalls.push("retry")}>
          <ThrowOnce />
        </ViewErrorBoundary>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "errors.errorPage.details" }));
    fireEvent.click(screen.getByTitle("actions.copy"));

    await waitFor(() => expect(screen.getByText(/status.copyFailed/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "actions.retry" }));

    expect(retryCalls).toEqual(["retry"]);
    await waitFor(() => expect(screen.getByText("safe child")).toBeTruthy());
  });
});

function dismissRenderedToasts(): void {
  for (const closeButton of screen.queryAllByRole("button", { name: "actions.close" })) {
    fireEvent.click(closeButton);
  }
}

function AlwaysThrow(): ComponentChildren {
  throw new Error("boom");
}

let shouldThrowOnce = true;

function ThrowOnce(): ComponentChildren {
  if (shouldThrowOnce) {
    shouldThrowOnce = false;
    throw new Error("boom");
  }
  return <div>safe child</div>;
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}
