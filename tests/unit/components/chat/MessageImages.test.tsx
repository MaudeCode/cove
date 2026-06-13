/** @jsxImportSource preact */
import { afterEach, describe, expect, test } from "bun:test";
import { fireEvent, renderComponent, screen, waitFor, within } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";

installI18nMock({
  formatBytes: (bytes: number) => `${bytes} bytes`,
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
});

const { MessageImages } = await import("../../../../src/components/chat/MessageImages");

const originalFetch = globalThis.fetch;
const originalOpen = window.open;

afterEach(() => {
  globalThis.fetch = originalFetch;
  window.open = originalOpen;
});

describe("MessageImages", () => {
  test("renders omitted image placeholders without opening the lightbox", () => {
    renderComponent(<MessageImages images={[{ bytes: 2048, omitted: true, url: "" }]} />);

    const placeholder = screen.getByText('chat.omittedImage:{"size":"2048 bytes"}');
    expect(placeholder).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.click(placeholder);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("supports lightbox keyboard navigation and escape close", async () => {
    renderComponent(
      <MessageImages
        images={[
          { url: "https://example.com/first.png", alt: "first" },
          { url: "https://example.com/second.png", alt: "second" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "first" }));

    const dialog = screen.getByRole("dialog", { name: "common.imageViewer" });
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    expect(within(dialog).getByRole("img", { name: "first" })).toBeTruthy();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(within(dialog).getByRole("img", { name: "second" })).toBeTruthy();

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("opens the original image when download fetch fails", async () => {
    const opened: Array<[string | URL | undefined, string | undefined]> = [];
    globalThis.fetch = (async () => {
      throw new Error("network blocked");
    }) as unknown as typeof fetch;
    window.open = ((url?: string | URL, target?: string) => {
      opened.push([url, target]);
      return null;
    }) as typeof window.open;

    renderComponent(<MessageImages images={[{ url: "https://example.com/fallback.png" }]} />);

    fireEvent.click(screen.getByRole("button", { name: "common.download" }));

    await waitFor(() => expect(opened).toEqual([["https://example.com/fallback.png", "_blank"]]));
  });
});
