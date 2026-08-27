import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, globalShortcut, nativeImage, screen, powerMonitor, systemPreferences } from "electron";

// Do not await app readiness at module top level: Electron awaits ESM evaluation.
// Real Electron windows, isolated app data. Live chat is explicitly opt-in.
await mkdir(path.resolve("work"), { recursive: true });
app.setPath("userData", await mkdtemp(path.resolve("work/desktop-test-")));
const runtime = await import("../src/main.js");
const { getRuntime, ready, setMode, toggleHidden, showChat, restorePetFrame, recoverWindows, shutdown } = runtime;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (!await fn()) { if (Date.now() > deadline) throw new Error("Timed out waiting for runtime state"); await delay(30); }
}
const evaluate = code => getRuntime().petWindow.webContents.executeJavaScript(code);
const results = [];
async function check(name, run) {
  if (process.env.BLUEPET_TEST_MATCH && !new RegExp(process.env.BLUEPET_TEST_MATCH).test(name)) return;
  await run(); results.push(name); console.log("PASS", name);
}
async function visiblePixels(win = getRuntime().petWindow) {
  const capture = await win.webContents.capturePage();
  const bitmap = capture.toBitmap();
  let blue = 0;
  for (let i=0; i<bitmap.length; i+=4) if(bitmap[i] > bitmap[i+2]*1.3 && bitmap[i+3]>100) blue++;
  assert.ok(blue > 600, "character should have >600 real blue pixels, got " + blue);
  return capture;
}
async function run() {
try {
  await ready;
  await until(() => getRuntime().petWindow && !getRuntime().petWindow.webContents.isLoading());
  await delay(200);
  await until(()=>evaluate("Boolean(document.querySelector('.mascot-svg'))"));
  await check("renderer uses original SVG geometry with no extra layers",async()=>{
    setMode("pet"); await delay(150);
    const original = await evaluate("window.bluepet.loadMascot()");
    const originalBody=original.match(/class="body" d="([^"]+)"/)[1];
    assert.equal(await evaluate("document.querySelector('path.body').getAttribute('d')"),originalBody);
    const structure=await evaluate("Array.from(document.querySelector('.mascot-svg').querySelectorAll('*'),e=>e.tagName)");
    const baseline=await evaluate("Array.from(new DOMParser().parseFromString("+JSON.stringify(original)+",'image/svg+xml').documentElement.querySelectorAll('*'),e=>e.tagName)");
    assert.deepEqual(structure,baseline);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.pet')).width"),"84px");
    await writeFile(path.resolve("work/original-idle.png"),(await getRuntime().petWindow.webContents.capturePage()).toPNG());
  });
  await check("Mode inertia: smooth launch, momentum on return/reversal, settling and chat cancellation",async()=>{
    setMode("pet");await until(()=>!getRuntime().modeTransition,7000);
    const realCursor=screen.getCursorScreenPoint,realAnimations=systemPreferences.getAnimationSettings;
    const area=screen.getDisplayMatching(getRuntime().petWindow.getBounds()).workArea;
    screen.getCursorScreenPoint=()=>({x:area.x+30,y:area.y+30});
    systemPreferences.getAnimationSettings=()=>({...realAnimations.call(systemPreferences),prefersReducedMotion:false});
    try {
      const home=getRuntime().position;
      setMode("dodge");assert.deepEqual(getRuntime().position,home);
      assert.deepEqual(getRuntime().velocity,{x:0,y:0});
      await delay(45);assert.ok(Math.hypot(...Object.values(getRuntime().velocity))<30);
      await delay(1500);
      const before=getRuntime().position,momentum=getRuntime().velocity;
      assert.ok(Math.hypot(before.x-home.x,before.y-home.y)>15);
      setMode("pet");assert.deepEqual(getRuntime().position,before);assert.deepEqual(getRuntime().velocity,momentum);
      await delay(100);
      const turning=getRuntime().position,turnVelocity=getRuntime().velocity;
      setMode("dodge");assert.deepEqual(getRuntime().position,turning);assert.deepEqual(getRuntime().velocity,turnVelocity);
      await delay(120);setMode("pet");
      await until(()=>!getRuntime().modeTransition,7000);
      assert.ok(Math.hypot(getRuntime().position.x-home.x,getRuntime().position.y-home.y)<1);
      assert.deepEqual(getRuntime().velocity,{x:0,y:0});await visiblePixels();
      setMode("dodge");await delay(500);setMode("pet");showChat();
      const paused=getRuntime().position;await delay(150);
      assert.equal(getRuntime().modeTransition,undefined);assert.deepEqual(getRuntime().position,paused);
      restorePetFrame();
    } finally {screen.getCursorScreenPoint=realCursor;systemPreferences.getAnimationSettings=realAnimations;}
  });
  await check("eye stays open by default under CSP, with only brief natural blinks",async()=>{
    const eyeY=()=>evaluate("new DOMMatrix(getComputedStyle(document.querySelector('.lid')).transform).m42");
    assert.equal(await eyeY(),-20);
    let samples=0,closed=0,closedSince=0,longest=0,captured=false;
    const start=performance.now();
    while(performance.now()-start<8000) {
      const y=await eyeY(); samples++;
      if(y > -19) {
        closed++; if(!closedSince) closedSince=performance.now();
        if(!captured && y>0) {
          await writeFile(path.resolve("work/brief-blink.png"),(await getRuntime().petWindow.webContents.capturePage()).toPNG());
          captured=true;
        }
      } else if(closedSince) { longest=Math.max(longest,performance.now()-closedSince);closedSince=0; }
      await delay(20);
    }
    assert.ok(closed>0,"an automatic blink occurs");
    assert.ok(closed/samples<.1,"fully open for over 90% of the time");
    assert.ok(longest<350,"no lingering half-closed lid");
    console.log("Eye sampling:", {samples,closed,longest:Math.round(longest)});
  });
  await check("white transparent menu-bar icon, not a boxed app icon", async () => {
    const icon = nativeImage.createFromPath(path.resolve("assets/tray.png"));
    assert.equal(icon.isEmpty(),false);
    const b=icon.toBitmap();let painted=0,transparent=0;
    for(let i=0;i<b.length;i+=4) {
      // Native bitmap channels are premultiplied by alpha on macOS.
      if(b[i+3]>230) { assert.ok([b[i],b[i+1],b[i+2]].every(v=>Math.abs(v-b[i+3])<=2)); painted++; }
      if(!b[i+3])transparent++;
    }
    assert.ok(painted>20&&transparent>20);
    assert.equal(getRuntime().tray.listenerCount("click"),0);
    assert.ok(getRuntime().tray.getBounds().width>0);
    assert.deepEqual(getRuntime().trayMenu.items.filter(item=>item.type==="radio").map(item=>item.id),["dodge","pet","pacman"]);
  });
  await check("both global shortcuts registered; menu cannot double-register hide", async () => {
    assert.ok(globalShortcut.isRegistered("Control+Alt+B"));
    assert.ok(globalShortcut.isRegistered("Control+Alt+Space"));
    assert.equal(getRuntime().trayMenu.getMenuItemById("hide").registerAccelerator,false);
  });
  for(const mode of ["dodge","pet"]) {
    await check(mode + ": visible geometry, real character pixels, chat roundtrip and boss-key restore",async()=>{
      setMode(mode); await delay(180);
      assert.equal(getRuntime().petWindow.isVisible(),true);
      await visiblePixels();
      toggleHidden(); assert.equal(getRuntime().petWindow.isVisible(),false);
      toggleHidden(); await delay(160); assert.equal(getRuntime().petWindow.isVisible(),true); await visiblePixels();
      showChat(); await delay(140); assert.equal(await evaluate("document.body.classList.contains('chat-open')"),true);
      restorePetFrame(); await delay(220); assert.deepEqual(await evaluate("[innerWidth,innerHeight]"),[132,132]);
      await visiblePixels();
      const rect = await evaluate("document.querySelector('.pet').getBoundingClientRect().toJSON()");
      assert.ok(rect.left >= 0 && rect.right <= 132 && rect.top >= 0 && rect.bottom <= 132);
    });
  }
  await check("opening/cancelling status menu leaves hidden state and chat untouched",async()=>{
    setMode("pet"); toggleHidden();
    const before=getRuntime().state;
    const menu=getRuntime().trayMenu;
    menu.emit("menu-will-show",{}); getRuntime().tray.emit("click",{});
    await delay(120); assert.deepEqual(getRuntime().state,before); assert.equal(getRuntime().petWindow.isVisible(),false);
    menu.emit("menu-will-close",{}); assert.deepEqual(getRuntime().state,before);
    menu.getMenuItemById("pet").click(); await delay(150); assert.equal(getRuntime().petWindow.isVisible(),true);
  });
  await check("real native context menu opens and closes without revealing the hidden pet",async()=>{
    setMode("pet"); toggleHidden();
    const {tray,trayMenu}=getRuntime(),before=getRuntime().state;
    let opened=false,closed=false;
    trayMenu.once("menu-will-show",()=>{opened=true;});
    trayMenu.once("menu-will-close",()=>{closed=true;});
    const close=setTimeout(()=>tray.closeContextMenu(),500);
    tray.popUpContextMenu();
    await until(()=>opened,2000);
    assert.equal(getRuntime().petWindow.isVisible(),false);assert.deepEqual(getRuntime().state,before);
    await until(()=>closed,2000);clearTimeout(close);
    assert.deepEqual(getRuntime().state,before);
  });
  await check("Pet keyboard: four directions, release, focus loss, chat isolation and legacy Control alias",async()=>{
    setMode("control"); await delay(150); assert.equal(getRuntime().state.mode,"pet");
    for(const [key,axis,sign] of [["LEFT","x",-1],["UP","y",-1],["RIGHT","x",1],["DOWN","y",1]]) {
      const win=getRuntime().petWindow, before=getRuntime().position;
      const events=[];
      const collect=(_event,input)=>events.push({type:input.type,key:input.key,code:input.code});
      win.webContents.on("before-input-event",collect);
      app.focus({steal:true}); win.focus(); win.webContents.focus();
      await until(()=>win.isFocused()); await delay(120);
      win.webContents.sendInputEvent({type:"keyDown",keyCode:key}); await delay(200);
      const after=getRuntime().position;
      assert.ok((after[axis]-before[axis])*sign>10, key+" should move "+JSON.stringify({before,after,events,state:getRuntime().state,focused:win.isFocused(),menuOpen:getRuntime().menuOpen}));
      assert.equal(await evaluate("document.querySelector('.mascot-svg').dataset.gait"),"run",JSON.stringify({key,events,state:getRuntime().state,focused:win.isFocused(),menuOpen:getRuntime().menuOpen}));
      assert.ok(Number.parseFloat(await evaluate("document.querySelector('.mascot-svg').style.getPropertyValue('--gaze-"+axis+"')"))*sign>0);
      assert.equal(await evaluate("document.querySelectorAll('.foot,.feet,.torso,.rig').length"),0);
      const bodyAnimation = await evaluate("document.querySelector('path.body').getAnimations().map(a=>a.effect.getTiming().duration)");
      assert.deepEqual(bodyAnimation,[220]);
      const shapeBefore = await evaluate("getComputedStyle(document.querySelector('path.body')).d");
      await delay(65);
      assert.notEqual(await evaluate("getComputedStyle(document.querySelector('path.body')).d"),shapeBefore);
      await visiblePixels();
      await writeFile(path.resolve("work/pet-move-"+key.toLowerCase()+".png"),(await win.webContents.capturePage()).toPNG());
      app.focus({steal:true}); win.focus(); win.webContents.focus();
      win.webContents.sendInputEvent({type:"keyUp",keyCode:key}); await delay(150);
      assert.ok(events.some(e=>e.type==="keyUp"), "key release reaches main process");
      win.webContents.removeListener("before-input-event",collect);
      assert.equal(await evaluate("document.querySelector('.mascot-svg').dataset.gait"),"idle");
    }
    const win=getRuntime().petWindow;
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"LEFT"}); await delay(100); win.emit("blur");
    await delay(100); assert.equal(await evaluate("document.querySelector('.mascot-svg').dataset.gait"),"idle");
    const beforeEscape=getRuntime().position;
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"ESCAPE"}); await delay(120);
    assert.equal(getRuntime().state.mode,"pet"); assert.deepEqual(getRuntime().position,beforeEscape);
    showChat(); await delay(150);
    const beforeChat=getRuntime().position;
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"RIGHT"});await delay(150);
    assert.deepEqual(getRuntime().position,beforeChat);
    win.webContents.sendInputEvent({type:"keyUp",keyCode:"RIGHT"});restorePetFrame();
  });
  await check("Pet: proximity, linger, strokes and clicks have distinct bounded reactions",async()=>{
    setMode("pet"); await delay(180);
    await evaluate("document.querySelector('.pet').dispatchEvent(new PointerEvent('pointerenter'))");
    await delay(1200); assert.equal(await evaluate("document.body.dataset.reaction"),"nuzzle");
    await evaluate("(()=>{const p=document.querySelector('.pet'),r=p.getBoundingClientRect();for(const x of [r.x+10,r.x+80,r.x+10])p.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:r.y+20}));})()");
    assert.equal(await evaluate("document.body.dataset.reaction"),"headpat");
    await delay(380);
    assert.equal(await evaluate("new DOMMatrix(getComputedStyle(document.querySelector('.lid')).transform).m42"),-20);
    await evaluate("(()=>{const p=document.querySelector('.pet'),r=p.getBoundingClientRect();for(const x of [r.x+10,r.x+80,r.x+10])p.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:r.y+20}));})()");
    assert.equal(await evaluate("document.querySelector('.lid').getAnimations().length"),0,"repeated strokes do not keep the eye drooping");
    await evaluate("document.querySelector('.pet').click()"); assert.equal(await evaluate("document.body.dataset.reaction"),"hop");
    await writeFile(path.resolve("work/pet-hop.png"),(await getRuntime().petWindow.webContents.capturePage()).toPNG());
    await evaluate("(()=>{const p=document.querySelector('.pet'),r=p.getBoundingClientRect();p.dispatchEvent(new MouseEvent('click',{clientX:r.x+r.width*.5,clientY:r.y+r.height*.2,detail:1}));})()"); assert.equal(await evaluate("document.body.dataset.reaction"),"shy");
    await delay(1800); assert.equal(await evaluate("document.body.dataset.reaction"),undefined);
  });
  await check("Pet touch: tickle belly, poke, cheek nuzzle and native long-press cuddle",async()=>{
    setMode("dodge"); setMode("pet"); await delay(150);
    getRuntime().trayMenu.emit("menu-will-show",{});
    const poke=(x,y)=>evaluate(`(()=>{const p=document.querySelector('.pet'),r=p.getBoundingClientRect();p.dispatchEvent(new MouseEvent('click',{clientX:r.x+r.width*${x},clientY:r.y+r.height*${y},detail:1}));})()`);
    await poke(.5,.75); assert.equal(await evaluate("document.body.dataset.reaction"),"poke");
    assert.match(await evaluate("document.querySelector('#pet-hint').textContent"),/肚肚/);
    await poke(.2,.5); assert.equal(await evaluate("document.body.dataset.reaction"),"nuzzle");
    await evaluate("document.querySelector('.pet').dispatchEvent(new PointerEvent('pointerleave'))");
    for(const x of [.3,.7,.3,.7]) {
      await evaluate(`(()=>{const p=document.querySelector('.pet'),r=p.getBoundingClientRect();p.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+r.width*${x},clientY:r.y+r.height*.75}));})()`);
      await delay(45);
    }
    assert.equal(await evaluate("document.body.dataset.reaction"),"tickle");
    assert.match(await evaluate("document.querySelector('#pet-hint').textContent"),/痒/);
    await writeFile(path.resolve("work/pet-tickle.png"),(await getRuntime().petWindow.webContents.capturePage()).toPNG());
    await delay(850); assert.equal(await evaluate("document.body.dataset.reaction"),undefined);
    getRuntime().trayMenu.emit("menu-will-close",{});
    const win=getRuntime().petWindow;
    app.focus({steal:true});win.focus();win.webContents.focus();await delay(120);
    const rect=await evaluate("document.querySelector('.pet').getBoundingClientRect().toJSON()");
    const point={x:Math.round(rect.x+rect.width*.5),y:Math.round(rect.y+rect.height*.75)};
    await evaluate("window.pointerTrace=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture','blur'])window.addEventListener(type,e=>window.pointerTrace.push({type,buttons:e.buttons,x:e.screenX,y:e.screenY}),true)");
    win.webContents.sendInputEvent({type:"mouseMove",...point});
    win.webContents.sendInputEvent({type:"mouseDown",button:"left",clickCount:1,...point});
    await delay(720); assert.equal(await evaluate("document.body.dataset.reaction"),"cuddle",JSON.stringify({pending:getRuntime().dragPending,trace:await evaluate("window.pointerTrace")}));
    win.webContents.sendInputEvent({type:"mouseUp",button:"left",clickCount:1,...point});
    await delay(80); assert.equal(await evaluate("document.body.dataset.reaction"),"cuddle","release does not turn a cuddle into a poke");
    await writeFile(path.resolve("work/pet-cuddle.png"),(await win.webContents.capturePage()).toPNG());
    showChat();await delay(100);assert.equal(await evaluate("document.body.dataset.reaction"),undefined);
    restorePetFrame();getRuntime().trayMenu.emit("menu-will-close",{});
  });
  await check("Pet drag: native pointer capture, threshold, release without click and stable placement",async()=>{
    setMode("dodge");setMode("pet");await delay(200);
    const win=getRuntime().petWindow;
    app.focus({steal:true});win.focus();win.webContents.focus();await delay(150);
    const rect=await evaluate("document.querySelector('.pet').getBoundingClientRect().toJSON()");
    const bounds=win.getBounds(), origin=getRuntime().position;
    const start={x:bounds.x+Math.round(rect.x+rect.width*.5),y:bounds.y+Math.round(rect.y+rect.height*.75)};
    const at=(type,point,extra={})=>{
      const b=win.getBounds();
      win.webContents.sendInputEvent({type,x:Math.round(point.x-b.x),y:Math.round(point.y-b.y),globalX:Math.round(point.x),globalY:Math.round(point.y),...extra});
    };
    at("mouseMove",start);at("mouseDown",start,{button:"left",clickCount:1});
    await until(()=>getRuntime().dragPending);
    at("mouseMove",{x:start.x+2,y:start.y+1},{modifiers:["leftButtonDown"]});await delay(80);
    assert.equal(getRuntime().dragPending,true,JSON.stringify(await evaluate("window.pointerTrace")));
    assert.deepEqual(getRuntime().position,origin,"tiny jitter does not move the window");
    const first={x:start.x-14,y:start.y-12};
    at("mouseMove",first,{modifiers:["leftButtonDown"]});
    await delay(120);
    assert.ok(getRuntime().position.x<origin.x-5,JSON.stringify({origin,position:getRuntime().position,pending:getRuntime().dragPending,trace:await evaluate("window.pointerTrace")}));
    assert.equal(await evaluate("document.body.classList.contains('is-dragging')"),true);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.pet')).cursor"),"grabbing");
    const target={x:start.x-90,y:start.y-60};
    at("mouseMove",target,{modifiers:["leftButtonDown"]});await delay(100);
    assert.ok(Math.abs(getRuntime().position.x-(origin.x-90))<2);
    assert.ok(Math.abs(getRuntime().position.y-(origin.y-60))<2);
    assert.equal(await evaluate("document.body.dataset.reaction"),undefined);
    await writeFile(path.resolve("work/pet-drag.png"),(await win.webContents.capturePage()).toPNG());
    at("mouseUp",target,{button:"left",clickCount:1});await until(()=>!getRuntime().dragPending);
    const dropped=getRuntime().position;await delay(300);
    assert.deepEqual(getRuntime().position,dropped);
    assert.equal(await evaluate("document.body.classList.contains('is-dragging')"),false);
    assert.equal(await evaluate("document.body.dataset.reaction"),undefined,"dropping does not poke, cuddle or tickle");
    at("mouseDown",target,{button:"left",clickCount:1});await delay(50);
    at("mouseUp",target,{button:"left",clickCount:1});await delay(100);
    assert.equal(await evaluate("document.body.dataset.reaction"),"poke","a fresh click still works after dragging");
  });
  await check("Pet drag: screen clamping, invalid coordinates, Escape/chat/hide/mode cancellation",async()=>{
    setMode("pet");await delay(150);
    const send=request=>evaluate("window.bluepet.dragPet("+JSON.stringify(request)+")");
    const origin=getRuntime().position;
    await send({phase:"start",point:origin});await until(()=>getRuntime().dragPending);
    await evaluate("window.bluepet.dragPet({phase:'move',point:{x:NaN,y:0}})");await delay(80);
    assert.deepEqual(getRuntime().position,origin);
    const cursor={x:-9000,y:-9000};await send({phase:"move",point:cursor});await delay(80);
    const display=screen.getDisplayNearestPoint(cursor).workArea,b=getRuntime().petWindow.getBounds();
    assert.ok(b.x>=display.x&&b.y>=display.y&&b.x+b.width<=display.x+display.width&&b.y+b.height<=display.y+display.height);
    getRuntime().petWindow.webContents.sendInputEvent({type:"keyDown",keyCode:"ESCAPE"});await delay(100);
    assert.equal(getRuntime().dragPending,false);
    await send({phase:"start",point:getRuntime().position});await until(()=>getRuntime().dragPending);
    showChat();await delay(100);assert.equal(getRuntime().dragPending,false);
    const inChat=getRuntime().position;
    await send({phase:"start",point:inChat});await send({phase:"move",point:{x:0,y:0}});await delay(100);
    assert.equal(getRuntime().dragPending,false);assert.deepEqual(getRuntime().position,inChat);
    restorePetFrame();await delay(100);
    await send({phase:"start",point:inChat});await until(()=>getRuntime().dragPending);
    toggleHidden();assert.equal(getRuntime().dragPending,false);toggleHidden();await delay(100);
    await send({phase:"start",point:getRuntime().position});await until(()=>getRuntime().dragPending);
    setMode("dodge");assert.equal(getRuntime().dragPending,false);setMode("pet");
  });
  await check("Pet makes a sparse autonomous gesture, rests, and yields to interaction/chat/hide",async()=>{
    setMode("dodge"); setMode("pet"); await delay(150);
    // Keep the real mouse position from perturbing this unattended-idle check.
    getRuntime().trayMenu.emit("menu-will-show",{});
    getRuntime().petWindow.webContents.send("pet:proximity",{near:false,x:0,y:0});
    await evaluate("document.querySelector('.pet').dispatchEvent(new PointerEvent('pointerleave'))");
    const start=performance.now();
    await until(()=>evaluate("Boolean(document.body.dataset.reaction?.startsWith('idle-'))"),23000);
    assert.ok(performance.now()-start>=11500,"not a frequent looping motion");
    assert.equal(await evaluate("document.body.dataset.reaction"),"idle-look");
    assert.ok(parseFloat(await evaluate("document.querySelector('.mascot-svg').style.getPropertyValue('--gaze-x')"))<0);
    await writeFile(path.resolve("work/pet-idle-look.png"),(await getRuntime().petWindow.webContents.capturePage()).toPNG());
    await delay(1700); assert.equal(await evaluate("document.body.dataset.reaction"),undefined);
    await delay(2500); assert.equal(await evaluate("document.body.dataset.reaction"),undefined);
    await until(()=>evaluate("document.body.dataset.reaction==='idle-stretch'"),21000);
    assert.ok((await evaluate("document.querySelector('.mascot').getAnimations().map(a=>a.animationName)")).includes("idle-stretch"));
    await evaluate("document.querySelector('.pet').dispatchEvent(new PointerEvent('pointerenter'))");
    assert.notEqual(await evaluate("document.body.dataset.reaction"),"idle-stretch");
    showChat(); await delay(1200); assert.equal(await evaluate("document.body.dataset.reaction"),undefined);
    toggleHidden(); await delay(100);
    assert.equal(await evaluate("document.querySelector('.lid').getAnimations().length"),0);
    assert.equal(await evaluate("new DOMMatrix(getComputedStyle(document.querySelector('.lid')).transform).m42"),-20);
    toggleHidden(); restorePetFrame(); getRuntime().trayMenu.emit("menu-will-close",{});
  });
  await check("reduced-motion mode keeps eyes open and disables decorative motion",async()=>{
    const win=getRuntime().petWindow;
    win.webContents.debugger.attach("1.3");
    try {
      await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
      await delay(100);
      await evaluate("document.querySelector('.pet').click()"); await delay(100);
      assert.equal(await evaluate("document.querySelector('.lid').getAnimations().length"),0);
      assert.equal(await evaluate("new DOMMatrix(getComputedStyle(document.querySelector('.lid')).transform).m42"),-20);
      assert.equal(await evaluate("document.querySelector('.mascot').getAnimations().length"),0);
    } finally {
      await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia",{features:[]});
      win.webContents.debugger.detach();
    }
  });
  await check("Dodge reflex: fast approach launches a visible native window, decays and resets after chat/hide",async()=>{
    setMode("pet");await delay(150);
    const origin=getRuntime().position,area=screen.getDisplayNearestPoint(origin).workArea;
    const target={x:area.x+area.width/2-66,y:area.y+area.height/2-66};
    for(const request of [{phase:"start",point:origin},{phase:"move",point:target},{phase:"end"}]) {
      await evaluate("window.bluepet.dragPet("+JSON.stringify(request)+")");await delay(50);
    }
    setMode("dodge");await until(()=>!getRuntime().modeTransition);
    const realCursor=screen.getCursorScreenPoint,realAnimations=systemPreferences.getAnimationSettings;
    const center={x:getRuntime().position.x+66,y:getRuntime().position.y+66};
    let cursor={x:center.x+230,y:center.y},samples=0;
    screen.getCursorScreenPoint=()=>{samples++;return {...cursor};};
    systemPreferences.getAnimationSettings=()=>({...realAnimations.call(systemPreferences),prefersReducedMotion:false});
    try {
      await until(()=>samples>=2);
      const before=getRuntime().petWindow.getBounds();
      cursor={x:center.x+110,y:center.y};
      await until(()=>getRuntime().dodgeMotion?.reflex);
      const initialSpeed=Math.hypot(...Object.values(getRuntime().dodgeMotion.velocity));
      assert.ok(initialSpeed>600,"fast approaching cursor produces a launch");
      await until(()=>evaluate("document.querySelector('.mascot-svg').dataset.gait==='run'"));
      assert.deepEqual(await evaluate("document.querySelector('path.body').getAnimations().map(a=>a.effect.getTiming().duration)"),[220]);
      await delay(100);
      assert.ok(getRuntime().petWindow.getBounds().x<before.x-45,"native window visibly travels away");
      assert.equal(getRuntime().petWindow.isVisible(),true);await visiblePixels();
      await delay(700);
      assert.equal(getRuntime().dodgeMotion.reflex,false);
      assert.equal(await evaluate("document.querySelector('.mascot-svg').dataset.gait"),"walk");
      assert.ok(Math.hypot(...Object.values(getRuntime().dodgeMotion.velocity))<initialSpeed/2);
      for(const pause of ["chat","hide"]) {
        if(pause==="chat") showChat(); else toggleHidden();
        await delay(80);
        cursor={x:getRuntime().position.x+90,y:getRuntime().position.y+66};
        if(pause==="chat") restorePetFrame(); else toggleHidden();
        await delay(80);assert.equal(getRuntime().dodgeMotion.reflex,false,"resume discards stale cursor samples");
        assert.equal(getRuntime().petWindow.isVisible(),true);
      }
      console.log("Dodge launch speed:",Math.round(initialSpeed),"px/s");
    } finally {
      screen.getCursorScreenPoint=realCursor;systemPreferences.getAnimationSettings=realAnimations;
      setMode("dodge");
    }
  });
  await check("Dodge stays continuously visible for 10 seconds, and only manual hide conceals it",async()=>{
    setMode("dodge");
    const start=performance.now();
    while(performance.now()-start<10000) {
      await delay(40); assert.equal(getRuntime().petWindow.isVisible(),true);
    }
    const gait=await evaluate("document.querySelector('.mascot-svg').dataset.gait");
    assert.ok(["walk","run"].includes(gait));
    assert.deepEqual(await evaluate("document.querySelector('path.body').getAnimations().map(a=>a.effect.getTiming().duration)"),[gait==="run"?220:680]);
    await visiblePixels();
    await writeFile(path.resolve("work/dodge-original-shape.png"),(await getRuntime().petWindow.webContents.capturePage()).toPNG());
    toggleHidden(); await delay(3300); assert.equal(getRuntime().petWindow.isVisible(),false);
    toggleHidden(); assert.equal(getRuntime().petWindow.isVisible(),true);
  });
  await check("Dodge chat and native menu roundtrips keep the current visibility",async()=>{
    showChat(); await delay(300); assert.equal(getRuntime().petWindow.isVisible(),true);
    restorePetFrame(); await delay(200);
    const menu=getRuntime().trayMenu, before=getRuntime().position;
    menu.emit("menu-will-show",{}); await delay(400);
    assert.equal(getRuntime().petWindow.isVisible(),true); assert.deepEqual(getRuntime().position,before);
    menu.emit("menu-will-close",{}); assert.equal(getRuntime().petWindow.isVisible(),true);
  });
  await check("recover unexpected hide, monitor changes, sleep wake, renderer reload and window close",async()=>{
    setMode("pet"); await delay(100); getRuntime().petWindow.hide();
    await until(()=>getRuntime().petWindow.isVisible(),2200); await visiblePixels();
    getRuntime().petWindow.setBounds({x:-9000,y:-9000,width:132,height:132});
    screen.emit("display-removed",{},screen.getPrimaryDisplay()); await delay(150);
    const b=getRuntime().petWindow.getBounds(),d=screen.getDisplayMatching(b).workArea;
    assert.ok(b.x>=d.x&&b.y>=d.y&&b.x+b.width<=d.x+d.width&&b.y+b.height<=d.y+d.height);
    toggleHidden();powerMonitor.emit("resume");assert.equal(getRuntime().petWindow.isVisible(),false);toggleHidden();
    getRuntime().petWindow.reload(); await delay(500); await visiblePixels();
    const old=getRuntime().petWindow.id;getRuntime().petWindow.close();
    await until(()=>getRuntime().petWindow&&getRuntime().petWindow.id!==old&&!getRuntime().petWindow.webContents.isLoading());
    await delay(180);await visiblePixels();
  });
  await check("Pac-Man: smaller lidless sprite, real bean clears accelerate each round, hide/restore and restart",async()=>{
    setMode("pacman");await until(()=>getRuntime().gameWindow?.isVisible());
    const win=getRuntime().gameWindow;await delay(150);
    const js=code=>win.webContents.executeJavaScript(code);
    await until(()=>js("Boolean(document.querySelector('.mascot-svg'))"));
    assert.equal(await js("document.querySelectorAll('.lid').length"),0,"Pac-Man has no eyelid node");
    assert.equal(await js("getComputedStyle(document.querySelector('#game-pet')).width"),"64px");
    const before=await js("document.querySelector('#game-pet').style.transform");
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"UP"});await delay(200);
    assert.notEqual(await js("document.querySelector('#game-pet').style.transform"),before);
    assert.ok(parseFloat(await js("document.querySelector('.mascot-svg').style.getPropertyValue('--gaze-y')"))<0);
    await visiblePixels(win);
    const sprite=await js("document.querySelector('#game-pet').getBoundingClientRect().toJSON()");
    await writeFile(path.resolve("work/pacman-no-lid.png"),(await win.webContents.capturePage({x:Math.round(sprite.x),y:Math.round(sprite.y),width:64,height:64})).toPNG());
    // Deterministic two-bean round; real key input and animation frames must eat both.
    await js("import('./game.js').then(({game})=>{Object.assign(game.pet,{x:200,y:200,vx:0,vy:0});game.pellets=[{x:260,y:200,radius:5,glow:0},{x:340,y:200,radius:5,glow:0}];})");
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"RIGHT"});
    await until(()=>js("document.querySelector('#round').textContent==='2'"));
    assert.deepEqual(await js("import('./game.js').then(({game})=>[game.pet.speed,game.pet.vx,game.pet.vy])"),[308,308,0]);
    assert.equal(await js("document.querySelector('#speed').textContent"),"1.10×");
    await js("import('./game.js').then(({game})=>{Object.assign(game.pet,{x:200,y:200,vx:0,vy:0});game.pellets=[{x:260,y:200,radius:5,glow:0},{x:340,y:200,radius:5,glow:0}];})");
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"RIGHT"});
    await until(()=>js("document.querySelector('#round').textContent==='3'"));
    assert.deepEqual(await js("import('./game.js').then(({game})=>[game.pet.speed,game.pet.vx].map(v=>Math.round(v*100)/100))"),[338.8,338.8]);
    assert.equal(await js("document.querySelector('#speed').textContent"),"1.21×");
    const hud=await js("document.querySelector('.hud').getBoundingClientRect().toJSON()");
    const hint=await js("document.querySelector('#level-message').getBoundingClientRect().toJSON()");
    assert.ok(hint.top>=hud.top&&hint.bottom<=hud.bottom,"round announcement stays within the HUD");
    assert.ok(await js("import('./game.js').then(({game})=>game.pellets.every(p=>p.y-p.radius>96))"));
    await js("import('./game.js').then(({game})=>{Object.assign(game.pet,{y:140,vy:-1000,vx:0});})");
    await delay(60);
    assert.ok((await js("document.querySelector('#game-pet').getBoundingClientRect().top"))>hud.bottom);
    await writeFile(path.resolve("work/pacman-round-3.png"),(await win.webContents.capturePage()).toPNG());
    toggleHidden();assert.equal(win.isVisible(),false);toggleHidden();assert.equal(win.isVisible(),true);
    assert.equal(await js("document.querySelectorAll('.lid').length"),0);
    assert.equal(await js("document.querySelector('#round').textContent"),"3");
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"ESCAPE"});await delay(180);assert.equal(getRuntime().state.mode,"pet");await visiblePixels();
    setMode("pacman");await until(()=>getRuntime().gameWindow?.isVisible());await delay(200);
    assert.equal(await getRuntime().gameWindow.webContents.executeJavaScript("document.querySelector('#speed').textContent"),"1.00×");
    setMode("pet");
  });
  if(process.env.BLUEPET_TEST_CHAT==="1") await check("Chat live: Flash reply reaches the bubble with a 50-character cap",async()=>{
    setMode("pet");showChat();await delay(150);
    const started=performance.now();
    await evaluate("document.querySelector('#message').value='跟我打个招呼吧';document.querySelector('#chat-form').requestSubmit()");
    await until(()=>evaluate("!document.body.classList.contains('is-thinking')"),18000);
    assert.equal(await evaluate("document.querySelector('.speech__status').textContent"),"只告诉你");
    const reply=await evaluate("document.querySelector('#reply').textContent");
    assert.ok([...reply].length>0&&[...reply].length<=50);
    console.log("Live bubble reply:",JSON.stringify({elapsedMs:Math.round(performance.now()-started),reply}));
    restorePetFrame();
  });
  console.log("Desktop integration checks passed:",results.length);
  await writeFile(path.resolve("work/desktop-test-results.json"),JSON.stringify({passed:results},null,2));
  shutdown();
} catch(error) { console.error(error);shutdown(1); }
}
run().catch(error => { console.error(error); shutdown(1); });
