// Bundles each Lambda entry point into a single small ESM file (fast cold starts).
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

const entries = { api: "src/lambda.ts", "expire-holds": "src/jobs/expire-holds.ts", migrate: "src/db/migrate.ts" };
for (const [name, entry] of Object.entries(entries)) {
  const outdir = `dist/${name}`;
  await mkdir(outdir, { recursive: true });
  await build({
    entryPoints: [entry],
    outfile: `${outdir}/index.mjs`,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    minify: true,
    sourcemap: "linked",
    external: ["@aws-sdk/*", "pg-native"], // AWS SDK v3 is provided by the Lambda runtime
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  });
}
// Migration SQL files ship with the migrate Lambda.
await import("node:fs/promises").then((fs) => fs.cp("drizzle", "dist/migrate/drizzle", { recursive: true }));
await writeFile("dist/.built", new Date().toISOString());
console.log("Built", Object.keys(entries).join(", "));
