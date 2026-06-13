import { mock } from "bun:test";

export type GatewaySendCall = [method: string, params: unknown];
type GatewaySendResponse =
  | unknown
  | ((method: string, params: unknown) => unknown | Promise<unknown>);

export interface GatewaySendRecorder {
  calls: GatewaySendCall[];
  clear: () => void;
  send: ReturnType<typeof mock>;
  setResponse: (method: string, response: GatewaySendResponse) => void;
}

export function createGatewaySendRecorder(
  responses: Record<string, GatewaySendResponse> = {},
): GatewaySendRecorder {
  const calls: GatewaySendCall[] = [];
  const methodResponses = new Map(Object.entries(responses));

  const send = mock(async (method: string, params?: unknown) => {
    calls.push([method, params]);

    if (!methodResponses.has(method)) {
      throw new Error(`Unexpected gateway method: ${method}`);
    }

    const response = methodResponses.get(method);
    if (typeof response === "function") {
      return response(method, params);
    }

    return response;
  });

  return {
    calls,
    clear() {
      calls.length = 0;
      send.mockClear();
    },
    send,
    setResponse(method: string, response: GatewaySendResponse) {
      methodResponses.set(method, response);
    },
  };
}
