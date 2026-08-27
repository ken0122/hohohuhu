import { fitPet } from "./core.js";

// A damped spring retains incoming momentum; bounded acceleration makes long
// desktop trips readable. Substeps keep braking stable at variable frame times.
export function arriveAt(position, velocity, target, dt, bounds) {
  let p={...position},v={...velocity};
  const elapsed=Math.max(0,Math.min(dt,.06)),steps=Math.max(1,Math.ceil(elapsed*120)),h=elapsed/steps;
  for(let i=0;i<steps;i++) {
    let ax=36*(target.x-p.x)-12*v.x,ay=36*(target.y-p.y)-12*v.y;
    const acceleration=Math.hypot(ax,ay);
    if(acceleration>2600) {ax*=2600/acceleration;ay*=2600/acceleration;}
    v.x+=ax*h;v.y+=ay*h;
    const speed=Math.hypot(v.x,v.y);
    if(speed>1100) {v.x*=1100/speed;v.y*=1100/speed;}
    const next={x:p.x+v.x*h,y:p.y+v.y*h};p=fitPet(next,bounds);
    if(p.x!==next.x)v.x=0;if(p.y!==next.y)v.y=0;
  }
  const done=Math.hypot(target.x-p.x,target.y-p.y)<.8&&Math.hypot(v.x,v.y)<5;
  return {position:done?{...target}:p,velocity:done?{x:0,y:0}:v,done};
}

export function launchVelocity(velocity, target, dt) {
  const blend=1-Math.exp(-6*Math.max(0,Math.min(dt,.06)));
  return {x:velocity.x+(target.x-velocity.x)*blend,y:velocity.y+(target.y-velocity.y)*blend};
}
