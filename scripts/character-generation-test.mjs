import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {app} from 'electron';
import {characterApiFixture} from './fixtures/character-api.mjs';
import {validateCharacterAnalysis} from '../src/character-analysis.js';
import {BLACK_CAT_PROFILE,profileFromAnalysis} from '../src/character-profile.js';
import {characterDefinition} from '../src/characters.js';
import {createInteractionPolicy} from '../src/renderer/pet-interactions.js';

export async function characterGenerationChecks({getRuntime,until,check}) {
  await check('Character AI: current-language generation, explicit translation, local confirmation and saved fallback', ['character','generation'],async()=>{
    const {characterText}=await import('../src/character-draft.js');
    const {nativeTheme}=await import('electron');
    const svg=await readFile(new URL('../assets/characters/black-cat/character.svg',import.meta.url),'utf8');
    const analysis=validateCharacterAnalysis({quality:{decision:'pass',issues:[],explanation:'test'},persona:BLACK_CAT_PROFILE.persona,parts:[{kind:'body',confidence:.7,box:[.335,0,.665,1]}]});
    getRuntime().trayMenu.getMenuItemById('locale-zh-CN').click();
    getRuntime().trayMenu.getMenuItemById('characters').click();
    await until(()=>getRuntime().characterWindow?.isVisible());
    const win=getRuntime().characterWindow,js=code=>win.webContents.executeJavaScript(code);
    await until(()=>js("document.body.dataset.ready==='true'"));
    const imported=await js(`window.characterLibrary.import(${JSON.stringify({name:'AI audit fixture',svg,analysis})})`);assert.equal(imported.ok,true);
    const id=imported.value.selected;
    await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.webContents.reload();});await until(()=>js("document.body.dataset.ready==='true'"));
    const idle=()=>until(()=>js("document.body.getAttribute('aria-busy')==='false'"));
    const edit=async()=>{await js("document.querySelector('#edit').click()");await idle();};
    const save=async()=>{await js("document.querySelector('#apply').click()");await idle();assert.equal(await js("document.querySelector('#draft-fields').hidden"),true,await js("document.querySelector('#status').textContent"));};
    const read=async()=>{const response=await js(`window.characterLibrary.source(${JSON.stringify(id)})`);assert.equal(response.ok,true);return response.value.analysis;};
    const language=async locale=>{getRuntime().trayMenu.getMenuItemById('locale-'+locale).click();await until(()=>js(`document.documentElement.lang===${JSON.stringify(locale)}`));};
    const generate=async(scope,action='generate')=>{
      await js(`document.querySelector('[data-${action}-scope="${scope}"]').scrollIntoView({block:'center'});document.querySelector('[data-${action}-scope="${scope}"]').click()`);await idle();
      assert.equal(await js("document.querySelector('#generation-proposal').hidden"),false,await js("document.querySelector('#generation-status').textContent"));
      const anchored=await js(`(()=>{const b=document.querySelector('[data-generate-scope="${scope}"]'),p=document.querySelector('#generation-proposal');return {button:b.getBoundingClientRect().top,proposal:p.getBoundingClientRect().top,local:!!b.closest('.dialogue-label')?.contains(p)}})()`);
      assert.ok(anchored.proposal>=anchored.button,'confirmation follows originating button');
      if(scope.startsWith('dialogue:'))assert.equal(anchored.local,true);
    };
    const adopt=async()=>{await js("document.querySelector('#adopt-suggestion').click()");await idle();};
    // Editing and navigating languages are local; no implicit model request.
    await edit();characterApiFixture.reset();
    assert.equal(await js("document.querySelector('#egg-description').maxLength"),80,'source egg description stays concise');
    assert.deepEqual(await js("Array.from(document.querySelectorAll('[data-translate-scope]'),button=>({text:button.textContent,hidden:button.hidden,disabled:button.disabled}))"),
      Array(11).fill({text:'Translate',hidden:false,disabled:true}),'all Translate controls remain visible in the source language');
    await js("document.querySelector('[data-dialogue=headpat]').value='我的中文摸头';document.querySelector('#egg-message').value='我的中文彩蛋'");
    await language('en');assert.equal(await js("document.querySelector('[data-dialogue=headpat]').value"),'我的中文摸头');
    assert.equal(await js("document.querySelector('#egg-description').maxLength"),120,'translated egg description allows language expansion');
    assert.deepEqual(await js("Array.from(document.querySelectorAll('[data-translate-scope]'),button=>({text:button.textContent,hidden:button.hidden,disabled:button.disabled}))"),
      Array(11).fill({text:'Translate',hidden:false,disabled:false}),'all Translate controls are available in a target language');
    await save();assert.equal(characterApiFixture.calls.length,0);
    assert.equal((await read()).dialogueTranslations.en,undefined);
    // Generate each scope through the real click/IPC/adopt/save path.
    for(const scope of ['dialogue:headpat','dialogue:tickle','dialogue:poke','dialogue:cuddle','dialogue:nuzzle','dialogue:hop','dialogue:shy','persona','dialogue','easterEgg','parts','all']) {
      await edit();const prior=await read();characterApiFixture.reset(scope==='dialogue:headpat'?'retry':['persona','dialogue','easterEgg'].includes(scope)?'shape-repair':'success');
      if(scope==='dialogue:headpat')await js("document.querySelector('#persona-identity').value=''");
      await generate(scope);
      if(scope!=='parts')assert.deepEqual(await js(`(()=>{const button=document.querySelector('[data-translate-scope="${scope}"]');return {text:button.textContent,hidden:button.hidden}})()`),
        {text:'Translate',hidden:false},'Generate must not remove its Translate control');
      assert.equal(characterApiFixture.calls.length,['dialogue:headpat','persona','dialogue','easterEgg'].includes(scope)?2:1);
      assert.equal(characterApiFixture.calls.filter(call=>call.hasImage).length,scope==='parts'?1:0);
      if(scope !== 'parts') assert.ok(characterApiFixture.calls[0].prompt.includes('English'));
      const timing = await js("document.querySelector('#generation-timing').textContent");
      assert.match(timing,/Generation took [0-9.]+s/);
      assert.match(timing,characterApiFixture.calls.length === 2 ? /Adjustments took [0-9.]+s/ : /^Generation took [0-9.]+s$/);
      await adopt();
      if(scope!=='parts')assert.deepEqual(await js(`(()=>{const button=document.querySelector('[data-translate-scope="${scope}"]');return {text:button.textContent,hidden:button.hidden}})()`),
        {text:'Translate',hidden:false},'adopting generated text must not remove its Translate control');
      if(scope==='dialogue:headpat'){
        assert.equal(await js("document.querySelector('#persona-identity').value"),'','unrelated incomplete draft retained');
        await js("document.querySelector('#apply').click()");await idle();assert.equal(await js("document.querySelector('#draft-fields').hidden"),false);
        await js(`document.querySelector('#persona-identity').value=${JSON.stringify(analysis.persona.identity)}`);
      }
      await save();const persisted=await read();
      assert.deepEqual(persisted.dialogue,prior.dialogue,'English generation preserves authored Chinese');
      if(scope==='all'||scope==='dialogue'||scope.startsWith('dialogue:')) {
        const intents=scope.startsWith('dialogue:')?[scope.split(':')[1]]:Object.keys(persisted.dialogue);
        for(const intent of intents)assert.equal(persisted.dialogueTranslations.en[intent].length,4,'automatic generation always stores four lines');
      }
      assert.equal(persisted.sourceLocale,'zh-CN');assert.equal(persisted.dialogueTranslations.fr,undefined);
      if(scope!=='parts')assert.deepEqual(persisted.parts,prior.parts);
    }
    // No version in Japanese: display the latest saved English, including egg and persona.
    await edit();characterApiFixture.reset();const persisted=await read();
    await language('ja');
    const english=characterText({name:'AI audit fixture',analysis:persisted},'en');
    assert.equal(await js("document.querySelector('[data-dialogue=headpat]').value"),english.analysis.dialogue.headpat.join('｜'));
    assert.equal(await js("document.querySelector('#egg-message').value"),english.analysis.easterEgg.message);
    assert.equal(await js("document.querySelector('#persona-identity').value"),english.analysis.persona.identity);
    assert.equal(characterApiFixture.calls.length,0);
    // An explicit single-target translation produces a proposal only after that click.
    characterApiFixture.reset('thinking-recovery');
    await generate('dialogue:headpat','translate');assert.equal(characterApiFixture.calls.length,2);
    assert.deepEqual(characterApiFixture.calls.map(call=>call.budget),[2048,8192]);
    assert.match(characterApiFixture.calls[0].prompt,/翻译成日本語/);await adopt();await save();
    const translated=await read();assert.deepEqual(translated.dialogueTranslations.en,persisted.dialogueTranslations.en);
    assert.deepEqual(translated.dialogue, persisted.dialogue);assert.ok(translated.dialogueTranslations.ja.headpat);
    // Official DeepSeek capability is exercised with a mock HTTP transport.
    await edit();characterApiFixture.reset('direct-translation');
    await generate('persona','translate');assert.equal(characterApiFixture.calls.length,1);
    assert.equal(characterApiFixture.calls[0].budget,2048);await adopt();await save();
    // A response belongs to the language at click time, even if the UI changes while waiting.
    await edit();await language('fr');characterApiFixture.reset('delayed');
    await js("document.querySelector('[data-generate-scope=\"dialogue:poke\"]').click()");
    await language('de');await idle();await adopt();await save();
    assert.ok((await read()).dialogueTranslations.fr.poke);assert.equal((await read()).dialogueTranslations.de,undefined);
    await edit();await language('en');
    // Visual/geometry batch: local suggestion at native desktop and minimum size in both themes.
    for(const [width,height,theme] of [[820,800,'light'],[720,620,'light'],[820,800,'dark'],[720,620,'dark']]) {
      win.setSize(width,height);nativeTheme.themeSource=theme;
      await until(()=>js(`innerWidth===${width}`));
      characterApiFixture.reset('natural-line');await generate('dialogue:shy');
      await js("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
      const bounds=await js("(()=>{const p=document.querySelector('#generation-proposal').getBoundingClientRect(),a=document.querySelector('#adopt-suggestion').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,left:p.left,right:p.right,adoptTop:a.top,adoptBottom:a.bottom,height:innerHeight}})()");
      assert.equal(bounds.overflow,false);assert.ok(bounds.left>=0&&bounds.right<=width);assert.ok(bounds.adoptTop>=0&&bounds.adoptBottom<bounds.height);
      await writeFile(path.resolve(`work/character-text-${width}-${theme}.png`),(await win.webContents.capturePage()).toPNG());
      await js("document.querySelector('#discard-suggestion').click()");
    }
    nativeTheme.themeSource='system';
    for(const scenario of ['empty','auth','missing','thinking-only']) {
      characterApiFixture.reset(scenario);
      await js("document.querySelector('[data-generate-scope=\"dialogue:headpat\"]').click()");await idle();
      assert.equal(await js("document.querySelector('#generation-status').dataset.error"),'true');
      assert.equal(await js("document.querySelector('#generation-proposal').hidden"),true);
      assert.equal(await js("document.querySelector('#generation-status').closest('.dialogue-label').querySelector('textarea').dataset.dialogue"),'headpat');
      assert.equal(characterApiFixture.calls.length,scenario==='auth'?1:2);
      const timing = await js("document.querySelector('#generation-timing').textContent");
      assert.match(timing, /Generation took [0-9.]+s/);
      assert.match(timing, scenario === 'auth' ? /^Generation took [0-9.]+s$/ : /Adjustments took [0-9.]+s/);
    }
    characterApiFixture.reset();await js("document.querySelector('#cancel').click()");await idle();
    await js(`window.characterLibrary.remove(${JSON.stringify(id)})`);win.close();await until(()=>!getRuntime().characterWindow);getRuntime().trayMenu.getMenuItemById('locale-zh-CN').click();
  });
  await check('Character AI: independent request deadline aborts a slow HTTP response', ['character','generation','soak'],async()=>{
    const {generateCharacterFields}=await import('../src/character-analysis.js');
    const svg=await readFile(new URL('../assets/characters/black-cat/character.svg',import.meta.url),'utf8');
    const analysis=validateCharacterAnalysis({quality:{decision:'pass',issues:[],explanation:'test'},persona:BLACK_CAT_PROFILE.persona,parts:[{kind:'body',confidence:1,box:[0,0,1,1]}]});
    characterApiFixture.reset('slow');const start=Date.now();
    try {
      await assert.rejects(generateCharacterFields({svg,name:'fixture',analysis,scope:'dialogue:headpat'},characterApiFixture),error=>error.code==='CHAR_TIMEOUT');
      assert.ok(Date.now()-start>=29000 && Date.now()-start<34000);
      assert.equal(characterApiFixture.calls.length,1);
    } finally {characterApiFixture.reset();}
  });

  await check('Character AI: thinking retry reads a body after 30 seconds and saves translated details', ['character','generation','soak'],async()=>{
    const svg=await readFile(new URL('../assets/characters/black-cat/character.svg',import.meta.url),'utf8');
    const analysis=validateCharacterAnalysis({quality:{decision:'pass',issues:[],explanation:'fixture'},persona:BLACK_CAT_PROFILE.persona,parts:[{kind:'body',confidence:1,box:[0,0,1,1]}]});
    getRuntime().trayMenu.getMenuItemById('locale-en').click();
    getRuntime().trayMenu.getMenuItemById('characters').click();
    await until(()=>getRuntime().characterWindow?.isVisible());
    const win=getRuntime().characterWindow,js=code=>win.webContents.executeJavaScript(code);
    await until(()=>js("document.body.dataset.ready==='true'"));
    const added=await js(`window.characterLibrary.import(${JSON.stringify({name:'Slow translation fixture',svg,analysis})})`);
    assert.equal(added.ok,true);const id=added.value.selected;
    await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.webContents.reload();});
    await until(()=>js("document.body.dataset.ready==='true'"));
    await js("document.querySelector('#edit').click()");
    characterApiFixture.reset('thinking-slow-body');const started=Date.now();
    await js("document.querySelector('[data-translate-scope=persona]').click()");
    await until(()=>js("document.querySelector('#generation-timing').textContent.includes('90 seconds')"));
    await until(()=>js("document.body.getAttribute('aria-busy')==='false'"),40000);
    assert.ok(Date.now()-started>=31000);
    assert.equal(await js("document.querySelector('#generation-proposal').hidden"),false,await js("document.querySelector('#generation-status').textContent"));
    assert.deepEqual(characterApiFixture.calls.map(call=>call.budget),[2048,8192]);
    assert.notEqual(characterApiFixture.calls[0].signal,characterApiFixture.calls[1].signal);
    assert.equal(characterApiFixture.calls[1].signal.aborted,false);
    assert.ok(!await js("document.querySelector('#generation-timing').textContent.includes('90 seconds')"));
    await js("document.querySelector('#adopt-suggestion').click()");
    await until(()=>js("document.body.getAttribute('aria-busy')==='false'"));
    await js("document.querySelector('#apply').click()");
    await until(()=>js("document.querySelector('#draft-fields').hidden"));
    const saved=await js(`window.characterLibrary.source(${JSON.stringify(id)})`);
    assert.equal(saved.ok,true);assert.deepEqual(saved.value.analysis.persona,analysis.persona);
    assert.ok(saved.value.analysis.textVersions.en.persona.summary);
    await js(`window.characterLibrary.remove(${JSON.stringify(id)})`);
    characterApiFixture.reset();win.close();await until(()=>!getRuntime().characterWindow);
    getRuntime().trayMenu.getMenuItemById('locale-zh-CN').click();
  });

}
