import path from "node:path";
import fs from "node:fs";
import chokidar, { type FSWatcher } from "chokidar";
import { RunDetails, WatchEvent } from "./types.js";
import { parseRunFile, generateRunId } from "./scanner.js";

export class RunWatcher {
  private watchers: FSWatcher[] = [];
  private onEvent: (event: WatchEvent) => void;
  private watchedDirs: string[] = [];
  private knownRunIds: Set<string> = new Set();

  constructor(onEvent: (event: WatchEvent) => void) {
    this.onEvent = onEvent;
  }

  /** Emit a "removed" event for a run_details.json path */
  private emitRemoved(filePath: string): void {
    const id = generateRunId(filePath);
    this.knownRunIds.delete(id);
    this.onEvent({
      type: "removed",
      run: {
        id,
        filePath,
        version: "",
        exitCode: -1,
        success: false,
        sessionId: "",
        workingDirectory: "",
        name: "",
        agent: null,
        promptName: "",
        displayFiles: [],
        urlRegexp: "",
        timestamp: "",
        gitCommit: "",
        promptFile: "",
        model: "",
        duration: 0,
        gitBranch: "",
        agentFile: null,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /** Register known run IDs so unlinkDir can identify tracked runs */
  trackRunIds(ids: Iterable<string>): void {
    for (const id of ids) {
      this.knownRunIds.add(id);
    }
  }

  /** Check if a file path is a run_details.json we care about */
  private isRunDetailsFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, "/");
    return (
      normalized.includes("/.copilot_runs/") &&
      path.basename(filePath) === "run_details.json"
    );
  }

  /**
   * Start watching the given directories for run_details.json changes.
   * Chokidar v4 no longer supports globs, so we watch the .copilot_runs
   * directory directly and filter events by filename.
   */
  watchDirectories(dirs: string[]): void {
    // Close existing watchers first
    this.close();
    this.watchedDirs = [...dirs];

    for (const dir of dirs) {
      const watchTarget = path.join(dir, ".copilot_runs");

      // Skip if the .copilot_runs directory doesn't exist yet —
      // create it so chokidar has something to watch
      if (!fs.existsSync(watchTarget)) {
        fs.mkdirSync(watchTarget, { recursive: true });
      }

      console.log(`Watching directory: ${watchTarget}`);

      const watcher = chokidar.watch(watchTarget, {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      });

      watcher.on("add", (filePath) => {
        if (!this.isRunDetailsFile(filePath)) return;
        console.log(`Run file added: ${filePath}`);
        const run = parseRunFile(filePath);
        if (run) {
          this.knownRunIds.add(run.id);
          this.onEvent({
            type: "added",
            run,
            timestamp: new Date().toISOString(),
          });
        }
      });

      watcher.on("change", (filePath) => {
        if (!this.isRunDetailsFile(filePath)) return;
        console.log(`Run file changed: ${filePath}`);
        const run = parseRunFile(filePath);
        if (run) {
          this.knownRunIds.add(run.id);
          this.onEvent({
            type: "changed",
            run,
            timestamp: new Date().toISOString(),
          });
        }
      });

      watcher.on("unlink", (filePath) => {
        if (!this.isRunDetailsFile(filePath)) return;
        console.log(`Run file removed: ${filePath}`);
        this.emitRemoved(filePath);
      });

      // When a directory is deleted, chokidar fires unlinkDir instead of
      // unlink for the files inside. Emit a remove for the run_details.json
      // that would have lived in the deleted directory.
      watcher.on("unlinkDir", (dirPath) => {
        const candidate = path.join(dirPath, "run_details.json");
        const id = generateRunId(candidate);
        // Only emit if we were actually tracking this run
        if (this.knownRunIds.has(id)) {
          console.log(`Run directory removed: ${dirPath}`);
          this.emitRemoved(candidate);
        }
      });

      watcher.on("error", (error) => {
        console.error(`Watcher error for ${dir}:`, error);
      });

      this.watchers.push(watcher);
    }
  }

  getWatchedDirectories(): string[] {
    return this.watchedDirs;
  }

  getStatus(): { directories: string[]; active: boolean; watcherCount: number } {
    return {
      directories: this.watchedDirs,
      active: this.watchers.length > 0,
      watcherCount: this.watchers.length,
    };
  }

  close(): void {
    for (const watcher of this.watchers) {
      watcher.close().catch(console.error);
    }
    this.watchers = [];
    this.watchedDirs = [];
  }
}
