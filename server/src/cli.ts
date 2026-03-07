#!/usr/bin/env node

/**
 * CLI entry point for copilot-dash.
 *
 * Usage:
 *   copilot-dash                              Start server
 *   copilot-dash --tray                       Start with system tray icon
 *   copilot-dash --detach                     Spawn detached background process, then exit
 *   copilot-dash --tray --detach              Spawn detached tray process, then exit
 *   copilot-dash --install-autostart          Register autostart and exit
 *   copilot-dash --tray --install-autostart   Register autostart, then start tray
 *   copilot-dash --remove-autostart           Remove autostart and exit
 *   copilot-dash --port 4000                  Override server port
 */

import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import {
  installAutostart,
  removeAutostart,
  isAutostartInstalled,
} from "./autostart.js";

const { values } = parseArgs({
  options: {
    tray: { type: "boolean", default: false },
    detach: { type: "boolean", default: false },
    "install-autostart": { type: "boolean", default: false },
    "remove-autostart": { type: "boolean", default: false },
    port: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: false,
});

if (values.help) {
  console.log(`
Copilot Dash — dashboard for Copilot CLI run results

Usage: copilot-dash [options]

Options:
  --tray               Start with system tray icon
  --detach             Start as a detached background process
  --install-autostart  Register OS autostart (idempotent; exits unless combined with --tray)
  --remove-autostart   Remove OS autostart and exit
  --port <number>      Override server port
  -h, --help           Show this help
`);
  process.exit(0);
}

// ── Remove autostart ──
if (values["remove-autostart"]) {
  removeAutostart();
  process.exit(0);
}

// ── Install autostart (idempotent) ──
if (values["install-autostart"]) {
  if (!isAutostartInstalled()) {
    installAutostart({ tray: true });
  } else {
    console.log("Autostart already registered.");
  }
  // If no other start flag, exit after registering
  if (!values.tray && !values.detach) {
    process.exit(0);
  }
}

// ── Detach: re-spawn ourselves without --detach, then exit ──
if (values.detach) {
  const args = process.argv.slice(2).filter((a) => a !== "--detach");
  const child = spawn(process.execPath, [process.argv[1], ...args], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  console.log(`Copilot Dash started in background (PID: ${child.pid})`);
  process.exit(0);
}

// ── Set port override via env var ──
if (values.port) {
  process.env.COPILOT_DASH_PORT = values.port as string;
}

// ── Start ──
if (values.tray) {
  await import("./tray.js");
} else {
  await import("./index.js");
}
