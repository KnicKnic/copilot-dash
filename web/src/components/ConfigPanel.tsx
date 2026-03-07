import { useState, useEffect } from "react";
import { api } from "../api";
import type { AppConfig } from "../types";

export default function ConfigPanel() {
  const [config, setConfig] = useState<(AppConfig & { configPath?: string }) | null>(null);
  const [newDir, setNewDir] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchStatus, setWatchStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await api.config.get();
      setConfig(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadWatchStatus = async () => {
    try {
      setStatusLoading(true);
      const data = await api.config.watchStatus();
      setWatchStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadWatchStatus();
  }, []);

  const addDirectory = async () => {
    if (!newDir.trim()) return;
    try {
      setError(null);
      const result = await api.config.addDirectory(newDir.trim());
      setConfig({ ...result.config, configPath: config?.configPath });
      setNewDir("");
      loadWatchStatus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeDirectory = async (dir: string) => {
    try {
      setError(null);
      const result = await api.config.removeDirectory(dir);
      setConfig({ ...result.config, configPath: config?.configPath });
      loadWatchStatus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const forceScan = async () => {
    try {
      setScanning(true);
      setError(null);
      const result = await api.config.scan();
      loadWatchStatus();
      alert(`Scan complete: found ${result.count} run(s)`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="spinner" />
        <span className="ml-2 text-gray-500">Loading config...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Config file path */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Configuration File
        </h3>
        <p className="font-mono text-xs text-gray-500 bg-gray-100 p-2 rounded">
          {config?.configPath || "~/.copilot-dash/config.json"}
        </p>
      </div>

      {/* Scan Directories */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Scan Directories
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Directories to search for <code>.copilot_runs/**/run_details.json</code>
        </p>

        {config?.scanDirectories.length === 0 && (
          <p className="text-sm text-gray-400 italic mb-3">
            No directories configured. Add one below.
          </p>
        )}

        <div className="space-y-2 mb-3">
          {config?.scanDirectories.map((dir) => (
            <div
              key={dir}
              className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
            >
              <span className="font-mono text-sm text-gray-700 truncate">
                {dir}
              </span>
              <button
                onClick={() => removeDirectory(dir)}
                className="text-red-500 hover:text-red-700 text-sm ml-2 flex-shrink-0"
                title="Remove directory"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add directory */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newDir}
            onChange={(e) => setNewDir(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDirectory()}
            placeholder="C:\code\my-project"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
          <button
            onClick={addDirectory}
            disabled={!newDir.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Actions</h3>
        <div className="flex gap-2">
          <button
            onClick={forceScan}
            disabled={scanning}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            {scanning ? "Scanning..." : "Force Re-scan"}
          </button>
          <button
            onClick={loadWatchStatus}
            disabled={statusLoading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* Watch Status / Debug */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          🔍 Watch Status
        </h3>
        {watchStatus ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Active:</span>
              <span
                className={
                  watchStatus.active ? "text-green-600" : "text-red-600"
                }
              >
                {watchStatus.active ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="font-medium">Watchers:</span>{" "}
              {watchStatus.watcherCount}
            </div>
            <div>
              <span className="font-medium">Total Runs:</span>{" "}
              {watchStatus.totalRuns}
            </div>
            <div>
              <span className="font-medium">Watched Dirs:</span>
              <ul className="list-disc list-inside ml-4 mt-1">
                {watchStatus.directories.map((d: string) => (
                  <li key={d} className="font-mono text-xs">
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent events */}
            {watchStatus.recentEvents?.length > 0 && (
              <div>
                <span className="font-medium">
                  Recent Events ({watchStatus.recentEvents.length}):
                </span>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {watchStatus.recentEvents
                    .slice(-20)
                    .reverse()
                    .map((evt: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs bg-white p-2 rounded border border-gray-100"
                      >
                        <span
                          className={`font-medium ${
                            evt.type === "added"
                              ? "text-green-600"
                              : evt.type === "changed"
                              ? "text-blue-600"
                              : "text-red-600"
                          }`}
                        >
                          {evt.type.toUpperCase()}
                        </span>
                        <span className="font-mono truncate">
                          {evt.run?.name || evt.run?.filePath}
                        </span>
                        <span className="text-gray-400 flex-shrink-0">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Loading status...</p>
        )}
      </div>
    </div>
  );
}
