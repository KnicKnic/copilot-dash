import esbuild from "esbuild";

// Only bundle @github/copilot-sdk (and its deps like vscode-jsonrpc) to resolve
// the ESM subpath import at build time. Everything else stays external.
const shared = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  sourcemap: true,
  // Provide require() for CJS deps (vscode-jsonrpc) bundled into ESM output.
  // Must be in banner so it's defined before esbuild's __require shim runs.
  banner: {
    js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
  },
  external: [
    "express",
    "cors",
    "socket.io",
    "chokidar",
    "fast-glob",
    "jsonc-parser",
    "systray2",
  ],
};

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: ["src/cli.ts"],
    outfile: "dist/cli.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["src/tray.ts"],
    outfile: "dist/tray.js",
  }),
]);
