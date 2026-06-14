import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { GatewayRpcMap } from "../../../src/types/gateway-rpc";

const expectedMau28GatewayRpcMethods = [
  "agent.wait",
  "chat.startup",
  "chat.metadata",
  "sessions.compact",
  "talk.client.create",
  "talk.client.toolCall",
  "talk.client.steer",
  "talk.session.create",
  "talk.catalog",
  "talk.config",
  "talk.speak",
  "talk.mode",
  "plugin.approval.list",
  "plugin.approval.request",
  "plugin.approval.waitDecision",
  "plugin.approval.resolve",
  "wiki.importRuns",
  "wiki.status",
  "wiki.importInsights",
  "wiki.palace",
  "wiki.init",
  "wiki.doctor",
  "wiki.compile",
  "wiki.ingest",
  "wiki.lint",
  "wiki.bridge.import",
  "wiki.unsafeLocal.import",
  "wiki.search",
  "wiki.apply",
  "wiki.get",
  "wiki.obsidian.status",
  "wiki.obsidian.search",
  "wiki.obsidian.open",
  "wiki.obsidian.command",
  "wiki.obsidian.daily",
  "doctor.memory.dreamDiary",
  "doctor.memory.backfillDreamDiary",
  "doctor.memory.resetDreamDiary",
  "doctor.memory.resetGroundedShortTerm",
  "doctor.memory.repairDreamingArtifacts",
  "doctor.memory.dedupeDreamDiary",
] as const satisfies readonly (keyof GatewayRpcMap)[];

describe("GatewayRpcMap inventory", () => {
  test("covers MAU-28 official gateway RPC methods", () => {
    const gatewayRpcMethods = gatewayRpcMapMethods();

    expect(
      expectedMau28GatewayRpcMethods.filter((method) => !gatewayRpcMethods.has(method)),
    ).toEqual([]);
  });
});

function gatewayRpcMapMethods(): Set<string> {
  const source = ts.createSourceFile(
    "src/types/gateway-rpc.ts",
    readFileSync("src/types/gateway-rpc.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const methods = new Set<string>();

  source.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node) || node.name.text !== "GatewayRpcMap") return;

    for (const member of node.members) {
      if (!ts.isPropertySignature(member)) continue;
      const name = member.name;
      if (ts.isStringLiteral(name) || ts.isIdentifier(name)) {
        methods.add(name.text);
      }
    }
  });

  return methods;
}
