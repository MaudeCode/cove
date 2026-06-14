import { initChat } from "@/lib/chat/init";
import { loadAssistantIdentity } from "@/signals/identity";
import { loadModels } from "@/signals/models";
import { initExecApproval } from "@/signals/exec";
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
