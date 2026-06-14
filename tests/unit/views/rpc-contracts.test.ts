import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

type SendCall = {
  method: string;
  payloadKeys: string[];
};

describe("direct RPC contracts", () => {
  test("ChannelsView logs out with channel and accountId", () => {
    const calls = sendCalls("src/views/ChannelsView.tsx");

    expect(calls).toContainEqual({
      method: "channels.status",
      payloadKeys: ["probe", "timeoutMs"],
    });
    expect(calls).toContainEqual({
      method: "common.logout",
      payloadKeys: ["accountId", "channel"],
    });
  });

  test("DevicesView uses exact pair and token RPC payloads", () => {
    expect(sendCalls("src/views/DevicesView.tsx")).toEqual(
      expect.arrayContaining([
        {
          method: "device.pair.list",
          payloadKeys: [],
        },
        {
          method: "device.pair.approve",
          payloadKeys: ["requestId"],
        },
        {
          method: "device.pair.reject",
          payloadKeys: ["requestId"],
        },
        {
          method: "device.token.rotate",
          payloadKeys: ["deviceId", "role"],
        },
        {
          method: "device.token.revoke",
          payloadKeys: ["deviceId", "role"],
        },
        {
          method: "device.pair.remove",
          payloadKeys: ["deviceId"],
        },
      ]),
    );
  });

  test("WorkspaceEditorView uses exact file get and set RPC payloads", () => {
    expect(sendCalls("src/views/WorkspaceEditorView.tsx")).toEqual(
      expect.arrayContaining([
        {
          method: "agents.files.get",
          payloadKeys: ["agentId", "name"],
        },
        {
          method: "agents.files.set",
          payloadKeys: ["agentId", "content", "name"],
        },
      ]),
    );
  });

  test("agent tool and skill saves route through the config.apply helper", () => {
    expect(readFileSync("src/views/agents/agents-tools-state.ts", "utf8")).toContain(
      "applyGatewayConfigWithSend",
    );
    expect(readFileSync("src/views/agents/agents-skills-state.ts", "utf8")).toContain(
      "applyGatewayConfig(config)",
    );
  });
});

function sendCalls(file: string): SendCall[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const calls: SendCall[] = [];

  visit(source, (node) => {
    if (!ts.isCallExpression(node)) return;
    if (!ts.isIdentifier(node.expression) || node.expression.text !== "send") return;

    const [methodArg, payloadArg] = node.arguments;
    if (!methodArg || !ts.isStringLiteral(methodArg)) return;

    calls.push({
      method: methodArg.text,
      payloadKeys: payloadKeys(payloadArg),
    });
  });

  return calls;
}

function payloadKeys(node: ts.Expression | undefined): string[] {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];

  return node.properties
    .flatMap((property) => {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
        return [];
      }
      const name = property.name;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return [name.text];
      }
      return [];
    })
    .sort();
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}
