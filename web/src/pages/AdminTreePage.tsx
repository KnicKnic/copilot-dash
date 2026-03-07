import RunTree from "../components/RunTree";

export default function AdminTreePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Tree View</h2>
        <p className="text-sm text-gray-500 mt-1">
          Browse runs organized by their name hierarchy.
        </p>
      </div>
      <RunTree />
    </div>
  );
}
