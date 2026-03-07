// ── Run Details (matches the JSON file structure) ──

export interface RunDetailsFile {
  version: string;
  exitCode: number;
  success: boolean;
  sessionId: string;
  workingDirectory: string;
  name: string;
  agent: string | null;
  agentFile: string | null;
  promptName: string;
  displayFiles: string[];
  urlRegexp: string;
  timestamp: string;
  gitCommit: string;
  promptFile: string;
  model: string;
  duration: number;
  gitBranch: string;
  systemMessage?: string;
  mcpConfigPath?: string;
}

/** RunDetails enriched with server-side metadata */
export interface RunDetails extends RunDetailsFile {
  /** Deterministic URL-safe ID (base64url of filePath) */
  id: string;
  /** Absolute path to the run_details.json file */
  filePath: string;
}

// ── Configuration ──

export interface AppConfig {
  /** Directories to scan for .copilot_runs */
  scanDirectories: string[];
  /** Server port */
  port: number;
}

// ── Watch Events ──

export interface WatchEvent {
  type: "added" | "changed" | "removed";
  run: RunDetails;
  timestamp: string;
}

// ── Session types ──

export interface SessionMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCall?: {
    name: string;
    arguments: string;
  };
  toolResult?: {
    name: string;
    content: string;
  };
}
