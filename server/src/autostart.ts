/**
 * Manages OS-level autostart registration.
 * Windows: VBS launcher in shell:startup folder
 * macOS:   launchd plist in ~/Library/LaunchAgents/
 * Linux:   systemd user service in ~/.config/systemd/user/
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

// ── Paths per platform ──

const WIN_STARTUP_DIR = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "Microsoft",
  "Windows",
  "Start Menu",
  "Programs",
  "Startup"
);
const WIN_STARTUP_FILE = path.join(WIN_STARTUP_DIR, "CopilotDash.vbs");

const MAC_PLIST_DIR = path.join(os.homedir(), "Library", "LaunchAgents");
const MAC_PLIST_FILE = path.join(MAC_PLIST_DIR, "com.copilot-dash.plist");

const LINUX_SYSTEMD_DIR = path.join(os.homedir(), ".config", "systemd", "user");
const LINUX_SERVICE_FILE = path.join(LINUX_SYSTEMD_DIR, "copilot-dash.service");

// ── Helpers ──

function getLaunchArgs(options: { tray?: boolean } = {}): {
  exe: string;
  script: string;
  flags: string[];
} {
  return {
    exe: process.execPath,
    script: process.argv[1],
    flags: options.tray ? ["--tray"] : [],
  };
}

// ── Windows ──

function installWindows(options: { tray?: boolean }): void {
  const { exe, script, flags } = getLaunchArgs(options);
  const flagStr = flags.length ? " " + flags.join(" ") : "";
  const cmd = `"""${exe}"" ""${script}""${flagStr}"`;

  const vbs = [
    'Set WshShell = CreateObject("WScript.Shell")',
    `WshShell.Run ${cmd}, 0, False`,
  ].join("\r\n");

  fs.writeFileSync(WIN_STARTUP_FILE, vbs, "ascii");
  console.log(`✓ Autostart installed: ${WIN_STARTUP_FILE}`);
}

function removeWindows(): void {
  if (fs.existsSync(WIN_STARTUP_FILE)) {
    fs.unlinkSync(WIN_STARTUP_FILE);
    console.log("✓ Autostart removed.");
  } else {
    console.log("Autostart was not installed.");
  }
}

function isInstalledWindows(): boolean {
  return fs.existsSync(WIN_STARTUP_FILE);
}

// ── macOS (launchd) ──

function installMac(options: { tray?: boolean }): void {
  const { exe, script, flags } = getLaunchArgs(options);
  const allArgs = [script, ...flags];

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.copilot-dash</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(exe)}</string>
${allArgs.map((a) => `    <string>${escapeXml(a)}</string>`).join("\n")}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${escapeXml(path.join(os.homedir(), ".copilot-dash", "server.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(path.join(os.homedir(), ".copilot-dash", "server.log"))}</string>
</dict>
</plist>`;

  if (!fs.existsSync(MAC_PLIST_DIR)) {
    fs.mkdirSync(MAC_PLIST_DIR, { recursive: true });
  }
  fs.writeFileSync(MAC_PLIST_FILE, plist, "utf-8");
  console.log(`✓ Autostart installed: ${MAC_PLIST_FILE}`);
  console.log("  Run: launchctl load " + MAC_PLIST_FILE);
}

function removeMac(): void {
  if (fs.existsSync(MAC_PLIST_FILE)) {
    try {
      execSync(`launchctl unload "${MAC_PLIST_FILE}"`, { stdio: "ignore" });
    } catch {
      // may not be loaded
    }
    fs.unlinkSync(MAC_PLIST_FILE);
    console.log("✓ Autostart removed.");
  } else {
    console.log("Autostart was not installed.");
  }
}

function isInstalledMac(): boolean {
  return fs.existsSync(MAC_PLIST_FILE);
}

// ── Linux (systemd user service) ──

function installLinux(options: { tray?: boolean }): void {
  const { exe, script, flags } = getLaunchArgs(options);
  const execLine = [exe, script, ...flags]
    .map((a) => (a.includes(" ") ? `"${a}"` : a))
    .join(" ");

  const unit = `[Unit]
Description=Copilot Dash Server
After=network.target

[Service]
Type=simple
ExecStart=${execLine}
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;

  if (!fs.existsSync(LINUX_SYSTEMD_DIR)) {
    fs.mkdirSync(LINUX_SYSTEMD_DIR, { recursive: true });
  }
  fs.writeFileSync(LINUX_SERVICE_FILE, unit, "utf-8");

  try {
    execSync("systemctl --user daemon-reload", { stdio: "ignore" });
    execSync("systemctl --user enable copilot-dash.service", {
      stdio: "ignore",
    });
    console.log(`✓ Autostart installed and enabled: ${LINUX_SERVICE_FILE}`);
    console.log("  Start now: systemctl --user start copilot-dash");
  } catch {
    console.log(`✓ Autostart installed: ${LINUX_SERVICE_FILE}`);
    console.log(
      "  Enable manually: systemctl --user daemon-reload && systemctl --user enable copilot-dash"
    );
  }
}

function removeLinux(): void {
  if (fs.existsSync(LINUX_SERVICE_FILE)) {
    try {
      execSync("systemctl --user stop copilot-dash.service", {
        stdio: "ignore",
      });
      execSync("systemctl --user disable copilot-dash.service", {
        stdio: "ignore",
      });
    } catch {
      // may not be running/enabled
    }
    fs.unlinkSync(LINUX_SERVICE_FILE);
    try {
      execSync("systemctl --user daemon-reload", { stdio: "ignore" });
    } catch {
      // best effort
    }
    console.log("✓ Autostart removed.");
  } else {
    console.log("Autostart was not installed.");
  }
}

function isInstalledLinux(): boolean {
  return fs.existsSync(LINUX_SERVICE_FILE);
}

// ── XML escaping for plist ──

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Public API ──

export function installAutostart(options: { tray?: boolean } = {}): void {
  switch (process.platform) {
    case "win32":
      installWindows(options);
      break;
    case "darwin":
      installMac(options);
      break;
    case "linux":
      installLinux(options);
      break;
    default:
      console.log(`Autostart is not supported on ${process.platform}.`);
  }
}

export function removeAutostart(): void {
  switch (process.platform) {
    case "win32":
      removeWindows();
      break;
    case "darwin":
      removeMac();
      break;
    case "linux":
      removeLinux();
      break;
    default:
      console.log(`Autostart is not supported on ${process.platform}.`);
  }
}

export function isAutostartInstalled(): boolean {
  switch (process.platform) {
    case "win32":
      return isInstalledWindows();
    case "darwin":
      return isInstalledMac();
    case "linux":
      return isInstalledLinux();
    default:
      return false;
  }
}
