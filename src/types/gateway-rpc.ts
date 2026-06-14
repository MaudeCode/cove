import type { AttachmentPayload } from "@/types/attachments";
import type { AgentsListResponse } from "@/types/agents";
import type { ChatHistoryResult, ChatSendResult } from "@/types/chat";
import type { ChannelsStatusResponse } from "@/types/channels";
import type { ConfigGetResponse, ConfigSaveResponse, ConfigSchemaResponse } from "@/types/config";
import type {
  CronDeliveryStatus,
  CronJob,
  CronListResult,
  CronRunsResult,
  CronStatusResult,
} from "@/types/cron";
import type { DeviceListResponse } from "@/types/devices";
import type { ExecApprovalDecision } from "@/types/exec";
import type { HelloPayload } from "@/types/gateway";
import type { ModelsListResult } from "@/types/models";
import type { SystemPresence } from "@/types/presence";
import type {
  CostUsageSummary,
  HealthSummary,
  SessionLogsResult,
  SessionsUsageResult,
  SessionUsageTimeSeries,
} from "@/types/server-stats";
import type { SessionsListParams, SessionsListResult } from "@/types/sessions";
import type { SkillStatusReport } from "@/types/skills";
import type { UsageSummary } from "@/types/usage";
import type { WorkspaceFileResult, WorkspaceFilesResult } from "@/types/workspace";

export type EmptyParams = Record<string, never>;

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName: string;
    version: string;
    platform: string;
    mode: string;
  };
  caps?: string[];
  role: string;
  scopes: string[];
  auth: {
    token?: string;
    password?: string;
  };
}

export interface ChatSendParams {
  sessionKey: string;
  sessionId?: string;
  message: string;
  thinking?: string;
  fastMode?: boolean;
  deliver?: boolean;
  originatingChannel?: string;
  originatingTo?: string;
  originatingAccountId?: string;
  originatingThreadId?: string;
  timeoutMs?: number;
  idempotencyKey?: string;
  attachments?: AttachmentPayload[];
}

export interface SessionsPatchParams {
  key: string;
  label?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  traceLevel?: string | null;
  reasoningLevel?: string | null;
  responseUsage?: "off" | "tokens" | "full" | "on" | null;
  elevatedLevel?: string | null;
  execHost?: string | null;
  execSecurity?: string | null;
  execAsk?: string | null;
  execNode?: string | null;
  spawnedBy?: string | null;
  spawnedWorkspaceDir?: string | null;
  spawnDepth?: number | null;
  subagentRole?: "orchestrator" | "leaf" | null;
  subagentControlScope?: "children" | "none" | null;
  inheritedToolAllow?: string[] | null;
  inheritedToolDeny?: string[] | null;
  sendPolicy?: "allow" | "deny" | null;
  groupActivation?: "mention" | "always" | null;
}

export interface CronJobUpsert {
  name: string;
  description?: string;
  enabled?: boolean;
  schedule: CronJob["schedule"];
  sessionTarget: CronJob["sessionTarget"];
  wakeMode: CronJob["wakeMode"];
  payload: CronJob["payload"];
  delivery?: {
    mode: string;
    channel?: string;
    to?: string;
    threadId?: string | number;
    bestEffort?: boolean;
    accountId?: string;
    failureDestination?: {
      channel?: string;
      to?: string;
      accountId?: string;
      mode?: "announce" | "webhook";
    };
  };
}

export interface LogsTailParams {
  cursor?: number;
  limit?: number;
  maxBytes?: number;
}

export interface LogsTailResult {
  file: string;
  cursor: number;
  size: number;
  lines: string[];
  truncated: boolean;
  reset: boolean;
}

type ConfigModel = string | { primary?: string; fallbacks?: string[] };

interface ConfigDeliveryContext {
  channel?: string;
  to?: string;
  accountId?: string;
  threadId?: string | number;
}

interface ConfigApplyLikeParams {
  raw: string;
  baseHash?: string;
  sessionKey?: string;
  deliveryContext?: ConfigDeliveryContext;
  note?: string;
  restartDelayMs?: number;
}

