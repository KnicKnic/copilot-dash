import { useState, useEffect } from "react";
import { api } from "../api";
import RunCard from "./RunCard";
import type { TreeNode } from "../types";

interface TreeViewProps {
  nodes: TreeNode[];
  depth?: number;
}

function TreeView({ nodes, depth = 0 }: TreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(depth === 0 ? nodes.map((n) => n.fullPath) : [])
  );

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className={depth > 0 ? "tree-node" : ""}>
      {nodes.map((node) => {
        const isLeaf = node.children.length === 0;
        const isOpen = expanded.has(node.fullPath);

        return (
          <div key={node.fullPath}>
            {isLeaf && node.run ? (
              <div className="ml-4 mb-2">
                <RunCard run={node.run} compact />
              </div>
            ) : (
              <>
                <div
                  className="tree-node-label"
                  onClick={() => toggle(node.fullPath)}
                >
                  <span className="text-gray-400 text-xs">
                    {isOpen ? "📂" : "📁"}
                  </span>
                  <span className="font-medium text-sm text-gray-700">
                    {node.name}
                  </span>
                  {!isLeaf && (
                    <span className="text-xs text-gray-400">
                      ({node.children.length})
                    </span>
                  )}
                </div>
                {isOpen && node.children.length > 0 && (
                  <TreeView nodes={node.children} depth={depth + 1} />
                )}
                {isOpen && isLeaf && node.run && (
                  <div className="ml-4 mb-2">
                    <RunCard run={node.run} compact />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RunTree() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.runs
      .tree()
      .then(setTree)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="spinner" />
        <span className="ml-2 text-gray-500">Loading tree...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg">No runs found</p>
        <p className="text-sm mt-1">
          Configure scan directories in the Configuration page.
        </p>
      </div>
    );
  }

  return <TreeView nodes={tree} />;
}
