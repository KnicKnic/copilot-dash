import { Router, Request, Response } from "express";
import fs from "node:fs";
import { RunDetails } from "../types.js";
import { readRunFile, decodeRunId, resolveDisplayFiles } from "../scanner.js";

export function createRunsRouter(runs: Map<string, RunDetails>): Router {
  const router = Router();

  /** GET /api/runs — List all runs, optionally sorted */
  router.get("/", (_req: Request, res: Response) => {
    const allRuns = Array.from(runs.values());
    // Sort by timestamp descending (most recent first)
    allRuns.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    res.json(allRuns);
  });

  /** GET /api/runs/match?url=<url> — Find run whose urlRegexp matches the given URL */
  router.get("/match", (req: Request, res: Response) => {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: "url query parameter required" });
      return;
    }

    // Find the most recent run for each name that matches the URL
    const byName = new Map<string, RunDetails>();
    for (const run of runs.values()) {
      if (!run.urlRegexp) continue;
      try {
        const re = new RegExp(run.urlRegexp);
        if (re.test(url)) {
          const existing = byName.get(run.name);
          if (
            !existing ||
            new Date(run.timestamp).getTime() >
              new Date(existing.timestamp).getTime()
          ) {
            byName.set(run.name, run);
          }
        }
      } catch {
        // Invalid regex, skip
      }
    }

    const matches = Array.from(byName.values());
    if (matches.length === 0) {
      res.json({ matched: false, runs: [] });
      return;
    }

    res.json({ matched: true, runs: matches });
  });

  /** GET /api/runs/tree — Get runs organized as a tree by name */
  router.get("/tree", (_req: Request, res: Response) => {
    // Group runs by name, keeping only the most recent per name
    const byName = new Map<string, RunDetails>();
    for (const run of runs.values()) {
      const existing = byName.get(run.name);
      if (
        !existing ||
        new Date(run.timestamp).getTime() >
          new Date(existing.timestamp).getTime()
      ) {
        byName.set(run.name, run);
      }
    }

    // Build tree structure
    interface TreeNode {
      name: string;
      fullPath: string;
      run?: RunDetails;
      children: TreeNode[];
    }

    const root: TreeNode = { name: "", fullPath: "", children: [] };

    for (const [name, run] of byName) {
      // Split on both "/" and "_" to create deeper category hierarchy
      // e.g. "pipeline/1977_833122" → ["pipeline", "1977", "833122"]
      const parts = name.split(/[\/\_]/);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const fullPath = parts.slice(0, i + 1).join("/");
        let child = current.children.find((c) => c.name === part);
        if (!child) {
          child = { name: part, fullPath, children: [] };
          current.children.push(child);
        }
        current = child;
      }

      current.run = run;
    }

    // Sort children by most recent timestamp first; non-leaf nodes use
    // the most recent timestamp among their descendants
    function getNewestTimestamp(node: TreeNode): number {
      if (node.run) return new Date(node.run.timestamp).getTime();
      if (node.children.length === 0) return 0;
      return Math.max(...node.children.map(getNewestTimestamp));
    }

    function sortTree(node: TreeNode) {
      node.children.sort(
        (a, b) => getNewestTimestamp(b) - getNewestTimestamp(a)
      );
      node.children.forEach(sortTree);
    }
    sortTree(root);

    res.json(root.children);
  });

  /** GET /api/runs/:id/displayfiles — Return glob-expanded display file paths */
  router.get("/:id/displayfiles", (req: Request, res: Response) => {
    const run = runs.get(req.params.id as string);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    const files = resolveDisplayFiles(run);
    res.json({ files });
  });

  /** GET /api/runs/:id — Get a specific run */
  router.get("/:id", (req: Request, res: Response) => {
    const run = runs.get(req.params.id as string);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json(run);
  });

  /** GET /api/runs/:id/file?path=<relativePath> — Read a file from the run's working directory */
  router.get("/:id/file", (req: Request, res: Response) => {
    const run = runs.get(req.params.id as string);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "path query parameter required" });
      return;
    }

    const content = readRunFile(run, filePath);
    if (content === null) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Determine content type
    const ext = filePath.split(".").pop()?.toLowerCase();
    const markdownExts = ["md", "markdown", "mdx"];
    const isMarkdown = ext && markdownExts.includes(ext);

    res.json({
      path: filePath,
      content,
      isMarkdown,
      extension: ext || "",
    });
  });

  /** PATCH /api/runs/:id/fail — Force-mark a run as failed */
  router.patch("/:id/fail", (req: Request, res: Response) => {
    const run = runs.get(req.params.id as string);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    try {
      const raw = fs.readFileSync(run.filePath, "utf-8");
      const data = JSON.parse(raw);
      data.success = false;
      data.exitCode = 1;
      fs.writeFileSync(run.filePath, JSON.stringify(data, null, 2), "utf-8");

      // Update in-memory record
      run.success = false;
      run.exitCode = 1;

      res.json({ success: true });
    } catch (err) {
      console.error("Failed to mark run as failed:", err);
      res.status(500).json({ error: "Failed to update run file" });
    }
  });

  /** GET /api/runs/:id/history — Get all versions of a run by name */
  router.get("/:id/history", (req: Request, res: Response) => {
    const run = runs.get(req.params.id as string);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    const history = Array.from(runs.values())
      .filter((r) => r.name === run.name)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    res.json(history);
  });

  return router;
}
