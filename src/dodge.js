import { clamp, nextDodgeVelocity, PET_FRAME_SIZE } from "./core.js";

// Use only cursor motion, not the pet's own movement, to measure approach.
// The closest point catches a fast swipe that crosses the pet between samples.
export function cursorApproach(previous, cursor, petCenter, dt) {
  if (!previous || dt <= 0 || dt > .15) return { speed: 0, distance: Infinity };
  const dx=cursor.x-previous.x, dy=cursor.y-previous.y, travel=Math.hypot(dx,dy);
  if (!travel || travel > 900) return { speed: 0, distance: Infinity };
  const t=clamp(((petCenter.x-previous.x)*dx+(petCenter.y-previous.y)*dy)/(travel*travel),0,1);
  const distance=Math.hypot(petCenter.x-previous.x-t*dx,petCenter.y-previous.y-t*dy);
  const before=Math.hypot(petCenter.x-previous.x,petCenter.y-previous.y);
  return { speed: Math.max(0,(before-distance)/dt), distance };
}

function escapeDirection(vector, center, bounds) {
  let {x,y}=vector;
  const margin=PET_FRAME_SIZE/2+30;
  const blockedX=(x<0&&center.x<bounds.x+margin)||(x>0&&center.x>bounds.x+bounds.width-margin);
  const blockedY=(y<0&&center.y<bounds.y+margin)||(y>0&&center.y>bounds.y+bounds.height-margin);
  if (blockedX) x=0;
  if (blockedY) y=0;
  if (Math.hypot(x,y)<.01) {
    if (blockedX) y=center.y<bounds.y+bounds.height/2?1:-1;
    if (blockedY) x=center.x<bounds.x+bounds.width/2?1:-1;
    if (!x&&!y) y=-1;
  }
  const length=Math.hypot(x,y);
  return {x:x/length,y:y/length};
}

export function createDodgeMotion() {
  let previous, impulse={x:0,y:0}, cooldown=0, wander={x:48,y:25};
  return {
    reset() { previous=undefined; impulse={x:0,y:0}; cooldown=0; },
    step({cursor,petCenter,dt,bounds,random=Math.random,reducedMotion=false,allowWander=true}) {
      if (dt>.15 || dt<=0 || reducedMotion) { previous=undefined; impulse={x:0,y:0}; cooldown=0; }
      const elapsed=clamp(dt,0,.06);
      const approach=cursorApproach(previous,cursor,petCenter,dt);
      const incoming=previous?{x:cursor.x-previous.x,y:cursor.y-previous.y}:{x:0,y:-1};
      previous={...cursor};
      cooldown=Math.max(0,cooldown-elapsed);
      const decay=Math.exp(-7.5*elapsed);
      impulse={x:impulse.x*decay,y:impulse.y*decay};
      const triggered=!reducedMotion && cooldown===0 && approach.distance<175 && approach.speed>450;
      if (triggered) {
        let away={x:petCenter.x-cursor.x,y:petCenter.y-cursor.y};
        if (Math.hypot(away.x,away.y)<1) away=incoming;
        const direction=escapeDirection(away,petCenter,bounds);
        const strength=clamp((approach.speed-450)/2200,0,1);
        const boost=(480+650*strength)*(1-.25*approach.distance/175);
        impulse={x:direction.x*boost,y:direction.y*boost};
        cooldown=.7;
      }
      const power=Math.hypot(impulse.x,impulse.y);
      if (power>8) {
        const direction=escapeDirection(impulse,petCenter,bounds);
        impulse={x:direction.x*power,y:direction.y*power};
      } else impulse={x:0,y:0};
      let base;
      if (allowWander) {
        wander=nextDodgeVelocity({petCenter,cursor,velocity:wander,dt:elapsed,bounds,random});
        base=wander;
      } else {
        // Chat never invents motion: only proximity and the decaying reflex move it.
        const away={x:petCenter.x-cursor.x,y:petCenter.y-cursor.y};
        const distance=Math.hypot(away.x,away.y);
        const speed=Math.max(0,170-distance)*2;
        const direction=escapeDirection(away,petCenter,bounds);
        base={x:direction.x*speed,y:direction.y*speed};
      }
      let x=base.x+impulse.x,y=base.y+impulse.y;
      const speed=Math.hypot(x,y);
      if (speed>1200) { x=x/speed*1200; y=y/speed*1200; }
      return { velocity:{x,y}, gait:speed<.01?"idle":power>80?"run":"walk", reflex:power>80, triggered, approachSpeed:approach.speed };
    },
  };
}
