import { describe, expect, test } from "bun:test";
import {
  deriveChannelStatus,
  getChannelLastActivity,
  transformChannelsResponse,
  type ChannelsStatusResponse,
} from "../../../src/types/channels";
import {
  formatDeviceId,
  getDeviceRole,
  getPlatformIcon,
  getRoleBadgeVariant,
  isNodeDevice,
  isOperatorDevice,
  type PairedDevice,
} from "../../../src/types/devices";
import {
  normalizeWorkspaceFilename,
  WORKSPACE_FILE_META,
  WORKSPACE_FILES_OPTIONAL,
} from "../../../src/types/workspace";

describe("operational type helpers", () => {
  test("device helpers derive role, platform, badge, and stable display ids", () => {
    const operator = device({ role: "operator", platform: "web" });
    const node = device({ roles: ["node"], platform: "linux" });
    const unknown = device({ deviceId: "device-id-that-is-longer-than-display", platform: "beos" });

    expect(getDeviceRole(operator)).toBe("operator");
    expect(getDeviceRole(node)).toBe("node");
    expect(isOperatorDevice(operator)).toBe(true);
    expect(isNodeDevice(node)).toBe(true);
    expect(getRoleBadgeVariant("operator")).toBe("info");
    expect(getRoleBadgeVariant("node")).toBe("success");
    expect(getRoleBadgeVariant("custom")).toBe("default");
    expect(getPlatformIcon(operator.platform)).toBe("🌐");
    expect(getPlatformIcon(node.platform)).toBe("🐧");
    expect(getPlatformIcon(unknown.platform)).toBe("📱");
    expect(formatDeviceId(unknown.deviceId)).toBe("device-id-...isplay");
  });

  test("channel response helpers preserve order, fallbacks, statuses, and activity timestamps", () => {
    const response: ChannelsStatusResponse = {
      ts: 1,
      channelOrder: ["slack", "discord", "sms", "email", "empty"],
      channelLabels: { slack: "Slack", discord: "Discord" },
      channelDetailLabels: { slack: "Slack workspace" },
      channelSystemImages: { slack: "bubble" },
      channelMeta: [],
      channels: { slack: { configured: true } },
      channelAccounts: {
        slack: [{ accountId: "s1", connected: true, lastInboundAt: 10, lastOutboundAt: 20 }],
        discord: [{ accountId: "d1", lastError: "bad token" }],
        sms: [{ accountId: "m1", enabled: false, configured: true }],
        email: [{ accountId: "e1", configured: true, connected: false }],
      },
      channelDefaultAccountId: { slack: "s1" },
    };

    const transformed = transformChannelsResponse(response);

    expect(transformed.map((channel) => [channel.id, channel.label, channel.status])).toEqual([
      ["slack", "Slack", "connected"],
      ["discord", "Discord", "error"],
      ["sms", "sms", "disabled"],
      ["email", "email", "configured"],
      ["empty", "empty", "not-configured"],
    ]);
    expect(transformed[0]).toMatchObject({
      defaultAccountId: "s1",
      detailLabel: "Slack workspace",
      systemImage: "bubble",
      summary: { configured: true },
    });
    expect(transformed[4].defaultAccountId).toBe("default");
    expect(getChannelLastActivity(transformed[0])).toBe(20);
    expect(deriveChannelStatus([])).toBe("not-configured");
  });

  test("workspace filenames normalize only MEMORY.md while preserving metadata contracts", () => {
    expect(normalizeWorkspaceFilename("memory.md")).toBe("MEMORY.md");
    expect(normalizeWorkspaceFilename("Memory.md")).toBe("MEMORY.md");
    expect(normalizeWorkspaceFilename("AGENTS.md")).toBe("AGENTS.md");
    expect(WORKSPACE_FILE_META[normalizeWorkspaceFilename("memory.md")].description).toBe(
      "agents.files.meta.memory",
    );
    expect(WORKSPACE_FILES_OPTIONAL).toContain("BOOTSTRAP.md");
  });
});

function device(overrides: Partial<PairedDevice> = {}): PairedDevice {
  return {
    approvedAtMs: 2,
    createdAtMs: 1,
    deviceId: "device-1",
    publicKey: "pub",
    ...overrides,
  };
}
