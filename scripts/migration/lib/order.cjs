/* eslint-disable @typescript-eslint/no-require-imports */
// FK dependency ordering (Kahn topological sort, preferred-order tie-break, deterministic).

/**
 * edges: [{ child, parent }] (self references are reported separately and ignored for ordering).
 * Returns { order, cycles, selfRefs, levels }.
 */
function deriveOrder(tables, edges, preferred = []) {
  const rank = new Map(preferred.map((t, i) => [t, i]));
  const rankOf = (t) => (rank.has(t) ? rank.get(t) : 1e6);
  const selfRefs = edges.filter((e) => e.child === e.parent).map((e) => e.child);
  const real = edges.filter((e) => e.child !== e.parent && tables.includes(e.child) && tables.includes(e.parent));
  const parents = new Map(tables.map((t) => [t, new Set()]));
  for (const e of real) parents.get(e.child).add(e.parent);
  const done = new Set();
  const order = [];
  const levels = {};
  let remaining = [...tables];
  let level = 0;
  while (remaining.length) {
    const ready = remaining.filter((t) => [...parents.get(t)].every((p) => done.has(p)));
    if (!ready.length) {
      return { order, cycles: remaining.slice().sort(), selfRefs, levels };
    }
    ready.sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b));
    // Emit one table per step in preferred order but only among currently-ready tables.
    const next = ready[0];
    order.push(next);
    done.add(next);
    levels[next] = level++;
    remaining = remaining.filter((t) => t !== next);
  }
  return { order, cycles: [], selfRefs, levels };
}

module.exports = { deriveOrder };
