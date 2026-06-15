/** @jsxImportSource preact */
import { describe, expect, mock, test } from "bun:test";
import { renderComponent, screen } from "../../../../helpers/dom";
import { installI18nMock } from "../../../../helpers/i18n";

installI18nMock({ t: (key: string) => key });

mock.module("../../../../../src/components/chat/tool-blocks/CodeBlock", () => ({
  CodeBlock: ({ content }: { content: unknown }) => (
    <pre data-testid="code-block">{String(content)}</pre>
  ),
}));

const { ExecCommandBlock } = await import("../../../../../src/components/chat/tool-blocks/exec");

describe("ExecCommandBlock", () => {
  test("renders commandText when command is absent", () => {
    renderComponent(<ExecCommandBlock args={{ commandText: "bun test" }} />);

    expect(screen.getByTestId("code-block").textContent).toBe("bun test");
  });

  test("renders shell argv command when command is absent", () => {
    renderComponent(<ExecCommandBlock args={{ argv: ["/bin/zsh", "-lc", "echo ok"] }} />);

    expect(screen.getByTestId("code-block").textContent).toBe("echo ok");
  });
});
