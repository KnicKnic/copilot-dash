import { useState, useEffect } from "react";
import { api } from "../api";
import MarkdownRenderer from "./MarkdownRenderer";
import type { FileContent } from "../types";

interface FileViewerProps {
  runId: string;
  filePath: string;
  defaultOpen?: boolean;
  defaultExpanded?: boolean;
  label?: string;
  forceText?: boolean;
}

export default function FileViewer({
  runId,
  filePath,
  defaultOpen = false,
  defaultExpanded,
  label,
  forceText = false,
}: FileViewerProps) {
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultExpanded ?? defaultOpen);

  useEffect(() => {
    if (!open || content) return;

    setLoading(true);
    setError(null);
    api.runs
      .file(runId, filePath)
      .then(setContent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, runId, filePath, content]);

  const displayName = label || filePath.split(/[/\\]/).pop() || filePath;
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const isMarkdown = ext === "md" || ext === "markdown" || ext === "mdx";

  return (
    <details
      className="file-viewer border border-gray-200 rounded-lg overflow-hidden"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm">
        <span className="text-gray-400">{open ? "▼" : "▶"}</span>
        <span className="font-mono text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">
          {ext || "file"}
        </span>
        <span className="font-semibold text-gray-800 truncate">{displayName}</span>
        <span className="ml-auto text-xs text-gray-400 font-mono truncate">
          {filePath}
        </span>
        {loading && <span className="spinner ml-2" />}
      </summary>

      <div className="p-4 border-t border-gray-200">
        {error && (
          <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
            Failed to load: {error}
          </div>
        )}

        {content && (
          <>
            {!forceText && (content.isMarkdown || isMarkdown) ? (
              <div className="markdown-content">
                <MarkdownRenderer content={content.content} />
              </div>
            ) : (
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm whitespace-pre-wrap">
                <code>{content.content}</code>
              </pre>
            )}
          </>
        )}

        {!content && !loading && !error && (
          <p className="text-gray-400 text-sm italic">No content available</p>
        )}
      </div>
    </details>
  );
}
