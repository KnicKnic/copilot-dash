import { useSocket } from "../useSocket";
import RunCard from "./RunCard";

export default function RecentRuns() {
  const { runs } = useSocket();

  // Sort by timestamp descending
  const sorted = [...runs].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg">No runs found</p>
        <p className="text-sm mt-1">
          Configure scan directories in the Configuration page, then runs will
          appear here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((run) => (
        <RunCard key={run.id} run={run} />
      ))}
    </div>
  );
}
