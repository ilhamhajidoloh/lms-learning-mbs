/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 3G recheck: PUT /api/assignments writes open_at / close_at. The stored instant must equal the
// input instant regardless of the server's TZ and of the DST period of the instant.
// Oracle by default; --postgres runs against a DISPOSABLE PostgreSQL database (see the harness guard).
const H = require("./lib/phase3-test-harness.cjs");
const { isPg, id, token, check, finish, makeDb, rows, startServer, stopServer, call } = H;

const TAG = `p3gtz_${Date.now()}`;
const F = { teacher: id(), course: `${TAG}_course`, assignment: `${TAG}_as` };
const ASG_TYPE = isPg ? "type" : "assignment_type";

async function seed(pool) {
  const c = await pool.getConnection();
  try {
    await c.execute("INSERT INTO users (id, email, password_hash, username, display_name, role) VALUES (:id, :e, 'x', :u, 'P3G tz teacher', 'teacher')",
      { id: F.teacher, e: `${TAG}@example.invalid`, u: TAG });
    await c.execute(`INSERT INTO courses (id, title, ${isPg ? "level" : "course_level"}, level_label, instructor_id) VALUES (:id, 'P3G tz', 'm1', 'M.1', :t)`,
      { id: F.course, t: F.teacher });
    await c.execute(`INSERT INTO assignments (id, course_id, created_by, ${ASG_TYPE}, title, due_date, points) VALUES (:id, :c, :u, 'file', 'tz', DATE '2099-12-31', 10)`,
      { id: F.assignment, c: F.course, u: F.teacher });
    await c.commit();
  } finally { await c.close(); }
}

async function stored(pool) {
  const c = await pool.getConnection();
  try {
    const fmt = (col) => (isPg
      ? `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
      : `TO_CHAR(SYS_EXTRACT_UTC(${col}), 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`);
    const r = (await rows(c, `SELECT ${fmt("open_at")} AS o, ${fmt("close_at")} AS c FROM assignments WHERE id = :id`, { id: F.assignment }))[0];
    return { open: r.O, close: r.C };
  } finally { await c.close(); }
}

async function main() {
  const pool = await makeDb();
  const tt = token(F.teacher, "teacher");
  let server;
  let crashed = null;
  try {
    await seed(pool);
    // Instants in a DST period (Mar 15 / Jul 15 2026 are on opposite sides of US DST), plus an offset-bearing input.
    const cases = [
      ["Mar open / Jul close", "2026-03-15T03:30:00.000Z", "2026-07-15T03:30:00.000Z"],
      ["Jul open / Mar close", "2026-07-15T03:30:00.000Z", "2026-03-15T03:30:00.000Z"],
      ["+07:00 offset inputs", "2026-03-15T10:30:00.000+07:00", "2026-07-15T10:30:00.000+07:00"],
    ];
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Bangkok"]) {
      server = await startServer(tz);
      for (const [label, openAt, closeAt] of cases) {
        const put = await call(server, "PUT", "/api/assignments", tt, { id: F.assignment, openAt, closeAt });
        const s = await stored(pool);
        const wantO = new Date(openAt).toISOString();
        const wantC = new Date(closeAt).toISOString();
        check(`tz ${tz}`, `${label}: PUT ok`, put.status === 200, JSON.stringify(put.body));
        check(`tz ${tz}`, `${label}: open_at instant preserved`, s.open === wantO, `want ${wantO} got ${s.open}`);
        check(`tz ${tz}`, `${label}: close_at instant preserved`, s.close === wantC, `want ${wantC} got ${s.close}`);
      }
      const clear = await call(server, "PUT", "/api/assignments", tt, { id: F.assignment, openAt: "", closeAt: null });
      const s = await stored(pool);
      check(`tz ${tz}`, "empty/null clears both to NULL", clear.status === 200 && s.open === null && s.close === null);
      await stopServer(server);
      server = undefined;
    }
  } catch (error) {
    crashed = error;
    console.error("TEST RUN ABORTED:", error);
  } finally {
    await stopServer(server);
    const c = await pool.getConnection();
    try {
      await c.execute("DELETE FROM courses WHERE id = :id", { id: F.course });
      await c.execute("DELETE FROM users WHERE id = :id", { id: F.teacher });
      await c.commit();
      const left = (await rows(c, "SELECT (SELECT COUNT(*) FROM assignments WHERE id = :a) + (SELECT COUNT(*) FROM courses WHERE id = :c) + (SELECT COUNT(*) FROM users WHERE id = :u) AS n",
        { a: F.assignment, c: F.course, u: F.teacher }))[0].N;
      check("cleanup", "no fixture rows remain", left === 0, `left ${left}`);
    } catch (e) { console.error("CLEANUP FAILED:", e.message); check("cleanup", "no fixture rows remain", false, e.message); }
    finally { await c.close(); }
    await pool.close(5);
  }
  finish("Phase 3G timezone recheck", crashed);
}

main();
