import RecentRuns from "../components/RecentRuns";

export default function AdminRecentPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Recent Runs</h2>
        <p className="text-sm text-gray-500 mt-1">
          Live-updating list of all Copilot CLI runs, most recent first.
        </p>
      </div>
      <RecentRuns />
    </div>
  );
}
