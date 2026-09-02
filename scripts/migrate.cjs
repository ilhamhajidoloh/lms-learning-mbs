const fs = require("fs");
const path = require("path");
const Module = require("module");
const typescript = require("typescript");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const dbPath = path.join(process.cwd(), "lib", "db.ts");
const source = fs.readFileSync(dbPath, "utf8");
const output = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2017,
    esModuleInterop: true,
  },
  fileName: dbPath,
}).outputText;

const dbModule = new Module(dbPath, module);
dbModule.filename = dbPath;
dbModule.paths = Module._nodeModulePaths(path.dirname(dbPath));
dbModule._compile(output, dbPath);

const { default: pool, migrateDatabase } = dbModule.exports;

async function run() {
  try {
    await migrateDatabase();
    console.log("Database migration completed.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
