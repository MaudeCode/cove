/**
 * SystemMessage
 *
 * System message displayed as a muted banner.
 */

import type { Message } from "@/types/messages";
import { MessageContent } from "./MessageContent";

interface SystemMessageProps {
  message: Message;
}

export function SystemMessage({ message }: SystemMessageProps) {
  return (
    <div class="flex items-start gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]">
      {/* Info icon */}
      <div class="flex-shrink-0 w-5 h-5 text-[var(--color-text-muted)] mt-0.5">
        <InfoIcon />
      </div>

      {/* Content */}
      <div class="flex-1 text-sm text-[var(--color-text-muted)] italic">
        <MessageContent content={message.content} />
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  );
}
