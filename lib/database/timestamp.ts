/**
 * Oracle SQL fragment that turns a bound UTC ISO string (Date#toISOString()) into an exact instant.
 *
 * Do not bind the string directly: Oracle then parses it with the session NLS_TIMESTAMP_TZ_FORMAT and
 * fails with ORA-01843. Do not bind a bare JS Date either: it is TIMESTAMP_LTZ, uses the session offset
 * and shifts instants that fall in a different DST period. A NULL bind yields NULL.
 */
export function oracleUtcInstant(bindName: string): string {
  return `FROM_TZ(TO_TIMESTAMP(:${bindName}, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'), 'UTC')`;
}
