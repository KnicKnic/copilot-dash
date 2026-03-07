import { useMemo, useState } from "react";
import { api } from "../api";
import OutputViewer from "./OutputViewer";
import FileViewer from "./FileViewer";
import type { RunDetails } from "../types";

interface DebugTabProps {
  run: RunDetails;
}

export default function DebugTab({ run }: DebugTabProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [freshData, setFreshData] = useState<RunDetails | null>(null);
  const [markingFailed, setMarkingFailed] = useState(false);
  const [markedFailed, setMarkedFailed] = useState(false);

  const forceRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await api.runs.get(run.id);
      setFreshData(data);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const forceMarkFailed = async () => {
    setMarkingFailed(true);
    try {
      await api.runs.markFailed(run.id);
      setMarkedFailed(true);
      const data = await api.runs.get(run.id);
      setFreshData(data);
    } catch (err) {
      console.error("Mark failed error:", err);
    } finally {
      setMarkingFailed(false);
    }
  };

  const displayRun = freshData || run;
  const rawJson = useMemo(() => JSON.stringify(displayRun, null, 2), [displayRun]);

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Debug Information
        </h3>
        <button
          onClick={forceRefresh}
          disabled={refreshing}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "🔄 Force Refresh"}
        </button>
        <button
          onClick={forceMarkFailed}
          disabled={markingFailed || markedFailed}
          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors disabled:opacity-50"
        >
          {markingFailed ? "Marking..." : markedFailed ? "✓ Marked Failed" : "✗ Force Mark Failed"}
        </button>
      </div>

      {freshData && (
        <div className="p-2 bg-green-50 text-green-700 text-sm rounded-lg">
          ✓ Data refreshed at {new Date().toLocaleTimeString()}
        </div>
      )}

      {/* Config Files */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Config Files
        </h4>
        <div className="space-y-2">
          {displayRun.agentFile && (
            <FileViewer
              runId={displayRun.id}
              filePath={displayRun.agentFile}
              label={`Agent: ${displayRun.agent || displayRun.agentFile}`}
              defaultExpanded={false}
              forceText
            />
          )}
          {displayRun.mcpConfigPath && (
            <FileViewer
              runId={displayRun.id}
              filePath={displayRun.mcpConfigPath}
              label={`MCP Config: ${displayRun.mcpConfigPath}`}
              defaultExpanded={false}
              forceText
            />
          )}
          {displayRun.promptFile && (
            <FileViewer
              runId={displayRun.id}
              filePath={displayRun.promptFile}
              label={`Prompt: ${displayRun.promptFile}`}
              defaultExpanded={false}
              forceText
            />
          )}
        </div>
      </div>

      {/* Full JSON */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Raw Run Data
        </h4>
        <OutputViewer output={rawJson} title="run_details" maxHeight={480} />
      </div>

      {/* Individual Fields */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Field Breakdown
        </h4>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {Object.entries(displayRun).map(([key, value]) => (
            <div key={key} className="flex px-4 py-2 text-sm">
              <span className="w-40 flex-shrink-0 font-mono text-gray-500 text-xs">
                {key}
              </span>
              <span className="font-mono text-xs text-gray-800 break-all">
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* File Path */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          File Location
        </h4>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="font-mono text-xs text-gray-700 break-all">
            {displayRun.filePath}
          </p>
        </div>
      </div>

      {/* URL Regexp */}
      {displayRun.urlRegexp && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            URL Match Pattern
          </h4>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <code className="text-xs text-purple-700">
              {displayRun.urlRegexp}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
