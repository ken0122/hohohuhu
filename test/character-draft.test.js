import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { editSourceDialogue, characterText, writeCharacterText } from '../src/character-draft.js';
import { validateCharacterAnalysis } from '../src/character-analysis.js';
import { BLACK_CAT_PROFILE } from '../src/character-profile.js';
import { createCharacterStore } from '../src/character-store.js';
const base = () => validateCharacterAnalysis({quality:{decision:'pass',issues:[],explanation:'fixture'},persona:BLACK_CAT_PROFILE.persona,parts:[{kind:'body',confidence:.7,box:[.335,0,.665,1]}],dialogueTranslations:{en:{headpat:['English headpat'],tickle:['English tickle']}}});

test('source editing preserves untouched translations through save and reopen', async t => {
  const directory=await mkdtemp(path.join(tmpdir(),'character-draft-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const store=await createCharacterStore(directory);
  const analysis=base();
  const svg=await readFile(new URL('../assets/characters/black-cat/character.svg',import.meta.url),'utf8');
  const {selected}=await store.import({name:'original',svg,analysis});
  await store.update(selected,{name:'renamed',analysis:{...analysis,...editSourceDialogue(analysis,structuredClone(analysis.dialogue))}});
  const reopened=await createCharacterStore(directory);
  assert.deepEqual(reopened.source(selected).analysis.dialogueTranslations.en,analysis.dialogueTranslations.en);
  assert.deepEqual(reopened.source(selected).analysis.parts,analysis.parts);
});

test('editing one source line preserves independently authored foreign versions',()=>{
  const analysis=base();
  const edited=validateCharacterAnalysis({...analysis,...editSourceDialogue(analysis,{...analysis.dialogue,headpat:['新的摸头']})});
  assert.equal(edited.sourceLocale,'zh-CN');
  assert.deepEqual(edited.dialogueTranslations['zh-CN'].headpat,['新的摸头']);
  assert.deepEqual(edited.dialogueTranslations.en.headpat,['English headpat']);
  assert.deepEqual(edited.dialogueTranslations.en.tickle,['English tickle']);
  assert.deepEqual(analysis.dialogueTranslations.en.headpat,['English headpat']);
});

test('saved custom egg is spoken by real interaction policy in every source locale',async()=>{
  const {characterDefinition}=await import('../src/characters.js');
  const {profileFromAnalysis}=await import('../src/character-profile.js');
  const {createInteractionPolicy}=await import('../src/renderer/pet-interactions.js');
  for(const locale of ['zh-CN','zh-TW','en','ja','fr','de','ru']) {
    const analysis=validateCharacterAnalysis({...base(),sourceLocale:locale,easterEgg:{label:'unique',description:'three pats',triggerIntent:'headpat',message:'My saved unique egg'}});
    const definition=characterDefinition('local-fixture',profileFromAnalysis(analysis),analysis,null,locale);
    let time=0;const policy=createInteractionPolicy(()=>definition,{now:()=>time});
    policy.reaction('headpat');time=2000;policy.reaction('headpat');time=4000;
    assert.equal(policy.reaction('headpat').message,'My saved unique egg');
  }
});

test('source-language runtime speaks the reviewed line when same-language translation differs',async()=>{
  const {characterDefinition}=await import('../src/characters.js');
  const {profileFromAnalysis}=await import('../src/character-profile.js');
  const {createInteractionPolicy}=await import('../src/renderer/pet-interactions.js');
  const analysis=validateCharacterAnalysis({...base(),dialogue:{...base().dialogue,headpat:['Reviewed source']},dialogueTranslations:{'zh-CN':{headpat:['Unreviewed alternative']}}});
  const definition=characterDefinition('local-fixture',profileFromAnalysis(analysis),analysis,null,'zh-CN');
  assert.equal(createInteractionPolicy(()=>definition).reaction('headpat').message,'Reviewed source');
});

test('language switches keep the latest authored text, never create versions, and preserve both languages through disk',async t=>{
  const directory=await mkdtemp(path.join(tmpdir(),'character-languages-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const original={name:'原名',analysis:base()};
  const english=writeCharacterText(original,'en',{name:'English name',persona:{...original.analysis.persona,identity:'A personal cat'},dialogue:{headpat:['My English pat']},easterEgg:{...original.analysis.easterEgg,message:'My English secret'}},{force:true});
  const snapshot=structuredClone(english);
  const japanese=characterText(english,'ja');
  assert.equal(japanese.name,'English name');assert.equal(japanese.analysis.persona.identity,'A personal cat');
  assert.deepEqual(japanese.analysis.dialogue.headpat,['My English pat']);assert.equal(japanese.analysis.easterEgg.message,'My English secret');
  const unchanged=writeCharacterText(english,'ja',{name:japanese.name,...japanese.analysis});
  assert.deepEqual(unchanged,english,'simply viewing and saving a fallback creates no fake translation');
  assert.deepEqual(characterText(english,'zh-CN').analysis.dialogue,original.analysis.dialogue);
  assert.deepEqual(english,snapshot);
  const store=await createCharacterStore(directory);const svg=await readFile(new URL('../assets/characters/black-cat/character.svg',import.meta.url),'utf8');
  const imported=await store.import({...english,svg});const reopened=await createCharacterStore(directory);
  const saved={name:reopened.catalog().items.find(item=>item.id===imported.selected).name,analysis:reopened.source(imported.selected).analysis};
  assert.equal(reopened.catalog().items.find(item=>item.id===imported.selected).names.en,'English name');
  assert.equal(characterText(saved,'en').name,'English name');assert.equal(characterText(saved,'zh-CN').name,'原名');
  assert.equal(characterText(saved,'ja').analysis.easterEgg.message,'My English secret');
});

test('custom runtime uses previous authored language for both interactions and egg when target has no version',async()=>{
  const {characterDefinition}=await import('../src/characters.js');const {profileFromAnalysis}=await import('../src/character-profile.js');
  const original={name:'原名',analysis:base()};const changed=writeCharacterText(original,'en',{persona:{...original.analysis.persona,identity:'Authored identity'},dialogue:{headpat:['Authored pat']},easterEgg:{...original.analysis.easterEgg,message:'Authored secret'}},{force:true});
  const profile=characterDefinition('local-test',profileFromAnalysis(changed.analysis),changed.analysis,null,'ja').profile;
  assert.equal(profile.persona.identity,'Authored identity');assert.deepEqual(profile.reactions.headpat.messages,['Authored pat']);assert.deepEqual(profile.easterEgg.reaction.messages,['Authored secret']);
});

test('custom runtime accepts the full translated egg description boundary',async()=>{
  const {characterDefinition}=await import('../src/characters.js');const {profileFromAnalysis}=await import('../src/character-profile.js');
  const original={name:'原名',analysis:base()}, visible=characterText(original,'en');
  const translated=writeCharacterText(original,'en',{easterEgg:{...visible.analysis.easterEgg,description:'x'.repeat(120)}},{force:true});
  const analysis=validateCharacterAnalysis(translated.analysis);
  const profile=characterDefinition('local-test',profileFromAnalysis(analysis),analysis,null,'en').profile;
  assert.equal(profile.easterEgg.description.length,120);
});

test('new localized fields are strictly validated before persistence',()=>{
  for(const textVersions of [{en:{name:'x'.repeat(41)}},{en:{persona:null}},{en:{easterEgg:{...base().easterEgg,message:'\n'}}}])
    assert.throws(()=>validateCharacterAnalysis({...base(),textVersions}));
  assert.throws(()=>validateCharacterAnalysis({...base(),textLocaleOrder:['made-up-language']}));
});

test('editor field order does not mark unchanged fallback text as newly authored',()=>{
  const original={name:'原名',analysis:base()};
  const english=writeCharacterText(original,'en',{name:'English name',easterEgg:{...original.analysis.easterEgg,message:'English secret'}},{force:true});
  let entry=english;
  for(const locale of ['ja','zh-CN','de']) {
    const visible=characterText(entry,locale), egg=visible.analysis.easterEgg;
    entry=writeCharacterText(entry,locale,{name:visible.name,persona:visible.analysis.persona,dialogue:visible.analysis.dialogue,easterEgg:{label:egg.label,triggerIntent:egg.triggerIntent,description:egg.description,message:egg.message}});
    assert.deepEqual(entry,english);
  }
  assert.equal(characterText(entry,'de').name,'English name');
  assert.equal(characterText(entry,'de').analysis.easterEgg.message,'English secret');
});
