/**
 * AgentSelector
 *
 * Dropdown for selecting the active agent.
 */

import { Check, ChevronDown } from "lucide-preact";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import {
  selectedAgentId,
  selectedAgent,
  uniqueAgents,
  agentSelectorOpen,
  selectAgent,
} from "./agent-state";

export function AgentSelector() {
  const agent = selectedAgent.value;
  const agentsList = uniqueAgents.value;
  const isOpen = agentSelectorOpen.value;

  if (!agent) return null;

  const emoji = agent.identity?.emoji || "🤖";
  const name = agent.identity?.name || agent.name || agent.id;

  return (
    <div class="relative">
      {/* Selected agent button */}
      <button
        type="button"
        onClick={() => (agentSelectorOpen.value = !isOpen)}
        class="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-hover)] transition-colors max-w-[180px] sm:max-w-none sm:min-w-[180px]"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <AgentAvatar agentId={agent.id} emoji={emoji} size="md" />
        <span class="flex-1 text-left font-medium truncate">{name}</span>
        <ChevronDown
          class={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            class="fixed inset-0 z-10 cursor-default"
            onClick={() => (agentSelectorOpen.value = false)}
            aria-label="Close menu"
          />

          {/* Options */}
          <div
            class="absolute top-full left-0 mt-1 w-full min-w-[220px] py-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-lg z-20"
            role="listbox"
          >
            {agentsList.map((a) => {
              const aEmoji = a.identity?.emoji || "🤖";
              const aName = a.identity?.name || a.name || a.id;
              const isSelected = a.id === selectedAgentId.value;

              return (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    selectAgent(a.id);
                    agentSelectorOpen.value = false;
                  }}
                  class={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-bg-hover)] transition-colors ${
                    isSelected ? "bg-[var(--color-bg-tertiary)]" : ""
                  }`}
                >
                  <AgentAvatar agentId={a.id} emoji={aEmoji} size="sm" />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">{aName}</div>
                    {aName !== a.id && (
                      <div class="text-xs text-[var(--color-text-muted)] truncate">{a.id}</div>
                    )}
                  </div>
                  {isSelected && <Check class="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
