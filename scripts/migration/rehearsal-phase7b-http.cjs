#!/usr/bin/env node
const BASE = "http://localhost:5002", PW = process.env.P7B_PW, USER = "phase7_rehearsal_teacher";
const j = async (method, path, { token, body, headers } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  let data = null; try { data = await r.json(); } catch { /* non-json */ }
  return { status: r.status, data };
};
const size = (d) => Array.isArray(d) ? d.length : d && typeof d === "object" ? Object.keys(d).length + " keys" : "n/a";
(async () => {
  const out = {};
  const h = await j("GET", "/api/health"); out.health = { status: h.status, provider: h.data && h.data.provider };
  const bad = await j("POST", "/api/auth/login", { body: { username: USER, password: "definitely-wrong" } }); out.login_wrong_password = { status: bad.status, freeze_code: bad.data && bad.data.code || null };
  const ok = await j("POST", "/api/auth/login", { body: { username: USER, password: PW } });
  out.login = { status: ok.status, token_issued: !!(ok.data && ok.data.token), role: ok.data && ok.data.user && ok.data.user.role, freeze_code: ok.data && ok.data.code || null };
  const token = ok.data && ok.data.token;
  out.unauth_read = (await j("GET", "/api/levels")).status;
  out.reads = {};
  for (const p of ["/api/data", "/api/levels", "/api/profiles", "/api/live-classes", "/api/private-lesson-requests"]) {
    const r = await j("GET", p, { token });
    out.reads[p] = { status: r.status, shape: size(r.data), freeze_code: r.data && r.data.code || null };
  }
  const w = await j("POST", "/api/courses", { token, body: {} }); out.mutation_still_frozen = { status: w.status, code: w.data && w.data.code };
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error("driver error:", e.message); process.exit(1); });
