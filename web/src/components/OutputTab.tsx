import { useState, useEffect } from "react";
import { api } from "../api";
import FileViewer from "./FileViewer";
import type { RunDetails } from "../types";

interface OutputTabProps {
  run: RunDetails;
}

export default function OutputTab({ run }: OutputTabProps) {
  const [resolvedFiles, setResolvedFiles] = useState<string[] | null>(null);

  useEffect(() => {
    if (run.displayFiles.length === 0) {
      setResolvedFiles([]);
      return;
    }
    api.runs
      .displayFiles(run.id)
      .then(({ files }) => setResolvedFiles(files))
      .catch(() => setResolvedFiles(run.displayFiles));
  }, [run.id]);

  const files = resolvedFiles ?? run.displayFiles;

  return (
    <div className="space-y-4">
      {/* Display Files */}
      {files.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-700">Display Files</div>
          {files.map((file, index) => (
            <FileViewer
              key={file}
              runId={run.id}
              filePath={file}
              defaultExpanded={index === 0}
              label={index === 0 ? `${file} (primary)` : file}
            />
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <p>No display files for this run.</p>
          <p className="text-xs mt-1">
            The run completed with exit code {run.exitCode}.
          </p>
        </div>
      )}

      {/* Run Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Run Summary
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Status:</span>{" "}
            <span className={run.success ? "text-green-600" : "text-red-600"}>
              {run.success ? "Success" : "Failed"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Exit Code:</span> {run.exitCode}
          </div>
          <div>
            <span className="text-gray-500">Model:</span> {run.model}
          </div>
          <div>
            <span className="text-gray-500">Duration:</span>{" "}
            {run.duration.toFixed(1)}s
          </div>
          <div>
            <span className="text-gray-500">Branch:</span>{" "}
            {run.gitBranch || "N/A"}
          </div>
          <div>
            <span className="text-gray-500">Timestamp:</span>{" "}
            {new Date(run.timestamp).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
