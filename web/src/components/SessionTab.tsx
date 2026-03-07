import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import MessageBubble from "./MessageBubble";
import ToolGroup from "./ToolGroup";
import type { ToolCall } from "./ToolGroup";
import type { RunDetails } from "../types";

interface SessionTabProps {
  run: RunDetails;
}

type SessionMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp?: string;
  toolName?: string;
  toolCallId?: string;
  toolInput?: string;
  toolOutput?: string;
  toolSuccess?: boolean;
  isReasoning?: boolean;
};

/** Isolated chat input — typing here does not re-render the message list */
const ChatInput = memo(function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (msg: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (text.trim() && !disabled) {
          onSend(text.trim());
          setText("");
        }
      }
    },
    [text, disabled, onSend]
  );

  const handleSend = useCallback(() => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
    }
  }, [text, disabled, onSend]);

  return (
    <div className="border-t border-gray-200 p-4">
      <div className="flex gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          disabled={disabled}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
});

/** Event types we actually want to show as chat messages */
const VISIBLE_TYPES = new Set([
  "user.message",
  "user",
  "assistant.message",
  "assistant",
  "assistant.reasoning",
  "tool.execution_start",
  "tool.execution_complete",
  "system.message",
  "system",
  "tool",
]);

function normalizeMessage(msg: any, index: number): SessionMessage | null {
  const type = msg?.type || msg?.role || "assistant";
  const data = msg?.data ?? msg;

  // Filter out internal SDK events (turn_start, turn_end, usage_info,
  // session.resume, session.idle, reasoning_delta, message_delta, etc.)
  if (!VISIBLE_TYPES.has(type) && !msg?.toolCall && !msg?.toolResult) {
    return null;
  }

  let role: SessionMessage["role"] = "assistant";
  let content = "";
  let toolInput: string | undefined;
  let toolOutput: string | undefined;
  const isReasoning = type === "assistant.reasoning";

  if (type === "user.message" || type === "user") role = "user";
  if (type === "assistant.message" || type === "assistant") role = "assistant";
  if (isReasoning) role = "assistant";
  if (type === "system.message" || type === "system") role = "system";
  if (
    type === "tool.execution_start" ||
    type === "tool.execution_complete" ||
    msg?.toolCall ||
    msg?.toolResult ||
    type === "tool"
  ) {
    role = "tool";
  }

  if (type === "tool.execution_start") {
    content = `Executing tool: ${data?.toolName || "unknown"}...`;
    // SDK: data.arguments holds the tool input
    const input = data?.arguments || data?.input || data?.parameters;
    if (input) {
      toolInput = typeof input === "string" ? input : JSON.stringify(input, null, 2);
    }
  } else if (type === "tool.execution_complete") {
    content = `Tool completed: ${data?.toolName || "unknown"}`;
    // SDK: data.result is { content, detailedContent, contents[] }
    const result = data?.result;
    if (result) {
      // Prefer detailedContent, then content, then the whole result object
      const output = result.detailedContent || result.content || result;
      toolOutput = typeof output === "string" ? output : JSON.stringify(output, null, 2);
    } else if (data?.error) {
      toolOutput = typeof data.error === "string" ? data.error : (data.error.message || JSON.stringify(data.error));
    }
  } else if (isReasoning) {
    content = data?.content || data?.reasoningText || "";
  } else {
    content =
      data?.content ||
      data?.prompt ||
      data?.message ||
      msg?.content ||
      (typeof data === "string" ? data : "");
  }

  // Extract tool input/output from toolCall/toolResult properties
  if (msg?.toolCall) {
    const input = msg.toolCall.input || msg.toolCall.parameters || msg.toolCall.arguments;
    if (input && !toolInput) {
      toolInput = typeof input === "string" ? input : JSON.stringify(input, null, 2);
    }
  }
  if (msg?.toolResult) {
    const output = msg.toolResult.output || msg.toolResult.content || msg.toolResult.result;
    if (output && !toolOutput) {
      toolOutput = typeof output === "string" ? output : JSON.stringify(output, null, 2);
    }
  }

  // Ensure content is a string
  if (content && typeof content !== "string") {
    try {
      content = JSON.stringify(content, null, 2);
    } catch {
      content = String(content);
    }
  }

  // For generic "tool" role messages that have content but no toolOutput,
  // the content is likely the result — move it to toolOutput so the UI
  // can render it as a collapsible result.
  if (role === "tool" && !toolOutput && content && type !== "tool.execution_start") {
    const trimmed = content.trim();
    if (
      (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("\"")) &&
      !trimmed.startsWith("Executing tool:") &&
      !trimmed.startsWith("Tool:")
    ) {
      toolOutput = content;
      const tn = data?.toolName || msg?.toolCall?.name || msg?.toolResult?.name || "";
      content = tn ? `Tool completed: ${tn}` : "Tool result";
    }
  }

  // For tool messages, ensure we have some content even if only input/output exists
  if (role === "tool" && !content && (toolInput || toolOutput)) {
    const tn = data?.toolName || msg?.toolCall?.name || msg?.toolResult?.name || "unknown";
    content = `Tool: ${tn}`;
  }

  // Skip messages with no meaningful content
  if (!content && !toolInput && !toolOutput) return null;

  const toolName =
    data?.toolName ||
    msg?.toolCall?.name ||
    msg?.toolResult?.name ||
    undefined;

  // SDK tool events carry data.toolCallId for matching start <-> complete
  const toolCallId = data?.toolCallId || undefined;

  const toolSuccess = type === "tool.execution_complete" ? data?.success : undefined;

  const timestamp = data?.timestamp || msg?.timestamp || undefined;

  return {
    id: data?.id || `${type}-${index}`,
    role,
    content,
    timestamp,
    toolName,
    toolCallId,
    toolInput,
    toolOutput,
    toolSuccess,
    isReasoning,
  };
}

