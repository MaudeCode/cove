import { initChat } from "@/lib/chat/init";
import { startNodeConnection } from "@/lib/node-connection";
import { loadAssistantIdentity } from "@/signals/identity";
import { loadModels } from "@/signals/models";
import { initExecApproval } from "@/signals/exec";
import { loadAgents } from "@/signals/agents";
import { canvasNodeEnabled } from "@/signals/settings";
import { setActiveSession, loadSessions, initSessionEventSubscription } from "@/signals/sessions";
import { initUpdateSubscription } from "@/signals/update";
import { startUsagePolling } from "@/signals/usage";

export async function initConnectedApp(): Promise<void> {
  await loadSessions();
  initSessionEventSubscription();

  await loadAssistantIdentity();

  setActiveSession("main");
  await initChat("main");

  startUsagePolling();
  loadModels();
  initExecApproval();
  initUpdateSubscription();
}

export async function initPostConnectApp(
  options: { startCanvasNode?: boolean } = {},
): Promise<void> {
  await loadAgents();
  await initConnectedApp();

  if (options.startCanvasNode !== false) {
    startCanvasNodeConnectionIfEnabled();
  }
}

export function startCanvasNodeConnectionIfEnabled(): void {
  if (canvasNodeEnabled.value) {
    startNodeConnection();
  }
}
