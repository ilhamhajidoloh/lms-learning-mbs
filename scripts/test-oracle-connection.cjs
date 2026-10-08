/* eslint-disable @typescript-eslint/no-require-imports */
const oracledb = require("oracledb");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to test Oracle connectivity`);
  return value;
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
      const result = await connection.execute(
        "SELECT 1 AS value, SYSTIMESTAMP AS current_time FROM DUAL",
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      console.log("Oracle connectivity test passed.", result.rows?.[0] ?? {});
    } finally {
      await connection.close();
    }
  } finally {
    await pool.close(5);
  }
}

main().catch((error) => {
  // Do not print driver configuration or environment values: messages are enough for diagnosis.
  console.error("Oracle connectivity test failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
