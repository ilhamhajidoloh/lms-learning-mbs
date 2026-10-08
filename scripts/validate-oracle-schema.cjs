/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to validate the Oracle schema`);
  return value;
}

function loadManifest() {
  const filename = path.join(process.cwd(), "database", "oracle", "schema-manifest.json");
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

async function names(connection, sql, binds) {
  const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return new Set((result.rows ?? []).map((row) => row.NAME));
}

async function validateTable(connection, table) {
  const problems = [];
  const columnsResult = await connection.execute(
    "SELECT column_name AS name, data_type AS type, nullable FROM user_tab_columns WHERE table_name = :tableName",
    { tableName: table.name.toUpperCase() },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const columns = new Map((columnsResult.rows ?? []).map((row) => [row.NAME, row]));
  for (const [name, expectedType, nullable] of table.columns) {
    const actual = columns.get(name.toUpperCase());
    if (!actual) {
      problems.push(`${table.name}.${name} is missing`);
    } else {
      // Oracle stores TIMESTAMP WITH TIME ZONE as TIMESTAMP(6) WITH TIME ZONE.
      const actualType = String(actual.TYPE).replace(/^TIMESTAMP\(\d+\) WITH TIME ZONE$/, "TIMESTAMP WITH TIME ZONE");
      if (!actualType.startsWith(expectedType)) {
        problems.push(`${table.name}.${name} type is ${actual.TYPE}, expected ${expectedType}`);
      }
    }
    if (actual && (actual.NULLABLE === "Y") !== nullable) {
      problems.push(`${table.name}.${name} nullable state differs`);
    }
  }

  const constraints = await names(
    connection,
    "SELECT constraint_name AS name FROM user_constraints WHERE table_name = :tableName",
    { tableName: table.name.toUpperCase() },
  );
  for (const name of [table.primaryKey, ...table.foreignKeys, ...table.uniqueConstraints, ...table.checks]) {
    if (!constraints.has(name.toUpperCase())) problems.push(`${table.name} constraint ${name} is missing`);
  }
  const indexes = await names(
    connection,
    "SELECT index_name AS name FROM user_indexes WHERE table_name = :tableName",
    { tableName: table.name.toUpperCase() },
  );
  for (const name of table.indexes) {
    if (!indexes.has(name.toUpperCase())) problems.push(`${table.name} index ${name} is missing`);
  }
  return problems;
}

async function main() {
  const manifest = loadManifest();
  const pool = await oracledb.createPool({
    user: required("ORACLE_USER"),
    password: required("ORACLE_PASSWORD"),
    connectString: required("ORACLE_CONNECT_STRING"),
    ...(process.env.ORACLE_WALLET_LOCATION ? {
      walletLocation: process.env.ORACLE_WALLET_LOCATION,
      configDir: process.env.ORACLE_WALLET_LOCATION,
    } : {}),
    ...(process.env.ORACLE_WALLET_PASSWORD ? { walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
    poolMin: 0, poolMax: 1, poolIncrement: 1,
  });
  try {
    const connection = await pool.getConnection();
    try {
      const actualTables = await names(connection, "SELECT table_name AS name FROM user_tables", {});
      const missingTables = manifest.tables.filter((table) => !actualTables.has(table.name.toUpperCase()));
      const problems = missingTables.map((table) => `table ${table.name} is missing`);
      for (const table of manifest.tables.filter((table) => !missingTables.includes(table))) {
        problems.push(...await validateTable(connection, table));
      }
      if (problems.length) throw new Error(`Schema validation failed:\n- ${problems.join("\n- ")}`);
      console.log(`Oracle schema validation passed: ${manifest.tables.length} LMS tables validated.`);
    } finally {
      await connection.close();
    }
  } finally {
    await pool.close(5);
  }
}

main().catch((error) => {
  console.error("Oracle schema validation failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
