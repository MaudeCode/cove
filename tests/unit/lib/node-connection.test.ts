import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { installDeterministicCrypto, type DeterministicCryptoFixture } from "../../helpers/crypto";
import { installStorageMocks } from "../../helpers/storage";
import { installFakeTimers, type FakeTimers } from "../../helpers/timers";
import { connectChallengeFrame, eventFrame, responseFrame } from "../../fixtures/gateway";
import { installMockWebSocket, MockWebSocket } from "../../mocks/websocket";
import type { GatewayRequest } from "../../../src/types/gateway";

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
  return `blob:node-${createdBlobs.length}`;
}) as typeof URL.createObjectURL;
URL.revokeObjectURL = ((url: string) => {
  revokedUrls.push(url);
}) as typeof URL.revokeObjectURL;

const restoreStorage = installStorageMocks();
const originalDateNow = Date.now;
const fixedNow = 1_700_000_000_000;

Date.now = () => fixedNow;

const { gatewayUrl } = await import("../../../src/lib/gateway");
const { clearAuth, saveAuth } = await import("../../../src/lib/storage");
const {
  canvasBlobUrl,
  canvasContentType,
  canvasUrl,
  canvasVisible,
  nodeConnected,
  nodeId,
  nodePairingStatus,
  pendingCanvasEval,
  pendingCanvasSnapshot,
  refreshNodeRegistration,
  startNodeConnection,
  stopNodeConnection,
} = await import("../../../src/lib/node-connection");
const { clearDeviceIdentityCache } = await import("../../../src/lib/device-identity");

const canvasChannel = MockBroadcastChannel.instances[0]!;
let sockets: ReturnType<typeof installMockWebSocket>;
let timers: FakeTimers;
let cryptoFixture: DeterministicCryptoFixture;

afterAll(() => {
  Date.now = originalDateNow;
  Object.defineProperty(globalThis, "BroadcastChannel", {
    configurable: true,
    value: originalBroadcastChannel,
  });
  URL.createObjectURL = originalCreateObjectUrl;
  URL.revokeObjectURL = originalRevokeObjectUrl;
  restoreStorage();
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearAuth();
  cryptoFixture = installDeterministicCrypto();
  clearDeviceIdentityCache();
  gatewayUrl.value = "wss://gateway.example.test";
  canvasBlobUrl.value = null;
  canvasContentType.value = null;
  canvasUrl.value = null;
  canvasVisible.value = false;
  nodeConnected.value = false;
  nodeId.value = null;
  nodePairingStatus.value = "unpaired";
  pendingCanvasEval.value = null;
  pendingCanvasSnapshot.value = null;
  timers = installFakeTimers();
  sockets = installMockWebSocket();
  canvasChannel.posted = [];
  createdBlobs.length = 0;
  revokedUrls.length = 0;
  stopNodeConnection();
});

afterEach(() => {
  stopNodeConnection();
  pendingCanvasEval.value = null;
  pendingCanvasSnapshot.value = null;
  timers.uninstall();
  sockets.uninstall();
  cryptoFixture.uninstall();
});

