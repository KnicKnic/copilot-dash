import type {
  RunDetails,
  AppConfig,
  TreeNode,
  FileContent,
  UrlMatchResult,
  SessionStatus,
} from "./types";

const BASE = "";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Runs ──

export const api = {
  runs: {
    list: () => request<RunDetails[]>("/api/runs"),
    get: (id: string) => request<RunDetails>(`/api/runs/${id}`),
    tree: () => request<TreeNode[]>("/api/runs/tree"),
    match: (url: string) =>
      request<UrlMatchResult>(`/api/runs/match?url=${encodeURIComponent(url)}`),
    file: (id: string, path: string) =>
      request<FileContent>(
        `/api/runs/${id}/file?path=${encodeURIComponent(path)}`
      ),
    displayFiles: (id: string) =>
      request<{ files: string[] }>(`/api/runs/${id}/displayfiles`),
    history: (id: string) => request<RunDetails[]>(`/api/runs/${id}/history`),
    markFailed: (id: string) =>
      request<{ success: boolean }>(`/api/runs/${id}/fail`, { method: "PATCH" }),
  },

  config: {
    get: () => request<AppConfig & { configPath: string }>("/api/config"),
    update: (config: Partial<AppConfig>) =>
      request<{ success: boolean; config: AppConfig }>("/api/config", {
        method: "PUT",
        body: JSON.stringify(config),
      }),
    scan: () =>
      request<{ success: boolean; count: number }>("/api/config/scan", {
        method: "POST",
      }),
    watchStatus: () =>
      request<{
        directories: string[];
        active: boolean;
        watcherCount: number;
        recentEvents: any[];
        totalRuns: number;
      }>("/api/config/watch-status"),
    addDirectory: (directory: string) =>
      request<{ success: boolean; config: AppConfig }>(
        "/api/config/directories",
        { method: "POST", body: JSON.stringify({ directory }) }
      ),
    removeDirectory: (directory: string) =>
      request<{ success: boolean; config: AppConfig }>(
        "/api/config/directories",
        { method: "DELETE", body: JSON.stringify({ directory }) }
      ),
  },

  sessions: {
    status: () => request<SessionStatus>("/api/sessions/status"),
    resume: (
      sessionId: string,
      options?: {
        model?: string;
        workingDirectory?: string;
        mcpConfigPath?: string;
        systemMessage?: string;
      }
    ) =>
      request<{ success: boolean }>(`/api/sessions/${sessionId}/resume`, {
        method: "POST",
        body: JSON.stringify(options || {}),
      }),
    messages: (sessionId: string) =>
      request<any[]>(`/api/sessions/${sessionId}/messages`),
    send: (sessionId: string, prompt: string) =>
      request<{ success: boolean; messages: any[] }>(
        `/api/sessions/${sessionId}/send`,
        { method: "POST", body: JSON.stringify({ prompt }) }
      ),
    /**
     * Send a message with SSE streaming.
     * Calls onEvent for each streamed event (deltas, tool events, etc.).
     * Returns the final result when the stream completes.
     */
    sendStreaming: async (
      sessionId: string,
      prompt: string,
      onEvent: (event: {
        type: string;
        data?: any;
        id?: string;
        timestamp?: string;
        success?: boolean;
        error?: string;
      }) => void
    ): Promise<{ success: boolean; error?: string }> => {
      const res = await fetch(`${BASE}/api/sessions/${sessionId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: { success: boolean; error?: string } = { success: true };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "done") {
              finalResult = { success: event.success, error: event.error };
            } else {
              onEvent(event);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }

      return finalResult;
    },
    close: (sessionId: string) =>
      request<{ success: boolean }>(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      }),
  },

  health: () =>
    request<{
      status: string;
      uptime: number;
      runs: number;
      sdkAvailable: boolean;
    }>("/api/health"),
};
