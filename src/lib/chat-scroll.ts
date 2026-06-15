export const CHAT_CONTENT_TOGGLE_EVENT = "cove:chat-content-toggle";

export function dispatchChatContentToggle(target: HTMLElement | null): void {
  const CustomEventCtor = target?.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
  target?.dispatchEvent(new CustomEventCtor(CHAT_CONTENT_TOGGLE_EVENT, { bubbles: true }));
}

export function isNearScrollBottom(element: HTMLElement, threshold = 50): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}
