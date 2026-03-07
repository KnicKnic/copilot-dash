import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const sharedOptions = {
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
};

const contexts = await Promise.all([
  esbuild.context({
    ...sharedOptions,
    entryPoints: ["src/background.ts"],
    outfile: "dist/background.js",
  }),
  esbuild.context({
    ...sharedOptions,
    entryPoints: ["src/sidepanel.ts"],
    outfile: "dist/sidepanel.js",
  }),
]);

if (watch) {
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("Watching for changes...");
} else {
  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
}