interface ConfigToolsSection {
  profile?: string;
  allow?: string[];
  alsoAllow?: string[];
  deny?: string[];
}

interface ConfigAgentSection {
  id: string;
  tools?: ConfigToolsSection;
  skills?: string[];
  model?: ConfigModel;
}

type CronIdOrJobIdParams = { id: string; jobId?: string } | { id?: string; jobId: string };

export interface GatewayRpcMap {
  "agent.identity.get": {
    params: { sessionKey?: string };
    result: { name?: string; avatar?: string | null; agentId?: string | null };
  };
  "agents.create": {
    params: { name: string; workspace: string; model?: string; emoji?: string; avatar?: string };
    result: { ok: boolean; agentId: string };
  };
  "agents.delete": {
    params: { agentId: string; deleteFiles?: boolean };
    result: { ok?: boolean };
  };
  "agents.files.get": {
    params: { agentId: string; name: string };
    result: WorkspaceFileResult;
  };
  "agents.files.list": {
    params: { agentId: string };
    result: WorkspaceFilesResult;
  };
  "agents.files.set": {
    params: { agentId: string; name: string; content: string };
    result: { ok?: boolean };
  };
  "agents.list": {
    params: EmptyParams;
    result: AgentsListResponse;
  };
  "agents.update": {
    params: { agentId: string; name?: string; avatar?: string; workspace?: string; model?: string };
    result: { ok?: boolean };
  };
  "channels.status": {
    params: { probe?: boolean; timeoutMs?: number } | undefined;
    result: ChannelsStatusResponse;
  };
  "channels.logout": {
    params: { channel: string; accountId?: string };
    result: { channel: string; accountId: string; cleared: boolean; [key: string]: unknown };
  };
  "chat.abort": {
    params: { sessionKey: string };
    result: { ok?: boolean };
  };
  "chat.history": {
    params: { sessionKey: string; limit?: number; maxChars?: number };
    result: ChatHistoryResult;
  };
  "chat.send": {
    params: ChatSendParams;
    result: ChatSendResult;
  };
  connect: {
    params: ConnectParams;
    result: HelloPayload;
  };
  "config.apply": {
    params: ConfigApplyLikeParams;
    result: ConfigSaveResponse;
  };
  "config.get": {
    params: EmptyParams;
    result: ConfigGetResponse & {
      config: Record<string, unknown> & {
        tools?: ConfigToolsSection;
        agents?: {
          defaults?: {
            model?: ConfigModel;
          };
          list?: ConfigAgentSection[];
        };
      };
    };
  };
  "config.patch": {
    params: ConfigApplyLikeParams & { replacePaths?: string[] };
    result: ConfigSaveResponse;
  };
  "config.schema": {
    params: EmptyParams;
    result: ConfigSchemaResponse;
  };
  "cron.add": {
    params: CronJobUpsert;
    result: { ok?: boolean; jobId?: string };
  };
  "cron.list": {
    params:
      | {
          includeDisabled?: boolean;
          limit?: number;
          offset?: number;
          query?: string;
          enabled?: "all" | "enabled" | "disabled";
          sortBy?: "nextRunAtMs" | "updatedAtMs" | "name";
          sortDir?: "asc" | "desc";
        }
      | EmptyParams;
    result: CronListResult;
  };
  "cron.remove": {
    params: CronIdOrJobIdParams;
    result: { ok?: boolean };
  };
  "cron.run": {
    params: CronIdOrJobIdParams & { mode?: string };
    result: { ran?: boolean; runId?: string };
  };
  "cron.runs": {
    params: {
      scope?: "job" | "all";
      id?: string;
      jobId?: string;
      limit?: number;
      offset?: number;
      statuses?: Array<"ok" | "error" | "skipped">;
      status?: "ok" | "error" | "skipped";
      deliveryStatuses?: Array<CronDeliveryStatus>;
      deliveryStatus?: CronDeliveryStatus;
      query?: string;
      sortDir?: "asc" | "desc";
    };
    result: CronRunsResult;
  };
  "cron.status": {
    params: EmptyParams | undefined;
    result: CronStatusResult;
  };
  "cron.update": {
    params: CronIdOrJobIdParams & { patch: Partial<CronJobUpsert> };
    result: { ok?: boolean };
  };
  "device.pair.approve": {
    params: { requestId: string };
    result: { ok?: boolean };
  };
  "device.pair.list": {
    params: EmptyParams;
    result: DeviceListResponse;
  };
  "device.pair.reject": {
    params: { requestId: string };
    result: { ok?: boolean };
  };
  "device.pair.remove": {
    params: { deviceId: string };
    result: { deviceId: string };
  };
  "device.token.revoke": {
    params: { deviceId: string; role: string };
    result: { ok?: boolean };
  };
  "device.token.rotate": {
    params: { deviceId: string; role: string };
    result: { token?: string };
  };
  "exec.approval.resolve": {
    params: { id: string; decision: ExecApprovalDecision };
    result: { ok?: boolean };
  };
  "gateway.restart": {
    params: EmptyParams;
    result: { ok?: boolean };
  };
  "doctor.memory.status": {
    params: EmptyParams;
    result: {
      agentId: string;
      provider?: string;
      embedding: { ok: boolean; error?: string };
    };
  };
  health: {
    params: { probe?: boolean } | undefined;
    result: HealthSummary & {
      channels?: Record<
        string,
        {
          configured?: boolean;
          linked?: boolean;
          accountId?: string;
          accounts?: Record<string, { configured?: boolean; linked?: boolean }>;
        }
      >;
      channelOrder?: string[];
      channelLabels?: Record<string, string>;
    };
  };
  "logs.tail": {
    params: LogsTailParams;
    result: LogsTailResult;
  };
  "models.list": {
    params: { view?: "default" | "configured" | "all" } | EmptyParams;
    result: ModelsListResult;
  };
  "secrets.reload": {
    params: EmptyParams;
    result: { ok: boolean; warningCount: number };
  };
  ping: {
    params: EmptyParams;
    result: { ok?: boolean };
  };
  "sessions.delete": {
    params: { key: string; deleteTranscript?: boolean; emitLifecycleHooks?: boolean };
    result: { ok?: boolean };
  };
  "sessions.create": {
    params: {
      key?: string;
      agentId?: string;
      label?: string;
      model?: string;
      parentSessionKey?: string;
      emitCommandHooks?: boolean;
      task?: string;
      message?: string;
    };
    result: { ok?: boolean; key: string; sessionId?: string };
  };
  "sessions.list": {
    params: SessionsListParams | { limit?: number };
    result: SessionsListResult;
  };
  "sessions.subscribe": {
    params: EmptyParams | undefined;
    result: { ok?: boolean };
  };
  "sessions.unsubscribe": {
    params: EmptyParams | undefined;
    result: { ok?: boolean };
  };
  "sessions.messages.subscribe": {
    params: { key: string };
    result: { ok?: boolean };
  };
  "sessions.messages.unsubscribe": {
    params: { key: string };
    result: { ok?: boolean };
  };
  "sessions.abort": {
    params: { key?: string; runId?: string; agentId?: string };
    result: { ok?: boolean };
  };
  "sessions.patch": {
    params: SessionsPatchParams;
    result: { ok?: boolean };
  };
  "sessions.pluginPatch": {
    params: { key: string; pluginId: string; namespace: string; value?: unknown; unset?: boolean };
    result: { ok: true; key: string; value?: unknown };
  };
  "sessions.cleanup": {
    params: {
      agent?: string;
      allAgents?: boolean;
      enforce?: boolean;
      activeKey?: string;
      fixMissing?: boolean;
      fixDmScope?: boolean;
    };
    result: unknown;
  };
  "sessions.compaction.list": {
    params: { key: string };
    result: { ok: true; key: string; checkpoints: unknown[] };
  };
  "sessions.compaction.get": {
    params: { key: string; checkpointId: string };
    result: { ok: true; key: string; checkpoint: unknown };
  };
  "sessions.compaction.branch": {
    params: { key: string; checkpointId: string };
    result: { ok: true; sourceKey: string; key: string; sessionId: string; checkpoint: unknown };
  };
  "sessions.compaction.restore": {
    params: { key: string; checkpointId: string };
    result: { ok: true; key: string; sessionId: string; checkpoint: unknown };
  };
  "sessions.usage": {
    params: {
      key?: string;
      agentId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      includeContextWeight?: boolean;
      mode?: "utc" | "gateway" | "specific";
      range?: "7d" | "30d" | "90d" | "1y" | "all";
      groupBy?: "instance" | "family";
      includeHistorical?: boolean;
      utcOffset?: string;
    };
    result: SessionsUsageResult;
  };
  "sessions.usage.logs": {
    params: { key: string; limit?: number };
    result: SessionLogsResult;
  };
  "sessions.usage.timeseries": {
    params: { key: string };
    result: SessionUsageTimeSeries;
  };
  "skills.install": {
    params: { name: string; installId: string; timeoutMs?: number };
    result: { ok: boolean; message?: string };
  };
  "skills.status": {
    params: EmptyParams | undefined;
    result: SkillStatusReport;
  };
  "skills.update": {
    params: { skillKey: string; enabled: boolean };
    result: { ok?: boolean };
  };
  "tools.catalog": {
    params: {
      agentId?: string;
      includePlugins?: boolean;
    };
    result: {
      agentId: string;
      profiles: Array<{ id: "minimal" | "coding" | "messaging" | "full"; label: string }>;
      groups: Array<{
        id: string;
        label: string;
        source: "core" | "plugin";
        pluginId?: string;
        tools: Array<{
          id: string;
          label: string;
          description: string;
          source: "core" | "plugin";
          pluginId?: string;
          optional?: boolean;
          risk?: "low" | "medium" | "high";
          tags?: string[];
          defaultProfiles: Array<"minimal" | "coding" | "messaging" | "full">;
        }>;
      }>;
    };
  };
  "tools.effective": {
    params: { agentId?: string; sessionKey: string };
    result: {
      agentId: string;
      profile: string;
      groups: Array<{
        id: "core" | "plugin" | "channel";
        label: string;
        source: "core" | "plugin" | "channel";
        tools: Array<{
          id: string;
          label: string;
          description: string;
          rawDescription: string;
          source: "core" | "plugin" | "channel";
          pluginId?: string;
          channelId?: string;
          risk?: "low" | "medium" | "high";
          tags?: string[];
        }>;
      }>;
    };
  };
  "tools.invoke": {
    params: {
      name: string;
      args?: Record<string, unknown>;
      sessionKey?: string;
      agentId?: string;
      confirm?: boolean;
      idempotencyKey?: string;
    };
    result: {
      ok: boolean;
      toolName: string;
      output?: unknown;
      requiresApproval?: boolean;
      approvalId?: string;
      source?: string;
      error?: { code: string; message: string; details?: unknown };
    };
  };
  status: {
    params: EmptyParams | undefined;
    result: {
      heartbeat?: {
        defaultAgentId?: string;
        agents?: Array<{
          agentId: string;
          enabled: boolean;
          every?: string;
          everyMs?: number;
        }>;
      };
      sessions?: {
        count?: number;
        defaults?: {
          model?: string | null;
          contextTokens?: number;
        };
        recent?: Array<{
          agentId?: string;
          key?: string;
          kind?: string;
          model?: string;
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          remainingTokens?: number;
          percentUsed?: number;
          contextTokens?: number;
          updatedAt?: number;
        }>;
      };
      queuedSystemEvents?: number;
    };
  };
  "system-presence": {
    params: EmptyParams;
    result: SystemPresence[];
  };
  "usage.cost": {
    params: { days: number };
    result: CostUsageSummary;
  };
  "usage.status": {
    params: undefined;
    result: UsageSummary;
  };
}
