export const REACTIONS = {
  headpat: { duration: 1000, messages: ["摸摸头，好舒服", "嗯～再摸一下"] },
  tickle: { duration: 800, messages: ["哎呀呀，好痒！", "哈哈，肚肚怕痒～"] },
  poke: { duration: 500, messages: ["哎呀！戳到肚肚啦", "软乎乎的，不许戳～"] },
  cuddle: { duration: 1200, messages: ["抱抱，再陪我一会儿", "贴着你，暖乎乎"] },
  nuzzle: { duration: 1100, messages: ["贴贴～", "蹭蹭你"] },
  hop: { duration: 700, messages: ["嘿嘿！", "我在呢～"] },
  shy: { duration: 800, messages: ["耳朵也会痒的呀", "有点害羞…"] },
};

export function petZone(x, y) {
  if (y < .4) return "head";
  if (y >= .6) return "belly";
  if (x < .35 || x > .65) return "cheek";
  return "face";
}
export function clickReaction(x, y) {
  return { head: "shy", belly: "poke", cheek: "nuzzle", face: "hop" }[petZone(x, y)];
}

// Normalized coordinates keep gestures consistent as the pet's size changes.
export function createStrokeGesture() {
  let previous, distance = 0, reversals = 0, direction = 0;
  const reset = () => { previous = undefined; distance = 0; reversals = 0; direction = 0; };
  return {
    reset,
    move(x, y, time) {
      const zone = petZone(x, y);
      if (!previous || time - previous.time > 650 || previous.zone !== zone) {
        reset(); previous = { x, y, time, zone }; return;
      }
      const dx = x - previous.x;
      distance += Math.hypot(dx, y - previous.y);
      if (Math.abs(dx) > .035) {
        const nextDirection = Math.sign(dx);
        if (direction && nextDirection !== direction) reversals++;
        direction = nextDirection;
      }
      previous = { x, y, time, zone };
      const kind = zone === "head" && distance > .55 ? "headpat"
        : zone === "belly" && distance > .65 && reversals >= 2 ? "tickle" : undefined;
      if (kind) reset();
      return kind;
    },
  };
}
