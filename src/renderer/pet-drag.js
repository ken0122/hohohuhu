export const DRAG_THRESHOLD = 6;

// Screen coordinates remain stable while the native window follows the pointer.
export function createPetDrag(element, { enabled, onPress, onStart, onEnd }) {
  let press;
  const point = event => ({ x: event.screenX, y: event.screenY });
  function finish(cancelled = false, notify = true) {
    if (!press) return;
    const previous = press; press = undefined;
    if (element.hasPointerCapture(previous.id)) element.releasePointerCapture(previous.id);
    if (notify) window.bluepet.dragPet({ phase: "end" });
    onEnd({ dragged: previous.dragged, cancelled });
  }
  element.addEventListener("pointerdown", event => {
    if (!enabled() || event.button !== 0 || press) return;
    press = { id: event.pointerId, start: point(event), dragged: false };
    // Synthetic pointer events in regression tests cannot acquire native capture.
    if (event.isTrusted) element.setPointerCapture(event.pointerId);
    window.bluepet.dragPet({ phase: "start", point: press.start });
    onPress();
  });
  element.addEventListener("pointermove", event => {
    if (!press || event.pointerId !== press.id) return;
    if (!(event.buttons & 1)) { finish(true); return; }
    const cursor = point(event);
    if (!press.dragged && Math.hypot(cursor.x-press.start.x,cursor.y-press.start.y) >= DRAG_THRESHOLD) {
      press.dragged = true; onStart();
    }
    if (press.dragged) { event.preventDefault(); window.bluepet.dragPet({ phase: "move", point: cursor }); }
  });
  element.addEventListener("pointerup", event => {
    if (!press || event.pointerId !== press.id) return;
    if (press.dragged) window.bluepet.dragPet({ phase: "move", point: point(event) });
    finish();
  });
  element.addEventListener("pointercancel", () => finish(true));
  element.addEventListener("lostpointercapture", () => finish(true));
  window.addEventListener("blur", () => finish(true));
  window.bluepet.onDragEnd(() => finish(true, false));
  return { get pressed() { return Boolean(press); }, cancel: () => finish(true) };
}
