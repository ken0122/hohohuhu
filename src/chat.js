import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanClaudeReply } from "./core.js";
const SYSTEM_PROMPT = "你是一只住在用户桌面上的蓝色单眼小宠物。性格乖巧、亲昵、略微害羞，偶尔撒娇，但不油腻、不说教。用用户的语言回答，只说一句自然短句，不使用 Markdown，最多 50 个字符。不要声称你操作了电脑，不要索取敏感信息。";
function resolveClaudePath() {
  const candidates = [
    process.env.BLUEPET_CLAUDE_PATH,
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    path.join(os.homedir(), ".local/bin/claude"),
  ].filter(Boolean);
  return candidates.find((candidate) => path.isAbsolute(candidate) && existsSync(candidate));
}

export async function askClaude(prompt) {
  const claudePath = resolveClaudePath();
  if (!claudePath) throw new Error("没有找到 Claude Code。请先安装 claude，或设置 BLUEPET_CLAUDE_PATH。");
  const safePrompt = String(prompt).trim().slice(0, 500);
  if (!safePrompt) throw new Error("悄悄说点什么吧。");

  return new Promise((resolve, reject) => {
    const child = spawn(
      claudePath,
      [
        "-p",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--tools",
        "",
        "--system-prompt",
        SYSTEM_PROMPT,
        safePrompt,
      ],
      { cwd: os.tmpdir(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    let errorOutput = "";
    const timeout = setTimeout(() => child.kill("SIGTERM"), 45_000);
    child.stdout.on("data", (chunk) => {
      if (output.length < 8_000) output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      if (errorOutput.length < 2_000) errorOutput += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (signal) return reject(new Error("我想了太久，脑袋冒烟啦。再问一次好吗？"));
      if (code !== 0) {
        if (process.argv.includes("--dev") && errorOutput.trim()) console.error(errorOutput.trim());
        return reject(new Error("Claude Code 暂时没回应，请检查本机 provider 后再试。"));
      }
      const reply = cleanClaudeReply(output);
      if (!reply) return reject(new Error("我刚刚走神了，再说一次好吗？"));
      resolve(reply);
    });
  });
}
