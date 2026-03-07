import RunViewer from "../components/RunViewer";

/**
 * Run viewer within the admin layout — keeps the sidebar visible.
 */
export default function AdminRunPage() {
  return (
    <div className="h-full flex flex-col">
      <RunViewer />
    </div>
  );
}
