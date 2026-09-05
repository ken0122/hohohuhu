import { locale, tr } from "./localize.js";

export function createReminderUI({ onView, feedback }) {
  const speech = document.querySelector(".speech");
  const chat = document.querySelector("#chat-content");
  const panel = document.querySelector("#note-panel");
  const badge = document.querySelector("#note-badge");
  const heading = document.querySelector("#note-heading");
  const details = document.querySelector("#note-details");
  const actions = document.querySelector("#note-actions");
  const back = document.querySelector("#note-back");
  let state = { note: null, proposal: null, view: "chat", revision: 0 };
  let pending = false, rendered = "", entrance = "", errorKey = null, messageKey = null;
  const formatTime = time => new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(time);
  const isNote = () => state.view !== "chat" && Boolean(state.note || state.warning || state.proposal);
  function button(label, action, id, primary = false) {
    const node = document.createElement("button");
    node.type = "button"; node.textContent = tr(label); node.dataset.action = action;
    if (primary) node.classList.add("note-primary");
    node.disabled = pending;
    const revision = state.revision;
    node.addEventListener("click", async () => {
      if (pending) return;
      pending = true;
      actions.querySelectorAll("button").forEach(button => { button.disabled = true; });
      try {
        const result = await window.bluepet.reminderAction({ action, id, revision });
        if (result.snapshot) state = { ...result.snapshot, view: result.view || state.view };
        if (!result.ok) { errorKey = result.error; feedback(result.error); }
        else if (action === "cancel" || action === "reset") feedback("noteCancelled");
      } catch { errorKey = "noteStorageFailed"; feedback(errorKey); }
      finally { pending = false; render(true); }
    });
    actions.append(node);
  }
  function line(note, prefix = "") {
    const row = document.createElement("div"); row.className = "note-item";
    const text = document.createElement("p"); text.textContent = (prefix ? tr(prefix) + " · " : "") + note.text;
    text.title = text.textContent;
    const time = document.createElement("time"); time.dateTime = new Date(note.dueAt).toISOString(); time.textContent = formatTime(note.dueAt);
    row.append(text, time); details.append(row);
  }
  function render(force = false) {
    const signature = JSON.stringify([state, locale(), pending]);
    if (!force && rendered === signature) return;
    rendered = signature;
    const shown = isNote(), due = shown && state.view !== "replace" && state.note?.due;
    chat.hidden = shown; panel.hidden = !shown;
    badge.hidden = shown || (!state.note && !state.warning);
    badge.textContent = tr(state.warning ? "noteStorageFailed" : state.note?.due ? "noteDue" : "noteView");
    badge.title = badge.textContent;
    speech.classList.toggle("has-note", Boolean(state.note || state.warning));
    speech.classList.toggle("is-note", shown);
    speech.classList.toggle("note-replacing", shown && state.view === "replace");
    speech.classList.toggle("note-due", Boolean(due));
    const nextEntrance = due ? state.note.id : "";
    if (entrance !== nextEntrance) {
      speech.classList.remove("note-arrive");
      if (nextEntrance) { void speech.offsetWidth; speech.classList.add("note-arrive"); }
      entrance = nextEntrance;
    }
    onView(shown);
    if (!shown) return;
    heading.textContent = tr(errorKey || state.warning || (state.view === "replace" ? "noteFull" : due ? "noteDue" : messageKey || "noteTitle"));
    details.replaceChildren(); actions.replaceChildren();
    back.textContent = tr("noteBack");
    if (state.warning) {
      button("noteReset", "reset", null);
    } else if (state.view === "replace" && state.proposal) {
      line(state.note, "noteOld"); line(state.proposal, "noteNew");
      button("noteKeep", "keep", state.proposal.id);
      button("noteReplace", "replace", state.proposal.id, true);
    } else if (state.note) {
      line(state.note);
      button(due ? "noteAck" : "noteCancel", due ? "ack" : "cancel", state.note.id, due);
    }
  }
  async function view(value) {
    try {
      const result = await window.bluepet.viewReminder(value);
      if (!result.ok) feedback(result.error);
    } catch { feedback("noteInvalid"); }
  }
  badge.addEventListener("click", () => view("note"));
  back.addEventListener("click", () => view("chat"));
  window.bluepet.onReminder(value => { if (value.revision !== state.revision || value.view !== state.view) { errorKey = null; messageKey = null; } state = value; render(); });
  window.bluepet.onReminderError(feedback);
  window.bluepet.getReminder().then(value => { state = value; render(); }).catch(() => feedback("noteStorageFailed"));
  return { render: () => render(true), isNote, message(key) { messageKey = key; render(true); } };
}
