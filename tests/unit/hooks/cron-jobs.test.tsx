/** @jsxImportSource preact */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderComponent } from "../../helpers/dom";
import { installGatewayAliasMock, resetGatewayAliasMock } from "../../helpers/gateway-alias";
import { installI18nMock } from "../../helpers/i18n";
import type { CronJob, CronStatusResult, UseCronJobsResult } from "../../../src/types/cron";

type SendCall = {
  method: string;
  params: unknown;
};

type SendResponse = unknown | ((method: string, params: unknown) => unknown | Promise<unknown>);

installGatewayAliasMock();
const sendCalls: SendCall[] = [];
const sendResponses = new Map<string, SendResponse>();
const originalDateNow = Date.now;
let cron: UseCronJobsResult | undefined;

function setResponse(method: string, response: SendResponse): void {
  sendResponses.set(method, response);
}

installI18nMock({ t: (key: string) => key });

mock.module("@/lib/utils", () => import("../../../src/lib/utils"));
mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));
mock.module("@/lib/timezones", () => import("../../../src/lib/timezones"));
mock.module("@/components/cron", () => import("../../../src/components/cron/cron-helpers"));

const { useCronJobs } = await import("../../../src/hooks/useCronJobs");

function HookHarness() {
  cron = useCronJobs();
  return <span data-testid="cron-count">{cron.state.cronJobs.value.length}</span>;
}

function cronHook(): UseCronJobsResult {
  if (!cron) throw new Error("Cron hook harness has not rendered.");
  return cron;
}

function cronJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "job-1",
    name: "Daily summary",
    description: "Summarize activity",
    enabled: true,
    createdAtMs: 1,
    updatedAtMs: 2,
    schedule: { kind: "cron", expr: "0 9 * * *", tz: "UTC" },
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    payload: { kind: "systemEvent", text: "Run summary" },
    delivery: { mode: "none" },
    state: {},
    ...overrides,
  };
}

function resetHookState(hook: UseCronJobsResult): void {
  hook.state.cronJobs.value = [];
  hook.state.cronStatus.value = null;
  hook.state.isLoading.value = false;
  hook.state.error.value = null;
  hook.state.searchQuery.value = "";
  hook.state.statusFilter.value = "all";
  hook.actions.closeModal();
}

function renderCronHook(): UseCronJobsResult {
  cron = undefined;
  renderComponent(<HookHarness />);
  const hook = cronHook();
  resetHookState(hook);
  return hook;
}

function fillValidMainForm(hook: UseCronJobsResult): void {
  hook.form.editName.value = "Daily summary";
  hook.form.editScheduleKind.value = "cron";
  hook.form.editScheduleExpr.value = "0 9 * * *";
  hook.form.editSessionTarget.value = "main";
  hook.form.editPayloadText.value = "Run summary";
}

