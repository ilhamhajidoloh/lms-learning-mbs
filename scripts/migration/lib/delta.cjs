/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 7 pure delta logic (no I/O). Shared by compare-phase7-delta.cjs, apply-phase7-delta.cjs and the offline tests.
// Identity is the primary key; "equal" means equal after the SAME canonical transform used by the Phase 4 export/import.
const crypto = require("crypto");
const { transformRow } = require("./transform.cjs");

const sha = (v) => crypto.createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");
const pkOf = (def, row) => def.primary_key.map((c) => String(row[c])).join("|");

/** Logical identity of one row: sha256 of the transformed (Oracle-bound) values, exactly as the exporter's logical checksum. */
function logicalOf(def, row, onScaleRounding) {
  const tr = transformRow(def, row, { allowScaleRounding: true, onScaleRounding });
  return { values: tr.values, hash: sha(JSON.stringify(tr.values)) };
}

function indexRows(def, rows, label) {
  const map = new Map();
  for (const row of rows) {
    const id = pkOf(def, row);
    if (map.has(id)) throw new Error(`${label}: duplicate primary key ${id}`);
    map.set(id, row);
  }
  return map;
}

/**
 * Compare two row sets for one table. DELETE is never inferred from counts: it is a PK present in baseline and absent from final.
 * Returns ids/hashes/changed column NAMES only (never row content).
 */
function diffTable(def, baselineRows, finalRows) {
  const base = indexRows(def, baselineRows, "baseline"), fin = indexRows(def, finalRows, "final");
  const rounding = [];
  const out = { baseline_count: base.size, final_count: fin.size, inserted: [], updated: [], deleted: [], unchanged_count: 0, rounding };
  for (const [id, row] of base) {
    const b = logicalOf(def, row);
    if (!fin.has(id)) { out.deleted.push({ id, baseline_logical_sha256: b.hash }); continue; }
    const f = logicalOf(def, fin.get(id), (x) => rounding.push({ id, column: x.column, source: x.source, target: x.target, oracle_type: x.oracle_type }));
    if (b.hash === f.hash) { out.unchanged_count++; continue; }
    const cols = Object.keys(def.columns);
    out.updated.push({ id, baseline_logical_sha256: b.hash, final_logical_sha256: f.hash, changed_columns: cols.filter((_, i) => JSON.stringify(b.values[i]) !== JSON.stringify(f.values[i])) });
  }
  for (const [id, row] of fin) {
    if (base.has(id)) continue;
    const f = logicalOf(def, row, (x) => rounding.push({ id, column: x.column, source: x.source, target: x.target, oracle_type: x.oracle_type }));
    out.inserted.push({ id, final_logical_sha256: f.hash });
  }
  for (const k of ["inserted", "updated", "deleted"]) out[k].sort((a, b) => a.id.localeCompare(b.id));
  // Invariant: every baseline row is exactly one of deleted/updated/unchanged; every final row is inserted/updated/unchanged.
  if (out.deleted.length + out.updated.length + out.unchanged_count !== out.baseline_count) throw new Error("delta invariant violated (baseline)");
  if (out.inserted.length + out.updated.length + out.unchanged_count !== out.final_count) throw new Error("delta invariant violated (final)");
  return out;
}

/**
 * Classify one primary key against the live Oracle state. `oracleHash` is null when the Oracle row is absent.
 * PENDING_* means the operation still has to be applied; APPLIED means Oracle already equals the final state (idempotent re-run);
 * anything else is ORACLE_TARGET_DRIFT and must STOP the run.
 */
function classifyRow(baselineHash, finalHash, oracleHash) {
  const inBase = baselineHash != null, inFinal = finalHash != null;
  if (inBase && inFinal && baselineHash === finalHash) return oracleHash === baselineHash ? "UNCHANGED_OK" : "ORACLE_TARGET_DRIFT";
  if (inBase && inFinal) return oracleHash === baselineHash ? "PENDING_UPDATE" : oracleHash === finalHash ? "APPLIED" : "ORACLE_TARGET_DRIFT";
  if (inBase) return oracleHash === baselineHash ? "PENDING_DELETE" : oracleHash === null ? "APPLIED" : "ORACLE_TARGET_DRIFT";
  if (inFinal) return oracleHash === null ? "PENDING_INSERT" : oracleHash === finalHash ? "APPLIED" : "ORACLE_TARGET_DRIFT";
  return "ORACLE_TARGET_DRIFT"; // a row Oracle has that neither snapshot knows about
}