describe("node connection", () => {
  test("sends signed node role connect params with commands and challenge nonce", async () => {
    saveAuth({
      url: "wss://gateway.example.test",
      authMode: "token",
      rememberMe: true,
      credential: "node-token",
    });
    const expectedDeviceId = cryptoFixture.deviceIdForSeed(1);
    const expectedPayload = `v2|${expectedDeviceId}|node-host|node|node||${fixedNow}|node-token|node-nonce`;

    startNodeConnection();
    const socket = sockets.latest();
    socket.open();
    expect(socket.sentJson()).toEqual([]);

    socket.receive(connectChallengeFrame({ nonce: "node-nonce" }));
    await flushPromises();

    expect(socket.sentJson()).toEqual([
      {
        type: "req",
        id: expect.stringMatching(/^\d+$/),
        method: "connect",
        params: {
          minProtocol: 4,
          maxProtocol: 4,
          role: "node",
          client: {
            id: "node-host",
            displayName: `Cove Canvas (${expectedDeviceId.slice(0, 8)})`,
            mode: "node",
            version: "1.0.0",
            platform: expect.any(String),
          },
          device: {
            id: expectedDeviceId,
            publicKey: cryptoFixture.publicKeyBase64UrlForSeed(1),
            signature: cryptoFixture.signatureForPayload(1, expectedPayload),
            signedAt: fixedNow,
            nonce: "node-nonce",
          },
          caps: ["canvas"],
          commands: [
            "canvas.present",
            "canvas.hide",
            "canvas.navigate",
            "canvas.eval",
            "canvas.snapshot",
          ],
          auth: { token: "node-token" },
        },
      },
    ]);
    expect(cryptoFixture.calls.signPayloads).toEqual([expectedPayload]);
  });

  test("does not sign password credentials as token material", async () => {
    saveAuth({
      url: "wss://gateway.example.test",
      authMode: "password",
      rememberMe: false,
      credential: "node-password",
    });
    const expectedDeviceId = cryptoFixture.deviceIdForSeed(1);
    const expectedPayload = `v2|${expectedDeviceId}|node-host|node|node||${fixedNow}||node-nonce`;

    startNodeConnection();
    const socket = sockets.latest();
    socket.open();
    socket.receive(connectChallengeFrame({ nonce: "node-nonce" }));
    await flushPromises();

    expect(socket.sentJson()).toEqual([
      expect.objectContaining({
        method: "connect",
        params: expect.objectContaining({
          auth: { password: "node-password" },
          device: expect.objectContaining({
            signature: cryptoFixture.signatureForPayload(1, expectedPayload),
          }),
        }),
      }),
    ]);
    expect(cryptoFixture.calls.signPayloads).toEqual([expectedPayload]);
  });

  test("sends node.invoke.result for successful and failed canvas commands", async () => {
    const { socket, connectRequest } = await connectNode();
    socket.receive(responseFrame(connectRequest.id, { type: "hello-ok" }));
    await flushPromises();

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "invoke-hide",
        command: "canvas.hide",
        params: {},
      }),
    );
    await flushPromises();

    expect(lastSentRequest(socket)).toEqual({
      type: "req",
      id: expect.stringMatching(/^\d+$/),
      method: "node.invoke.result",
      params: {
        id: "invoke-hide",
        nodeId: cryptoFixture.deviceIdForSeed(1),
        ok: true,
        payload: { ok: true },
      },
    });
    expect(canvasVisible.value).toBe(false);

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "invoke-unknown",
        command: "canvas.unknown",
        params: {},
      }),
    );
    await flushPromises();

    expect(lastSentRequest(socket)).toEqual({
      type: "req",
      id: expect.stringMatching(/^\d+$/),
      method: "node.invoke.result",
      params: {
        id: "invoke-unknown",
        nodeId: cryptoFixture.deviceIdForSeed(1),
        ok: false,
        error: {
          code: "UNKNOWN_COMMAND",
          message: "Unknown command: canvas.unknown",
        },
      },
    });
  });

  test("rejects invalid canvas content params", async () => {
    const { socket, connectRequest } = await connectNode();
    socket.receive(responseFrame(connectRequest.id, { type: "hello-ok" }));
    await flushPromises();

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "invoke-present",
        command: "canvas.present",
        params: {},
      }),
    );
    await flushPromises();

    expect(lastSentRequest(socket)).toEqual({
      type: "req",
      id: expect.stringMatching(/^\d+$/),
      method: "node.invoke.result",
      params: {
        id: "invoke-present",
        nodeId: cryptoFixture.deviceIdForSeed(1),
        ok: false,
        error: {
          code: "INVALID_PARAMS",
          message: "url or imageBase64 parameter required",
        },
      },
    });
    expect(canvasVisible.value).toBe(false);
  });

  test("prefers data URL MIME for direct canvas content", async () => {
    const { socket, connectRequest } = await connectNode();
    socket.receive(responseFrame(connectRequest.id, { type: "hello-ok" }));
    await flushPromises();

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "invoke-present",
        command: "canvas.present",
        params: {
          imageBase64: "data:image/jpeg;base64,aGk=",
          imageMimeType: "image/png",
        },
      }),
    );
    await flushPromises();

    expect(canvasBlobUrl.value).toBe("blob:node-1");
    expect(canvasContentType.value).toBe("image/jpeg");
    expect(canvasUrl.value).toBeNull();
    expect(canvasVisible.value).toBe(true);
    expect(createdBlobs[0]?.type).toBe("image/jpeg");
    expect(await createdBlobs[0]?.text()).toBe("hi");
    expect(canvasChannel.posted.at(-1)).toEqual({
      type: "canvas-content",
      url: null,
      base64: "data:image/jpeg;base64,aGk=",
      mimeType: "image/jpeg",
    });
  });

  test("receives cross-tab canvas content with MIME detection and blob cleanup", async () => {
    canvasBlobUrl.value = "blob:old";
    canvasContentType.value = "image/png";

    canvasChannel.emit({
      type: "canvas-content",
      base64: "data:image/jpeg;base64,aGk=",
      mimeType: "image/png",
    });

    expect(canvasBlobUrl.value).toBe("blob:node-1");
    expect(canvasContentType.value).toBe("image/jpeg");
    expect(canvasUrl.value).toBeNull();
    expect(revokedUrls).toEqual(["blob:old"]);
    expect(createdBlobs[0]?.type).toBe("image/jpeg");

    canvasChannel.emit({ type: "canvas-content", url: "https://example.test/canvas.png" });

    expect(canvasUrl.value).toBe("https://example.test/canvas.png");
    expect(canvasBlobUrl.value).toBeNull();
    expect(canvasContentType.value).toBeNull();
    expect(revokedUrls).toEqual(["blob:old", "blob:node-1"]);
  });

  test("sends eval invoke results for resolved and rejected canvas eval requests", async () => {
    const { socket, connectRequest } = await connectNode();
    socket.receive(responseFrame(connectRequest.id, { type: "hello-ok" }));
    await flushPromises();

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "eval-ok",
        command: "canvas.eval",
        params: { javaScript: "window.answer" },
      }),
    );
    await flushPromises();

    expect(pendingCanvasEval.value?.js).toBe("window.answer");
    pendingCanvasEval.value?.resolve("forty-two");
    await flushPromises();

    expect(lastSentRequest(socket)).toEqual({
      type: "req",
      id: expect.stringMatching(/^\d+$/),
      method: "node.invoke.result",
      params: {
        id: "eval-ok",
        nodeId: cryptoFixture.deviceIdForSeed(1),
        ok: true,
        payload: { result: "forty-two" },
      },
    });
    pendingCanvasEval.value = null;

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "eval-error",
        command: "canvas.eval",
        params: { javaScript: "throw new Error('boom')" },
      }),
    );
    await flushPromises();

    const evalErrorRequest = pendingCanvasEval.value as unknown as {
      reject: (error: string) => void;
    };
    evalErrorRequest.reject("boom");
    await flushPromises();

    expect(lastSentRequest(socket)).toEqual({
      type: "req",
      id: expect.stringMatching(/^\d+$/),
      method: "node.invoke.result",
      params: {
        id: "eval-error",
        nodeId: cryptoFixture.deviceIdForSeed(1),
        ok: false,
        error: {
          code: "EVAL_ERROR",
          message: "Error: boom",
        },
      },
    });
    pendingCanvasEval.value = null;
  });

  test("sends snapshot invoke results with requested and default options", async () => {
    const { socket, connectRequest } = await connectNode();
    socket.receive(responseFrame(connectRequest.id, { type: "hello-ok" }));
    await flushPromises();

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "snapshot-ok",
        command: "canvas.snapshot",
        params: { maxWidth: 320, outputFormat: "png", quality: 0.6 },
      }),
    );
    await flushPromises();

    expect(pendingCanvasSnapshot.value).toMatchObject({
      maxWidth: 320,
      outputFormat: "png",
      quality: 0.6,
    });
    pendingCanvasSnapshot.value?.resolve("data:image/png;base64,snapshot");
    await flushPromises();

    expect(lastSentRequest(socket)).toEqual({
      type: "req",
      id: expect.stringMatching(/^\d+$/),
      method: "node.invoke.result",
      params: {
        id: "snapshot-ok",
        nodeId: cryptoFixture.deviceIdForSeed(1),
        ok: true,
        payload: { dataUrl: "data:image/png;base64,snapshot" },
      },
    });
    pendingCanvasSnapshot.value = null;

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "snapshot-error",
        command: "canvas.snapshot",
        params: {},
      }),
    );
    await flushPromises();

    expect(pendingCanvasSnapshot.value).toMatchObject({
      maxWidth: 800,
      outputFormat: "jpeg",
      quality: 0.8,
    });
    const snapshotErrorRequest = pendingCanvasSnapshot.value as unknown as {
      reject: (error: string) => void;
    };
    snapshotErrorRequest.reject("no canvas");
    await flushPromises();

    expect(lastSentRequest(socket)).toEqual({
      type: "req",
      id: expect.stringMatching(/^\d+$/),
      method: "node.invoke.result",
      params: {
        id: "snapshot-error",
        nodeId: cryptoFixture.deviceIdForSeed(1),
        ok: false,
        error: {
          code: "SNAPSHOT_ERROR",
          message: "Error: no canvas",
        },
      },
    });
    pendingCanvasSnapshot.value = null;
  });

  test("eval and snapshot superseded requests return errors without clearing newer requests", async () => {
    const { socket, connectRequest } = await connectNode();
    socket.receive(responseFrame(connectRequest.id, { type: "hello-ok" }));
    await flushPromises();

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "eval-1",
        command: "canvas.eval",
        params: { javaScript: "same-js" },
      }),
    );
    await flushPromises();
    timers.advanceBy(1);
    socket.receive(
      eventFrame("node.invoke.request", {
        id: "eval-2",
        command: "canvas.eval",
        params: { javaScript: "same-js" },
      }),
    );
    await flushPromises();

    timers.advanceBy(9_999);
    expect(pendingCanvasEval.value?.js).toBe("same-js");
    expect(hasInvokeResult(socket, "eval-1", false)).toBe(true);
    pendingCanvasEval.value?.resolve("ok");
    await flushPromises();

    socket.receive(
      eventFrame("node.invoke.request", {
        id: "snapshot-1",
        command: "canvas.snapshot",
        params: {},
      }),
    );
    await flushPromises();
    timers.advanceBy(1);
    socket.receive(
      eventFrame("node.invoke.request", {
        id: "snapshot-2",
        command: "canvas.snapshot",
        params: {},
      }),
    );
    await flushPromises();

    timers.advanceBy(9_999);
    expect(pendingCanvasSnapshot.value?.maxWidth).toBe(800);
    expect(hasInvokeResult(socket, "snapshot-1", false)).toBe(true);
    pendingCanvasSnapshot.value?.resolve("data:image/png;base64,test");
    await flushPromises();
  });

  test("stopNodeConnection cancels a pending refresh reconnect", () => {
    startNodeConnection();
    expect(sockets.instances).toHaveLength(1);

    refreshNodeRegistration();
    stopNodeConnection();
    timers.advanceBy(600);

    expect(sockets.instances).toHaveLength(1);
    expect(sockets.instances[0]?.readyState).toBe(MockWebSocket.CLOSED);
  });

  test("refreshNodeRegistration replaces a pending close reconnect", () => {
    startNodeConnection();
    const socket = sockets.latest();
    expect(sockets.instances).toHaveLength(1);

    socket.serverClose();
    refreshNodeRegistration();
    timers.advanceBy(600);
    timers.advanceBy(5_000);

    expect(sockets.instances).toHaveLength(2);
    expect(sockets.instances[0]?.readyState).toBe(MockWebSocket.CLOSED);
  });

  test("refreshNodeRegistration rejects pending connect requests before stale responses arrive", async () => {
    startNodeConnection();
    const socket = sockets.latest();
    socket.open();
    socket.receive(connectChallengeFrame({ nonce: "node-nonce" }));
    await flushPromises();
    const connectRequest = socket.sentJson()[0] as GatewayRequest;

    refreshNodeRegistration();
    socket.receive(responseFrame(connectRequest.id, { type: "hello-ok" }));
    await flushPromises();

    expect(nodeConnected.value).toBe(false);
  });

  test("refreshNodeRegistration fences in-flight connect signing continuations", async () => {
    startNodeConnection();
    const staleSocket = sockets.latest();
    staleSocket.open();
    staleSocket.receive(connectChallengeFrame({ nonce: "stale-nonce" }));

    refreshNodeRegistration();
    timers.advanceBy(600);
    const freshSocket = sockets.latest();
    freshSocket.open();
    freshSocket.receive(connectChallengeFrame({ nonce: "fresh-nonce" }));
    await flushPromises();

    expect(staleSocket.sentJson()).toEqual([]);
    expect((freshSocket.sentJson()[0] as GatewayRequest).params).toEqual(
      expect.objectContaining({
        device: expect.objectContaining({ nonce: "fresh-nonce" }),
      }),
    );
  });
});

async function connectNode(): Promise<{ connectRequest: GatewayRequest; socket: MockWebSocket }> {
  saveAuth({
    url: "wss://gateway.example.test",
    authMode: "token",
    rememberMe: true,
    credential: "node-token",
  });
  startNodeConnection();
  const socket = sockets.latest();
  socket.open();
  socket.receive(connectChallengeFrame({ nonce: "node-nonce" }));
  await flushPromises();
  return {
    connectRequest: socket.sentJson()[0] as GatewayRequest,
    socket,
  };
}

function lastSentRequest(socket: MockWebSocket): GatewayRequest {
  return socket.sentJson().at(-1) as GatewayRequest;
}

function sentRequests(socket: MockWebSocket): GatewayRequest[] {
  return socket.sentJson() as GatewayRequest[];
}

function hasInvokeResult(socket: MockWebSocket, id: string, ok: boolean): boolean {
  return sentRequests(socket).some((request) => {
    const params = request.params as { id?: string; ok?: boolean } | undefined;
    return request.method === "node.invoke.result" && params?.id === id && params?.ok === ok;
  });
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    await Promise.resolve();
  }
}
