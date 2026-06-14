/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderComponent, screen, waitFor } from "../../helpers/dom";
import {
  isSupportedImage,
  MAX_FILE_SIZE,
  MAX_IMAGE_DIMENSION,
  MAX_PAYLOAD_SIZE,
  SUPPORTED_IMAGE_TYPES,
} from "../../../src/types/attachments";

mock.module("@/types/attachments", () => ({
  isSupportedImage,
  MAX_FILE_SIZE,
  MAX_IMAGE_DIMENSION,
  MAX_PAYLOAD_SIZE,
  SUPPORTED_IMAGE_TYPES,
}));

const { compressImage, useAttachments } = await import("../../../src/hooks/useAttachments");

type HookResult = ReturnType<typeof useAttachments>;

const originalCreateElement = document.createElement.bind(document);
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
const originalFileReader = globalThis.FileReader;
const originalImage = globalThis.Image;

const objectUrls: string[] = [];
const revokedUrls: string[] = [];
const drawCalls: Array<{ height: number; width: number }> = [];
let activeResult: HookResult | undefined;
let imageLoadMode: "load" | "error" = "load";
let imageSize = { height: 800, width: 1200 };
let dataUrlQueue: string[] = [];
let canvasSupported = true;
let fileReaderMode: "load" | "error" = "load";

function dataUrl(mimeType: string, base64Length: number): string {
  return `data:${mimeType};base64,${"a".repeat(base64Length)}`;
}

function smallJpeg(): string {
  return dataUrl("image/jpeg", 120);
}

function smallPng(): string {
  return dataUrl("image/png", 80);
}

function file(name: string, type: string, content: string): File {
  return new File([content], name, { type });
}

function oversizedFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

