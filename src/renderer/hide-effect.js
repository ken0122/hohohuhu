// Rasterize a runtime clone, never modify the source mascot. All pixels stay local.
export async function installHideEffect(host, onHide = () => {}) {
  let image, imageReady=false, particles=[], version=0;
  async function refresh() {
  const generation=++version;
  imageReady=false;
  const clone=host.querySelector("svg").cloneNode(true);
  clone.querySelectorAll("style,.character-lid").forEach(node=>node.remove());
  const nextImage=new Image();
  nextImage.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const ready=await nextImage.decode().then(()=>true,()=>false);
  if(generation!==version)return;
  image=nextImage;imageReady=ready;
  const sample=document.createElement("canvas");sample.width=sample.height=64;
  const source=sample.getContext("2d",{willReadFrequently:true});
  if(imageReady)source.drawImage(image,0,0,64,64);
  const pixels=source.getImageData(0,0,64,64).data;
  particles=[];
  for(let y=1;y<64;y+=3)for(let x=1;x<64;x+=3) {
    const i=(y*64+x)*4;
    if(pixels[i+3]<80)continue;
    const seed=x*17+y*29;
    particles.push({
      x,y,color:`rgb(${pixels[i]} ${pixels[i+1]} ${pixels[i+2]})`,
      angle:Math.atan2(y-32,x-32)+((seed%9)-4)*.035,
      travel:18+seed%31,
      lift:5+seed%15,
      size:.9+(seed%8)*.12,
      spin:((seed%11)-5)*.42,
      phase:(seed%13)/13*Math.PI*2,
      shard:seed%3,
    });
  }
  host.dataset.hideCharacter=host.querySelector("svg").dataset.character;
  }
  host.addEventListener("character-mounted",refresh);
  await refresh();
  window.addEventListener("pagehide",()=>{++version;host.removeEventListener("character-mounted",refresh);},{once:true});
  const canvas=document.createElement("canvas");
  canvas.className="hide-particles";canvas.setAttribute("aria-hidden","true");document.body.append(canvas);
  const context=canvas.getContext("2d");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let frame,active=false,request;
  function cancel() {
    cancelAnimationFrame(frame);active=false;request=undefined;
    document.body.classList.remove("is-dissolving");
    document.body.inert=false;
    context.clearRect(0,0,canvas.width,canvas.height);
  }
  function finish() {
    cancelAnimationFrame(frame);
    context.clearRect(0,0,canvas.width,canvas.height);
    if(request)window.bluepet.hideDone(request.id);
  }
  window.bluepet.onHide(data=>{
    cancel();request=data;active=true;onHide();
    const rect=host.getBoundingClientRect();
    const ratio=devicePixelRatio||1;
    canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);
    context.setTransform(ratio,0,0,ratio,0,0);
    document.body.classList.add("is-dissolving");document.body.inert=true;
    if(!imageReady||data.reducedMotion||reduced.matches) { finish();return; }
    const started=performance.now();
    const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2,unit=rect.width/64;
    function draw(now) {
      const elapsed=now-started;
      context.clearRect(0,0,innerWidth,innerHeight);
      if(elapsed>=420) { finish();return; }
      if(elapsed<95) {
        const t=elapsed/95,ease=1-(1-t)**3;
        const size=rect.width*(1+.14*ease);
        context.save();
        context.shadowColor="rgba(91,132,255,.7)";
        context.shadowBlur=4+8*ease;
        context.drawImage(image,cx-size/2,cy-size/2,size,size);
        context.restore();
        if(t>.48) {
          const crack=(t-.48)/.52;
          context.save();
          context.globalCompositeOperation="destination-out";
          context.strokeStyle=`rgba(0,0,0,${.22+.68*crack})`;
          context.lineWidth=.7+crack*1.2;
          for(let ray=0;ray<6;ray++) {
            const angle=ray*Math.PI/3+(ray%2?.18:-.12);
            context.beginPath();context.moveTo(cx,cy);
            for(let step=1;step<=3;step++) {
              const distance=size*(.09+step*.09)*crack;
              const wobble=(step%2?.11:-.08);
              context.lineTo(cx+Math.cos(angle+wobble)*distance,cy+Math.sin(angle+wobble)*distance);
            }
            context.stroke();
          }
          context.restore();
        }
      } else {
        const t=(elapsed-95)/325,ease=1-(1-t)**3;
        if(t<.28) {
          const ghostAlpha=(1-t/.28)*.22;
          const size=rect.width*(1.14+.05*ease);
          context.globalAlpha=ghostAlpha;
          context.drawImage(image,cx-size/2,cy-size/2,size,size);
        }
        context.globalAlpha=Math.max(0,1-t**1.65);
        for(const p of particles) {
          const swirl=Math.sin(p.phase+ease*Math.PI)*7*ease*(1-t*.45);
          const x=cx+(p.x-32)*unit+Math.cos(p.angle)*p.travel*ease-Math.sin(p.angle)*swirl;
          const y=cy+(p.y-32)*unit+Math.sin(p.angle)*p.travel*ease+Math.cos(p.angle)*swirl-p.lift*ease*ease;
          const size=Math.max(.35,p.size*unit*(1-t*.58));
          context.save();context.translate(x,y);context.rotate(p.spin*ease);
          context.fillStyle=p.color;context.beginPath();
          if(p.shard===0) {
            context.moveTo(-size,-size*.45);context.lineTo(size*.9,0);context.lineTo(-size*.45,size);context.closePath();
          } else if(p.shard===1) {
            context.rect(-size*.75,-size*.28,size*1.5,size*.56);
          } else {
            context.moveTo(0,-size);context.lineTo(size*.65,0);context.lineTo(0,size);context.lineTo(-size*.65,0);context.closePath();
          }
          context.fill();context.restore();
        }
        // The bright fracture ring bridges the swollen silhouette into shards.
        context.globalAlpha=Math.max(0,1-t*2.8)*.75;
        context.strokeStyle="#a9bdff";context.lineWidth=2-t;
        context.beginPath();context.arc(cx,cy,rect.width*(.38+.2*ease),0,Math.PI*2);context.stroke();
        context.globalAlpha=Math.max(0,1-t*4)*.42;
        context.strokeStyle="#ffffff";context.lineWidth=.8;
        context.beginPath();context.arc(cx,cy,rect.width*(.32+.24*ease),0,Math.PI*2);context.stroke();
        context.globalAlpha=1;
      }
      frame=requestAnimationFrame(draw);
    }
    frame=requestAnimationFrame(draw);
  });
  window.bluepet.onHideCancel(cancel);
  reduced.addEventListener("change",()=>{if(active&&reduced.matches)finish();});
  return {get active(){return active;}};
}
