/**
 * ChatMessage
 *
 * Routes to appropriate message component based on role.
 */

import type { Message } from "@/types/messages";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { SystemMessage } from "./SystemMessage";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  assistantName?: string;
  assistantAvatar?: string;
  userName?: string;
  userAvatar?: string;
}

export function ChatMessage({
  message,
  isStreaming = false,
  assistantName,
  assistantAvatar,
  userName,
  userAvatar,
}: ChatMessageProps) {
  switch (message.role) {
    case "user":
      return <UserMessage message={message} userName={userName} userAvatar={userAvatar} />;
    case "assistant":
      return (
        <AssistantMessage
          message={message}
          isStreaming={isStreaming}
          assistantName={assistantName}
          assistantAvatar={assistantAvatar}
        />
      );
    case "system":
      return <SystemMessage message={message} />;
    default:
      return null;
  }
}
