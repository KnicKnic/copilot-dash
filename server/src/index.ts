import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, saveConfig } from "./config.js";
import { scanAllDirectories } from "./scanner.js";
import { RunWatcher } from "./watcher.js";
import { SessionManager } from "./sessionManager.js";
import { createRunsRouter } from "./routes/runs.js";
import { createConfigRouter } from "./routes/config.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { RunDetails, WatchEvent } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── State ──
const runs = new Map<string, RunDetails>();
const recentEvents: WatchEvent[] = [];
const MAX_EVENTS = 200;

// ── Config ──
const config = loadConfig();
const PORT = process.env.COPILOT_DASH_PORT
  ? parseInt(process.env.COPILOT_DASH_PORT, 10)
  : config.port || 3456;

// ── Express Setup ──
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

app.use(express.json());
app.use(cors());

// ── Serve static frontend (production build) ──
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// ── Session Manager ──
const sessionManager = new SessionManager();

// ── File Watcher ──
const watcher = new RunWatcher((event: WatchEvent) => {
  // Update runs map
  if (event.type === "removed") {
    runs.delete(event.run.id);
  } else {
    runs.set(event.run.id, event.run);
  }

  // Store event
  recentEvents.push(event);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_EVENTS);
  }

  // Broadcast to connected clients
  io.emit("run:event", event);
});

function onConfigChange() {
  const freshConfig = loadConfig();
  // Re-scan
  const found = scanAllDirectories(freshConfig.scanDirectories);
  runs.clear();
  for (const [id, run] of found) {
    runs.set(id, run);
  }
  // Restart watchers
  watcher.watchDirectories(freshConfig.scanDirectories);
  watcher.trackRunIds(runs.keys());
  // Notify clients
  io.emit("config:changed", freshConfig);
  io.emit("runs:refreshed", Array.from(runs.values()));
}

// ── API Routes ──
app.use("/api/runs", createRunsRouter(runs));
app.use(
  "/api/config",
  createConfigRouter(watcher, runs, recentEvents, onConfigChange)
);
app.use("/api/sessions", createSessionsRouter(sessionManager));

// ── Health check ──
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    runs: runs.size,
    sdkAvailable: sessionManager.isAvailable(),
  });
});

// ── SPA fallback: serve index.html for non-API routes ──
app.get("/{*splat}", (_req, res) => {
  const indexPath = path.join(publicDir, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: "Frontend not built. Run: npm run build:web" });
    }
  });
});

// ── Socket.IO ──
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current runs on connect, sorted by most recent first
  const sortedRuns = Array.from(runs.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  socket.emit("runs:initial", sortedRuns);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ── Startup ──
async function start() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║        Copilot Dash Server           ║");
  console.log("╚══════════════════════════════════════╝");

  // Initial scan
  console.log(`\nScanning ${config.scanDirectories.length} directory(ies)...`);
  const found = scanAllDirectories(config.scanDirectories);
  for (const [id, run] of found) {
    runs.set(id, run);
  }
  console.log(`Found ${runs.size} total run(s)\n`);

  // Start watchers
  watcher.watchDirectories(config.scanDirectories);
  watcher.trackRunIds(runs.keys());

  // Start session manager
  await sessionManager.start();

  // Start HTTP server
  httpServer.listen(PORT, "127.0.0.1", () => {
    console.log(`\n✓ Server running at http://localhost:${PORT}`);
    console.log(`  API:      http://localhost:${PORT}/api`);
    console.log(`  Frontend: http://localhost:${PORT}`);
  });
}

// ── Graceful shutdown ──
async function shutdown() {
  console.log("\nShutting down...");
  watcher.close();
  await sessionManager.stop();
  httpServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

export { app, httpServer, io, runs };
