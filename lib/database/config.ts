import { DatabaseError } from "./errors";
import { resolveOracleWalletLocation } from "./oracleWallet";
import type { DbProvider } from "./types";

const DEFAULTS = {
  oraclePoolMin: 0,
  oraclePoolMax: 4,
  oraclePoolIncrement: 1,
  oraclePoolTimeoutSeconds: 60,
  oracleQueueTimeoutMs: 10_000,
  oracleConnectTimeoutSeconds: 15,
} as const;

function optionalPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new DatabaseError("configuration", `${name} must be a non-negative integer`);
  }
  return value;
}

export function getDbProvider(): DbProvider {
  const provider = process.env.DB_PROVIDER?.trim().toLowerCase();
  if (provider === "postgres") return "postgres";
  if (provider === "oracle") return "oracle";
  throw new DatabaseError("configuration", "DB_PROVIDER is required and must be either postgres or oracle");
}

export interface OracleConfig {
  user: string;
  password: string;
  connectString: string;
  walletLocation?: string;
  walletPassword?: string;
  poolMin: number;
  poolMax: number;
  poolIncrement: number;
  poolTimeout: number;
  queueTimeout: number;
  connectTimeout: number;
}

export function getOracleConfig(): OracleConfig {
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;
  if (!user || !password || !connectString) {
    throw new DatabaseError(
      "configuration",
      "Oracle requires ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING",
    );
  }

  const poolMin = optionalPositiveInteger("ORACLE_POOL_MIN", DEFAULTS.oraclePoolMin);
  const poolMax = optionalPositiveInteger("ORACLE_POOL_MAX", DEFAULTS.oraclePoolMax);
  const poolIncrement = optionalPositiveInteger("ORACLE_POOL_INCREMENT", DEFAULTS.oraclePoolIncrement);
  if (poolMax < poolMin || poolIncrement < 1) {
    throw new DatabaseError("configuration", "Oracle pool settings are invalid");
  }

  return {
    user,
    password,
    connectString,
    walletLocation: resolveOracleWalletLocation(),
    walletPassword: process.env.ORACLE_WALLET_PASSWORD || undefined,
    poolMin,
    poolMax,
    poolIncrement,
    poolTimeout: optionalPositiveInteger("ORACLE_POOL_TIMEOUT_SECONDS", DEFAULTS.oraclePoolTimeoutSeconds),
    queueTimeout: optionalPositiveInteger("ORACLE_QUEUE_TIMEOUT_MS", DEFAULTS.oracleQueueTimeoutMs),
    connectTimeout: optionalPositiveInteger("ORACLE_CONNECT_TIMEOUT_SECONDS", DEFAULTS.oracleConnectTimeoutSeconds),
  };
}
