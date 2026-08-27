import test from "node:test";
import assert from "node:assert/strict";
import {askClaude} from "../src/chat.js";
import {deepseekCredentials} from "../src/chat-provider.js";
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
