/** @jsxImportSource preact */
import { describe, expect, mock, test } from "bun:test";
import { renderComponent, screen } from "../../../../helpers/dom";
import { installI18nMock } from "../../../../helpers/i18n";

installI18nMock({ t: (key: string) => key });

mock.module("../../../../../src/components/chat/tool-blocks/CodeBlock", () => ({
  CodeBlock: ({
    content,
    error,
    filePath,
  }: {
    content: unknown;
    error?: boolean;
    filePath?: string;
  }) => (
    <pre data-error={String(!!error)} data-file-path={filePath} data-testid="code-block">
      {JSON.stringify(content)}
    </pre>
  ),
}));
mock.module("../../../../../src/components/chat/tool-blocks/web-search", () => ({
  WebSearchResultBlock: () => <div data-testid="web-search-result" />,
}));
mock.module("../../../../../src/components/chat/tool-blocks/web-fetch", () => ({
  WebFetchResultBlock: () => <div data-testid="web-fetch-result" />,
}));
mock.module("../../../../../src/components/chat/tool-blocks/memory", () => ({
  MemoryGetResultBlock: () => <div data-testid="memory-get-result" />,
  MemorySearchResultBlock: () => <div data-testid="memory-search-result" />,
}));
mock.module("../../../../../src/components/chat/tool-blocks/image", () => ({
  ImageResultBlock: () => <div data-testid="image-result" />,
}));
mock.module("../../../../../src/components/chat/tool-blocks/session-status", () => ({
  SessionStatusResultBlock: () => <div data-testid="session-status-result" />,
}));
mock.module("../../../../../src/components/chat/tool-blocks/browser", () => ({
  BrowserResultBlock: () => <div data-testid="browser-result" />,
}));
mock.module("../../../../../src/components/chat/tool-blocks/cron", () => ({
  CronResultBlock: () => <div data-testid="cron-result" />,
}));
mock.module("../../../../../src/components/chat/tool-blocks/message", () => ({
  MessageResultBlock: () => <div data-testid="message-result" />,
}));
mock.module("../../../../../src/components/chat/tool-blocks/gateway", () => ({
  GatewayResultBlock: () => <div data-testid="gateway-result" />,
}));

const { ResultBlock } =
  await import("../../../../../src/components/chat/tool-blocks/result-dispatcher");

describe("ResultBlock", () => {
  test("renders error-shaped results before specialized routing", () => {
    renderComponent(
      <ResultBlock result={{ error: "denied", status: "error" }} toolName="web_search" />,
    );

    expect(screen.getByText("common.error")).toBeTruthy();
    expect(screen.getByText("denied")).toBeTruthy();
    expect(screen.queryByTestId("web-search-result")).toBeNull();
  });

  test("routes specialized result blocks by tool name", () => {
    const cases = [
      ["web_search", "web-search-result"],
      ["web_fetch", "web-fetch-result"],
      ["memory_search", "memory-search-result"],
      ["memory_get", "memory-get-result"],
      ["image", "image-result"],
      ["session_status", "session-status-result"],
      ["browser", "browser-result"],
      ["cron", "cron-result"],
      ["message", "message-result"],
      ["gateway", "gateway-result"],
    ] as const;

    for (const [toolName, testId] of cases) {
      renderComponent(<ResultBlock result={{ ok: true }} toolName={toolName} />);
      expect(screen.getByTestId(testId)).toBeTruthy();
    }
  });

  test("falls back to code block and preserves error and file path props", () => {
    renderComponent(
      <ResultBlock result={{ ok: true }} toolName="unknown" error filePath="/tmp/output.txt" />,
    );

    const block = screen.getByTestId("code-block");
    expect(block.textContent).toBe('{"ok":true}');
    expect(block.getAttribute("data-error")).toBe("true");
    expect(block.getAttribute("data-file-path")).toBe("/tmp/output.txt");
  });
});