/**
 * Deterministic operation order from the FK-safe import order:
 *   DELETE children-first (reverse order) -> INSERT parents-first -> UPDATE parents-first.
 */
function orderOperations(order, perTable) {
  const ops = [];
  for (const t of [...order].reverse()) for (const id of perTable[t].delete || []) ops.push({ op: "DELETE", table: t, id });
  for (const t of order) for (const id of perTable[t].insert || []) ops.push({ op: "INSERT", table: t, id });
  for (const t of order) for (const id of perTable[t].update || []) ops.push({ op: "UPDATE", table: t, id });
  return ops;
}

/** Hash of the structural (count-independent) sections of a preflight report. The report fingerprint includes row counts, so it changes with any data delta. */
function structuralHash(preflight) {
  const s = preflight.sections || {};
  return sha({
    source_tables: s.source_tables, extra_tables: s.extra_tables, schema_matrix: s.schema_matrix,
    source_constraints_and_indexes: s.source_constraints_and_indexes, source_absent_tables: s.source_absent_tables,
  });
}

/**
 * Exactly nine duplicate FOREIGN KEY constraints, approved as benign drift on 2026-10-09. Cause: three production Vercel builds
 * (11:37Z, 11:39Z, 11:49Z) ran `npm run db:migrate && next build`; each run of migrateDatabase() re-issues
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... REFERENCES ...` (lib/db.ts) and Cockroach adds a new FK each time (3 ALTERs x 3 runs).
 * A constraint is ignored only if table, name, type AND definition all match; anything else stays NEW_SCHEMA_DRIFT.
 */
const FK = (col, ref) => `FOREIGN KEY (${col}) REFERENCES ${ref}(id) ON DELETE CASCADE`;
const APPROVED_BENIGN_DRIFT = Object.freeze([
  ...[135, 136, 137].map((n) => ({ table: "lessons", name: `lessons_course_id_fkey_${n}`, type: "f", definition: FK("course_id", "courses") })),
  ...[134, 135, 136].map((n) => ({ table: "lessons", name: `lessons_topic_id_fkey_${n}`, type: "f", definition: FK("topic_id", "topics") })),
  ...[172, 173, 174].map((n) => ({ table: "assignments", name: `assignments_lesson_id_fkey_${n}`, type: "f", definition: FK("lesson_id", "lessons") })),
].map((e) => Object.freeze(e)));

const isApproved = (table, c) => APPROVED_BENIGN_DRIFT.some((a) => a.table === table && a.name === c.name && a.type === c.type && a.definition === c.definition);

/** Approved duplicate constraints present in this preflight (table.name), for reporting. */
function approvedDriftPresent(preflight) {
  const cx = ((preflight.sections || {}).source_constraints_and_indexes) || {};
  const found = [];
  for (const t of Object.keys(cx)) for (const c of (cx[t].constraints || [])) if (isApproved(t, c)) found.push(t + "." + c.name);
  return found.sort();
}

/** structuralHash with ONLY the approved duplicate constraints removed. Every other structural difference still changes the hash. */
function gateStructuralHash(preflight) {
  const s = preflight.sections || {};
  const cx = {};
  for (const t of Object.keys(s.source_constraints_and_indexes || {})) {
    const e = s.source_constraints_and_indexes[t];
    cx[t] = { ...e, constraints: (e.constraints || []).filter((c) => !isApproved(t, c)) };
  }
  return structuralHash({ sections: { ...s, source_constraints_and_indexes: cx } });
}

module.exports = { sha, pkOf, logicalOf, diffTable, classifyRow, orderOperations, structuralHash, gateStructuralHash, approvedDriftPresent, APPROVED_BENIGN_DRIFT };
