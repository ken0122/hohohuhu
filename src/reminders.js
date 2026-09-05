import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

function validNote(note) {
  return note === null || (note && typeof note.id === "string" && note.id.length <= 64 &&
    typeof note.text === "string" && note.text.trim() && [...note.text].length <= 60 &&
    Number.isSafeInteger(note.dueAt) && note.dueAt > 0 && note.dueAt <= 8640000000000000 &&
    Number.isSafeInteger(note.createdAt) && typeof note.dismissed === "boolean" && typeof note.notified === "boolean");
}

export function createReminderStore({ directory, secureStorage }) {
  const file = path.join(directory, "reminder-v1.enc");
  let note = null, warning = null;
  function available() {
    if (!secureStorage.isEncryptionAvailable()) throw new Error("noteStorageFailed");
  }
  try {
    const bytes = readFileSync(file);
    available();
    if (bytes.length > 16384) throw new Error();
    const data = JSON.parse(secureStorage.decryptString(bytes));
    if (data.version !== 1 || !validNote(data.note)) throw new Error();
    note = data.note;
  } catch (error) { if (error.code !== "ENOENT") warning = "noteStorageFailed"; }
  return {
    read: () => ({ note: note && { ...note }, warning }),
    write(next) {
      if (!validNote(next)) throw new Error("noteInvalid");
      try {
        available();
        const bytes = secureStorage.encryptString(JSON.stringify({ version: 1, note: next }));
        mkdirSync(directory, { recursive: true });
        writeFileSync(file + ".tmp", bytes, { mode: 0o600 });
        renameSync(file + ".tmp", file);
      } catch { throw new Error("noteStorageFailed"); }
      note = next && { ...next }; warning = null;
    },
  };
}

// All mutations are synchronous and small. Model requests carry a revision so
// a response arriving after cancel/replace/ack cannot resurrect an old note.
export function createReminders({ store, now = Date.now, changed = () => {} }) {
  let revision = 0, proposal = null, draft = null, busy = false;
  let shownId = null, notificationAttemptId = null;
  const snapshot = () => {
    const { note, warning } = store.read();
    return { revision, note: note && { ...note, due: note.dueAt <= now() }, warning, proposal: proposal && { ...proposal } };
  };
  function emit() { changed(snapshot()); }
  function write(note) { store.write(note); revision++; emit(); }
  function save(candidate) {
    if (candidate.dueAt <= now()) throw new Error("noteTimeInvalid");
    const note = { id: randomUUID(), text: candidate.text, dueAt: candidate.dueAt, createdAt: now(), dismissed: false, notified: false };
    store.write(note);
    proposal = null; draft = null; revision++; shownId = null; notificationAttemptId = null; emit();
  }
  return {
    snapshot,
    get busy() { return busy; },
    async submit(classify) {
      if (busy) throw new Error("noteBusy");
      const ticket = revision, submittedAt = now();
      const { note, warning } = store.read();
      busy = true;
      try {
        const result = await classify({ submittedAt, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          localTime: new Date(submittedAt).toString(), note: note && { text: note.text, dueAt: note.dueAt }, draft });
        if (ticket !== revision) throw new Error("noteChanged");
        if (result.intent === "chat") { draft = null; return { reply: result.reply, snapshot: snapshot() }; }
        if (result.intent === "clarify") { draft = result.draft; return { reply: result.reply, snapshot: snapshot() }; }
        if (result.intent === "show") return { key: warning || (note ? "noteTitle" : "noteEmpty"), view: note || warning ? "note" : "chat", snapshot: snapshot() };
        if (warning) throw new Error(warning);
        if (result.intent === "cancel") {
          proposal = null; draft = null; write(null);
          return { key: note ? "noteCancelled" : "noteEmpty", snapshot: snapshot() };
        }
        if (result.intent !== "create" || !result.text || result.dueAt <= now()) throw new Error("noteTimeInvalid");
        if (note) {
          proposal = { id: randomUUID(), text: result.text, dueAt: result.dueAt };
          draft = null; revision++; emit();
          return { key: "noteFull", view: "replace", snapshot: snapshot() };
        }
        save(result);
        return { key: "noteSaved", view: "note", snapshot: snapshot() };
      } finally { busy = false; }
    },
    action({ action, id, revision: expected }) {
      if (expected !== revision) throw new Error("noteChanged");
      const { note, warning } = store.read();
      if (action === "replace" && proposal?.id === id) save(proposal);
      else if (action === "keep" && proposal?.id === id) { proposal = null; revision++; emit(); }
      else if (["cancel", "ack"].includes(action) && note?.id === id) {
        if (action === "ack" && note.dueAt > now()) throw new Error("noteChanged");
        proposal = null; draft = null; write(null);
      } else if (action === "reset" && warning && id === null) write(null);
      else throw new Error("noteChanged");
      return snapshot();
    },
    dismiss() {
      // Dismissing the surface never cancels an already submitted request.
      draft = null;
      if (proposal) { proposal = null; revision++; emit(); }
    },
    dismissDue() {
      const { note } = store.read();
      if (note && note.dueAt <= now() && !note.dismissed) write({ ...note, dismissed: true });
    },
    delivery(surface) {
      const { note, warning } = store.read();
      if (warning || !note || note.dueAt > now() || note.dismissed || surface === "defer") return null;
      if (surface === "notification") {
        if (note.notified || notificationAttemptId === note.id) return null;
        notificationAttemptId = note.id;
        // Persist attempted delivery, never a claim that macOS displayed it.
        store.write({ ...note, notified: true }); emit();
        return { type: "notification", note };
      }
      if (shownId === note.id) return null;
      shownId = note.id; emit();
      return { type: "bubble", note };
    },
    resetPresentation() { shownId = null; },
  };
}
