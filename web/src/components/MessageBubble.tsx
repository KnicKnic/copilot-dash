import { memo, useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

export interface MessageBubbleProps {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp?: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  className?: string;
  isReasoning?: boolean;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Truncate a string to maxLen, collapsing whitespace for preview */
function truncatePreview(text: string, maxLen = 120): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.substring(0, maxLen) + "…";
}

/** Try to extract a meaningful one-liner from JSON input (e.g. first key: value) */
function summarizeInput(text: string, maxLen = 120): string {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      if (keys.length > 0) {
        const firstKey = keys[0];
        const val = typeof parsed[firstKey] === "string"
          ? parsed[firstKey]
          : JSON.stringify(parsed[firstKey]);
        const summary = `${firstKey}: ${val}`;
        return summary.length > maxLen ? summary.substring(0, maxLen) + "…" : summary;
      }
    }
  } catch {
    // not JSON, fall through
  }
  return truncatePreview(text, maxLen);
}

/** Summarize output — show size + preview */
function summarizeOutput(text: string, maxLen = 100): string {
  const len = text.length;
  const preview = truncatePreview(text, maxLen);
  if (len > 500) {
    return `${preview}  (${len.toLocaleString()} chars)`;
  }
  return preview;
}

function MessageBubbleInner({
  role,
  content,
  timestamp,
  toolName,
  toolInput,
  toolOutput,
  className = "",
  isReasoning = false,
}: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const isUser = role === "user";
  const isTool = role === "tool";
  const isSystem = role === "system";

  if (isTool) {
    const hasDetails = !!(toolInput || toolOutput);

    return (
      <div className={`session-tool ${className}`}>
        <div
          className={`session-tool-header ${hasDetails ? "cursor-pointer select-none" : ""}`}
          onClick={() => hasDetails && setExpanded(!expanded)}
        >
          {hasDetails && (
            <span className={`session-tool-chevron ${expanded ? "rotated" : ""}`}>▶</span>
          )}
          <span>Tool</span>
          {toolName && <span className="session-tool-name">{toolName}</span>}
          {timestamp && (
            <span className="session-timestamp ml-auto">{formatTime(timestamp)}</span>
          )}
        </div>

        {/* Collapsed summary */}
        {!expanded && (
          <div className="session-tool-summary">
            {toolInput && (
              <div className="session-tool-summary-line" title={toolInput}>
                {summarizeInput(toolInput)}
              </div>
            )}
            {toolOutput && (
              <div className="session-tool-summary-line session-tool-result-ok" title="Click to expand">
                ✓ {summarizeOutput(toolOutput)}
              </div>
            )}
            {!toolInput && !toolOutput && content && (
              <div className="session-tool-summary-line">
                <MarkdownRenderer content={content} />
              </div>
            )}
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="session-tool-details">
            {toolInput && (
              <div className="session-tool-section">
                <div className="session-tool-section-label">Input</div>
                <pre className="session-tool-code">{toolInput}</pre>
              </div>
            )}
            {toolOutput && (
              <div className="session-tool-section">
                <div className="session-tool-section-label">Result</div>
                <pre className="session-tool-code">{toolOutput}</pre>
              </div>
            )}
            {!toolInput && !toolOutput && content && (
              <div className="session-tool-body">
                <MarkdownRenderer content={content} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className={`session-system ${className}`}>
        <MarkdownRenderer content={content} />
        {timestamp && (
          <div className="session-timestamp">{formatTime(timestamp)}</div>
        )}
      </div>
    );
  }

  return (
    <div className={`session-message ${isUser ? "session-user" : "session-assistant"} ${isReasoning ? "session-reasoning" : ""} ${className}`}>
      <div className="session-avatar">
        {isUser ? "U" : "C"}
      </div>
      <div className={`session-bubble ${isReasoning ? "italic opacity-70" : ""}`}>
        {isReasoning && (
          <div className="text-xs font-medium text-purple-500 mb-1 not-italic">Reasoning</div>
        )}
        <MarkdownRenderer content={content} />
        {timestamp && (
          <div className="session-timestamp">{formatTime(timestamp)}</div>
        )}
      </div>
    </div>
  );
}

const MessageBubble = memo(MessageBubbleInner);
export default MessageBubble;
