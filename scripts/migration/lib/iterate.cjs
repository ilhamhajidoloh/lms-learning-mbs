/* eslint-disable @typescript-eslint/no-require-imports */
// Keyset-paginated, deterministic table iteration over a READ ONLY snapshot session.
const { qi } = require("./common.cjs");

const CAST = { uuid: "uuid", text: "text", int: "bigint", smallint: "smallint" };

/**
 * Calls onBatch(rows) with rows ordered by primary key. `select` is the SQL select list (without PK helpers);
 * PK values are appended as __pk0..n (text) and used as the keyset cursor. Memory is bounded by `batch`.
 */
async function forEachBatch(q, tname, t, { select, batch = 1000 }, onBatch) {
  const pk = t.primary_key;
  const helpers = pk.map((c, i) => `${qi(c)}::text AS __pk${i}`).join(", ");
  const orderBy = pk.map(qi).join(", ");
  const casts = pk.map((c) => {
    const st = t.columns[c].source_type;
    if (!CAST[st]) throw new Error(`unsupported PK type ${st} for ${tname}.${c}`);
    return CAST[st];
  });
  let last = null;
  let total = 0;
  for (;;) {
    const where = last ? `WHERE (${pk.map(qi).join(", ")}) > (${pk.map((_, i) => `$${i + 1}::${casts[i]}`).join(", ")})` : "";
    const res = await q(`SELECT ${select}, ${helpers} FROM ${qi(tname)} ${where} ORDER BY ${orderBy} LIMIT ${batch}`, last || []);
    if (!res.rows.length) break;
    total += res.rows.length;
    await onBatch(res.rows);
    const tail = res.rows[res.rows.length - 1];
    last = pk.map((_, i) => tail[`__pk${i}`]);
    if (res.rows.length < batch) break;
  }
  return total;
}

const pkOf = (row, t) => t.primary_key.map((_, i) => row[`__pk${i}`]).join("|");

module.exports = { forEachBatch, pkOf };
