/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

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

async function main() {
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
        const checksum = crypto.createHash("sha256").update(sql).digest("hex");
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

main().catch((error) => {
  console.error("Oracle migration failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
