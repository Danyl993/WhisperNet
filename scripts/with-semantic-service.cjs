const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const projectDir = path.resolve(__dirname, "..");
const serviceDir = path.join(projectDir, "embedding-service");
const mode = process.argv[2] === "start" ? "start" : "dev";
const pythonPath = process.platform === "win32"
  ? path.join(serviceDir, ".venv", "Scripts", "python.exe")
  : path.join(serviceDir, ".venv", "bin", "python");

if (!existsSync(pythonPath)) {
  console.error("Semantic service Python environment is missing. Create embedding-service/.venv and install embedding-service/requirements.txt.");
  process.exit(1);
}

const semantic = spawn(
  pythonPath,
  ["-m", "uvicorn", "api:app", "--host", "127.0.0.1", "--port", "8000"],
  { cwd: serviceDir, stdio: "inherit", env: { ...process.env, PYTHONUNBUFFERED: "1" } }
);

let stopping = false;
let next;

function stopChildren() {
  stopping = true;
  if (next && next.exitCode === null) next.kill("SIGTERM");
  if (semantic.exitCode === null) semantic.kill("SIGTERM");
}

process.once("SIGINT", stopChildren);
process.once("SIGTERM", stopChildren);

async function waitForSemanticService() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline && !stopping) {
    if (semantic.exitCode !== null) {
      throw new Error("Semantic service stopped during startup; see its error above.");
    }
    try {
      const response = await fetch("http://127.0.0.1:8000/");
      if (response.ok) return;
    } catch {
      // The embedding model may take time to load the first time.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("Semantic service did not become ready within 2 minutes.");
}

async function holdSemanticServiceForExistingNext() {
  const port = process.env.PORT || 3000;
  try {
    await fetch(`http://127.0.0.1:${port}/`);
    console.log(`An app is already responding on port ${port}. The semantic service is ready for it; leave this terminal open while WhisperNet is running.`);
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
    stopChildren();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  try {
    console.log("Starting WhisperNet semantic service and loading the embedding model...");
    await waitForSemanticService();
    if (stopping) return;
    if (mode === "dev" && await holdSemanticServiceForExistingNext()) return;
    console.log("Semantic service ready. Starting Next.js.");
    next = spawn(process.execPath, [require.resolve("next/dist/bin/next"), mode], {
      cwd: projectDir,
      stdio: "inherit",
      env: process.env,
    });
    next.once("exit", (code) => {
      if (!stopping) {
        stopping = true;
        if (semantic.exitCode === null) semantic.kill("SIGTERM");
        process.exitCode = code ?? 1;
      }
    });
    semantic.once("exit", (code) => {
      if (!stopping) {
        console.error(`Semantic service exited unexpectedly (${code ?? "signal"}); stopping Next.js so reports are not processed without semantic matching.`);
        stopChildren();
        process.exitCode = 1;
      }
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    stopChildren();
    process.exitCode = 1;
  }
}

main();
