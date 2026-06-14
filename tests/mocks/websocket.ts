type Listener = (event: Event) => void;

type TestGlobal = typeof globalThis & {
  __APP_VERSION__?: string;
};

type SendListener = (data: string, socket: MockWebSocket) => void;

export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly CONNECTING = MockWebSocket.CONNECTING;
  readonly OPEN = MockWebSocket.OPEN;
  readonly CLOSING = MockWebSocket.CLOSING;
  readonly CLOSED = MockWebSocket.CLOSED;
  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  protocol = "";
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  url: string;

  private listeners = new Map<string, Set<Listener>>();
  private sendListeners = new Set<SendListener>();

  constructor(url: string | URL) {
    this.url = String(url);
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    return true;
  }

  close(code = 1000, reason = ""): void {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.emitClose(code, reason, true);
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    const event = new Event("open");
    this.onopen?.(event);
    this.dispatchEvent(event);
  }

  receive(frame: unknown): void {
    const data = typeof frame === "string" ? frame : JSON.stringify(frame);
    const event = { type: "message", data } as MessageEvent;
    this.onmessage?.(event);
    this.dispatchEvent(event as Event);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("Cannot send while WebSocket is not open");
    }
    const message = String(data);
    this.sent.push(message);
    for (const listener of this.sendListeners) {
      listener(message, this);
    }
  }

  sentJson(): unknown[] {
    return this.sent.map((message) => JSON.parse(message));
  }

  onSend(listener: SendListener): () => void {
    this.sendListeners.add(listener);
    return () => this.sendListeners.delete(listener);
  }

  serverClose(code = 1006, reason = "", wasClean = false): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emitClose(code, reason, wasClean);
  }

  serverError(): void {
    const event = new Event("error");
    this.onerror?.(event);
    this.dispatchEvent(event);
  }

  private emitClose(code: number, reason: string, wasClean: boolean): void {
    const event = {
      type: "close",
      code,
      reason,
      wasClean,
    } as CloseEvent;
    this.onclose?.(event);
    this.dispatchEvent(event as Event);
  }
}

export function installMockWebSocket(): {
  instances: MockWebSocket[];
  latest: () => MockWebSocket;
  uninstall: () => void;
} {
  const originalWebSocket = globalThis.WebSocket;
  const testGlobal = globalThis as TestGlobal;
  const originalAppVersion = testGlobal.__APP_VERSION__;

  MockWebSocket.instances = [];
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  testGlobal.__APP_VERSION__ = testGlobal.__APP_VERSION__ ?? "test";

  return {
    instances: MockWebSocket.instances,
    latest() {
      const socket = MockWebSocket.instances.at(-1);
      if (!socket) throw new Error("No MockWebSocket instances were created");
      return socket;
    },
    uninstall() {
      globalThis.WebSocket = originalWebSocket;
      if (originalAppVersion === undefined) {
        delete testGlobal.__APP_VERSION__;
      } else {
        testGlobal.__APP_VERSION__ = originalAppVersion;
      }
      MockWebSocket.instances = [];
    },
  };
}