describe("useCronJobs", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    const gatewayState = resetGatewayAliasMock();
    gatewayState.isConnected.value = false;
    gatewayState.mainSessionKey.value = "main";
    gatewayState.send = async (method: string, params?: unknown) => {
      sendCalls.push({ method, params });
      if (!sendResponses.has(method)) {
        throw new Error(`Unexpected gateway method: ${method}`);
      }
      const response = sendResponses.get(method);
      return typeof response === "function" ? response(method, params) : response;
    };
    sendCalls.length = 0;
    sendResponses.clear();
    setResponse("cron.status", { enabled: true, jobs: 0 } satisfies CronStatusResult);
    setResponse("cron.list", { jobs: [] });
    setResponse("cron.runs", { entries: [] });
    Date.now = originalDateNow;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  test("loads status and jobs independently when one cron endpoint fails", async () => {
    const hook = renderCronHook();
    const job = cronJob({ id: "job-list" });
    setResponse("cron.status", () => {
      throw new Error("status offline");
    });
    setResponse("cron.list", { jobs: [job] });

    await hook.actions.loadCronJobs();

    expect(sendCalls).toEqual([
      { method: "cron.status", params: {} },
      { method: "cron.list", params: { includeDisabled: true } },
    ]);
    expect(hook.state.cronStatus.value).toBeNull();
    expect(hook.state.cronJobs.value).toEqual([job]);
    expect(hook.state.error.value).toBe("Status: status offline");
    expect(hook.state.isLoading.value).toBe(false);

    sendCalls.length = 0;
    setResponse("cron.status", { enabled: true, jobs: 1, nextWakeAtMs: 500 });
    setResponse("cron.list", () => {
      throw new Error("list offline");
    });

    await hook.actions.loadCronJobs();

    expect(hook.state.cronStatus.value).toEqual({ enabled: true, jobs: 1, nextWakeAtMs: 500 });
    expect(hook.state.cronJobs.value).toEqual([job]);
    expect(hook.state.error.value).toBe("Jobs: list offline");
  });

  test("filters jobs by status/search and sorts enabled jobs by next run", async () => {
    const hook = renderCronHook();
    const disabledEarly = cronJob({
      id: "disabled-early",
      name: "Old disabled",
      enabled: false,
      state: { nextRunAtMs: 1 },
    });
    const enabledLate = cronJob({
      id: "enabled-late",
      name: "Weekly cleanup",
      state: { nextRunAtMs: 20 },
    });
    const enabledSoon = cronJob({
      id: "enabled-soon",
      name: "Daily summary",
      description: "Find me",
      state: { nextRunAtMs: 10 },
    });
    setResponse("cron.list", { jobs: [disabledEarly, enabledLate, enabledSoon] });

    await hook.actions.loadCronJobs();

    expect(hook.computed.jobCounts.value).toEqual({ total: 3, enabled: 2, disabled: 1 });
    expect(hook.computed.filteredJobs.value.map((job) => job.id)).toEqual([
      "enabled-soon",
      "enabled-late",
      "disabled-early",
    ]);

    hook.state.statusFilter.value = "enabled";
    hook.state.searchQuery.value = "find";
    expect(hook.computed.filteredJobs.value.map((job) => job.id)).toEqual(["enabled-soon"]);

    hook.state.statusFilter.value = "disabled";
    hook.state.searchQuery.value = "";
    expect(hook.computed.filteredJobs.value.map((job) => job.id)).toEqual(["disabled-early"]);
  });

  test("rejects invalid cron fields and mixed integer schedule input before sending", async () => {
    const hook = renderCronHook();
    Date.now = () => 1_000;

    hook.actions.openJobModal("create");
    fillValidMainForm(hook);
    hook.form.editScheduleTz.value = "Mars/Olympus";
    await hook.actions.saveOrCreateJob();
    expect(sendCalls).toEqual([]);
    expect(hook.form.formErrors.value.schedule).toBe("cron.validation.timezoneInvalid");

    hook.form.editScheduleTz.value = "";
    hook.form.editScheduleStaggerMs.value = "250ms";
    await hook.actions.saveOrCreateJob();
    expect(sendCalls).toEqual([]);
    expect(hook.form.formErrors.value.schedule).toBe("cron.validation.staggerNonNegative");

    hook.form.editScheduleStaggerMs.value = "";
    hook.form.editScheduleKind.value = "every";
    hook.form.editScheduleEveryMs.value = "1500abc";
    await hook.actions.saveOrCreateJob();
    expect(sendCalls).toEqual([]);
    expect(hook.form.formErrors.value.schedule).toBe("cron.validation.intervalMin");

    hook.form.editScheduleEveryMs.value = "999";
    await hook.actions.saveOrCreateJob();
    expect(sendCalls).toEqual([]);
    expect(hook.form.formErrors.value.schedule).toBe("cron.validation.intervalMin");

    hook.form.editScheduleKind.value = "at";
    hook.form.editScheduleAtMs.value = "2000abc";
    await hook.actions.saveOrCreateJob();
    expect(sendCalls).toEqual([]);
    expect(hook.form.formErrors.value.schedule).toBe("cron.validation.atFuture");

    hook.form.editScheduleAtMs.value = "999";
    await hook.actions.saveOrCreateJob();
    expect(sendCalls).toEqual([]);
    expect(hook.form.formErrors.value.schedule).toBe("cron.validation.atFuture");
  });

  test("creates cron jobs with schedule, payload, and delivery RPC contracts", async () => {
    const hook = renderCronHook();
    setResponse("cron.add", { ok: true });

    hook.actions.openJobModal("create");
    fillValidMainForm(hook);
    hook.form.editDescription.value = "";
    hook.form.editEnabled.value = false;
    hook.form.editScheduleTz.value = "UTC";
    hook.form.editScheduleStaggerMs.value = "250";
    hook.form.editWakeMode.value = "now";
    hook.form.editSessionTarget.value = "isolated";
    hook.form.editDeliveryAnnounce.value = true;
    hook.form.editPayloadMessage.value = "Send agent update";
    hook.form.editPayloadModel.value = "claude-sonnet";

    await hook.actions.saveOrCreateJob();

    expect(sendCalls[0]).toEqual({
      method: "cron.add",
      params: {
        job: {
          name: "Daily summary",
          description: undefined,
          enabled: false,
          schedule: { kind: "cron", expr: "0 9 * * *", tz: "UTC", staggerMs: 250 },
          sessionTarget: "isolated",
          wakeMode: "now",
          payload: { kind: "agentTurn", message: "Send agent update", model: "claude-sonnet" },
          delivery: { mode: "announce" },
        },
      },
    });
    expect(sendCalls.map((call) => call.method)).toEqual(["cron.add", "cron.status", "cron.list"]);
    expect(hook.modal.modalMode.value).toBeNull();
  });

  test("updates existing jobs with jobId and strict every/at schedules", async () => {
    const hook = renderCronHook();
    const job = cronJob({
      id: "job-edit",
      schedule: { kind: "every", everyMs: 60_000 },
      sessionTarget: "main",
      payload: { kind: "systemEvent", text: "Old text" },
    });
    setResponse("cron.update", { ok: true });

    hook.actions.openJobModal("edit", job);
    sendCalls.length = 0;
    hook.form.editScheduleEveryMs.value = "300000";
    hook.form.editPayloadText.value = "New text";
    hook.form.editDeliveryAnnounce.value = false;

    await hook.actions.saveOrCreateJob();

    expect(sendCalls[0]).toEqual({
      method: "cron.update",
      params: {
        jobId: "job-edit",
        patch: {
          name: "Daily summary",
          description: "Summarize activity",
          enabled: true,
          schedule: { kind: "every", everyMs: 300_000 },
          sessionTarget: "main",
          wakeMode: "next-heartbeat",
          payload: { kind: "systemEvent", text: "New text" },
          delivery: { mode: "none" },
        },
      },
    });

    hook.actions.openJobModal("edit", job);
    sendCalls.length = 0;
    hook.form.editScheduleKind.value = "at";
    hook.form.editScheduleAtMs.value = "2000";
    Date.now = () => 1_000;

    await hook.actions.saveOrCreateJob();

    expect((sendCalls[0].params as { patch: { schedule: unknown } }).patch.schedule).toEqual({
      kind: "at",
      at: new Date(2_000).toISOString(),
    });
  });

  test("runs, removes, and toggles jobs with the expected cron RPCs and local state", async () => {
    const hook = renderCronHook();
    const job = cronJob({ id: "job-flow", enabled: true });
    setResponse("cron.list", { jobs: [job] });
    setResponse("cron.update", { ok: true });
    setResponse("cron.run", { ok: true });
    setResponse("cron.remove", { ok: true });

    await hook.actions.loadCronJobs();
    sendCalls.length = 0;

    await hook.actions.toggleJobEnabled(job);
    expect(sendCalls[0]).toEqual({
      method: "cron.update",
      params: { jobId: "job-flow", patch: { enabled: false } },
    });
    expect(hook.state.cronJobs.value[0].enabled).toBe(false);

    sendCalls.length = 0;
    await hook.actions.runJobNow(job);
    expect(sendCalls.map((call) => call.method)).toEqual(["cron.run", "cron.status", "cron.list"]);
    expect(sendCalls[0].params).toEqual({ jobId: "job-flow", mode: "force" });
    expect(hook.modal.isRunning.value).toBe(false);

    sendCalls.length = 0;
    hook.actions.openJobModal("edit", job);
    await hook.actions.deleteJob();
    expect(sendCalls.at(-1)).toEqual({
      method: "cron.remove",
      params: { jobId: "job-flow" },
    });
    expect(hook.state.cronJobs.value).toEqual([]);
    expect(hook.modal.modalMode.value).toBeNull();
  });
});
