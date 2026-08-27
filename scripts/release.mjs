import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function run(command, args, capture = false, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root, env, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}`);
  return result.stdout?.trim();
}
async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

try {
  if (process.platform !== "darwin") throw new Error("release:mac requires macOS.");
  if (process.argv.length > 2) throw new Error("release:mac takes no arguments; it builds the host architecture.");
  if (!["arm64", "x64"].includes(process.arch)) throw new Error("Unsupported host architecture.");
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  if (pkg.version !== lock.version || pkg.version !== lock.packages[""].version) {
    throw new Error("package.json and package-lock.json versions must match.");
  }
  run("git", ["diff", "--check"]);
  run("npm", ["test"]);
  const sourceCommit = run("git", ["rev-parse", "HEAD"], true);
  const dirty = Boolean(run("git", ["status", "--porcelain", "--untracked-files=normal"], true));
  const releases = path.join(root, "outputs", "releases");
  await mkdir(releases, { recursive: true });
  const output = await mkdtemp(path.join(releases, `v${pkg.version}-mac-${process.arch}-`));
  console.log(`Release output: ${output}`);
  run(process.execPath, [path.join(root, "node_modules/electron-builder/cli.js"),
    "--mac", "dmg", "zip", `--${process.arch}`, "--publish", "never",
    `-c.directories.output=${output}`,
    "-c.mac.identity=null", "-c.mac.notarize=false",
    "-c.artifactName=呼噜呼噜-${version}-mac-${arch}-unsigned.${ext}",
  ], false, { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" });

  const [packed] = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", output], true));
  // Keep npm payload explicit; never ship local outputs, configs or dependencies.
  const allowed = /^(?:bin\/|src\/|assets\/|scripts\/|AGENTS\.md$|LICENSE$|README\.md$|package\.json$)/;
  for (const { path: entry } of packed.files) {
    if (!allowed.test(entry) || /(?:^|\/)(?:\.env(?:\..*)?|\.claude|\.cc-switch)(?:\/|$)/.test(entry)) {
      throw new Error(`Unexpected npm payload entry: ${entry}`);
    }
  }
  const names = (await readdir(output)).filter(name => /\.(?:dmg|zip|tgz)$/.test(name)).sort();
  if (names.length !== 3 || !["dmg", "zip", "tgz"].every(ext => names.some(name => name.endsWith(`.${ext}`)))) {
    throw new Error("Expected exactly one DMG, ZIP and npm tarball.");
  }
  run("hdiutil", ["verify", path.join(output, names.find(name => name.endsWith(".dmg")))]);
  run("unzip", ["-tq", path.join(output, names.find(name => name.endsWith(".zip")))]);
  for (const name of ["README.md", "AGENTS.md", "LICENSE"]) {
    await copyFile(path.join(root, name), path.join(output, name));
  }
  await mkdir(path.join(output, "assets"));
  await copyFile(path.join(root, "assets/blue-one-eye-mascot.svg"), path.join(output, "assets/blue-one-eye-mascot.svg"));
  await writeFile(path.join(output, "SHA256SUMS"), (await Promise.all(names.map(async name =>
    `${await sha256(path.join(output, name))}  ${name}`))).join("\n") + "\n");
  await writeFile(path.join(output, "RELEASE.md"), `# 呼噜呼噜 v${pkg.version}\n\n` +
    `- 架构：macOS ${process.arch}；打包时间：${new Date().toISOString()}。\n` +
    `- 基础提交：${sourceCommit}；工作区${dirty ? "含未提交改动，产物不是该提交的干净快照" : "干净"}。\n` +
    `- 无 Developer ID 签名，未经 Apple 公证；未上传 GitHub / npm。\n` +
    `- 已通过：Node 单测、DMG 完整性、ZIP 完整性、npm 文件清单检查。\n` +
    `- 本命令不运行桌面交互测试，不发送真实聊天请求。\n\n` +
    `## 安装\n\nDMG / ZIP：将 呼噜呼噜.app 放进 Applications 后打开。\n` +
    `CLI（Node.js 22.12+）：\n\n\`\`\`bash\nnpm install -g ./${packed.filename}\nbluepet\n\`\`\`\n\n` +
    `在本目录执行 \`shasum -a 256 -c SHA256SUMS\` 校验三个安装包。\n\n` +
    `功能与使用说明见同目录 README.md；AGENTS.md 为项目协作指南。\n` +
    `公开发布需要另外授权 tag 与上传；本次目录包含未签名本地构建。\n`);
  console.log(`Release ready: ${output}`);
} catch (error) {
  console.error(`Release failed: ${error.message}`);
  process.exitCode = 1;
}
