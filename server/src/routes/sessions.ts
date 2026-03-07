import { Router, Request, Response } from "express";
import { SessionManager } from "../sessionManager.js";

export function createSessionsRouter(
  sessionManager: SessionManager
): Router {
  const router = Router();

  /** GET /api/sessions/status — Check SDK status */
  router.get("/status", (_req: Request, res: Response) => {
    res.json({
      available: true,
      activeSessions: sessionManager.getActiveSessions(),
    });
  });

  /** POST /api/sessions/:sessionId/resume — Resume a session */
  router.post("/:sessionId/resume", async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { model, workingDirectory, mcpConfigPath, systemMessage } = req.body || {};
    const result = await sessionManager.resumeSession(sessionId, {
      model,
      workingDirectory,
      mcpConfigPath,
      systemMessage,
    });
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(500).json(result);
    }
  });

  /** GET /api/sessions/:sessionId/messages — Get session messages */
  router.get("/:sessionId/messages", async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const messages = await sessionManager.getMessages(sessionId);
    res.json(messages);
  });

  /** POST /api/sessions/:sessionId/send — Send a message (non-streaming fallback) */
  router.post("/:sessionId/send", async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "prompt field required" });
      return;
    }

    const result = await sessionManager.sendMessage(sessionId, prompt);
    if (result.success) {
      // Return updated messages
      const messages = await sessionManager.getMessages(sessionId);
      res.json({ success: true, messages });
    } else {
      res.status(500).json(result);
    }
  });

  /** POST /api/sessions/:sessionId/stream — Send a message with SSE streaming */
  router.post("/:sessionId/stream", async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "prompt field required" });
      return;
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Disable Nagle's algorithm so each write goes out immediately
    res.socket?.setNoDelay(true);

    // Stream events relevant to the UI
    const STREAMED_TYPES = new Set([
      "assistant.message_delta",
      "assistant.message",
      "assistant.reasoning",
      "assistant.reasoning_delta",
      "assistant.intent",
      "assistant.turn_start",
      "assistant.turn_end",
      "tool.execution_start",
      "tool.execution_complete",
      "tool.execution_progress",
      "session.idle",
      "session.error",
    ]);

    const result = await sessionManager.sendMessageStreaming(
      sessionId,
      prompt,
      (event) => {
        if (!STREAMED_TYPES.has(event.type)) return;
        // Write SSE event
        const payload = JSON.stringify({
          type: event.type,
          data: event.data,
          id: event.id,
          timestamp: event.timestamp,
        });
        res.write(`data: ${payload}\n\n`);
        // Flush immediately to prevent Node.js buffering
        if (typeof (res as any).flush === "function") {
          (res as any).flush();
        }
      }
    );

    // Send final status
    res.write(`data: ${JSON.stringify({ type: "done", success: result.success, error: result.error })}\n\n`);
    res.end();
  });

  /** DELETE /api/sessions/:sessionId — Close a session */
  router.delete("/:sessionId", async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    await sessionManager.closeSession(sessionId);
    res.json({ success: true });
  });

  return router;
}
