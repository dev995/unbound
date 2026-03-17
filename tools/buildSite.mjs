#!/usr/bin/env node

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await cp(path.join(rootDir, "web"), path.join(distDir, "web"), {
    recursive: true,
  });
  await cp(path.join(rootDir, "data"), path.join(distDir, "data"), {
    recursive: true,
  });

  const indexRedirect = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url=./web/index.html" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cult Unbound 2026 Analytics</title>
  </head>
  <body>
    <p>Redirecting to analytics app...</p>
    <p><a href="./web/index.html">Open app</a></p>
  </body>
</html>
`;

  await writeFile(path.join(distDir, "index.html"), indexRedirect, "utf8");
  await writeFile(path.join(distDir, ".nojekyll"), "", "utf8");

  console.log("Build complete: dist/");
}

build().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
