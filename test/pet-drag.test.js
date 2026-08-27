import test from "node:test";
import assert from "node:assert/strict";
import { dragPosition, validDragPoint } from "../src/core.js";
import { DRAG_THRESHOLD } from "../src/renderer/pet-drag.js";

test("drag keeps the grab offset and uses the original position, not accumulated deltas", () => {
  const bounds={x:0,y:0,width:1200,height:800}, origin={x:200,y:300}, start={x:242,y:365};
  assert.deepEqual(dragPosition(origin,start,{x:292,y:385},bounds),{x:250,y:320});
  assert.deepEqual(dragPosition(origin,start,{x:342,y:465},bounds),{x:300,y:400});
  assert.equal(DRAG_THRESHOLD,6);
});
test("drag clamps to display work area, including displays with negative coordinates", () => {
  const bounds={x:-1920,y:-100,width:1920,height:1080};
  assert.deepEqual(dragPosition({x:0,y:0},{x:40,y:50},{x:-9000,y:-9000},bounds),{x:-1920,y:-100});
  assert.deepEqual(dragPosition({x:0,y:0},{x:40,y:50},{x:9000,y:9000},bounds),{x:-132,y:848});
});
test("drag IPC only accepts bounded finite coordinates", () => {
  for(const point of [null,{}, {x:NaN,y:0},{x:0,y:Infinity},{x:"10",y:20},{x:1e12,y:0}]) assert.ok(!validDragPoint(point));
  assert.ok(validDragPoint({x:-1920.5,y:100}));
});
