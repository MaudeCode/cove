import { afterAll, beforeEach, describe, expect, test } from "bun:test";

const originalBroadcastChannel = globalThis.BroadcastChannel;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];

  name: string;
  posted: unknown[] = [];
  #listeners: Array<(event: MessageEvent) => void> = [];

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    if (type === "message") {
      this.#listeners.push(listener as (event: MessageEvent) => void);
    }
  }

  postMessage(data: unknown): void {
    this.posted.push(data);
  }

  emit(data: unknown): void {
    for (const listener of this.#listeners) {
      listener({ data } as MessageEvent);
    }
  }

  close(): void {}
}

const createdBlobs: Blob[] = [];
const revokedUrls: string[] = [];

Object.defineProperty(globalThis, "BroadcastChannel", {
  configurable: true,
  value: MockBroadcastChannel,
});
URL.createObjectURL = ((blob: Blob) => {
  createdBlobs.push(blob);
  return `blob:receiver-${createdBlobs.length}`;
}) as typeof URL.createObjectURL;
URL.revokeObjectURL = ((url: string) => {
  revokedUrls.push(url);
}) as typeof URL.revokeObjectURL;

const { announceStatus, canvasBlobUrl, canvasContent, canvasContentType, canvasUrl } =
  await import("../../../src/lib/canvas-receiver");

const channel = MockBroadcastChannel.instances[0]!;

beforeEach(() => {
  channel.posted = [];
  createdBlobs.length = 0;
  revokedUrls.length = 0;
  canvasBlobUrl.value = null;
  canvasContent.value = null;
  canvasContentType.value = null;
  canvasUrl.value = null;
});

afterAll(() => {
  Object.defineProperty(globalThis, "BroadcastChannel", {
    configurable: true,
    value: originalBroadcastChannel,
  });
  URL.createObjectURL = originalCreateObjectUrl;
  URL.revokeObjectURL = originalRevokeObjectUrl;
});

describe("canvas receiver", () => {
  test("announces standalone canvas status over BroadcastChannel", () => {
    expect(channel.name).toBe("cove:canvas");

    announceStatus(true);
    announceStatus(false);

    expect(channel.posted).toEqual([
      { type: "canvas-standalone-status", open: true },
      { type: "canvas-standalone-status", open: false },
    ]);
  });

  test("receives URL messages and clears prior blob state", () => {
    channel.emit({ type: "canvas-content", base64: "aGk=", mimeType: "image/png" });
    expect(canvasBlobUrl.value).toBe("blob:receiver-1");

    channel.emit({ type: "canvas-content", url: "https://example.test/canvas.png" });

    expect(canvasUrl.value).toBe("https://example.test/canvas.png");
    expect(canvasBlobUrl.value).toBeNull();
    expect(canvasContentType.value).toBeNull();
    expect(revokedUrls).toEqual(["blob:receiver-1"]);
  });

  test("receives base64 messages, preserves data URL MIME type, and revokes replaced blobs", async () => {
    channel.emit({ type: "canvas-content", base64: "aGk=", mimeType: "image/png" });
    channel.emit({
      type: "canvas-content",
      base64: "data:image/jpeg;base64,Ynll",
      mimeType: "image/png",
    });

    expect(canvasUrl.value).toBeNull();
    expect(canvasBlobUrl.value).toBe("blob:receiver-2");
    expect(canvasContentType.value).toBe("image/jpeg");
    expect(revokedUrls).toEqual(["blob:receiver-1"]);
    expect(createdBlobs.map((blob) => blob.type)).toEqual(["image/png", "image/jpeg"]);
    expect(await createdBlobs[1]?.text()).toBe("bye");
  });

  test("ignores invalid base64 without revoking the current blob", () => {
    channel.emit({ type: "canvas-content", base64: "aGk=", mimeType: "image/png" });

    channel.emit({ type: "canvas-content", base64: "%%%", mimeType: "image/png" });

    expect(canvasBlobUrl.value).toBe("blob:receiver-1");
    expect(canvasContentType.value).toBe("image/png");
    expect(createdBlobs).toHaveLength(1);
    expect(revokedUrls).toEqual([]);
  });
});
