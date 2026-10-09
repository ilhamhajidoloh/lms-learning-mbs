#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("child_process");

const PRODUCTION_ORIGIN = "https://lms-learning-mbs.vercel.app";
const MARKER = "phase8_smoke_";
const targetUrl = process.env.PHASE8_SMOKE_URL;
const username = process.env.PHASE8_SMOKE_USERNAME;
const password = process.env.PHASE8_SMOKE_PASSWORD;
const courseId = process.env.PHASE8_SMOKE_COURSE_ID;
const exportDir = "migration-data/phase7-final-20261009T134910Z";

const result = {
  provider: "other",
  login: "FAIL",
  entity: "course announcement",
  marker: null,
  create: "FAIL",
  read: "FAIL",
  update: "FAIL",
  readBack: "FAIL",
  delete: "FAIL",
  cleanup: "FAIL",
  remaining: [],
  reconciliation: "FAIL",
  schema: "FAIL",
};

let token;
let createdId;
let markerVerified = false;
let cleanupAttempted = false;

function fail(message) {
  throw new Error(message);
}

function safeError(response) {
  return `${response.status} ${response.statusText}`.trim();
}

function reportStep(name, status, response, id) {
  const suffix = id ? ` id=${id}` : "";
  console.log(`${name}: ${status} HTTP ${response.status}${suffix}`);
}

async function request(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = "Bearer " + token;
  return fetch(`${targetUrl}${path}`, { ...options, headers });
}

function requireProductionGuards() {
  if (!targetUrl) fail("PHASE8_SMOKE_URL is required");
  const parsed = new URL(targetUrl);
  if (parsed.origin !== PRODUCTION_ORIGIN || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    fail(`PHASE8_SMOKE_URL must be exactly ${PRODUCTION_ORIGIN}`);
  }
  if (process.argv.includes("--confirm-production-smoke") === false) {
    fail("explicit --confirm-production-smoke is required");
  }
  if (process.env.WRITE_FREEZE === "1") {
    fail("local WRITE_FREEZE=1 would block writes");
  }
  if (!username || !password) fail("PHASE8_SMOKE_USERNAME and PHASE8_SMOKE_PASSWORD are required");
  if (!courseId) fail("PHASE8_SMOKE_COURSE_ID is required");
}

async function assertOracleAndWritable() {
  const health = await fetch(`${targetUrl}/api/health`, { headers: { Accept: "application/json" } });
  let healthBody = {};
  try {
    healthBody = await health.json();
  } catch {
    // The status check below provides the actionable failure.
  }
  if (health.status !== 200 || healthBody.provider !== "oracle") {
    fail(`production health is not Oracle (${health.status}, provider=${healthBody.provider || "unknown"})`);
  }
  result.provider = healthBody.provider;

  // This must reach the route's auth layer rather than the write-freeze middleware.
  const probe = await fetch(`${targetUrl}/api/announcements`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, title: `${MARKER}write_probe`, body: MARKER }),
  });
  if (probe.status !== 401) {
    fail(`write-freeze/auth preflight expected HTTP 401, got ${safeError(probe)}`);
  }
}

