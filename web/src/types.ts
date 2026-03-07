/** Shared types mirroring the server types */

export interface RunDetails {
  id: string;
  filePath: string;
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

export interface AppConfig {
  scanDirectories: string[];
  port: number;
  configPath?: string;
}

export interface WatchEvent {
  type: "added" | "changed" | "removed";
  run: RunDetails;
  timestamp: string;
}

export interface TreeNode {
  name: string;
  fullPath: string;
  run?: RunDetails;
  children: TreeNode[];
}

export interface FileContent {
  path: string;
  content: string;
  isMarkdown: boolean;
  extension: string;
}

export interface UrlMatchResult {
  matched: boolean;
  runs: RunDetails[];
}

export interface SessionStatus {
  available: boolean;
  activeSessions: string[];
}
