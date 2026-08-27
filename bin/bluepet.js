#!/usr/bin/env node

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronPath = require("electron");
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const foreground = process.argv.includes("--foreground");
const appArgs = process.argv.slice(2).filter((arg) => arg !== "--foreground");

const child = spawn(electronPath, [packageRoot, ...appArgs], {
  detached: !foreground,
  stdio: foreground ? "inherit" : "ignore",
  env: process.env,
});

if (!foreground) {
  child.unref();
  console.log("呼噜呼噜 已在后台启动。");
}
