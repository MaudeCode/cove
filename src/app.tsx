import { useState } from "preact/hooks";
import "./app.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // TODO: Connect to OpenClaw gateway
    // For now, just echo back
    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Echo: ${userMessage.content}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 500);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div class="cove">
      <header class="cove-header">
        <h1>🦞 Cove</h1>
        <span class="subtitle">A cozy WebUI for OpenClaw</span>
      </header>

      <main class="cove-messages">
        {messages.length === 0 ? (
          <div class="cove-empty">
            <p>Welcome to Cove!</p>
            <p class="hint">Start a conversation below.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} class={`message message-${msg.role}`}>
              <div class="message-content">{msg.content}</div>
              <div class="message-time">{msg.timestamp.toLocaleTimeString()}</div>
            </div>
          ))
        )}
      </main>

      <footer class="cove-input">
        <textarea
          value={input}
          onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
        />
        <button onClick={handleSend} disabled={!input.trim()}>
          Send
        </button>
      </footer>
    </div>
  );
}
