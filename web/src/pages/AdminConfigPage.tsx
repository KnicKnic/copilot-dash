import ConfigPanel from "../components/ConfigPanel";

export default function AdminConfigPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Configuration</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage scan directories, file watching, and server settings.
        </p>
      </div>
      <ConfigPanel />
    </div>
  );
}