async function login() {
  const response = await fetch(`${targetUrl}/api/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (response.status !== 200) {
    reportStep("Login", "FAIL", response);
    fail(`login failed (${safeError(response)})`);
  }
  const body = await response.json();
  if (!body.token || !body.user || !["admin", "teacher"].includes(body.user.role)) {
    reportStep("Login", "FAIL", response);
    fail("login did not return an admin/teacher token");
  }
  token = body.token;
  result.login = "PASS";
  reportStep("Login", "PASS", response);
}

async function readAnnouncements() {
  return request(`/api/announcements?courseId=${encodeURIComponent(courseId)}`);
}

async function create() {
  const response = await request("/api/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courseId,
      title: result.marker,
      body: `${result.marker} disposable authenticated CRUD smoke test`,
    }),
  });
  const body = await response.json().catch(() => ({}));
  createdId = body.announcement && body.announcement.id;
  if (response.status !== 201 || !createdId) {
    reportStep("CREATE", "FAIL", response);
    fail(`create failed (${safeError(response)})`);
  }
  result.create = "PASS";
  reportStep("CREATE", "PASS", response, createdId);
}

async function read() {
  const response = await readAnnouncements();
  const body = await response.json().catch(() => ({}));
  const found = Array.isArray(body.announcements)
    && body.announcements.find((item) => item.id === createdId);
  if (response.status !== 200 || !found || !String(found.title).includes(MARKER)) {
    reportStep("READ", "FAIL", response, createdId);
    fail(`created announcement was not returned with its marker (${safeError(response)})`);
  }
  markerVerified = true;
  result.read = "PASS";
  reportStep("READ", "PASS", response, createdId);
}

async function update() {
  if (!markerVerified) fail("refusing UPDATE because the target marker was not verified");
  const response = await request("/api/announcements", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: createdId,
      title: `${result.marker}updated`,
      body: `${result.marker} updated disposable authenticated CRUD smoke test`,
    }),
  });
  const body = await response.json().catch(() => ({}));
  const item = body.announcement;
  if (response.status !== 200 || !item || item.id !== createdId
      || !String(item.title).includes(MARKER) || !String(item.body).includes(MARKER)) {
    reportStep("UPDATE", "FAIL", response, createdId);
    fail(`update failed or marker was not preserved (${safeError(response)})`);
  }
  result.update = "PASS";
  reportStep("UPDATE", "PASS", response, createdId);
}

async function readBack() {
  const response = await readAnnouncements();
  const body = await response.json().catch(() => ({}));
  const item = Array.isArray(body.announcements)
    && body.announcements.find((candidate) => candidate.id === createdId);
  if (response.status !== 200 || !item
      || item.title !== `${result.marker}updated`
      || item.body !== `${result.marker} updated disposable authenticated CRUD smoke test`) {
    reportStep("READ-BACK", "FAIL", response, createdId);
    fail(`updated announcement did not read back exactly (${safeError(response)})`);
  }
  result.readBack = "PASS";
  reportStep("READ-BACK", "PASS", response, createdId);
}

async function deleteCreated() {
  if (!markerVerified) fail("refusing DELETE because the target marker was not verified");
  const response = await request(`/api/announcements?id=${encodeURIComponent(createdId)}`, {
    method: "DELETE",
  });
  if (response.status !== 200) {
    reportStep("DELETE", "FAIL", response, createdId);
    fail(`delete failed (${safeError(response)})`);
  }
  result.delete = "PASS";
  reportStep("DELETE", "PASS", response, createdId);
}

async function verifyDeleted() {
  const response = await readAnnouncements();
  const body = await response.json().catch(() => ({}));
  const found = Array.isArray(body.announcements)
    && body.announcements.some((item) => item.id === createdId);
  if (response.status !== 200 || found) {
    reportStep("Cleanup verification", "FAIL", response, createdId);
    result.remaining = [createdId];
    return;
  }
  result.cleanup = "PASS";
  result.remaining = [];
  reportStep("Cleanup verification", "PASS", response, createdId);
}

async function cleanup() {
  if (!createdId || cleanupAttempted) return;
  cleanupAttempted = true;
  if (!markerVerified) {
    result.remaining = [createdId];
    console.error(`Cleanup refused because marker was not verified for created ID ${createdId}`);
    return;
  }
  // Never issue cleanup by marker or title: this is the exact ID created by this run.
  const response = await request(`/api/announcements?id=${encodeURIComponent(createdId)}`, {
    method: "DELETE",
  });
  if (response.status === 200 || response.status === 404) {
    await verifyDeleted();
  } else {
    result.remaining = [createdId];
    console.error(`Cleanup failed for created ID ${createdId}: HTTP ${response.status}`);
  }
}

function runValidator(command, args, label) {
  try {
    execFileSync(command, args, { stdio: "inherit", env: process.env });
    result[label] = "PASS";
  } catch {
    result[label] = "FAIL";
    console.error(`${label === "reconciliation" ? "Oracle reconciliation" : "Oracle schema validation"} failed.`);
  }
}

function printFinalReport() {
  console.log(`\nProduction provider:\n${result.provider}`);
  console.log(`\nLogin:\n${result.login}`);
  console.log(`\nTest entity:\n${result.entity}`);
  console.log(`\nMarker:\n${result.marker}`);
  console.log(`\nCREATE:\n${result.create}`);
  console.log(`\nREAD:\n${result.read}`);
  console.log(`\nUPDATE:\n${result.update}`);
  console.log(`\nREAD-BACK:\n${result.readBack}`);
  console.log(`\nDELETE:\n${result.delete}`);
  console.log(`\nCleanup verification:\n${result.cleanup}`);
  console.log(`\nCreated IDs remaining:\n${result.remaining.length ? result.remaining.join(", ") : "0"}`);
  console.log(`\nOracle reconciliation after cleanup:\n${result.reconciliation}`);
  console.log(`\nOracle schema validation:\n${result.schema}`);
  console.log("\nCockroach writes:\n0");
  const smokePass = result.provider === "oracle"
    && result.login === "PASS"
    && result.create === "PASS"
    && result.read === "PASS"
    && result.update === "PASS"
    && result.readBack === "PASS"
    && result.delete === "PASS"
    && result.cleanup === "PASS"
    && result.remaining.length === 0;
  const phasePass = smokePass && result.reconciliation === "PASS" && result.schema === "PASS";
  console.log(`\nPhase 8 CRUD smoke:\n${smokePass ? "PASS" : "FAIL"}`);
  console.log(`\nPhase 8:\n${phasePass ? "COMPLETE" : "INCOMPLETE"}`);
  return phasePass;
}

async function main() {
  result.marker = `${MARKER}${Date.now()}`;
  try {
    requireProductionGuards();
    await assertOracleAndWritable();
    await login();
    await create();
    await read();
    await update();
    await readBack();
    await deleteCreated();
    await verifyDeleted();
  } catch (error) {
    console.error(`Phase 8 smoke stopped: ${error instanceof Error ? error.message : "unknown error"}`);
  } finally {
    await cleanup();
    if (result.cleanup === "PASS" && result.remaining.length === 0
        && result.create === "PASS" && result.readBack === "PASS") {
      runValidator(process.execPath, [
        "scripts/migration/validate-phase4c-import.cjs",
        `--export-dir=${exportDir}`,
        "--phase7",
      ], "reconciliation");
      runValidator("npm.cmd", ["run", "db:validate:oracle"], "schema");
    }
    process.exitCode = printFinalReport() ? 0 : 1;
  }
}

main().catch((error) => {
  console.error(`Phase 8 smoke failed unexpectedly: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
