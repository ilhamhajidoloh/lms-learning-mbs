#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Removes only the explicitly supplied Phase 5 fixture course and users.
// The course FK cascades remove its own hierarchy, enrollments, completions and any remaining announcement.
const oracledb = require("oracledb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, "").split("=", 2);
  return [key, value];
}));

if (!args["course-id"] || !args["course-id"].startsWith("phase5_")) throw new Error("course-id must be an exact phase5_ fixture ID");
for (const key of ["student-id", "teacher-id"]) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args[key] || "")) throw new Error(`${key} must be an exact UUID fixture ID`);
}

async function main() {
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
    ...(process.env.ORACLE_WALLET_LOCATION ? { walletLocation: process.env.ORACLE_WALLET_LOCATION, configDir: process.env.ORACLE_WALLET_LOCATION } : {}),
    ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
  });
  try {
    const exec = (sql, binds) => connection.execute(sql, binds, { autoCommit: false });
    const course = await exec("DELETE FROM courses WHERE id = :id", { id: args["course-id"] });
    const teacher = await exec("DELETE FROM users WHERE id = :id", { id: args["teacher-id"] });
    const student = await exec("DELETE FROM users WHERE id = :id", { id: args["student-id"] });
    await connection.commit();
    console.log(JSON.stringify({ course_rows_deleted: course.rowsAffected || 0, teacher_rows_deleted: teacher.rowsAffected || 0, student_rows_deleted: student.rowsAffected || 0 }));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

main().catch((error) => { console.error(`Phase 5 cleanup failed: ${error.message}`); process.exitCode = 1; });
