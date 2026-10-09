#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 7B rehearsal-only: private_lesson_requests count + raw scratch state hash (read-only).
const s = require("./lib/rehearsal-state.cjs");
(async () => { const { conn, oracledb } = await s.open();
  const n = (await conn.execute("SELECT COUNT(*) N FROM private_lesson_requests", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].N;
  const due = (await conn.execute("SELECT COUNT(*) N FROM private_lesson_requests WHERE status='accepted' AND confirmed_at IS NOT NULL AND confirmed_at + NUMTODSINTERVAL(duration_minutes + 10, 'MINUTE') <= SYSTIMESTAMP", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].N;
  const h = await s.stateHash(conn, oracledb);
  console.log(JSON.stringify({ private_lesson_requests: n, expired_due: due, total_rows: h.total, state_hash: h.hash.slice(0, 16) })); await conn.close(); })().catch(e => { console.error(e.message); process.exit(1); });
