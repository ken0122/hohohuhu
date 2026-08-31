export const blinkDelay = (random = Math.random) => 3800 + random() * 3400;
export const idleDelay = (random = Math.random) => 8000 + random() * 7000;

export function eyeFrames(kind, poses) {
  const open = `translateY(${poses.open}px)`;
  const closed = kind === "shy" ? poses.shy : kind === "blink" ? poses.blink : poses.reaction;
  if (kind === "blue-secret") return [
    { transform: open, offset: 0 },
    { transform: `translateY(${poses.blink}px)`, offset: .18 },
    { transform: open, offset: .42 },
    { transform: `translateY(${poses.blink}px)`, offset: .66 },
    { transform: open, offset: 1 },
  ];
  return [
    { transform: open, offset: 0, easing: "ease-in" },
    { transform: `translateY(${closed}px)`, offset: .36, easing: "ease-out" },
    { transform: open, offset: 1 },
  ];
}

// One short closure, then fully open. Never freeze a half-closed eye on hide.
export function createEyeMotion(lid, reduced, poses, doc = document) {
  let timer, animation, active = true, destroyed = false;
  const canAnimate = () => !destroyed && lid && poses && active && !doc.hidden && !reduced.matches;
  function schedule() {
    clearTimeout(timer);
    if (canAnimate()) timer = setTimeout(() => play("blink"), blinkDelay());
  }
  function play(kind) {
    if (!canAnimate() || animation) return;
    clearTimeout(timer);
    const current = lid.animate(eyeFrames(kind, poses), { duration: kind === "blink" ? 180 : kind === "blue-secret" ? 560 : 280 });
    animation = current;
    current.onfinish = () => {
      current.cancel();
      if (animation === current) { animation = undefined; schedule(); }
    };
  }
  function reset() {
    clearTimeout(timer);
    animation?.cancel(); animation = undefined;
    schedule();
  }
  doc.addEventListener("visibilitychange", reset);
  reduced.addEventListener("change", reset);
  schedule();
  return {
    reset() { if (!destroyed) reset(); },
    setActive(value) { if (!destroyed && value !== active) { active = value; reset(); } },
    react(kind) { if (["headpat", "nuzzle", "shy", "tickle", "cuddle", "blue-secret"].includes(kind)) play(kind); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      reset();
      doc.removeEventListener("visibilitychange", reset);
      reduced.removeEventListener("change", reset);
    },
  };
}
