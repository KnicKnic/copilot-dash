/**
 * System tray wrapper that starts the backend server and provides a tray icon.
 * Uses systray2 for a lightweight Windows system tray.
 */

import { spawn, exec, ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess: ChildProcess | null = null;

// Base64 encoded minimal 16x16 ICO (blue circle)
// In production, replace with a proper icon file
const ICON_BASE64 =
  "AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAA" +
  "JwAAAEMAAABPAAAATwAAAEMAAAEnAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAYgAAAKEAAADHAAAA1wAAANcAAADHAAAA" +
  "oQAAAGIAAAASAAAAAAAAAAAAAAAAAAAAAAAAAAAAABIAAAB0AAAA1AAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAANQAAAB0AAAAEgAAAAAAAAAA" +
  "AAAAAAMAAABiAAAA1AAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA1AAAAGIAAAADAAAAAAAAACcAAAChAAAA/wAAAP8AAAD/AAAA" +
  "/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAKEAAAAnAAAAAAAAAEMAAADHAAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA" +
  "/wAAAMcAAABDAAAAAAAAAE8AAADXAgIC/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AgIC/wAAANcAAABPAAAAAAAAAE8AAADXAgIC" +
  "/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AgIC/wAAANcAAABPAAAAAAAAAEMAAADHAAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA" +
  "/wAAAP8AAAD/AAAA/wAAAMcAAABDAAAAAAAAACcAAAChAAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAKEAAAAnAAAA" +
  "AAAAAAMAAABiAAAA1AAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA1AAAAGIAAAADAAAAAAAAAAAAAAAAAAAEEgAAAHQAAADUAAAA" +
  "/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA1AAAAHQAAAASAAAAAAAAAAAAAAAAAAAAAAAAAAAAABIAAABiAAAAoQAAAMcAAADXAAAA1wAAAMcAAAChAAAA" +
  "YgAAABIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAJwAAAEMAAABPAAAATwAAAEMAAAEnAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAA//8AAP//AADgBwAAwAMAAIABAACAAQAAAAAAAAAAAAAAAAAAAAAAAACAAQAAgAEAAMADAADgBwAA//8AAP//AAA=";

async function startServer(): Promise<ChildProcess> {
  const serverEntry = path.join(__dirname, "index.ts");
  const child = spawn("npx", ["tsx", serverEntry], {
    stdio: "pipe",
    shell: true,
    env: { ...process.env },
  });

  child.stdout?.on("data", (data) => process.stdout.write(data));
  child.stderr?.on("data", (data) => process.stderr.write(data));
  child.on("exit", (code) => {
    console.log(`Server exited with code ${code}`);
    serverProcess = null;
  });

  return child;
}

async function main() {
  let SysTray: any;
  try {
    const mod: any = await import("systray2");
    SysTray = mod.default || mod.SysTray || mod;
  } catch {
    console.error(
      "systray2 not available. Install it with: npm install systray2"
    );
    console.log("Starting server without tray icon...");
    serverProcess = await startServer();
    return;
  }

  // Start server
  serverProcess = await startServer();

  const systray = new SysTray({
    menu: {
      icon: ICON_BASE64,
      title: "Copilot Dash",
      tooltip: "Copilot Dash Server",
      items: [
        {
          title: "Open Dashboard",
          tooltip: "Open in browser",
          checked: false,
          enabled: true,
        },
        {
          title: "Restart Server",
          tooltip: "Restart the backend server",
          checked: false,
          enabled: true,
        },
        SysTray.separator,
        {
          title: "Exit",
          tooltip: "Stop server and exit",
          checked: false,
          enabled: true,
        },
      ],
    },
    debug: false,
    copyDir: false,
  });

  systray.onClick((action: any) => {
    switch (action.seq_id) {
      case 0: {
        // Open dashboard
        exec("start http://localhost:3456");
        break;
      }
      case 1: {
        // Restart server
        if (serverProcess) {
          serverProcess.kill();
        }
        startServer().then((p) => {
          serverProcess = p;
        });
        break;
      }
      case 3: {
        // Exit
        if (serverProcess) {
          serverProcess.kill();
        }
        systray.kill(false);
        process.exit(0);
        break;
      }
    }
  });
}

main().catch(console.error);
