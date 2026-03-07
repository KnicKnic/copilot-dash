/**
 * SessionManager handles resuming and interacting with Copilot SDK sessions.
 * Sessions are cached for 3 minutes of inactivity.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { CopilotClient, CopilotSession, approveAll } from "@github/copilot-sdk";
import type { SessionEvent, ResumeSessionConfig, MCPServerConfig, MCPLocalServerConfig } from "@github/copilot-sdk";

interface ManagedSession {
  session: CopilotSession;
  lastActivity: number;
}

export class SessionManager {
  private client: CopilotClient | null = null;
  private sessions = new Map<string, ManagedSession>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private sdkAvailable = false;

  private static readonly SESSION_TIMEOUT = 3 * 60 * 1000; // 3 minutes

  /** Path to the mcp-wrapper executable that fixes env var propagation */
  private static readonly MCP_WRAPPER_PATHS = [
    path.join(os.homedir(), "OneDrive - Microsoft", "Documents", "PowerShell", "Modules", "CopilotShell", "mcp-wrapper.exe"),
    "C:\\Program Files\\PowerShell\\7\\Modules\\CopilotShell\\mcp-wrapper.exe",
  ];

  private mcpWrapperPath: string | null = null;

  async start(): Promise<void> {
    try {
      this.client = new CopilotClient();
      await this.client.start();
      this.sdkAvailable = true;
      console.log("✓ Copilot SDK client started");

      // Resolve mcp-wrapper: check PATH first, then known locations
      this.mcpWrapperPath = this.resolveMcpWrapper();
      if (this.mcpWrapperPath) {
        console.log(`✓ mcp-wrapper found: ${this.mcpWrapperPath}`);
      } else {
        console.warn("⚠ mcp-wrapper not found — MCP servers with env vars may not work correctly");
      }
    } catch (err) {
      console.error("Failed to start Copilot SDK client:", err);
      this.sdkAvailable = false;
      return;
    }

    // Cleanup idle sessions every 60 seconds
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      60_000
    );
  }

  isAvailable(): boolean {
    return this.sdkAvailable;
  }

  async resumeSession(
    sessionId: string,
    options?: {
      model?: string;
      workingDirectory?: string;
      mcpConfigPath?: string;
      systemMessage?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.sdkAvailable || !this.client) {
      return { success: false, error: "Copilot SDK not available" };
    }

    try {
      // Check if already cached
      if (this.sessions.has(sessionId)) {
        this.touchSession(sessionId);
        return { success: true };
      }

      // Build ResumeSessionConfig from run details
      const config: ResumeSessionConfig = {
        onPermissionRequest: approveAll,
      };

      if (options?.model) {
        config.model = options.model;
      }

      if (options?.workingDirectory) {
        config.workingDirectory = options.workingDirectory;
      }

      // Set system message: use the one from run details, or default
      const sysMsg = options?.systemMessage || "You are helpful fully autonomous agent.";
      config.systemMessage = { mode: "replace", content: sysMsg };

      // Enable infinite sessions
      config.infiniteSessions = { enabled: true };

      // Enable streaming so the CLI sends delta events
      config.streaming = true;

      // Load MCP servers from the config file if it exists
      if (options?.mcpConfigPath) {
        try {
          // Resolve relative paths against workingDirectory (not server cwd)
          const resolvedMcpConfigPath = path.isAbsolute(options.mcpConfigPath)
            ? options.mcpConfigPath
            : path.resolve(options.workingDirectory || process.cwd(), options.mcpConfigPath);
          const mcpServers = this.loadMcpServers(resolvedMcpConfigPath);
          if (mcpServers) {
            config.mcpServers = mcpServers;
          }
        } catch (err) {
          console.warn(`Failed to load MCP config from ${options.mcpConfigPath}:`, err);
        }
      }

      console.log(`Resuming session ${sessionId} with config:`, {
        model: config.model,
        workingDirectory: config.workingDirectory,
        systemMessage: sysMsg.substring(0, 60) + (sysMsg.length > 60 ? "..." : ""),
        mcpServers: config.mcpServers ? Object.keys(config.mcpServers) : [],
      });

      const session = await this.client.resumeSession(sessionId, config);
      this.sessions.set(sessionId, {
        session,
        lastActivity: Date.now(),
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Load MCP server configurations from an mcp-config.json file.
   * Expects the format: { mcpServers: { serverName: { command, args, ... } } }
   * Supports JSONC (comments + trailing commas) via jsonc-parser.
   */
  private loadMcpServers(configPath: string): Record<string, MCPServerConfig> | null {
    if (!fs.existsSync(configPath)) {
      console.warn(`MCP config file not found: ${configPath}`);
      return null;
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = parseJsonc(raw);

    // The mcp-config.json format has { _sourceHash, mcpServers: { ... } }
    const servers = parsed.mcpServers || parsed.servers || parsed;
    if (!servers || typeof servers !== "object") {
      return null;
    }

    const result: Record<string, MCPServerConfig> = {};
    for (const [name, config] of Object.entries(servers)) {
      if (name.startsWith("_")) continue; // skip metadata fields like _sourceHash
      const serverConfig = config as MCPServerConfig;

      // Wrap local MCP servers that have env or cwd through mcp-wrapper
      if (this.mcpWrapperPath && this.isLocalServerNeedingWrapper(serverConfig)) {
        result[name] = this.wrapMcpServer(serverConfig as MCPLocalServerConfig);
        console.log(`  Wrapped MCP server '${name}' via mcp-wrapper`);
      } else {
        result[name] = serverConfig;
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Check whether a server config is a local MCP server that needs wrapping.
   * All local servers are wrapped through mcp-wrapper for consistent process launching.
   */
  private isLocalServerNeedingWrapper(config: MCPServerConfig): boolean {
    // Remote servers (http/sse) don't have 'command', only 'url'
    if (!("command" in config)) return false;

    return true;
  }

  /**
   * Wrap a local MCP server config to use mcp-wrapper.exe.
   * The wrapper becomes the command, and the original command/args/env/cwd
   * become wrapper arguments:
   *   mcp-wrapper --env KEY=VAL --cwd DIR -- original-command arg1 arg2
   */
  private wrapMcpServer(original: MCPLocalServerConfig): MCPLocalServerConfig {
    // Separator + original command and args
    const wrappedArgs: string[] = ["--", original.command];
    if (original.args && original.args.length > 0) {
      wrappedArgs.push(...original.args);
    }

    return {
      command: this.mcpWrapperPath!,
      args: wrappedArgs,
      env: original.env,
      cwd: original.cwd,
      tools: original.tools,
      type: original.type,
      timeout: original.timeout,
    } as MCPLocalServerConfig;
  }

  /**
   * Resolve the mcp-wrapper executable.
   * Searches PATH directories first, then falls back to known locations.
   */
  private resolveMcpWrapper(): string | null {
    const exeName = process.platform === "win32" ? "mcp-wrapper.exe" : "mcp-wrapper";
    const extensions = process.platform === "win32" ? [""] : [""];

    // Search PATH directories
    const pathDirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
    for (const dir of pathDirs) {
      const candidate = path.join(dir, exeName);
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch {
        // skip inaccessible directories
      }
    }

    // Fall back to known locations
    for (const candidate of SessionManager.MCP_WRAPPER_PATHS) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  async getMessages(sessionId: string): Promise<SessionEvent[]> {
    const managed = this.sessions.get(sessionId);
    if (!managed) return [];

    this.touchSession(sessionId);
    try {
      const messages = await managed.session.getMessages();
      return messages;
    } catch (err) {
      console.error(`Failed to get messages for ${sessionId}:`, err);
      return [];
    }
  }

  async sendMessage(
    sessionId: string,
    prompt: string
  ): Promise<{ success: boolean; error?: string }> {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return { success: false, error: "Session not found. Resume it first." };
    }

    this.touchSession(sessionId);
    try {
      await managed.session.sendAndWait({ prompt }, 120_000);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Send a message and stream events back via a callback.
   * Uses session.send() + session.on() for real-time streaming.
   * Returns a promise that resolves when the assistant is idle.
   */
  async sendMessageStreaming(
    sessionId: string,
    prompt: string,
    onEvent: (event: SessionEvent) => void
  ): Promise<{ success: boolean; error?: string }> {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return { success: false, error: "Session not found. Resume it first." };
    }

    this.touchSession(sessionId);

    return new Promise((resolve) => {
      let settled = false;

      const finish = (result: { success: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve(result);
      };

      const unsubscribe = managed.session.on((event: SessionEvent) => {
        onEvent(event);
        if (event.type === "session.idle") {
          finish({ success: true });
        }
        if (event.type === "session.error") {
          finish({ success: false, error: (event.data as any)?.message || "Session error" });
        }
      });

      const timeout = setTimeout(() => {
        finish({ success: false, error: "Streaming timeout after 5 minutes" });
      }, 5 * 60_000);

      managed.session.send({ prompt }).catch((err: any) => {
        finish({ success: false, error: err.message || String(err) });
      });
    });
  }

  async closeSession(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (managed) {
      try {
        await managed.session.destroy();
      } catch {
        // ignore destroy errors
      }
      this.sessions.delete(sessionId);
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  private touchSession(sessionId: string): void {
    const managed = this.sessions.get(sessionId);
    if (managed) {
      managed.lastActivity = Date.now();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, managed] of this.sessions) {
      if (now - managed.lastActivity > SessionManager.SESSION_TIMEOUT) {
        console.log(`Closing idle session: ${id}`);
        managed.session.destroy().catch(() => {});
        this.sessions.delete(id);
      }
    }
  }

  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const [, managed] of this.sessions) {
      try {
        await managed.session.destroy();
      } catch {
        // ignore
      }
    }
    this.sessions.clear();

    if (this.client) {
      try {
        await this.client.stop();
      } catch {
        // ignore
      }
    }
  }
}