function installBrowserFileMocks(): void {
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:mock-${objectUrls.length}-${(blob as File).name ?? "blob"}`;
    objectUrls.push(url);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((url: string) => {
    revokedUrls.push(url);
  }) as typeof URL.revokeObjectURL;

  document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === "canvas") {
      Object.defineProperty(element, "getContext", {
        configurable: true,
        value: () =>
          canvasSupported
            ? {
                drawImage: (
                  _image: unknown,
                  _x: number,
                  _y: number,
                  width: number,
                  height: number,
                ) => {
                  drawCalls.push({ height, width });
                },
              }
            : null,
      });
      Object.defineProperty(element, "toDataURL", {
        configurable: true,
        value: (mimeType: string) => dataUrlQueue.shift() ?? dataUrl(mimeType, 96),
      });
    }
    return element;
  }) as typeof document.createElement;

  globalThis.Image = class MockImage {
    height = imageSize.height;
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    width = imageSize.width;
    #src = "";

    get src(): string {
      return this.#src;
    }

    set src(value: string) {
      this.#src = value;
      queueMicrotask(() => {
        if (imageLoadMode === "error") {
          this.onerror?.();
        } else {
          this.onload?.();
        }
      });
    }
  } as unknown as typeof Image;

  globalThis.FileReader = class MockFileReader {
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;
    result: string | ArrayBuffer | null = null;

    readAsDataURL(readFile: File): void {
      this.result = `data:${readFile.type || "application/octet-stream"};base64,Zm9v`;
      queueMicrotask(() => {
        if (fileReaderMode === "error") {
          this.onerror?.();
        } else {
          this.onload?.();
        }
      });
    }
  } as unknown as typeof FileReader;
}

function restoreBrowserFileMocks(): void {
  document.createElement = originalCreateElement;
  URL.createObjectURL = originalCreateObjectUrl;
  URL.revokeObjectURL = originalRevokeObjectUrl;
  globalThis.FileReader = originalFileReader;
  globalThis.Image = originalImage;
}

function HookHarness() {
  activeResult = useAttachments();
  return (
    <div>
      <span data-testid="count">{activeResult.attachments.length}</span>
      <span data-testid="processing">{String(activeResult.isProcessing)}</span>
      <span data-testid="error">{activeResult.error ?? ""}</span>
      <span data-testid="names">
        {activeResult.attachments.map((attachment) => attachment.fileName).join("|")}
      </span>
    </div>
  );
}

function attachmentHook(): HookResult {
  if (!activeResult) throw new Error("Hook harness has not rendered.");
  return activeResult;
}

beforeEach(() => {
  activeResult = undefined;
  canvasSupported = true;
  dataUrlQueue = [];
  drawCalls.length = 0;
  fileReaderMode = "load";
  imageLoadMode = "load";
  imageSize = { height: 800, width: 1200 };
  objectUrls.length = 0;
  revokedUrls.length = 0;
  installBrowserFileMocks();
});

afterEach(() => {
  restoreBrowserFileMocks();
});

describe("compressImage", () => {
  test("resizes oversized images and reduces JPEG quality until payload fits", async () => {
    imageSize = { height: 1000, width: 4000 };
    dataUrlQueue = [
      dataUrl("image/jpeg", MAX_PAYLOAD_SIZE + 20),
      dataUrl("image/jpeg", MAX_PAYLOAD_SIZE + 10),
      smallJpeg(),
    ];

    const result = await compressImage(file("wide.jpg", "image/jpeg", "image"));

    expect(result.content).toBe(smallJpeg());
    expect(result.size).toBe(90);
    expect(drawCalls).toEqual([{ height: 500, width: 2000 }]);
    expect(objectUrls).toEqual(["blob:mock-0-wide.jpg"]);
    expect(revokedUrls).toEqual(["blob:mock-0-wide.jpg"]);
  });

  test("falls back to aggressive resize when encoded output is still too large", async () => {
    dataUrlQueue = [
      dataUrl("image/png", MAX_PAYLOAD_SIZE + 20),
      dataUrl("image/png", MAX_PAYLOAD_SIZE + 10),
      smallPng(),
    ];

    const result = await compressImage(file("image.png", "image/png", "image"));

    expect(result.content).toBe(smallPng());
    expect(drawCalls).toEqual([
      { height: 800, width: 1200 },
      { height: 720, width: 1080 },
      { height: 640, width: 960 },
    ]);
    expect(revokedUrls).toEqual(["blob:mock-0-image.png"]);
  });

  test("revokes object URLs when image loading fails", async () => {
    imageLoadMode = "error";

    await expect(compressImage(file("broken.jpg", "image/jpeg", "bad"))).rejects.toThrow(
      "Failed to load image",
    );
    expect(revokedUrls).toEqual(["blob:mock-0-broken.jpg"]);
  });

  test("rejects before object URL creation when canvas is unsupported", async () => {
    canvasSupported = false;

    await expect(compressImage(file("image.jpg", "image/jpeg", "image"))).rejects.toThrow(
      "Canvas not supported",
    );
    expect(objectUrls).toEqual([]);
    expect(revokedUrls).toEqual([]);
  });
});

describe("useAttachments", () => {
  test("adds image and file attachments, exposes payloads, and clears cleanup state", async () => {
    dataUrlQueue = [smallJpeg()];
    renderComponent(<HookHarness />);

    await attachmentHook().addFiles([
      file("photo.jpg", "image/jpeg", "image"),
      file("notes.txt", "text/plain", "hello"),
    ]);

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));
    expect(screen.getByTestId("names").textContent).toBe("photo.jpg|notes.txt");
    expect(attachmentHook().getPayloads()).toEqual([
      {
        content: smallJpeg(),
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        type: "image",
      },
      {
        content: "data:text/plain;charset=utf-8;base64,Zm9v",
        fileName: "notes.txt",
        mimeType: "text/plain;charset=utf-8",
        type: "file",
      },
    ]);

    const imagePreviewUrl = attachmentHook().attachments[0]?.previewUrl;
    expect(imagePreviewUrl).toBeTruthy();
    attachmentHook().clearAttachments();

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
    expect(revokedUrls).toContain(imagePreviewUrl!);
  });

  test("rejects oversized files and clears errors", async () => {
    renderComponent(<HookHarness />);

    await attachmentHook().addFiles([
      oversizedFile("huge.bin", "application/octet-stream", MAX_PAYLOAD_SIZE + 1),
      oversizedFile("huge.png", "image/png", MAX_FILE_SIZE + 1),
    ]);

    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe(
        'File "huge.png" is too large (max 10MB)',
      ),
    );
    expect(screen.getByTestId("count").textContent).toBe("0");

    attachmentHook().clearError();
    await waitFor(() => expect(screen.getByTestId("error").textContent).toBe(""));
  });

  test("surfaces FileReader errors without adding attachments", async () => {
    fileReaderMode = "error";
    renderComponent(<HookHarness />);

    await attachmentHook().addFiles([file("broken.txt", "text/plain", "bad")]);

    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe('Failed to read "broken.txt"'),
    );
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  test("handles pasted images and ignores non-image clipboard data", async () => {
    dataUrlQueue = [smallPng()];
    const preventDefaultCalls: string[] = [];
    const pastedImage = file("paste.png", "image/png", "image");
    renderComponent(<HookHarness />);

    const handledText = await attachmentHook().handlePaste({
      clipboardData: {
        items: [
          {
            getAsFile: () => file("plain.txt", "text/plain", "text"),
            type: "text/plain",
          },
        ],
      },
      preventDefault: () => preventDefaultCalls.push("text"),
    } as unknown as ClipboardEvent);

    expect(handledText).toBe(false);
    expect(preventDefaultCalls).toEqual([]);

    const handledImage = await attachmentHook().handlePaste({
      clipboardData: {
        items: [
          {
            getAsFile: () => pastedImage,
            type: "image/png",
          },
        ],
      },
      preventDefault: () => preventDefaultCalls.push("image"),
    } as unknown as ClipboardEvent);

    expect(handledImage).toBe(true);
    expect(preventDefaultCalls).toEqual(["image"]);
    await waitFor(() => expect(screen.getByTestId("names").textContent).toBe("paste.png"));
  });

  test("remove and unmount revoke preview URLs", async () => {
    dataUrlQueue = [smallJpeg(), smallPng()];
    const rendered = renderComponent(<HookHarness />);

    await attachmentHook().addFiles([
      file("first.jpg", "image/jpeg", "image"),
      file("second.png", "image/png", "image"),
    ]);
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));

    const first = attachmentHook().attachments[0]!;
    const second = attachmentHook().attachments[1]!;
    expect(first.previewUrl).toBeTruthy();
    expect(second.previewUrl).toBeTruthy();
    attachmentHook().removeAttachment(first.id);

    await waitFor(() => expect(screen.getByTestId("names").textContent).toBe("second.png"));
    expect(revokedUrls).toContain(first.previewUrl!);

    rendered.unmount();
    expect(revokedUrls).toContain(second.previewUrl!);
  });
});
