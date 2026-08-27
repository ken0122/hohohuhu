import test from "node:test";
import assert from "node:assert/strict";
import {arriveAt,launchVelocity} from "../src/mode-motion.js";
const bounds={x:0,y:0,width:1920,height:1080};
test("arrival accelerates, brakes and settles without teleporting",()=>{
  let p={x:200,y:300},v={x:0,y:0};const target={x:1400,y:800},speeds=[];
  for(let i=0;i<250;i++) {
    const next=arriveAt(p,v,target,.032,bounds);
    assert.ok(Math.hypot(next.position.x-p.x,next.position.y-p.y)<36);
    assert.ok(Math.hypot(next.velocity.x,next.velocity.y)<=1100.001);
    p=next.position;v=next.velocity;speeds.push(Math.hypot(v.x,v.y));
    if(next.done)break;
  }
  assert.deepEqual(p,target);assert.deepEqual(v,{x:0,y:0});
  assert.ok(speeds[1]>speeds[0]);assert.ok(Math.max(...speeds)>600);
  assert.ok(speeds.at(-2)<10);
});
test("reversing a destination preserves momentum before turning",()=>{
  const next=arriveAt({x:800,y:400},{x:500,y:0},{x:200,y:400},.032,bounds);
  assert.ok(next.velocity.x>0&&next.velocity.x<500);
  assert.ok(next.position.x>800);
});
test("Dodge eases out of rest and arrival remains inside negative-coordinate screens",()=>{
  let v={x:0,y:0};const target={x:60,y:30};
  const first=launchVelocity(v,target,.032);assert.ok(first.x>0&&first.x<15);
  for(let i=0;i<40;i++)v=launchVelocity(v,target,.032);
  assert.ok(Math.abs(v.x-60)<.1);
  const result=arriveAt({x:-131,y:100},{x:1000,y:-300},{x:-500,y:200},1,{x:-1920,y:0,width:1920,height:1080});
  assert.ok(result.position.x<=-132&&result.position.x>=-1920&&result.position.y>=0);
});
