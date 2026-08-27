import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, globalShortcut, nativeImage, screen, powerMonitor } from "electron";

// Do not await app readiness at module top level: Electron awaits ESM evaluation.
// Real Electron windows, isolated app data, no network/provider calls.
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
    await writeFile(path.resolve("work/original-idle.png"),(await getRuntime().petWindow.webContents.capturePage()).toPNG());
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
  });
  await check("both global shortcuts registered; menu cannot double-register hide", async () => {
    assert.ok(globalShortcut.isRegistered("Control+Alt+B"));
    assert.ok(globalShortcut.isRegistered("Control+Alt+Space"));
    assert.equal(getRuntime().trayMenu.getMenuItemById("hide").registerAccelerator,false);
  });
  for(const mode of ["dodge","pet","control"]) {
    await check(mode + ": visible geometry, real character pixels, chat roundtrip and boss-key restore",async()=>{
      setMode(mode); await delay(180);
      assert.equal(getRuntime().petWindow.isVisible(),true);
      await visiblePixels();
      toggleHidden(); assert.equal(getRuntime().petWindow.isVisible(),false);
      toggleHidden(); await delay(160); assert.equal(getRuntime().petWindow.isVisible(),true); await visiblePixels();
      showChat(); await delay(140); assert.equal(await evaluate("document.body.classList.contains('chat-open')"),true);
      restorePetFrame(); await delay(220); assert.deepEqual(await evaluate("[innerWidth,innerHeight]"),[144,144]);
      await visiblePixels();
      const rect = await evaluate("document.querySelector('.pet').getBoundingClientRect().toJSON()");
      assert.ok(rect.left >= 0 && rect.right <= 144 && rect.top >= 0 && rect.bottom <= 144);
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
  await check("Control: actual key events move in four directions, keep body on canvas, morph the original body and aim pupils",async()=>{
    setMode("control"); await delay(150);
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
      await writeFile(path.resolve("work/control-"+key.toLowerCase()+".png"),(await win.webContents.capturePage()).toPNG());
      app.focus({steal:true}); win.focus(); win.webContents.focus();
      win.webContents.sendInputEvent({type:"keyUp",keyCode:key}); await delay(150);
      assert.ok(events.some(e=>e.type==="keyUp"), "key release reaches main process");
      win.webContents.removeListener("before-input-event",collect);
      assert.equal(await evaluate("document.querySelector('.mascot-svg').dataset.gait"),"idle");
    }
    const win=getRuntime().petWindow;
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"LEFT"}); await delay(100); win.emit("blur");
    await delay(100); assert.equal(await evaluate("document.querySelector('.mascot-svg').dataset.gait"),"idle");
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"ESCAPE"}); await delay(120); assert.equal(getRuntime().state.mode,"pet");
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
    await evaluate("document.querySelector('.pet').click()"); assert.equal(await evaluate("document.body.dataset.reaction"),"shy");
    await delay(1800); assert.equal(await evaluate("document.body.dataset.reaction"),undefined);
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
  await check("Dodge stays continuously visible for 10 seconds, and only manual hide conceals it",async()=>{
    setMode("dodge");
    const start=performance.now();
    while(performance.now()-start<10000) {
      await delay(40); assert.equal(getRuntime().petWindow.isVisible(),true);
    }
    assert.equal(await evaluate("document.querySelector('.mascot-svg').dataset.gait"),"walk");
    assert.deepEqual(await evaluate("document.querySelector('path.body').getAnimations().map(a=>a.effect.getTiming().duration)"),[680]);
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
    getRuntime().petWindow.setBounds({x:-9000,y:-9000,width:144,height:144});
    screen.emit("display-removed",{},screen.getPrimaryDisplay()); await delay(150);
    const b=getRuntime().petWindow.getBounds(),d=screen.getDisplayMatching(b).workArea;
    assert.ok(b.x>=d.x&&b.y>=d.y&&b.x+b.width<=d.x+d.width&&b.y+b.height<=d.y+d.height);
    toggleHidden();powerMonitor.emit("resume");assert.equal(getRuntime().petWindow.isVisible(),false);toggleHidden();
    getRuntime().petWindow.reload(); await delay(500); await visiblePixels();
    const old=getRuntime().petWindow.id;getRuntime().petWindow.close();
    await until(()=>getRuntime().petWindow&&getRuntime().petWindow.id!==old&&!getRuntime().petWindow.webContents.isLoading());
    await delay(180);await visiblePixels();
  });
  await check("Pac-Man still renders, moves, hides/restores and exits",async()=>{
    setMode("pacman");await until(()=>getRuntime().gameWindow?.isVisible());
    const win=getRuntime().gameWindow;await delay(150);
    const js=code=>win.webContents.executeJavaScript(code);
    await until(()=>js("Boolean(document.querySelector('.mascot-svg'))"));
    assert.equal(await js("document.querySelectorAll('.lid').length"),0,"Pac-Man has no eyelid node");
    const before=await js("document.querySelector('#game-pet').style.transform");
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"UP"});await delay(200);
    assert.notEqual(await js("document.querySelector('#game-pet').style.transform"),before);
    assert.ok(parseFloat(await js("document.querySelector('.mascot-svg').style.getPropertyValue('--gaze-y')"))<0);
    await visiblePixels(win);
    const sprite=await js("document.querySelector('#game-pet').getBoundingClientRect().toJSON()");
    await writeFile(path.resolve("work/pacman-no-lid.png"),(await win.webContents.capturePage({x:Math.round(sprite.x),y:Math.round(sprite.y),width:72,height:72})).toPNG());
    toggleHidden();assert.equal(win.isVisible(),false);toggleHidden();assert.equal(win.isVisible(),true);
    assert.equal(await js("document.querySelectorAll('.lid').length"),0);
    win.webContents.sendInputEvent({type:"keyDown",keyCode:"ESCAPE"});await delay(180);assert.equal(getRuntime().state.mode,"pet");await visiblePixels();
  });
  console.log("Desktop integration checks passed:",results.length);
  await writeFile(path.resolve("work/desktop-test-results.json"),JSON.stringify({passed:results},null,2));
  shutdown();
} catch(error) { console.error(error);shutdown(1); }
}
run().catch(error => { console.error(error); shutdown(1); });
