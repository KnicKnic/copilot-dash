import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import OutputTab from "./OutputTab";
import SessionTab from "./SessionTab";
import DebugTab from "./DebugTab";
import type { RunDetails } from "../types";

type Tab = "output" | "session" | "debug";

export default function RunViewer() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [run, setRun] = useState<RunDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeTab = (searchParams.get("tab") as Tab) || "output";

  const setTab = (tab: Tab) => {
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.runs
      .get(id)
      .then(setRun)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <span className="spinner" />
        <span className="ml-2 text-gray-500">Loading run...</span>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 rounded-lg p-4">
          <p className="font-medium">Failed to load run</p>
          <p className="text-sm mt-1">{error || "Run not found"}</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "output", label: "📄 Output" },
    { id: "session", label: "💬 Session" },
    { id: "debug", label: "🔍 Debug" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-sm font-bold text-gray-900">
              {run.name}
            </h2>
            <span className={run.success ? "badge-success" : "badge-failure"}>
              {run.success ? "✓ Pass" : "✗ Fail"}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {new Date(run.timestamp).toLocaleString()} · {run.model} ·{" "}
            {run.duration.toFixed(1)}s
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`pb-2 px-1 text-sm transition-colors ${
                activeTab === tab.id ? "tab-active" : "tab-inactive"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "output" && <OutputTab run={run} />}
        {activeTab === "session" && <SessionTab run={run} />}
        {activeTab === "debug" && <DebugTab run={run} />}
      </div>
    </div>
  );
}
