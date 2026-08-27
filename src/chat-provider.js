import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
const exec=promisify(execFile);
export const CHAT_MODEL="deepseek-v4-flash";

export function deepseekCredentials(env={}) {
  // Never mix a provider's key with another provider's URL.
  let url;
  try {url=new URL(env.ANTHROPIC_BASE_URL);} catch {return;}
  if(url.protocol!=="https:"||url.host!=="api.deepseek.com"||url.username||url.password)return;
  const key=env.ANTHROPIC_AUTH_TOKEN||env.ANTHROPIC_API_KEY;
  if(typeof key!=="string"||!key.trim())return;
  return {url:"https://api.deepseek.com/anthropic/v1/messages",key};
}

export async function loadChatProvider({env=process.env,home=os.homedir()}={}) {
  const explicit=deepseekCredentials(env);
  if(explicit)return explicit;
  // Read only the selected Claude provider; never log or copy credentials.
  try {
    const {stdout}=await exec("sqlite3",["-readonly",path.join(home,".cc-switch/cc-switch.db"),
      "SELECT settings_config FROM providers WHERE app_type='claude' AND is_current=1 LIMIT 1;"],{timeout:2000,maxBuffer:262144});
    const selected=deepseekCredentials(JSON.parse(stdout).env);
    if(selected)return selected;
  } catch { /* CC Switch is optional. */ }
  try {
    const settings=JSON.parse(await readFile(path.join(env.CLAUDE_CONFIG_DIR||path.join(home,".claude"),"settings.json"),"utf8"));
    const configured=deepseekCredentials(settings.env);
    if(configured)return configured;
  } catch { /* Report a safe message, never raw credential data. */ }
  throw new Error("请在 Claude Code 或 CC Switch 中配置并选择 DeepSeek，再和我聊天。");
}
