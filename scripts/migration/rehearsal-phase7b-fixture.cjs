#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 7B rehearsal-only fixture (scratch schema only): synthetic teacher gets a bcrypt hash of $P7B_PW; adds one EXPIRED accepted private_lesson_request.
//   node -r ./scripts/migration/lib/rehearsal-env.cjs scripts/migration/rehearsal-phase7b-fixture.cjs
const s = require("./lib/rehearsal-state.cjs");
const bcrypt = require("bcryptjs");
const T = "70000000-0000-4000-8000-000000000001", S = "70000000-0000-4000-8000-000000000002", RID = "70000000-0000-4000-8000-0000000000a1";
(async () => {
  const { conn, oracledb } = await s.open();
  try {
    const hash = await bcrypt.hash(process.env.P7B_PW, 10);
    await conn.execute("UPDATE users SET password_hash = :h WHERE id = :id", { h: hash, id: T }, { autoCommit: false });
    await conn.execute("DELETE FROM private_lesson_requests WHERE id = :id", { id: RID }, { autoCommit: false });
    await conn.execute(`INSERT INTO private_lesson_requests (id, student_id, teacher_id, course_id, requested_at, requested_slots, confirmed_at, duration_minutes, message, status)
      VALUES (:id, :st, :te, 'phase7_rehearsal_course', SYSTIMESTAMP - INTERVAL '3' DAY, '[]', SYSTIMESTAMP - INTERVAL '2' DAY, 30, EMPTY_CLOB(), 'accepted')`, { id: RID, st: S, te: T }, { autoCommit: false });
    await conn.commit();
    const n = (await conn.execute("SELECT COUNT(*) N FROM private_lesson_requests", [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows[0].N;
    const h = await s.stateHash(conn, oracledb);
    console.log(JSON.stringify({ expired_requests: n, total_rows: h.total, state_hash: h.hash }));
  } finally { await conn.close(); }
})().catch((e) => { console.error("setup failed:", e.message); process.exit(1); });
