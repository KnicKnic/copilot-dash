import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { RunDetails, RunDetailsFile } from "./types.js";

/**
 * Generate a deterministic, URL-safe ID from a file path.
 */
export function generateRunId(filePath: string): string {
  return Buffer.from(filePath).toString("base64url");
}

/**
 * Decode a run ID back to the original file path.
 */
export function decodeRunId(id: string): string {
  return Buffer.from(id, "base64url").toString();
}

/**
 * Parse a single run_details.json file into a RunDetails object.
 */
export function parseRunFile(filePath: string): RunDetails | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as RunDetailsFile;
    return {
      ...data,
      id: generateRunId(filePath),
      filePath,
    };
  } catch (err) {
    console.error(`Failed to parse run file ${filePath}:`, err);
    return null;
  }
}

/**
 * Scan a single directory for run_details.json files
 * under the .copilot_runs folder hierarchy.
 */
export function scanDirectory(dir: string): RunDetails[] {
  const normalizedDir = dir.replace(/\\/g, "/");
  const pattern = `${normalizedDir}/.copilot_runs/**/run_details.json`;

  let files: string[];
  try {
    files = fg.sync(pattern, {
      dot: true,
      absolute: true,
      onlyFiles: true,
    });
  } catch (err) {
    console.error(`Failed to scan directory ${dir}:`, err);
    return [];
  }

  const runs: RunDetails[] = [];
  for (const file of files) {
    const run = parseRunFile(file);
    if (run) {
      runs.push(run);
    }
  }
  return runs;
}

/**
 * Scan multiple directories and return all discovered runs.
 */
export function scanAllDirectories(dirs: string[]): Map<string, RunDetails> {
  const runs = new Map<string, RunDetails>();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.warn(`Scan directory does not exist: ${dir}`);
      continue;
    }
    const found = scanDirectory(dir);
    for (const run of found) {
      runs.set(run.id, run);
    }
    console.log(`Scanned ${dir}: found ${found.length} run(s)`);
  }
  return runs;
}

/**
 * Resolve displayFiles patterns (which may contain globs) to concrete relative paths.
 * Literal paths are passed through unchanged; glob patterns are expanded via fast-glob.
 */
export function resolveDisplayFiles(run: RunDetails): string[] {
  const results: string[] = [];
  const base = run.workingDirectory.replace(/\\/g, "/");

  for (const pattern of run.displayFiles) {
    if (fg.isDynamicPattern(pattern)) {
      const fullPattern = `${base}/${pattern.replace(/\\/g, "/")}`;
      try {
        const matches = fg.sync(fullPattern, { dot: true, onlyFiles: true });
        for (const match of matches) {
          const rel = path
            .relative(run.workingDirectory, match)
            .replace(/\\/g, "/");
          results.push(rel);
        }
      } catch {
        // Pattern couldn't be expanded; keep as-is
        results.push(pattern);
      }
    } else {
      results.push(pattern);
    }
  }

  return results;
}

/**
 * Read a file relative to a run's working directory.
 * Returns null if the file doesn't exist or the path is invalid.
 */
export function readRunFile(
  run: RunDetails,
  relativePath: string
): string | null {
  // Security: prevent directory traversal
  const resolved = path.resolve(run.workingDirectory, relativePath);
  const normalizedBase = path.resolve(run.workingDirectory);
  if (!resolved.startsWith(normalizedBase)) {
    console.warn(`Path traversal attempt blocked: ${relativePath}`);
    return null;
  }

  try {
    if (!fs.existsSync(resolved)) return null;
    return fs.readFileSync(resolved, "utf-8");
  } catch {
    return null;
  }
}
