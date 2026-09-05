import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCharacterDiagnostics, characterTimingMessage } from '../src/character-timing.js';

test('timing details whitelist IPC data and distinguish no repair, active repair, and completed repair', () => {
  const first = {phase:'generation',durationMs:1234,key:'secret',reply:'private'};
  assert.deepEqual(cleanCharacterDiagnostics({attempts:[first],provider:'secret'}),{attempts:[{phase:'generation',durationMs:1234}]});
  assert.equal(characterTimingMessage('zh-CN',{attempts:[first]}),'生成用时 1.2 秒');
  assert.equal(characterTimingMessage('zh-CN',{attempts:[first]},true),'生成用时 1.2 秒 · 正在调整内容…');
  assert.equal(characterTimingMessage('zh-CN',{attempts:[first,{phase:'repair',durationMs:2234}]}),'生成用时 1.2 秒 · 调整用时 2.2 秒');
  assert.equal(characterTimingMessage('zh-CN',{attempts:[{phase:'translation',durationMs:1234}]}), '翻译用时 1.2 秒');
  assert.equal(characterTimingMessage('zh-CN',{attempts:[]}), '');
  for(const locale of ['zh-CN','zh-TW','en','ja','fr','de','ru']) assert.ok(characterTimingMessage(locale,{attempts:[first]}).includes('1.2'));
});

test('active thinking retry explains its longer wait and drops it after completion', () => {
  const first={phase:'translation',durationMs:13374};
  const progress=cleanCharacterDiagnostics({attempts:[first],timeoutSeconds:90,secret:'private'});
  assert.deepEqual(progress,{attempts:[first],timeoutSeconds:90});
  for(const locale of ['zh-CN','zh-TW','en','ja','fr','de','ru']) {
    assert.match(characterTimingMessage(locale,progress,true),/90/);
    assert.ok(!characterTimingMessage(locale,{attempts:[first,{phase:'repair',durationMs:32000}]},false).includes('90'));
  }
  assert.equal(cleanCharacterDiagnostics({attempts:[first],timeoutSeconds:999}).timeoutSeconds,undefined);
});
