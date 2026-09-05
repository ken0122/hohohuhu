import assert from 'node:assert/strict';
import { providerRequest } from '../../src/chat-provider.js';
const locales = ['zh-CN','zh-TW','en','ja','fr','de','ru'];
const intents = ['headpat','tickle','poke','cuddle','nuzzle','hop','shy'];
export const characterApiFixture = {
  scenario: 'success', calls: [],
  reset(scenario = 'success') { this.scenario = scenario; this.calls.length = 0; },
  provider: async () => providerRequest({baseUrl:characterApiFixture.scenario==='direct-translation'?'https://api.deepseek.com/anthropic':'https://character-test.invalid/v1',key:'fictional-test-key',model:'fixture-chat',visionModel:'fixture-vision'}),
  async request(_url, options) {
    const direct=characterApiFixture.scenario==='direct-translation';
    assert.equal(_url, direct?'https://api.deepseek.com/anthropic/v1/messages':'https://character-test.invalid/v1/messages');
    const body = JSON.parse(options.body), content = body.messages[0].content, prompt = content[0].text;
    assert.equal(body.model, content.some(block => block.type === 'image') ? 'fixture-vision' : 'fixture-chat');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(body.thinking, direct?{type:'disabled'}:undefined); assert.equal(body.effort, undefined);
    characterApiFixture.calls.push({budget:body.max_tokens,model:body.model,signal:options.signal,prompt,hasImage:content.some(block=>block.type==='image')});
    if (prompt.includes('__missing_provider__')) { const error=new Error('not configured');error.code='PROVIDER_NOT_CONFIGURED';throw error; }
    options.signal.throwIfAborted();
    if (characterApiFixture.scenario === 'thinking-only') return Response.json({content:[{type:'thinking',thinking:'fixture reasoning'}],stop_reason:'max_tokens'});
    if (characterApiFixture.scenario === 'thinking-recovery' && body.max_tokens < 8192) return Response.json({content:[{type:'thinking',thinking:'fixture reasoning'}],stop_reason:'max_tokens'});
    if (characterApiFixture.scenario === 'thinking-recovery') return Response.json({content:[{type:'text',text:'原文的一句日语翻译'}],stop_reason:'end_turn'});
    if (characterApiFixture.scenario === 'thinking-slow-body' && body.max_tokens < 8192) return Response.json({content:[{type:'thinking',thinking:'fixture reasoning'}],stop_reason:'max_tokens'});
    if (characterApiFixture.scenario === 'translation-truncated' && characterApiFixture.calls.length > 1) return Response.json({content:[{type:'text',text:'{"dialogueTranslations":'}],stop_reason:'max_tokens'});
    if (['natural-line','translation-truncated'].includes(characterApiFixture.scenario) && characterApiFixture.calls.length === 1)
      return Response.json({content:[{type:'text',text:characterApiFixture.scenario==='translation-truncated'?'别戳啦，好痒｜第二句｜第三句｜第四句':'再摸一下嘛｜第二句｜第三句｜第四句'}],stop_reason:'end_turn'});
    if (characterApiFixture.scenario === 'empty' || (characterApiFixture.scenario === 'retry' && characterApiFixture.calls.length === 1)) return Response.json({content:[]});
    if (characterApiFixture.scenario === 'truncated' && body.max_tokens < 4096) return Response.json({content:[{type:'text',text:'{"dialogue":'}],stop_reason:'max_tokens'});
    if (characterApiFixture.scenario === 'auth') return new Response(null,{status:401});
    if (characterApiFixture.scenario === 'delayed') await new Promise(resolve=>setTimeout(resolve,450));
    if (characterApiFixture.scenario === 'slow' || characterApiFixture.scenario === 'staged-slow') {
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(resolve,characterApiFixture.scenario === 'staged-slow' ? (characterApiFixture.calls.length === 1 ? 18000 : 15000) : 35000);
        options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(options.signal.reason);},{once:true});
      });
    }
    const dialogue=Object.fromEntries(intents.map(intent=>[intent,[`AI 生成的 ${intent} 台词`,"第二句","第三句","第四句"]]));
    const result={
      name:'AI 测试角色', quality:{decision:'pass',issues:[],explanation:'固定 HTTP 测试响应'},
      persona:{archetype:'proud',voice:'reserved',identity:'一只桌面测试黑猫',summary:'根据补充要求生成的测试气质。',traits:['机灵','克制']},
      dialogue,
      dialogueTranslations:Object.fromEntries(locales.map(locale=>[locale,Object.fromEntries(intents.map(intent=>[intent,[locale==='zh-CN'?dialogue[intent][0]:`AI ${intent} ${locale}`]]))])),
      easterEgg:{label:'测试彩蛋',description:'连续摸头会触发测试彩蛋。',triggerIntent:'headpat',message:'测试彩蛋出现啦'},
      parts:[{kind:'body',confidence:.7,box:[.335,0,.665,1]},{kind:'eye',confidence:.9,box:[.25,.3,.4,.12]}],
    };
    if(prompt.startsWith('分析这张')) {
      // Keep the established import fixture dialogue used by desktop interaction tests.
      result.dialogue=Object.fromEntries(intents.map(intent=>[intent, {
        headpat:['只是刚好没躲','再摸一下也不是不行'], tickle:['爪子要伸出来了','这里不许乱碰'],poke:['……你戳我？','胆子不小'],
        cuddle:['只准抱一会儿','今天破例'],nuzzle:['我只是路过','别误会'],hop:['看见了','我一直在'],shy:['别一直盯着我','……你好'],
      }[intent].concat(["第三句","第四句"])]));
      result.dialogueTranslations['zh-CN']=result.dialogue;
      result.parts=[{kind:'body',confidence:.98,box:[.1,.1,.8,.8]},{kind:'eye',confidence:.9,box:[.25,.3,.4,.12]}];
    }
    if(characterApiFixture.scenario==='missing') result.dialogue={};
    if(characterApiFixture.scenario==='shape-repair' && characterApiFixture.calls.length===1) {
      result.persona.archetype='friendly'; result.dialogue={}; result.easterEgg.triggerIntent='pet';
    }
    const response = Response.json({content:[{type:'text',text:JSON.stringify(result)}],stop_reason:characterApiFixture.scenario==='complete-at-limit'?'max_tokens':'end_turn'});
    if(characterApiFixture.scenario==='thinking-slow-body') {
      const json=response.json.bind(response);
      response.json=async()=>{
        await new Promise((resolve,reject)=>{
          const abort=()=>{clearTimeout(timer);reject(options.signal.reason);};
          const timer=setTimeout(()=>{options.signal.removeEventListener('abort',abort);resolve();},32000);
          options.signal.addEventListener('abort',abort,{once:true});
          if(options.signal.aborted)abort();
        });
        return json();
      };
    }
    return response;
  },
};
