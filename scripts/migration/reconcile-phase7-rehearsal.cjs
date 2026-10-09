#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Rehearsal-only, READ ONLY independent reconciliation of LMS_PHASE7_REHEARSAL against a synthetic snapshot.
// Does not use apply-phase7-delta.cjs or lib/delta.cjs. Run with: node -r ./scripts/migration/lib/rehearsal-env.cjs scripts/migration/reconcile-phase7-rehearsal.cjs --snapshot-dir=<dir> --expect-rows=N [--out=<file>]
// Output contains counts, table names and IDs of mismatching rows only; no row content.
const fs = require("fs"), path = require("path");
const { open, ORDER, manifest } = require("./lib/rehearsal-state.cjs");
const { selectExpr, oracleValue } = require("./validate-phase4c-import.cjs");
const { transformRow } = require("./lib/transform.cjs");

const nonAscii = (s) => typeof s === "string" && /[^\x00-\x7f]/.test(s);

async function reconcile(snapDir, expectRows) {
  const { conn, oracledb } = await open();
  const q = async (sql) => (await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows;
  const rep = { snapshot: path.relative(path.resolve(__dirname, "..", ".."), snapDir), tables: {}, problems: [] };
  const st = { fields: { compared: 0, mismatched: 0 }, json: { compared: 0, mismatched: 0 }, ts: { compared: 0, mismatched: 0 }, date: { compared: 0, mismatched: 0 }, bool: { compared: 0, mismatched: 0 }, clob: { compared: 0, mismatched: 0 }, numeric: { compared: 0, mismatched: 0 }, thai: { compared: 0, mismatched: 0 } };
  let total = 0, expectedTotal = 0, pkOk = 0, logicalOk = 0;
  try {
    for (const t of ORDER) {
      const def = manifest.tables[t], cols = Object.entries(def.columns);
      const text = fs.readFileSync(path.join(snapDir, t + ".ndjson"), "utf8");
      const exported = text.split("\n").filter(Boolean).map(JSON.parse);
      const pkOf = (r) => def.primary_key.map((c) => String(r[c])).join("|");
      const rows = await q(`SELECT ${cols.map(([, c], i) => selectExpr(c, "C" + i)).join(", ")} FROM ${def.target.toUpperCase()}`);
      const pkIdx = def.primary_key.map((c) => cols.findIndex(([n]) => n === c));
      const byPk = new Map(rows.map((r) => [pkIdx.map((i) => String(r["C" + i])).join("|"), r]));
      const expPks = new Set(exported.map(pkOf));
      const missing = [...expPks].filter((k) => !byPk.has(k)), extra = [...byPk.keys()].filter((k) => !expPks.has(k));
      const pkMatch = missing.length === 0 && extra.length === 0 && byPk.size === rows.length && expPks.size === exported.length;
      let fieldBad = 0, logical = true;
      for (const row of exported) {
        const exp = transformRow(def, row, { allowScaleRounding: true }), o = byPk.get(pkOf(row));
        if (!o) { logical = false; continue; }
        const bad = [];
        cols.forEach(([name, c], i) => {
          const got = oracleValue(c, o, "C" + i), want = exp.values[i];
          const bucket = { TIMESTAMP_TRANSFORM: st.ts, DATE_COPY: st.date, BOOLEAN_TRANSFORM: st.bool, EMPTY_CLOB: st.clob, NUMERIC_SCALE: st.numeric, JSON_SERIALIZE: st.json }[c.transform];
          if (want !== null) { st.fields.compared++; if (bucket) bucket.compared++; }
          let same = got === want;
          if (c.transform === "JSON_SERIALIZE" && want !== null && got !== null) { try { same = JSON.stringify(JSON.parse(got)) === JSON.stringify(JSON.parse(want)); } catch { same = false; } }
          if (nonAscii(want)) { st.thai.compared++; if (got !== want || Buffer.compare(Buffer.from(String(got), "utf8"), Buffer.from(want, "utf8")) !== 0) { st.thai.mismatched++; same = false; } }
          if (!same) { st.fields.mismatched++; if (bucket) bucket.mismatched++; bad.push(name); }
        });
        if (bad.length) { fieldBad++; logical = false; rep.problems.push(`${t} id=${pkOf(row)}: field mismatch in ${bad.join(",")}`); }
      }
      if (!pkMatch) rep.problems.push(`${t}: PK set differs (missing=${missing.length}, extra=${extra.length})`);
      pkOk += pkMatch ? 1 : 0; logicalOk += pkMatch && logical && fieldBad === 0 ? 1 : 0;
      total += rows.length; expectedTotal += exported.length;
      rep.tables[t] = { snapshot_rows: exported.length, oracle_rows: rows.length, pk_match: pkMatch, logical_match: pkMatch && logical && fieldBad === 0, field_mismatch_rows: fieldBad, missing_ids: missing, extra_ids: extra };
    }
    let orphans = 0, dupGroups = 0;
    for (const t of ORDER) for (const fk of manifest.tables[t].foreign_keys) {
      const p = manifest.tables[fk.references], c = manifest.tables[t];
      const cc = fk.columns.map((x) => c.columns[x].target.toUpperCase()), pc = p.primary_key.map((x) => p.columns[x].target.toUpperCase());
      orphans += (await q(`SELECT COUNT(*) AS N FROM ${c.target.toUpperCase()} c WHERE ${cc.map((x) => `c.${x} IS NOT NULL`).join(" AND ")} AND NOT EXISTS (SELECT 1 FROM ${p.target.toUpperCase()} p WHERE ${cc.map((x, i) => `p.${pc[i]} = c.${x}`).join(" AND ")})`))[0].N;
    }
    for (const t of ORDER) {
      const d = manifest.tables[t], groups = [d.primary_key, ...d.unique_constraints];
      for (const g of groups) { const oc = g.map((x) => d.columns[x].target.toUpperCase()); dupGroups += (await q(`SELECT COUNT(*) AS N FROM (SELECT ${oc.join(",")} FROM ${d.target.toUpperCase()} WHERE ${oc.map((x) => x + " IS NOT NULL").join(" AND ")} GROUP BY ${oc.join(",")} HAVING COUNT(*) > 1)`))[0].N; }
    }
    const mig = (await q("SELECT COUNT(*) AS N FROM SCHEMA_MIGRATIONS"))[0].N;
    Object.assign(rep, { total_rows: total, snapshot_total_rows: expectedTotal, expected_total_rows: expectRows, pk_parity: `${pkOk}/${ORDER.length}`, logical_parity: `${logicalOk}/${ORDER.length}`, field_mismatches: st.fields.mismatched, fk_orphans: orphans, duplicate_groups: dupGroups, schema_migrations: mig, parity: st });
    if (total !== expectRows || expectedTotal !== expectRows) rep.problems.push(`total rows ${total}/${expectedTotal}, expected ${expectRows}`);
    if (pkOk !== ORDER.length) rep.problems.push("PK parity failed");
    if (logicalOk !== ORDER.length) rep.problems.push("logical parity failed");
    if (orphans) rep.problems.push(`FK orphans ${orphans}`);
    if (dupGroups) rep.problems.push(`duplicate groups ${dupGroups}`);
    for (const [k, v] of Object.entries(st)) if (v.mismatched) rep.problems.push(`${k} parity mismatches ${v.mismatched}`);
  } finally { await conn.close(); }
  rep.status = rep.problems.length ? "FAIL" : "PASS";
  return rep;
}

if (require.main === module) {
  const get = (k) => (process.argv.find((a) => a.startsWith("--" + k + "=")) || "").split("=")[1];
  const dir = path.resolve(get("snapshot-dir") || ""), n = Number(get("expect-rows"));
  if (!get("snapshot-dir") || !Number.isInteger(n)) { console.error("usage: --snapshot-dir=<dir> --expect-rows=<n> [--out=file]"); process.exit(1); }
  reconcile(dir, n).then((r) => {
    if (get("out")) fs.writeFileSync(path.resolve(get("out")), JSON.stringify(r, null, 2) + "\n");
    const head = { ...r }; delete head.tables; console.log(JSON.stringify(head, null, 2)); process.exitCode = r.status === "PASS" ? 0 : 2;
  }).catch((e) => { console.error("reconcile error: " + e.message); process.exitCode = 1; });
}
module.exports = { reconcile };
