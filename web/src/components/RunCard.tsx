import { Link } from "react-router-dom";
import type { RunDetails } from "../types";

interface RunCardProps {
  run: RunDetails;
  compact?: boolean;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RunCard({ run, compact }: RunCardProps) {
  return (
    <Link
      to={`/admin/run/${run.id}`}
      className="block border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer bg-white no-underline"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-semibold text-gray-900 truncate">
              {run.name}
            </h3>
            <span className={run.success ? "badge-success" : "badge-failure"}>
              {run.success ? "✓ Pass" : "✗ Fail"}
            </span>
          </div>
          {!compact && (
            <p className="text-xs text-gray-500 mt-1 font-mono truncate">
              {run.workingDirectory}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <div className="text-xs text-gray-500">{timeAgo(run.timestamp)}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {run.duration.toFixed(1)}s
          </div>
        </div>
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-500">
          <span className="bg-gray-100 px-2 py-0.5 rounded">{run.model}</span>
          {run.agent && (
            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
              {run.agent}
            </span>
          )}
          <span className="bg-gray-100 px-2 py-0.5 rounded">
            exit: {run.exitCode}
          </span>
          {run.gitBranch && (
            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
              🔀 {run.gitBranch}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
