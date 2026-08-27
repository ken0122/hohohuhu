// Rasterize a runtime clone, never modify the source mascot. All pixels stay local.
export async function installHideEffect(host, onHide = () => {}) {
  const clone=host.querySelector("svg").cloneNode(true);
  clone.querySelectorAll("style,.lid").forEach(node=>node.remove());
  const image=new Image();
  image.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const imageReady=await image.decode().then(()=>true,()=>false);
  const sample=document.createElement("canvas");sample.width=sample.height=64;
  const source=sample.getContext("2d",{willReadFrequently:true});
  if(imageReady)source.drawImage(image,0,0,64,64);
  const pixels=source.getImageData(0,0,64,64).data;
  const particles=[];
  for(let y=1;y<64;y+=3)for(let x=1;x<64;x+=3) {
    const i=(y*64+x)*4;
    if(pixels[i+3]<80)continue;
    particles.push({x,y,color:`rgb(${pixels[i]} ${pixels[i+1]} ${pixels[i+2]})`,
      angle:Math.atan2(y-32,x-32)+(x%5-.5)*.12,travel:8+(x*7+y*11)%17});
  }
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
      if(elapsed<70) {
        const size=rect.width*(1+.1*elapsed/70);
        context.drawImage(image,cx-size/2,cy-size/2,size,size);
      } else {
        const t=(elapsed-70)/350,ease=1-(1-t)**3;
        context.globalAlpha=(1-t)**1.5;
        for(const p of particles) {
          const x=cx+(p.x-32)*unit+Math.cos(p.angle)*p.travel*ease;
          const y=cy+(p.y-32)*unit+Math.sin(p.angle)*p.travel*ease-8*ease;
          context.fillStyle=p.color;context.beginPath();
          context.arc(x,y,Math.max(.1,1.8*unit*(1-t)),0,Math.PI*2);context.fill();
        }
        // A short, quiet pop rim; it vanishes before the last fragments.
        context.globalAlpha=Math.max(0,1-t*3)*.4;
        context.strokeStyle="#7594ff";context.lineWidth=1;
        context.beginPath();context.arc(cx,cy,rect.width*(.32+.23*ease),0,Math.PI*2);context.stroke();
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
