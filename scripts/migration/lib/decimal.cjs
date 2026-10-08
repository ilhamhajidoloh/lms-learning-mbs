// Exact decimal helpers for the preflight report (strings only; never floating point).

/**
 * Rounds a plain decimal string to `scale` fractional digits, ties away from zero (Oracle NUMBER(p,s) / ROUND semantics).
 * Returns the canonical string (no trailing fractional zeros). Throws on non-decimal input.
 */
function roundHalfAwayFromZero(s, scale) {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(s).trim());
  if (!m) throw new Error(`not a plain decimal: ${s}`);
  const [, sign, intPart, fracRaw = ""] = m;
  const frac = fracRaw.padEnd(scale + 1, "0");
  let digits = BigInt(intPart + frac.slice(0, scale));
  if (frac.charCodeAt(scale) - 48 >= 5) digits += 1n; // first dropped digit decides; magnitude rounding == away from zero
  let str = digits.toString().padStart(scale + 1, "0");
  const i = str.length - scale;
  str = scale ? `${str.slice(0, i)}.${str.slice(i)}` : str;
  str = str.includes(".") ? str.replace(/0+$/, "").replace(/\.$/, "") : str;
  return str === "0" ? "0" : `${sign}${str}`;
}

module.exports = { roundHalfAwayFromZero };
