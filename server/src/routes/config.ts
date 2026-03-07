import { Router, Request, Response } from "express";
import { loadConfig, saveConfig, getConfigPath } from "../config.js";
import { RunWatcher } from "../watcher.js";
import { WatchEvent, RunDetails } from "../types.js";
import { scanAllDirectories } from "../scanner.js";

export function createConfigRouter(
  watcher: RunWatcher,
  runs: Map<string, RunDetails>,
  recentEvents: WatchEvent[],
  onConfigChange: () => void
): Router {
  const router = Router();

  /** GET /api/config — Get current configuration */
  router.get("/", (_req: Request, res: Response) => {
    const config = loadConfig();
    res.json({
      ...config,
      configPath: getConfigPath(),
    });
  });

  /** PUT /api/config — Update configuration */
  router.put("/", (req: Request, res: Response) => {
    try {
      const config = loadConfig();
      const updates = req.body;

      if (updates.scanDirectories !== undefined) {
        config.scanDirectories = updates.scanDirectories;
      }
      if (updates.port !== undefined) {
        config.port = updates.port;
      }

      saveConfig(config);

      // Re-scan and restart watchers
      onConfigChange();

      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update config" });
    }
  });

  /** POST /api/config/scan — Force a re-scan of all directories */
  router.post("/scan", (_req: Request, res: Response) => {
    try {
      const config = loadConfig();
      const found = scanAllDirectories(config.scanDirectories);

      // Merge discovered runs
      runs.clear();
      for (const [id, run] of found) {
        runs.set(id, run);
      }

      res.json({ success: true, count: runs.size });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Scan failed" });
    }
  });

  /** GET /api/config/watch-status — Get file watcher status */
  router.get("/watch-status", (_req: Request, res: Response) => {
    res.json({
      ...watcher.getStatus(),
      recentEvents: recentEvents.slice(-50),
      totalRuns: runs.size,
    });
  });

  /** POST /api/config/directories — Add a scan directory */
  router.post("/directories", (req: Request, res: Response) => {
    const { directory } = req.body;
    if (!directory) {
      res.status(400).json({ error: "directory field required" });
      return;
    }

    const config = loadConfig();
    if (!config.scanDirectories.includes(directory)) {
      config.scanDirectories.push(directory);
      saveConfig(config);
      onConfigChange();
    }

    res.json({ success: true, config });
  });

  /** DELETE /api/config/directories — Remove a scan directory */
  router.delete("/directories", (req: Request, res: Response) => {
    const { directory } = req.body;
    if (!directory) {
      res.status(400).json({ error: "directory field required" });
      return;
    }

    const config = loadConfig();
    config.scanDirectories = config.scanDirectories.filter(
      (d) => d !== directory
    );
    saveConfig(config);
    onConfigChange();

    res.json({ success: true, config });
  });

  return router;
}
