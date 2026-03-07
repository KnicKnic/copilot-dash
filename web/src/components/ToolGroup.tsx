import { memo, useState } from "react";

export interface ToolCall {
  id: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  toolSuccess?: boolean;
  timestamp?: string;
}

interface ToolGroupProps {
  tools: ToolCall[];
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Truncate to one line */
function truncate(text: string, maxLen = 100): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length <= maxLen ? line : line.substring(0, maxLen) + "…";
}

/** Extract a short summary from JSON input */
function summarizeInput(text: string, maxLen = 100): string {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      const parts: string[] = [];
      for (const k of keys.slice(0, 3)) {
        const v = typeof parsed[k] === "string" ? parsed[k] : JSON.stringify(parsed[k]);
        parts.push(`${k}: ${v}`);
      }
      const summary = parts.join(", ");
      return summary.length > maxLen ? summary.substring(0, maxLen) + "…" : summary;
    }
  } catch {
    // not JSON
  }
  return truncate(text, maxLen);
}

/** Summarize output */
function summarizeOutput(text: string, maxLen = 80): string {
  const preview = truncate(text, maxLen);
  if (text.length > 500) {
    return `${preview} (${text.length.toLocaleString()} chars)`;
  }
  return preview;
}

/** A single tool call row inside the group */
function ToolCallRow({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!(tool.toolInput || tool.toolOutput);

  return (
    <div className="session-toolgroup-item">
      <div
        className={`session-toolgroup-item-header ${hasDetails ? "cursor-pointer" : ""}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {hasDetails && (
          <span className={`session-tool-chevron ${expanded ? "rotated" : ""}`}>▶</span>
        )}
        <span className="session-tool-name">{tool.toolName || "unknown"}</span>
        {!expanded && tool.toolInput && (
          <span className="session-toolgroup-inline-summary">
            {summarizeInput(tool.toolInput, 60)}
          </span>
        )}
        {!expanded && tool.toolOutput && (
          <span className="session-toolgroup-inline-result">
            ✓
          </span>
        )}
      </div>

      {expanded && (
        <div className="session-tool-details">
          {tool.toolInput && (
            <div className="session-tool-section">
              <div className="session-tool-section-label">Input</div>
              <pre className="session-tool-code">{tool.toolInput}</pre>
            </div>
          )}
          {tool.toolOutput && (
            <div className="session-tool-section">
              <div className="session-tool-section-label">Result</div>
              <pre className="session-tool-code">{tool.toolOutput}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolGroupInner({ tools }: ToolGroupProps) {
  const [expanded, setExpanded] = useState(false);

  if (tools.length === 0) return null;

  // For a single tool, render a compact card
  if (tools.length === 1) {
    const t = tools[0];
    const hasDetails = !!(t.toolInput || t.toolOutput);

    return (
      <div className="session-tool">
        <div
          className={`session-tool-header ${hasDetails ? "cursor-pointer select-none" : ""}`}
          onClick={() => hasDetails && setExpanded(!expanded)}
        >
          {hasDetails && (
            <span className={`session-tool-chevron ${expanded ? "rotated" : ""}`}>▶</span>
          )}
          <span className="session-tool-name">{t.toolName || "unknown"}</span>
          {!expanded && t.toolInput && (
            <span className="session-toolgroup-inline-summary">
              {summarizeInput(t.toolInput, 80)}
            </span>
          )}
          {!expanded && t.toolOutput && (
            <span className="session-toolgroup-inline-result">✓</span>
          )}
          {t.timestamp && (
            <span className="session-timestamp ml-auto">{formatTime(t.timestamp)}</span>
          )}
        </div>

        {expanded && (
          <div className="session-tool-details">
            {t.toolInput && (
              <div className="session-tool-section">
                <div className="session-tool-section-label">Input</div>
                <pre className="session-tool-code">{t.toolInput}</pre>
              </div>
            )}
            {t.toolOutput && (
              <div className="session-tool-section">
                <div className="session-tool-section-label">Result</div>
                <pre className="session-tool-code">{t.toolOutput}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Multiple tools — grouped card
  const allSucceeded = tools.every((t) => t.toolOutput);
  const names = tools.map((t) => t.toolName || "unknown");
  const lastTimestamp = tools[tools.length - 1]?.timestamp;

  return (
    <div className="session-tool">
      <div
        className="session-tool-header cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`session-tool-chevron ${expanded ? "rotated" : ""}`}>▶</span>
        <span className="text-xs font-semibold text-amber-800">
          {tools.length} tool calls
        </span>
        {!expanded && (
          <span className="session-toolgroup-names">
            {names.map((n, i) => (
              <span key={i} className="session-tool-name">{n}</span>
            ))}
          </span>
        )}
        {allSucceeded && !expanded && (
          <span className="session-toolgroup-inline-result">✓</span>
        )}
        {lastTimestamp && (
          <span className="session-timestamp ml-auto">{formatTime(lastTimestamp)}</span>
        )}
      </div>

      {/* When collapsed, show first tool's input summary for context */}
      {!expanded && tools[0]?.toolInput && (
        <div className="session-tool-summary">
          <div className="session-tool-summary-line" title={tools[0].toolInput}>
            {summarizeInput(tools[0].toolInput, 120)}
          </div>
        </div>
      )}

      {expanded && (
        <div className="session-toolgroup-list">
          {tools.map((t) => (
            <ToolCallRow key={t.id} tool={t} />
          ))}
        </div>
      )}
    </div>
  );
}

const ToolGroup = memo(ToolGroupInner);
export default ToolGroup;
