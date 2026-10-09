#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Rehearsal-only. Replaces ALL business rows in LMS_PHASE7_REHEARSAL with the rows of a synthetic snapshot (or with nothing for --empty).
// Row-level DELETE/INSERT in one transaction; no DDL, no TRUNCATE, no DROP; SCHEMA_MIGRATIONS untouched. Refuses unless USER and
// CURRENT_SCHEMA are both LMS_PHASE7_REHEARSAL and the snapshot manifest says rehearsal_only.
//   node -r ./scripts/migration/lib/rehearsal-env.cjs scripts/migration/reset-phase7-rehearsal.cjs (--snapshot-dir=<dir> | --empty)
const fs = require("fs"), path = require("path");
const { open, ORDER, manifest, wipeBusiness, stateHash } = require("./lib/rehearsal-state.cjs");
const { insertSql } = require("./import-oracle.cjs");
const { transformRow } = require("./lib/transform.cjs");

(async () => {
  const get = (k) => (process.argv.find((a) => a.startsWith("--" + k + "=")) || "").split("=")[1];
  const empty = process.argv.includes("--empty"), dir = get("snapshot-dir") && path.resolve(get("snapshot-dir"));
  if (!empty && !dir) throw new Error("--snapshot-dir=<dir> or --empty required");
  if (dir && JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")).rehearsal_only !== true) throw new Error("snapshot is not rehearsal_only");
  const { conn, oracledb } = await open();
  try {
    await wipeBusiness(conn);
    let n = 0;
    if (!empty) {
      for (const t of ORDER) {
        const def = manifest.tables[t], cols = Object.values(def.columns);
        for (const line of fs.readFileSync(path.join(dir, t + ".ndjson"), "utf8").split("\n").filter(Boolean)) {
          const tr = transformRow(def, JSON.parse(line), { allowScaleRounding: true });
          const binds = Object.fromEntries(tr.values.map((v, i) => ["b" + i, v === "" && cols[i].transform === "EMPTY_CLOB" ? null : v]));
          await conn.execute(insertSql(def), binds, { autoCommit: false }); n++;
        }
      }
      await conn.commit();
    }
    const h = await stateHash(conn, oracledb);
    console.log(JSON.stringify({ reset_to: empty ? "EMPTY" : path.basename(dir), inserted: n, total_rows: h.total, state_hash: h.hash }));
  } catch (e) { try { await conn.rollback(); } catch { /* keep original */ } throw e; } finally { await conn.close(); }
})().catch((e) => { console.error("reset failed: " + e.message); process.exitCode = 1; });
