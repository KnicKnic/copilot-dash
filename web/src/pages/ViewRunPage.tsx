import RunViewer from "../components/RunViewer";

/**
 * Standalone run viewer page — no sidebar, designed
 * to be embedded in the Edge extension side panel.
 */
export default function ViewRunPage() {
  return (
    <div className="h-screen flex flex-col">
      <RunViewer />
    </div>
  );
}
