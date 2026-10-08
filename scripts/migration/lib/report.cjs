/* eslint-disable @typescript-eslint/no-require-imports */
// Preflight report collector. Stores only counts and safe identifiers (never column values), except
// short enum/status values for constrained columns and the explicitly listed scale-rounding rows.
//
// Every issue has a `severity` and a derived `classification`:
//   BLOCKER   -> DATA_BLOCKER              real data problem; migration cannot proceed until fixed
//   TRANSFORM -> TRANSFORMATION_REQUIRED   known, safely-defined transform the importer must apply (may need an ack flag)
//   GAP       -> SOURCE_SCHEMA_GAP         source schema is older than the canonical schema (defined policy, not corruption)
//   WARNING   -> WARNING                   review item, never blocks
//   INFO      -> INFO
const fs = require("fs");
const path = require("path");

const MAX_IDS = 100;

const CLASSIFICATION = {
  BLOCKER: "DATA_BLOCKER",
  TRANSFORM: "TRANSFORMATION_REQUIRED",
  GAP: "SOURCE_SCHEMA_GAP",
  WARNING: "WARNING",
  INFO: "INFO",
};

/** Database counts must be exact non-negative integers. Accepts number or canonical decimal string (INT8 from the driver). */
function toCount(value, where = "count") {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${where}: not a non-negative safe integer (${value})`);
    return value;
  }
  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)) {
    const n = Number(value);
    if (!Number.isSafeInteger(n)) throw new Error(`${where}: integer outside safe range (${value})`);
    return n;
  }
  throw new Error(`${where}: not an integer count (${JSON.stringify(value)})`);
}

class Report {
  constructor() {
    this.issues = [];
    this.sections = {};
    this.startedAt = new Date().toISOString();
  }

  /**
   * severity: BLOCKER | TRANSFORM | GAP | WARNING | INFO. rowIds are safe identifiers only.
   * A check that finds zero violating rows is NOT an issue: add() ignores count === 0.
   */
  add({ severity, check, table, column = null, issue, count = null, rowIds = [], detail = null }) {
    if (!CLASSIFICATION[severity]) throw new Error(`unknown severity ${severity}`);
    let n = null;
    if (count !== null) {
      n = toCount(count, `${check} ${table}${column ? "." + column : ""}`);
      if (n === 0) return;
    }
    this.issues.push({
      severity, classification: CLASSIFICATION[severity], check, table, column, issue,
      ...(n === null ? {} : { count: n }),
      ...(rowIds.length ? { row_ids: rowIds.slice(0, MAX_IDS), row_ids_truncated: rowIds.length > MAX_IDS } : {}),
      ...(detail ? { detail } : {}),
    });
  }

  section(name, value) { this.sections[name] = value; }

  countBy(check, severity) {
    return this.issues.filter((i) => i.check === check && (!severity || i.severity === severity)).length;
  }

  /** BLOCKED > ACTION REQUIRED > SOURCE_SCHEMA_GAPS > WARNINGS > PASS, from the issues of the given check names. */
  verdict(checks) {
    const list = Array.isArray(checks) ? checks : [checks];
    return this.rank(this.issues.filter((i) => list.includes(i.check)));
  }

  rank(rel) {
    if (rel.some((i) => i.severity === "BLOCKER")) return "BLOCKED";
    if (rel.some((i) => i.severity === "TRANSFORM")) return "ACTION REQUIRED";
    if (rel.some((i) => i.severity === "GAP")) return "SOURCE_SCHEMA_GAPS";
    if (rel.some((i) => i.severity === "WARNING")) return "WARNINGS";
    return "PASS";
  }

  status() { return this.rank(this.issues); }

  bySeverity(severity) { return this.issues.filter((i) => i.severity === severity); }

  toJSON(extra = {}) {
    const c = (s) => this.bySeverity(s).length;
    return {
      report: "source-preflight",
      phase: "4A",
      started_at: this.startedAt,
      finished_at: new Date().toISOString(),
      status: this.status(),
      // issue_counts.BLOCKER counts DATA blockers only; schema gaps and transformations are counted separately.
      issue_counts: { BLOCKER: c("BLOCKER"), TRANSFORM: c("TRANSFORM"), GAP: c("GAP"), WARNING: c("WARNING"), INFO: c("INFO") },
      ...extra,
      dataBlockers: this.bySeverity("BLOCKER"),
      transformationsRequired: this.bySeverity("TRANSFORM"),
      sourceSchemaGaps: this.bySeverity("GAP"),
      warnings: this.bySeverity("WARNING"),
      sections: this.sections,
      issues: this.issues,
    };
  }

  write(file, extra) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(this.toJSON(extra), null, 2) + "\n");
  }
}

function pad(s, n) { return String(s).padEnd(n); }

module.exports = { Report, pad, MAX_IDS, toCount, CLASSIFICATION };
