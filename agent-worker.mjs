#!/usr/bin/env node
// ORCA 탭에서 직접 실행하는 워커. .agents/tasks/<role>/ 를 감시하다 작업 파일이 생기면
// 해당 CLI(codex 또는 cn)를 실행하고, 그 출력을 이 터미널에 실시간으로 그대로 찍는다.
import { spawn } from "child_process";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "fs";
import { join } from "path";

const role = process.argv[2];
if (role !== "codex" && role !== "glm") {
  console.error("사용법: node agent-worker.mjs <codex|glm>");
  process.exit(1);
}

const ROOT = process.cwd();
const TASK_DIR = join(ROOT, ".agents", "tasks", role);
const DONE_DIR = join(TASK_DIR, "done");
const RESULT_DIR = join(ROOT, ".agents", "results", role);

for (const dir of [TASK_DIR, DONE_DIR, RESULT_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function nextTask() {
  const files = readdirSync(TASK_DIR).filter((f) => f.endsWith(".md")).sort();
  return files[0] ?? null;
}

function runTask(filename) {
  const taskPath = join(TASK_DIR, filename);
  const content = readFileSync(taskPath, "utf-8");
  const id = filename.replace(/\.md$/, "");
  const resultPath = join(RESULT_DIR, `${id}.md`);

  console.log(`\n${"=".repeat(60)}\n[worker:${role}] 작업 시작: ${filename}\n${"=".repeat(60)}\n`);
  console.log(content);
  console.log(`${"-".repeat(60)}\n[worker:${role}] 실행 중...\n`);

  let child;
  if (role === "codex") {
    child = spawn("codex", ["exec", "-s", "workspace-write", "-c", "model_reasoning_effort=medium", "-"], { cwd: ROOT });
    child.stdin.write(content);
    child.stdin.end();
  } else {
    const promptPath = join(TASK_DIR, `.${id}.prompt.md`);
    writeFileSync(promptPath, content);
    child = spawn(
      "/Users/sw/.npm-global/bin/cn",
      ["--config", "./continue-glm.yaml", "--auto", "-p", "--prompt", promptPath, "위 지시대로 작업을 진행해줘."],
      { cwd: ROOT },
    );
  }

  let output = "";
  child.stdout.on("data", (chunk) => { process.stdout.write(chunk); output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { process.stderr.write(chunk); output += chunk.toString(); });

  child.on("close", (code) => {
    writeFileSync(resultPath, output);
    renameSync(taskPath, join(DONE_DIR, filename));
    console.log(`\n${"=".repeat(60)}\n[worker:${role}] 작업 완료 (exit ${code}) -> .agents/results/${role}/${id}.md\n${"=".repeat(60)}\n`);
    console.log(`[worker:${role}] 다음 작업 대기 중...`);
    setTimeout(poll, 2000);
  });
}

function poll() {
  const file = nextTask();
  if (file) runTask(file);
  else setTimeout(poll, 2000);
}

console.log(`[worker:${role}] 대기 중... (.agents/tasks/${role}/ 를 감시합니다)`);
poll();
