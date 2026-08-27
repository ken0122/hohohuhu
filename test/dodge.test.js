import test from "node:test";
import assert from "node:assert/strict";
import { createDodgeMotion, cursorApproach } from "../src/dodge.js";
const center={x:600,y:400}, bounds={x:0,y:0,width:1200,height:800};
const sample=(motion,cursor,extra={})=>motion.step({cursor,petCenter:center,dt:.032,bounds,random:()=>.5,...extra});
function approach(speed, extra={}) {
  const motion=createDodgeMotion();
  sample(motion,{x:700+speed*.032,y:400},extra);
  return { motion, result:sample(motion,{x:700,y:400},extra) };
}

test("faster approaching cursors produce stronger bounded reflex bursts",()=>{
  const slow=approach(150).result,medium=approach(1000).result,fast=approach(2400).result;
  assert.equal(slow.triggered,false);
  assert.ok(medium.triggered&&fast.triggered);
  assert.ok(fast.velocity.x<medium.velocity.x&&medium.velocity.x<0);
  assert.ok(Math.hypot(fast.velocity.x,fast.velocity.y)>650);
  assert.ok(Math.hypot(fast.velocity.x,fast.velocity.y)<=1200);
  assert.equal(fast.gait,"run");
});
test("stationary, retreating, far-away and sideways cursor motion do not trigger",()=>{
  for(const [previous,cursor] of [
    [{x:700,y:400},{x:700,y:400}],
    [{x:680,y:400},{x:730,y:400}],
    [{x:1100,y:400},{x:1030,y:400}],
    [{x:750,y:370},{x:750,y:430}],
  ]) {
    const motion=createDodgeMotion();sample(motion,previous);
    assert.equal(sample(motion,cursor).triggered,false);
  }
  assert.equal(cursorApproach({x:700,y:400},{x:700,y:400},{x:630,y:400},.032).speed,0,"pet movement cannot manufacture cursor speed");
});
test("a fast sweep across the pet is detected between samples",()=>{
  const motion=createDodgeMotion();sample(motion,{x:680,y:400});
  assert.equal(sample(motion,{x:560,y:400}).triggered,true);
});
test("burst decays to walking, and cooldown prevents repeated launches",()=>{
  const {motion,result}=approach(2000);
  let previousSpeed=Math.hypot(result.velocity.x,result.velocity.y),last;
  for(let i=0;i<25;i++) {
    last=sample(motion,{x:1100,y:400});
    assert.equal(last.triggered,false);
    if(i===0) assert.ok(Math.hypot(last.velocity.x,last.velocity.y)<previousSpeed);
  }
  assert.equal(last.reflex,false);assert.equal(last.gait,"walk");
  assert.ok(Math.hypot(last.velocity.x,last.velocity.y)<90);
  const second=approach(2000).motion;
  sample(second,{x:800,y:400});
  assert.equal(sample(second,{x:690,y:400}).triggered,false);
});
test("screen edges redirect a burst inward or along the edge",()=>{
  for(const [petCenter,previous,cursor,axis,sign] of [
    [{x:1134,y:400},{x:960,y:400},{x:1040,y:400},"x",1],
    [{x:66,y:400},{x:240,y:400},{x:160,y:400},"x",-1],
    [{x:600,y:734},{x:600,y:560},{x:600,y:640},"y",1],
  ]) {
    const motion=createDodgeMotion();sample(motion,previous,{petCenter});
    const next=sample(motion,cursor,{petCenter});
    assert.ok(next.triggered);assert.ok(next.velocity[axis]*sign<150,"burst must not point out of screen");
  }
});
test("pause resets, stale samples, cursor teleports and reduced-motion mode suppress bursts",()=>{
  const {motion}=approach(2200);motion.reset();
  assert.equal(sample(motion,{x:650,y:400}).reflex,false);
  assert.equal(approach(2200,{reducedMotion:true}).result.reflex,false);
  const stale=createDodgeMotion();sample(stale,{x:720,y:400});
  assert.equal(sample(stale,{x:660,y:400},{dt:1}).triggered,false);
  assert.equal(cursorApproach({x:2000,y:400},{x:660,y:400},center,.032).speed,0);
});
