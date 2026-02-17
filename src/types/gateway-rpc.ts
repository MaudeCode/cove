import type { AttachmentPayload } from "@/types/attachments";
import type { AgentsListResponse } from "@/types/agents";
import type { ChatHistoryResult, ChatSendResult } from "@/types/chat";
import type { ChannelsStatusResponse } from "@/types/channels";
import type { ConfigGetResponse, ConfigSaveResponse, ConfigSchemaResponse } from "@/types/config";
import type { CronJob, CronListResult, CronRunsResult, CronStatusResult } from "@/types/cron";
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
  message: string;
  thinking?: string;
  timeoutMs?: number;
  idempotencyKey?: string;
  attachments?: AttachmentPayload[];
}

export interface SessionsPatchParams {
  key: string;
  label?: string;
  model?: string;
  thinking?: string;
  verbose?: string;
  reasoning?: string;
}

export interface CronJobUpsert {
  name: string;
  description?: string;
  enabled?: boolean;
  schedule: CronJob["schedule"];
  sessionTarget: CronJob["sessionTarget"];
  wakeMode: CronJob["wakeMode"];
  payload: CronJob["payload"];
  delivery?: { mode: string; channel?: string; to?: string; bestEffort?: boolean };
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

export interface GatewayRpcMap {
  "agent.identity.get": {
    params: { sessionKey?: string };
    result: { name?: string; avatar?: string | null; agentId?: string | null };
  };
  "agents.create": {
    params: { name: string; workspace: string; emoji?: string };
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
  "chat.abort": {
    params: { sessionKey: string };
    result: { ok?: boolean };
  };
  "chat.history": {
    params: { sessionKey: string; limit?: number };
    result: ChatHistoryResult;
  };
  "chat.send": {
    params: ChatSendParams;
    result: ChatSendResult;
  };
  "common.logout": {
    params: { channel: string; accountId: string };
    result: { ok?: boolean };
  };
  connect: {
    params: ConnectParams;
    result: HelloPayload;
  };
  "config.apply": {
    params: { config: Record<string, unknown> };
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
    params: { raw: string; baseHash?: string | null };
    result: ConfigSaveResponse;
  };
  "config.schema": {
    params: EmptyParams;
    result: ConfigSchemaResponse;
  };
  "cron.add": {
    params: { job: CronJobUpsert };
    result: { ok?: boolean; jobId?: string };
  };
  "cron.list": {
    params: { includeDisabled?: boolean } | EmptyParams;
    result: CronListResult;
  };
  "cron.remove": {
    params: { jobId: string };
    result: { ok?: boolean };
  };
  "cron.run": {
    params: { jobId: string; mode?: string };
    result: { ran?: boolean; runId?: string };
  };
  "cron.runs": {
    params: { jobId: string; limit?: number };
    result: CronRunsResult;
  };
  "cron.status": {
    params: EmptyParams | undefined;
    result: CronStatusResult;
  };
  "cron.update": {
    params: { jobId: string; patch: Partial<CronJobUpsert> };
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
  "device.token.revoke": {
    params: { deviceId: string; role: string };
    result: { ok?: boolean };
  };
  "device.token.rotate": {
    params: { deviceId: string; role: string };
    result: { token: string };
  };
  "exec.approval.resolve": {
    params: { id: string; decision: ExecApprovalDecision };
    result: { ok?: boolean };
  };
  "gateway.restart": {
    params: EmptyParams;
    result: { ok?: boolean };
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
    params: EmptyParams;
    result: ModelsListResult;
  };
  ping: {
    params: EmptyParams;
    result: { ok?: boolean };
  };
  "sessions.delete": {
    params: { key: string };
    result: { ok?: boolean };
  };
  "sessions.list": {
    params: SessionsListParams | { limit?: number };
    result: SessionsListResult;
  };
  "sessions.patch": {
    params: SessionsPatchParams;
    result: { ok?: boolean };
  };
  "sessions.usage": {
    params: {
      startDate: string;
      endDate: string;
      limit?: number;
      includeContextWeight?: boolean;
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
