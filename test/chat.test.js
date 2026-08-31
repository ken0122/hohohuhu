import test from "node:test";
import assert from "node:assert/strict";
import {askClaude, chatSystemPrompt} from "../src/chat.js";
import {deepseekCredentials} from "../src/chat-provider.js";
import { BLACK_CAT_PROFILE } from "../src/character-profile.js";
const provider=async()=>({url:"https://api.deepseek.com/anthropic/v1/messages",key:"test-only-key"});
test("chat explicitly requests Flash with thinking disabled, low effort and no tools",async()=>{
  const reply=await askClaude("  你好  ",{provider,request:async(url,options)=>{
    assert.equal(url,(await provider()).url);assert.equal(options.redirect,"error");
    const body=JSON.parse(options.body);
    assert.equal(body.model,"deepseek-v4-flash");assert.deepEqual(body.thinking,{type:"disabled"});
    assert.deepEqual(body.output_config,{effort:"low"});assert.equal(body.max_tokens,160);
    assert.equal(body.tools,undefined);assert.deepEqual(body.messages,[{role:"user",content:"你好"}]);
    return Response.json({content:[{type:"thinking",thinking:"not displayed"},{type:"text",text:"蓝".repeat(100)}]});
  }});
  assert.equal([...reply].length,50);assert.ok(!reply.includes("displayed"));
});
test("chat prompt follows the selected trusted character persona", async () => {
  assert.match(chatSystemPrompt(BLACK_CAT_PROFILE.persona), /黑猫/);
  assert.match(chatSystemPrompt(BLACK_CAT_PROFILE.persona), /克制/);
  await askClaude("你好", { persona: BLACK_CAT_PROFILE.persona, provider, request: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.match(body.system, /黑猫/);
    assert.doesNotMatch(body.system, /蓝色单眼/);
    return Response.json({ content: [{ type: "text", text: "……你好。" }] });
  }});
});
test("credential routing never pairs an unrelated provider key with DeepSeek",()=>{
  for(const base of ["https://ark.cn-beijing.volces.com/api/plan","https://api.deepseek.com.evil.test","http://api.deepseek.com"])
    assert.equal(deepseekCredentials({ANTHROPIC_BASE_URL:base,ANTHROPIC_API_KEY:"test-only"}),undefined);
  assert.equal(deepseekCredentials({ANTHROPIC_BASE_URL:"https://api.deepseek.com/anthropic"}),undefined);
  assert.equal(deepseekCredentials({ANTHROPIC_BASE_URL:"https://api.deepseek.com/anthropic",ANTHROPIC_AUTH_TOKEN:"test-only"}).key,"test-only");
});
test("chat validates input and handles auth, rate limits and timeouts without raw provider errors",async()=>{
  await assert.rejects(askClaude("  ",{provider}),/悄悄/);
  for(const [status,expected] of [[401,/凭证/],[429,/稍等/],[500,/暂时/]])
    await assert.rejects(askClaude("hi",{provider,request:async()=>new Response("private provider detail",{status})}),expected);
  await assert.rejects(askClaude("hi",{provider,request:async()=>{throw new DOMException("private","TimeoutError");}}),/再问/);
  await assert.rejects(askClaude("hi",{provider,request:async()=>Response.json({content:[]})}),/走神/);
});

test("API settings validate URLs and securely persist without returning keys", async () => {
  const { createApiSettingsStore, validateApiSettings } = await import("../src/api-settings.js");
  const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createCipheriv, createDecipheriv, randomBytes } = await import("node:crypto");
  const cipherKey = randomBytes(32), iv = randomBytes(16);
  const secureStorage = {
    isEncryptionAvailable: () => true,
    encryptString(value) { const cipher = createCipheriv("aes-256-cbc", cipherKey, iv); return Buffer.concat([cipher.update(value), cipher.final()]); },
    decryptString(value) { const cipher = createDecipheriv("aes-256-cbc", cipherKey, iv); return Buffer.concat([cipher.update(value), cipher.final()]).toString(); },
  };
  const directory = await mkdtemp(join(tmpdir(), "bluepet-settings-"));
  try {
    for (const baseUrl of ["http://api.deepseek.com", "https://evil.test", "https://api.deepseek.com.evil.test", "https://user@api.deepseek.com", "https://api.deepseek.com/other", "https://api.deepseek.com/?token=x"])
      assert.throws(() => validateApiSettings({ baseUrl, apiKey: "fake-key" }));
    const store = createApiSettingsStore({ directory, secureStorage });
    assert.equal(store.provider(), undefined);
    const value = { baseUrl: "https://api.deepseek.com", apiKey: "fake-key" };
    const status = store.save(value);
    assert.deepEqual(status, { configured: true, baseUrl: "https://api.deepseek.com/anthropic" });
    assert.ok(!(await readFile(join(directory, "api-settings.enc"))).includes(Buffer.from("fake-key")));
    const reopened = createApiSettingsStore({ directory, secureStorage });
    assert.equal(reopened.provider().key, "fake-key");
    reopened.save({ ...value, apiKey: "" });
    assert.equal(reopened.provider().key, "fake-key");
    reopened.save({ ...value, apiKey: "replacement" });
    assert.equal(reopened.provider().key, "replacement");
    await assert.rejects(askClaude("hi", { provider: () => reopened.provider(), request: async (_url, options) => {
      assert.equal(options.headers["x-api-key"], "replacement"); return new Response(null, { status: 401 });
    }}), /凭证/);
    const unavailable = createApiSettingsStore({ directory, secureStorage: { isEncryptionAvailable: () => false } });
    assert.throws(() => unavailable.save(value), /系统加密/);
    await writeFile(join(directory, "api-settings.enc"), "corrupt");
    assert.throws(() => reopened.provider(), /无法解密/);
    assert.equal(reopened.clear().configured, false);
    assert.equal(reopened.provider(), undefined);
    assert.throws(() => reopened.save({ ...value, apiKey: "" }), /API Key/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
