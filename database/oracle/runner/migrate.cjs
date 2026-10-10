/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");
const { loadEnvConfig } = require("@next/env");
const isolation = require("./isolation.cjs");

const migrationsDirectory = path.join(process.cwd(), "database", "oracle", "migrations");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Oracle migrations`);
  return value;
}

function migrationFiles() {
  return fs.readdirSync(migrationsDirectory)
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
}

// Oracle drivers accept one SQL statement at a time. Deliberate markers avoid
// brittle semicolon splitting and allow related DDL to remain in one migration.
function migrationStatements(sql) {
  return sql.split(/^--\s*@statement\s*$/gmi).map((statement) => statement.trim()).filter(Boolean);
}

async function ensureMigrationLedger(connection) {
  const existing = await connection.execute(
    "SELECT table_name FROM user_tables WHERE table_name = :tableName",
    { tableName: "SCHEMA_MIGRATIONS" },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  if (existing.rows?.length) return;

  await connection.execute(`
    CREATE TABLE schema_migrations (
      version VARCHAR2(255) PRIMARY KEY,
      name VARCHAR2(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
      checksum VARCHAR2(64) NOT NULL
    )
  `);
  await connection.commit();
}

/**
 * Decides the credential source BEFORE any connection. Isolated test mode (IT_ORACLE_ISOLATED=yes) never loads
 * .env.local and requires every credential in the real process environment; otherwise behaviour is unchanged.
 */
function prepareEnvironment(env = process.env, loadEnv = loadEnvConfig, fsImpl = fs, argv = process.argv.slice(2)) {
  const preflight = argv.includes("--isolated-preflight");
  const migrate = argv.includes("--isolated-migrate");
  const planArg = argv.find((arg) => arg.startsWith("--expect-plan-sha256="));
  const flag = env.IT_ORACLE_ISOLATED;
  if (flag !== undefined && flag !== "" && flag !== "yes") {
    throw new isolation.IsolationError("IT_ORACLE_ISOLATED must be exactly 'yes' or unset");
  }
  if (preflight && migrate) throw new isolation.IsolationError("--isolated-preflight and --isolated-migrate cannot be combined");
  if ((preflight || migrate) && !isolation.isolatedModeRequested(env)) {
    throw new isolation.IsolationError(`${preflight ? "--isolated-preflight" : "--isolated-migrate"} requires IT_ORACLE_ISOLATED=yes`);
  }
  if (planArg && !migrate) throw new isolation.IsolationError("--expect-plan-sha256 is only valid with --isolated-migrate");
  if (!isolation.isolatedModeRequested(env)) {
    loadEnv(process.cwd());
    return { isolated: false };
  }
  // Isolated credentials never run a migration implicitly: the operator must choose preflight or migrate explicitly.
  if (!preflight && !migrate) {
    throw new isolation.IsolationError("IT_ORACLE_ISOLATED=yes requires --isolated-preflight or --isolated-migrate");
  }
  // Argument checks first (no environment needed), then environment, then files.
  let expectedPlan;
  if (migrate) {
    expectedPlan = planArg?.slice("--expect-plan-sha256=".length);
    if (!/^[0-9a-f]{64}$/.test(expectedPlan ?? "")) {
      throw new isolation.IsolationError("--isolated-migrate requires --expect-plan-sha256=<64 hex> copied from the preflight output");
    }
  }
  const check = isolation.validateIsolatedEnv(env, fsImpl);
  if (!check.ok) throw new isolation.IsolationError(`isolated Oracle migration refused: ${check.reason}`);
  isolation.assertMigrationsLf(migrationsDirectory, fsImpl);
  return { isolated: true, preflight, migrate, user: check.user, expectedPlan };
}

async function main() {
  const mode = prepareEnvironment();
  const pool = await oracledb.createPool({
    user: required("ORACLE_USER"),
    password: required("ORACLE_PASSWORD"),
    connectString: required("ORACLE_CONNECT_STRING"),
    ...(process.env.ORACLE_WALLET_LOCATION ? {
      walletLocation: process.env.ORACLE_WALLET_LOCATION,
      configDir: process.env.ORACLE_WALLET_LOCATION,
    } : {}),
    ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
    poolMin: 0,
    poolMax: 1,
    poolIncrement: 1,
  });

  try {
    const connection = await pool.getConnection();
    try {
      if (mode.preflight) {
        // Read-only: no ledger, no DDL/DML, no commit. Only SELECTs pass the read-only executor.
        const execute = async (sql, binds = {}) =>
          (await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows ?? [];
        const result = await isolation.runPreflight(execute, mode.user, { migrationsDirectory });
        console.log(`Migrations reviewed: ${result.migrations.length}`);
        for (const m of result.migrations) console.log(`  ${m.version} ${m.file} statements=${m.statements} sha256=${m.checksum}`);
        console.log(`PLAN_SHA256=${isolation.planDigest(result.migrations)}`);
        console.log(`SAFE_TO_MIGRATE_TEST_SCHEMA=YES session_user=${result.sessionUser} tables=${result.tableCount}`);
        return;
      }
      if (mode.migrate) {
        // Isolated execution: only reviewed, allowlisted statements run; see isolation.runIsolatedMigration.
        const select = async (sql, binds = {}) =>
          (await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows ?? [];
        const result = await isolation.runIsolatedMigration({
          select,
          exec: (sql, binds = {}) => connection.execute(sql, binds),
          commit: () => connection.commit(),
          user: mode.user,
          expectedPlan: mode.expectedPlan,
          migrationsDirectory,
          log: (line) => console.log(line),
        });
        console.log(`ISOLATED_MIGRATION_COMPLETE=YES session_user=${result.sessionUser} migrations=${result.applied} tables=${result.tables} plan_sha256=${result.planSha256}`);
        return;
      }
      await ensureMigrationLedger(connection);
      const appliedResult = await connection.execute(
        "SELECT version, checksum FROM schema_migrations",
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const applied = new Map((appliedResult.rows ?? []).map((row) => [row.VERSION, row.CHECKSUM]));

      for (const file of migrationFiles()) {
        const [version] = file.split("_", 1);
        const sql = fs.readFileSync(path.join(migrationsDirectory, file), "utf8").trim();
        if (!sql) continue;
        const checksum = isolation.checksumOf(sql);
        const previousChecksum = applied.get(version);
        if (previousChecksum) {
          if (previousChecksum !== checksum) throw new Error(`Checksum mismatch for already-applied migration ${file}`);
          continue;
        }

        for (const statement of migrationStatements(sql)) {
          await connection.execute(statement);
        }
        await connection.execute(
          "INSERT INTO schema_migrations (version, name, checksum) VALUES (:version, :name, :checksum)",
          { version, name: file, checksum },
        );
        await connection.commit();
        console.log(`Applied Oracle migration ${file}`);
      }
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      await connection.close();
    }
  } finally {
    await pool.close(5);
  }
}

module.exports = { prepareEnvironment, migrationFiles, migrationStatements };

if (require.main === module) {
  main().catch((error) => {
    console.error(process.argv.includes("--isolated-preflight") ? "Oracle preflight FAILED (SAFE_TO_MIGRATE_TEST_SCHEMA=NO):" : process.argv.includes("--isolated-migrate") ? "Oracle isolated migration FAILED (ISOLATED_MIGRATION_COMPLETE=NO):" : "Oracle migration failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  });
}