export default function SessionTab({ run }: SessionTabProps) {
  const [rawMessages, setRawMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [sending, setSending] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkAvailable, setSdkAvailable] = useState<boolean | null>(null);

  /** Accumulated streaming items that grow as the turn progresses */
  type StreamItem =
    | { kind: "reasoning"; content: string }
    | { kind: "message"; content: string }
    | { kind: "tool"; toolName: string; complete: boolean; toolInput?: string; toolOutput?: string };

  const [streamItems, setStreamItems] = useState<StreamItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => {
    const normalized = rawMessages
      .map((msg, index) => normalizeMessage(msg, index))
      .filter((msg): msg is SessionMessage => !!msg);

    // Build a lookup of tool.execution_complete events keyed by toolCallId
    // so we can merge them into their corresponding start events.
    const completeByCallId = new Map<string, SessionMessage>();
    const completeIds = new Set<string>();
    for (const msg of normalized) {
      if (msg.role === "tool" && msg.toolCallId && msg.toolOutput && !msg.toolInput) {
        completeByCallId.set(msg.toolCallId, msg);
      }
    }

    // Merge start + complete by toolCallId
    const merged: SessionMessage[] = [];
    for (const msg of normalized) {
      if (msg.role === "tool" && msg.toolCallId && msg.toolInput) {
        // This is a "start" event — try to find its matching complete
        const complete = completeByCallId.get(msg.toolCallId);
        if (complete) {
          completeIds.add(complete.id);
          merged.push({
            ...msg,
            toolOutput: complete.toolOutput,
            toolSuccess: complete.toolSuccess,
            timestamp: complete.timestamp || msg.timestamp,
          });
          continue;
        }
      }
      // Skip standalone complete events that were already merged
      if (completeIds.has(msg.id)) continue;
      merged.push(msg);
    }

    // Reorder so reasoning messages appear before their corresponding
    // assistant messages (SDK returns message before reasoning in history).
    const reordered: SessionMessage[] = [];
    for (let i = 0; i < merged.length; i++) {
      const msg = merged[i];
      // If this is an assistant message and the NEXT one is reasoning, swap them
      if (
        msg.role === "assistant" &&
        !msg.isReasoning &&
        i + 1 < merged.length &&
        merged[i + 1].isReasoning
      ) {
        reordered.push(merged[i + 1]); // reasoning first
        reordered.push(msg);                // then message
        i++; // skip the reasoning since we already added it
      } else {
        reordered.push(msg);
      }
    }
    return reordered;
  }, [rawMessages]);

  /** Group consecutive tool messages together, interleaving with non-tool messages */
  type ChatItem =
    | { kind: "message"; msg: SessionMessage }
    | { kind: "tools"; tools: ToolCall[] };

  const chatItems = useMemo<ChatItem[]>(() => {
    const items: ChatItem[] = [];
    let currentToolGroup: ToolCall[] = [];

    const flushTools = () => {
      if (currentToolGroup.length > 0) {
        items.push({ kind: "tools", tools: currentToolGroup });
        currentToolGroup = [];
      }
    };

    for (const msg of messages) {
      if (msg.role === "tool") {
        currentToolGroup.push({
          id: msg.id,
          toolName: msg.toolName,
          toolInput: msg.toolInput,
          toolOutput: msg.toolOutput,
          toolSuccess: msg.toolSuccess,
          timestamp: msg.timestamp,
        });
      } else {
        flushTools();
        items.push({ kind: "message", msg });
      }
    }
    flushTools();
    return items;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.sessions.status();
        if (cancelled) return;
        setSdkAvailable(s.available);
        if (!s.available) return;

        setResuming(true);
        await api.sessions.resume(run.sessionId, {
          model: run.model,
          workingDirectory: run.workingDirectory,
          mcpConfigPath: run.mcpConfigPath,
          systemMessage: run.systemMessage,
        });
        if (cancelled) return;
        setResumed(true);
        const msgs = await api.sessions.messages(run.sessionId);
        if (cancelled) return;
        setRawMessages(msgs);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setResuming(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [run.sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamItems]);

  const refreshMessages = useCallback(async () => {
    setLoading(true);
    try {
      const msgs = await api.sessions.messages(run.sessionId);
      setRawMessages(msgs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [run.sessionId]);

  const sendMessage = useCallback(async (msg: string) => {
    if (!msg || sending) return;
    setSending(true);
    setError(null);
    setStreamItems([]);

    try {
      const result = await api.sessions.sendStreaming(
        run.sessionId,
        msg,
        (event) => {
          if (event.type === "assistant.reasoning_delta") {
            setStreamItems((prev) => {
              const last = prev[prev.length - 1];
              if (last?.kind === "reasoning") {
                // Append to existing reasoning item
                return [...prev.slice(0, -1), { ...last, content: last.content + (event.data?.deltaContent || "") }];
              }
              // Start a new reasoning item
              return [...prev, { kind: "reasoning", content: event.data?.deltaContent || "" }];
            });
          } else if (event.type === "assistant.message_delta") {
            setStreamItems((prev) => {
              const last = prev[prev.length - 1];
              if (last?.kind === "message") {
                return [...prev.slice(0, -1), { ...last, content: last.content + (event.data?.deltaContent || "") }];
              }
              return [...prev, { kind: "message", content: event.data?.deltaContent || "" }];
            });
          } else if (event.type === "assistant.turn_start") {
            // Don't clear — items accumulate across turns
          } else if (event.type === "tool.execution_start") {
            const toolName = event.data?.toolName || "unknown";
            const input = event.data?.arguments;
            const toolInput = input
              ? (typeof input === "string" ? input : JSON.stringify(input, null, 2))
              : undefined;
            setStreamItems((prev) => [
              ...prev,
              { kind: "tool", toolName, complete: false, toolInput },
            ]);
          } else if (event.type === "tool.execution_complete") {
            const callId = event.data?.toolCallId;
            const resultData = event.data?.result;
            const toolOutput = resultData
              ? (resultData.detailedContent || resultData.content || JSON.stringify(resultData))
              : undefined;
            setStreamItems((prev) => {
              // Find the matching incomplete tool (by toolCallId if available, else last incomplete)
              const idx = prev.findLastIndex(
                (it) => it.kind === "tool" && !it.complete
              );
              if (idx >= 0) {
                const updated = { ...prev[idx] as Extract<StreamItem, { kind: "tool" }>, complete: true, toolOutput };
                return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
              }
              return prev;
            });
          }
        }
      );

      setStreamItems([]);

      if (!result.success) {
        setError(result.error || "Failed to send message");
      }

      // Fetch final messages
      await refreshMessages();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
      setStreamItems([]);
    }
  }, [run.sessionId, sending, refreshMessages]);

  const handleClose = useCallback(async () => {
    try {
      await api.sessions.close(run.sessionId);
      setResumed(false);
      setRawMessages([]);
    } catch (err: any) {
      setError(err.message || "Failed to close session");
    }
  }, [run.sessionId]);

  if (sdkAvailable === false) {
    return (
      <div className="p-6 text-center">
        <div className="text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="font-medium">Copilot SDK Not Available</p>
          <p className="text-sm mt-2">
            The <code>@github/copilot-sdk</code> package is not installed or
            configured. Set the <code>GITHUB_TOKEN</code> environment variable
            and ensure the SDK is installed.
          </p>
        </div>
      </div>
    );
  }

  if (!resumed) {
    return (
      <div className="flex items-center justify-center p-8">
        {resuming ? (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="spinner" />
            <span>Resuming session...</span>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg mb-4">
              {error}
            </div>
            <p className="text-xs text-gray-400">
              Session ID: <code>{run.sessionId}</code>
            </p>
          </div>
        ) : (
          <span className="text-gray-400">Connecting...</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Session</div>
          <div className="text-xs text-gray-500">{run.sessionId}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshMessages}
            disabled={loading}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={handleClose}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !loading && !sending && (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet. Start the conversation.</p>
          </div>
        )}

        {chatItems.map((item, idx) =>
          item.kind === "tools" ? (
            <ToolGroup key={`tg-${idx}`} tools={item.tools} />
          ) : (
            <MessageBubble
              key={item.msg.id}
              role={item.msg.role}
              content={item.msg.content}
              timestamp={item.msg.timestamp}
              toolName={item.msg.toolName}
              toolInput={item.msg.toolInput}
              toolOutput={item.msg.toolOutput}
              isReasoning={item.msg.isReasoning}
            />
          )
        )}

        {/* Streaming items — accumulated history during the current turn */}
        {sending && streamItems.length > 0 && (() => {
          // Group consecutive tool items for ToolGroup rendering
          const elements: React.ReactNode[] = [];
          let toolBatch: { id: string; toolName: string; toolInput?: string; toolOutput?: string }[] = [];

          const flushTools = () => {
            if (toolBatch.length > 0) {
              elements.push(<ToolGroup key={`stream-tg-${elements.length}`} tools={toolBatch} />);
              toolBatch = [];
            }
          };

          streamItems.forEach((item, i) => {
            if (item.kind === "tool") {
              toolBatch.push({
                id: `stream-tool-${i}`,
                toolName: item.toolName,
                toolInput: item.toolInput,
                toolOutput: item.toolOutput,
              });
            } else {
              flushTools();
              if (item.kind === "reasoning") {
                elements.push(
                  <MessageBubble key={`stream-r-${i}`} role="assistant" content={item.content} isReasoning />
                );
              } else {
                elements.push(
                  <MessageBubble key={`stream-m-${i}`} role="assistant" content={item.content} />
                );
              }
            }
          });
          flushTools();
          return elements;
        })()}

        {sending && streamItems.length === 0 && (
          <MessageBubble role="assistant" content="Thinking..." />
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={sending} />
    </div>
  );
}
