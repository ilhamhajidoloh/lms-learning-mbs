#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 7B rehearsal-only launcher: isolated Next server on :5002 using the scratch Oracle account. Needs a prior `npm run build` for `next start`.
// Env: P7B_FREEZE (default 1), P7B_JWT, P7B_CRON (optional), P7B_MODE=dev for `next dev --webpack`. Prints no secrets.
const { spawn } = require("child_process");
const crypto = require("crypto");
require("./lib/rehearsal-env.cjs"); // ORACLE_* <- PHASE7_REHEARSAL_ORACLE_*, DB_PROVIDER=postgres
const env = { ...process.env,
  DB_PROVIDER: "oracle",
  WRITE_FREEZE: process.env.P7B_FREEZE ?? "1",
  DATABASE_URL: "postgres://disabled:disabled@127.0.0.1:1/disabled", // Cockroach must be unreachable from this server
  DATABASE_SSL: "false",
  JWT_SECRET: process.env.P7B_JWT || crypto.randomBytes(24).toString("hex"),
  ...(process.env.P7B_CRON ? { CRON_SECRET: process.env.P7B_CRON } : {}),
  ORACLE_POOL_DIAGNOSTICS: "1",
};
const p = spawn(process.execPath, process.env.P7B_MODE==="dev" ? ["node_modules/next/dist/bin/next","dev","--webpack","-p","5002"] : ["node_modules/next/dist/bin/next","start","-p","5002"], { cwd: require("path").resolve(__dirname, "..", ".."), env, stdio: ["ignore", "inherit", "inherit"] });
p.on("exit", (c) => process.exit(c ?? 0));
