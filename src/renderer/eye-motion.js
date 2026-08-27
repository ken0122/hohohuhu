export const OPEN_EYE = "translateY(-20px)";
export const blinkDelay = (random = Math.random) => 3800 + random() * 3400;
export const idleDelay = (random = Math.random) => 12000 + random() * 10000;

export function eyeFrames(kind = "blink") {
  const closed = kind === "shy" ? -4 : kind === "blink" ? 10 : 5;
  return [
    { transform: OPEN_EYE, offset: 0, easing: "ease-in" },
    { transform: `translateY(${closed}px)`, offset: .36, easing: "ease-out" },
    { transform: OPEN_EYE, offset: 1 },
  ];
}

// One short closure, then fully open. Never freeze a half-closed eye on hide.
export function createEyeMotion(lid, reduced) {
  let timer, animation, active = true;
  const canAnimate = () => lid && active && !document.hidden && !reduced.matches;
  function schedule() {
    clearTimeout(timer);
    if (canAnimate()) timer = setTimeout(() => play("blink"), blinkDelay());
  }
  function play(kind) {
    if (!canAnimate() || animation) return;
    clearTimeout(timer);
    const current = lid.animate(eyeFrames(kind), { duration: kind === "blink" ? 180 : 280 });
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
  document.addEventListener("visibilitychange", reset);
  reduced.addEventListener("change", reset);
  schedule();
  return {
    setActive(value) { if (value !== active) { active = value; reset(); } },
    react(kind) { if (["headpat", "nuzzle", "shy"].includes(kind)) play(kind); },
  };
}
