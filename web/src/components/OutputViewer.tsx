import { useCallback, useMemo, useState } from "react";

interface OutputViewerProps {
  output: string | null | undefined;
  title?: string;
  maxHeight?: number;
  isError?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

function ClipboardIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75h6a2.25 2.25 0 012.25 2.25v12A2.25 2.25 0 0115 20.25H9A2.25 2.25 0 016.75 18V6A2.25 2.25 0 019 3.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75V3a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 3v.75" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ChevronIcon({ className = "h-4 w-4", expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export default function OutputViewer({
  output,
  title = "Output",
  maxHeight = 400,
  isError = false,
  defaultCollapsed = false,
  className = "",
}: OutputViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [copied, setCopied] = useState(false);

  const lineCount = useMemo(() => (output ? output.split("\n").length : 0), [output]);
  const isLongOutput = lineCount > 20;

  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [output]);

  if (!output) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 ${className}`}>
        <div className="px-4 py-3 border-b border-gray-200 text-sm font-medium text-gray-700">
          {title}
        </div>
        <div className="p-4 text-sm text-gray-500 italic">No output available</div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border ${
        isError ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"
      } ${className}`}
    >
      <div
        className={`px-4 py-3 border-b ${
          isError ? "border-red-200" : "border-gray-200"
        } flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${isError ? "text-red-700" : "text-gray-700"}`}>
            {title}
          </span>
          <span className="text-xs text-gray-500">{lineCount} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
              copied
                ? "bg-green-100 text-green-700"
                : isError
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {copied ? <CheckIcon /> : <ClipboardIcon />}
            {copied ? "Copied" : "Copy"}
          </button>
          {isLongOutput && (
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                isError
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <ChevronIcon expanded={!isCollapsed} />
              {isCollapsed ? "Expand" : "Collapse"}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="overflow-auto" style={{ maxHeight: `${maxHeight}px` }}>
          <pre className={`p-4 text-sm font-mono whitespace-pre-wrap break-words ${
            isError ? "text-red-800" : "text-gray-800"
          }`}>
            {output}
          </pre>
        </div>
      )}

      {isCollapsed && (
        <div
          className="px-4 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-100"
          onClick={() => setIsCollapsed(false)}
        >
          Click to expand ({lineCount} lines)
        </div>
      )}
    </div>
  );
}
