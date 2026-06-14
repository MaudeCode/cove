/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ComponentChildren } from "preact";
import { fireEvent, renderComponent, screen } from "../../../helpers/dom";
import { formatRawLog, type ParsedLogLine } from "../../../../src/components/logs/log-parser";
import {
  formatLogTimestamp,
  levelColors,
  levelIcons,
} from "../../../../src/components/logs/constants";

mock.module("@/lib/i18n", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    key === "logs.expandLine"
      ? `Expand log details for line ${String(params?.id ?? "")}`
      : key === "logs.filterByLevel"
        ? `Filter by ${String(params?.level ?? "")} level`
        : key === "logs.viewLogDetails"
          ? `View log details for line ${String(params?.id ?? "")}`
          : key === "logs.logDetails"
            ? "Log Details"
            : key === "logs.message"
              ? "Message"
              : key === "logs.rawLine"
                ? "Raw"
                : key === "logs.fields"
                  ? "fields"
                  : key === "logs.info"
                    ? "Info"
                    : key === "logs.warnings"
                      ? "Warn"
                      : key === "common.debug"
                        ? "Debug"
                        : key === "common.error"
                          ? "Error"
                          : key,
}));
mock.module("@/components/logs", () => ({
  formatLogTimestamp,
  formatRawLog,
  levelColors,
  levelIcons,
}));
mock.module("@/components/ui/Badge", () => ({
  Badge: ({ children }: { children?: ComponentChildren }) => <span>{children}</span>,
}));
mock.module("@/components/ui/Modal", () => ({
  Modal: ({
    children,
    open,
    title,
  }: {
    children?: ComponentChildren;
    open: boolean;
    title?: string;
  }) =>
    open ? (
      <section aria-label={title} role="dialog">
        {children}
      </section>
    ) : null,
}));

const { LogLine } = await import("../../../../src/components/logs/LogLine");
const { LevelFilter, MobileLogCard, MobileLogModal } =
  await import("../../../../src/views/logs/LogsPieces");

beforeEach(() => {
  document.body.replaceChildren();
});

describe("log components", () => {
  test("LogLine expands structured fields and raw formatted JSON", () => {
    let toggles = 0;
    const line = parsedLine({
      fields: {
        "request.id": "req_1",
        durationMs: "42",
      },
      message: "slow request",
      raw: '{"level":"warn","msg":"slow request","request":{"id":"req_1"},"durationMs":42}',
      timestamp: "2026-06-13T12:34:56.000Z",
    });

    const rendered = renderComponent(
      <LogLine line={line} expanded={false} onToggle={() => toggles++} />,
    );
    const button = screen.getByRole("button", {
      name: "Expand log details for line 1",
    });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.textContent).toContain("12:34:56.000");
    expect(button.textContent).toContain("slow request");

    fireEvent.click(button);
    expect(toggles).toBe(1);

    rendered.rerender(<LogLine line={line} expanded onToggle={() => toggles++} />);
    expect(screen.getByText("request.id")).toBeTruthy();
    expect(screen.getByText("req_1")).toBeTruthy();
    expect(screen.getByText("durationMs")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText(/"request":/)).toBeTruthy();
  });

  test("LogLine disables expansion when there are no structured fields", () => {
    renderComponent(
      <LogLine line={parsedLine({ fields: undefined })} expanded={false} onToggle={() => {}} />,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-expanded")).toBeNull();
  });

  test("LevelFilter exposes count and pressed state", () => {
    let clicks = 0;
    renderComponent(<LevelFilter level="error" count={3} selected onClick={() => clicks++} />);

    const button = screen.getByRole("button", { name: "Filter by Error level (3)" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toBe("Error (3)");

    fireEvent.click(button);
    expect(clicks).toBe(1);
  });

  test("MobileLogCard renders field counts and selects the line", () => {
    const selections: number[] = [];
    renderComponent(
      <MobileLogCard
        line={parsedLine({
          fields: { session: "alpha", model: "claude" },
          id: 7,
          message: "mobile detail",
          timestamp: "2026-06-13T09:08:07Z",
        })}
        onSelect={(id) => selections.push(id)}
      />,
    );

    const button = screen.getByRole("button", {
      name: "View log details for line 7",
    });
    expect(button.textContent).toContain("mobile detail");
    expect(button.textContent).toContain("09:08:07Z");
    expect(button.textContent).toContain("2 fields");

    fireEvent.click(button);
    expect(selections).toEqual([7]);
  });

  test("MobileLogModal renders selected log details and closes when id is missing", () => {
    const lines = [
      parsedLine({ id: 1, message: "first" }),
      parsedLine({
        fields: { account: "ops" },
        id: 2,
        level: "error",
        message: "selected",
        raw: '{"level":"error","msg":"selected","account":"ops"}',
        timestamp: "2026-06-13T01:02:03Z",
      }),
    ];

    const rendered = renderComponent(
      <MobileLogModal logId={2} lines={lines} onClose={() => undefined} />,
    );
    expect(screen.getByRole("dialog", { name: "Log Details" })).toBeTruthy();
    expect(screen.getByText("selected")).toBeTruthy();
    expect(screen.getByText("account")).toBeTruthy();
    expect(screen.getByText("ops")).toBeTruthy();
    expect(screen.getByText(/"account": "ops"/)).toBeTruthy();

    rendered.rerender(<MobileLogModal logId={99} lines={lines} onClose={() => undefined} />);
    expect(screen.queryByRole("dialog", { name: "Log Details" })).toBeNull();
    expect(document.body.textContent).not.toContain("selected");
  });
});

function parsedLine(overrides: Partial<ParsedLogLine> = {}): ParsedLogLine {
  return {
    id: 1,
    raw: "INFO default",
    level: "info",
    message: "default",
    timestamp: "2026-06-13T12:00:00Z",
    fields: {},
    ...overrides,
  };
}
