/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal, type Signal } from "@preact/signals";
import { fireEvent, renderComponent, screen, setViewport, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { installChatSignalAliases } from "../../../helpers/module-aliases";

installI18nMock({ t: (key: string) => key });
await installChatSignalAliases();

mock.module("@/components/ui/IconButton", () => ({
  IconButton: ({
    label,
    onClick,
  }: {
    icon: preact.ComponentChildren;
    label: string;
    onClick: () => void;
    size?: string;
  }) => (
    <button type="button" aria-label={label} onClick={onClick}>
      {label}
    </button>
  ),
}));

let iframeEval: ((js: string) => unknown) | undefined;
let contentMode: "empty" | "iframe" | "image" = "empty";
let imageSize = { height: 800, width: 1600 };
type EvalRequest = {
  js: string;
  resolve: (result: unknown) => void;
  reject: (error: string) => void;
};
type SnapshotRequest = {
  maxWidth: number;
  quality: number;
  outputFormat: "jpeg" | "png";
  resolve: (dataUrl: string) => void;
  reject: (error: string) => void;
};

const mockCanvasVisible = signal(false);
const mockCanvasUrl = signal<string | null>(null);
const mockCanvasContent = signal<string | null>(null);
const mockCanvasBlobUrl = signal<string | null>(null);
const mockCanvasContentType = signal<string | null>(null);
const mockStandaloneCanvasOpen = signal(false);
const mockPendingCanvasEval = signal<EvalRequest | null>(null);
const mockPendingCanvasSnapshot = signal<SnapshotRequest | null>(null);
const canvasPanelOpen = signal(false);

mock.module("@/lib/node-connection", () => ({
  canvasBlobUrl: mockCanvasBlobUrl,
  canvasContent: mockCanvasContent,
  canvasContentType: mockCanvasContentType,
  canvasUrl: mockCanvasUrl,
  canvasVisible: mockCanvasVisible,
  nodeConnected: signal(false),
  nodePairingStatus: signal("unpaired"),
  pendingCanvasEval: mockPendingCanvasEval,
  pendingCanvasSnapshot: mockPendingCanvasSnapshot,
  standaloneCanvasOpen: mockStandaloneCanvasOpen,
  startNodeConnection: () => undefined,
  stopNodeConnection: () => undefined,
}));
mock.module("@/signals/ui", () => ({ canvasPanelOpen }));
const canvasUtils = await import("../../../../src/lib/canvas-utils");
mock.module("@/lib/canvas-utils", () => canvasUtils);

const activeNodeConnection = (await import("@/lib/node-connection")) as {
  canvasBlobUrl: Signal<string | null>;
  canvasContent: Signal<string | null>;
  canvasContentType: Signal<string | null>;
  canvasUrl: Signal<string | null>;
  canvasVisible: Signal<boolean>;
  pendingCanvasEval: Signal<EvalRequest | null>;
  pendingCanvasSnapshot: Signal<SnapshotRequest | null>;
  standaloneCanvasOpen: Signal<boolean>;
};
const {
  canvasBlobUrl,
  canvasContent,
  canvasContentType,
  canvasUrl,
  canvasVisible,
  pendingCanvasEval,
  pendingCanvasSnapshot,
  standaloneCanvasOpen,
} = activeNodeConnection;

const canvasContentMock = {
  CanvasContent: ({
    iframeRef,
    imgRef,
  }: {
    iframeRef?: { current: HTMLIFrameElement | null };
    imgRef?: { current: HTMLImageElement | null };
  }) => {
    if (contentMode === "iframe" && iframeRef) {
      iframeRef.current = {
        contentDocument: {},
        contentWindow: {
          eval: (js: string) => iframeEval?.(js),
        },
      } as unknown as HTMLIFrameElement;
    }
    if (contentMode === "image" && imgRef) {
      imgRef.current = {
        complete: true,
        height: imageSize.height,
        naturalHeight: imageSize.height,
        naturalWidth: imageSize.width,
        width: imageSize.width,
      } as HTMLImageElement;
    }
    return <div data-testid={`canvas-content-${contentMode}`} />;
  },
};
mock.module("../../../../src/components/canvas/CanvasContent", () => canvasContentMock);
mock.module("../../../../src/components/canvas/CanvasContent.tsx", () => canvasContentMock);
mock.module(
  new URL("../../../../src/components/canvas/CanvasContent.tsx", import.meta.url).pathname,
  () => canvasContentMock,
);

const { dockPosition, isMinimized, panelHeight, panelWidth, panelX, panelY } =
  await import("../../../../src/components/canvas/canvas-panel-state");
const { CanvasPanel } =
  // @ts-ignore Query suffix isolates CanvasPanel from prior module-cache state in aggregate tests.
  await import("../../../../src/components/canvas/CanvasPanel.tsx?unit=panel");

const originalCreateElement = document.createElement.bind(document);
const drawCalls: Array<{ height: number; width: number }> = [];
const dataUrlCalls: Array<{ mimeType: string; quality: number | undefined }> = [];

beforeEach(() => {
  setViewport(1200, 800);
  canvasVisible.value = false;
  canvasUrl.value = null;
  canvasContent.value = null;
  canvasBlobUrl.value = null;
  canvasContentType.value = null;
  standaloneCanvasOpen.value = false;
  pendingCanvasEval.value = null;
  pendingCanvasSnapshot.value = null;
  canvasPanelOpen.value = false;
  dockPosition.value = "floating";
  isMinimized.value = false;
  panelX.value = 100;
  panelY.value = 100;
  panelWidth.value = 400;
  panelHeight.value = 350;
  contentMode = "empty";
  iframeEval = undefined;
  imageSize = { height: 800, width: 1600 };
  drawCalls.length = 0;
  dataUrlCalls.length = 0;
  document.createElement = originalCreateElement;
});

describe("CanvasPanel", () => {
  test("auto-opens for visible canvas content unless standalone canvas is open", async () => {
    renderComponent(<CanvasPanel />);

    canvasVisible.value = true;
    await waitFor(() => expect(canvasPanelOpen.value).toBe(true));
    expect(screen.getByRole("toolbar", { name: "Canvas panel controls" })).toBeTruthy();

    canvasPanelOpen.value = false;
    canvasVisible.value = false;
    standaloneCanvasOpen.value = true;
    canvasVisible.value = true;

    expect(canvasPanelOpen.value).toBe(false);
  });

  test("closes with Escape and the close button", async () => {
    canvasVisible.value = true;
    canvasPanelOpen.value = true;
    renderComponent(<CanvasPanel />);
    await flushPromises();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(canvasPanelOpen.value).toBe(false);

    canvasPanelOpen.value = true;
    await waitFor(() => expect(screen.getByRole("button", { name: "canvas.close" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "canvas.close" }));
    expect(canvasPanelOpen.value).toBe(false);
  });

  test("resolves and rejects pending iframe eval requests", async () => {
    const resolved: unknown[] = [];
    const rejected: string[] = [];
    contentMode = "iframe";
    iframeEval = (js) => `ran:${js}`;
    canvasVisible.value = true;
    canvasPanelOpen.value = true;
    canvasUrl.value = "https://example.test/page.html";
    renderComponent(<CanvasPanel />);
    await flushPromises();

    pendingCanvasEval.value = {
      js: "1 + 1",
      resolve: (value) => resolved.push(value),
      reject: (error) => rejected.push(error),
    };

    expect(resolved).toEqual(["ran:1 + 1"]);
    expect(rejected).toEqual([]);
    expect(pendingCanvasEval.value).toBeNull();

    iframeEval = () => {
      throw new Error("boom");
    };
    pendingCanvasEval.value = {
      js: "throw",
      resolve: (value) => resolved.push(value),
      reject: (error) => rejected.push(error),
    };

    expect(rejected).toEqual(["Error: boom"]);
  });

  test("captures completed images with snapshot scaling and output options", async () => {
    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "canvas") {
        Object.defineProperty(element, "getContext", {
          configurable: true,
          value: () => ({
            drawImage: (_image: unknown, _x: number, _y: number, width: number, height: number) =>
              drawCalls.push({ height, width }),
          }),
        });
        Object.defineProperty(element, "toDataURL", {
          configurable: true,
          value: (mimeType: string, quality?: number) => {
            dataUrlCalls.push({ mimeType, quality });
            return `data:${mimeType};base64,snapshot`;
          },
        });
      }
      return element;
    }) as typeof document.createElement;
    const resolved: string[] = [];
    contentMode = "image";
    canvasVisible.value = true;
    canvasPanelOpen.value = true;
    canvasUrl.value = "https://example.test/image.png";
    renderComponent(<CanvasPanel />);
    await flushPromises();

    pendingCanvasSnapshot.value = {
      maxWidth: 800,
      outputFormat: "jpeg",
      quality: 0.7,
      resolve: (dataUrl) => resolved.push(dataUrl),
      reject: () => undefined,
    };

    expect(resolved).toEqual(["data:image/jpeg;base64,snapshot"]);
    expect(drawCalls).toEqual([{ height: 400, width: 800 }]);
    expect(dataUrlCalls).toEqual([{ mimeType: "image/jpeg", quality: 0.7 }]);

    pendingCanvasSnapshot.value = {
      maxWidth: 2000,
      outputFormat: "png",
      quality: 0.5,
      resolve: (dataUrl) => resolved.push(dataUrl),
      reject: () => undefined,
    };

    expect(resolved.at(-1)).toBe("data:image/png;base64,snapshot");
    expect(dataUrlCalls.at(-1)).toEqual({ mimeType: "image/png", quality: 0.5 });
  });

  test("rejects iframe snapshots until HTML capture is implemented", async () => {
    const rejected: string[] = [];
    contentMode = "iframe";
    canvasVisible.value = true;
    canvasPanelOpen.value = true;
    canvasUrl.value = "https://example.test/page.html";
    renderComponent(<CanvasPanel />);
    await flushPromises();

    pendingCanvasSnapshot.value = {
      maxWidth: 800,
      outputFormat: "jpeg",
      quality: 0.8,
      resolve: () => undefined,
      reject: (error) => rejected.push(error),
    };

    expect(rejected).toEqual(["HTML snapshot not yet implemented - use images for now"]);
  });
});

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}
