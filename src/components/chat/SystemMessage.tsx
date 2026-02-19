/**
 * SystemMessage
 *
 * System message displayed as a muted banner.
 */

import { Info } from "lucide-preact";
import type { Message } from "@/types/messages";
import { MessageContent } from "./MessageContent";
import { HistoryTruncationIndicator } from "./HistoryTruncationIndicator";

interface SystemMessageProps {
  message: Message;
}

export function SystemMessage({ message }: SystemMessageProps) {
  return (
    <div class="flex items-start gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]">
      {/* Info icon */}
      <div class="flex-shrink-0 w-5 h-5 text-[var(--color-text-muted)] mt-0.5">
        <Info class="w-full h-full" aria-hidden="true" />
      </div>

      {/* Content */}
      <div class="flex-1 text-sm text-[var(--color-text-muted)] italic">
        {message.historyTruncated && (
          <HistoryTruncationIndicator reason={message.historyTruncationReason} class="mb-1" />
        )}
        <MessageContent content={message.content} />
      </div>
    </div>
  );
}
