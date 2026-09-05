import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReminders, createReminderStore } from "../src/reminders.js";
import { parseReminderIntent } from "../src/reminder-intent.js";
import { askClaude } from "../src/chat.js";

const start = Date.parse("2026-09-02T12:00:00+08:00");
function memory() {
  let note = null;
  return { read: () => ({ note: note && { ...note }, warning: null }), write: next => { note = next && { ...next }; } };
}
function fixture(store = memory()) {
  let time = start;
  const reminders = createReminders({ store, now: () => time });
  return { reminders, advance: ms => { time += ms; }, create: (text = "喝水", delay = 600000) => reminders.submit(async () => ({ intent: "create", text, dueAt: time + delay })) };
}
const action = (r, type, id = r.snapshot().note?.id) => r.action({ action: type, id, revision: r.snapshot().revision });

test("reminder intents validate relative/absolute time, calendar dates and bounded text", () => {
  const parse = data => parseReminderIntent(JSON.stringify(data), start);
  assert.deepEqual(parse({ intent: "create", text: "喝水", seconds: 600 }), { intent: "create", text: "喝水", dueAt: start + 600000 });
  assert.equal(parse({ intent: "create", text: "开会", at: "2026-09-03T15:00:00+08:00" }).dueAt, Date.parse("2026-09-03T07:00:00Z"));
  for (const data of [
    { intent: "create", text: "水" }, { intent: "create", text: "水", seconds: 0 },
    { intent: "create", text: "水", seconds: -1 }, { intent: "create", text: "水", seconds: 1.5 },
    { intent: "create", text: "水", seconds: Number.MAX_SAFE_INTEGER },
    { intent: "create", text: "水", at: "2026-09-02T01:00:00Z" },
    { intent: "create", text: "水", at: "2027-02-30T12:00:00Z" },
    { intent: "create", text: "水", at: "2026-09-03T15:00:00" },
    { intent: "create", text: "水", seconds: 600, at: "2026-09-03T15:00:00Z" },
    { intent: "create", text: "水".repeat(61), seconds: 600 },
    { intent: "create", text: "水", seconds: 600, repeat: "daily" },
    { intent: "run", command: "unsafe" }, [],
  ]) assert.throws(() => parse(data));
  assert.throws(() => parseReminderIntent('```json\n{}\n```', start));
  assert.deepEqual(parse({ intent: "clarify", reply: "什么时候？", text: "喝水" }).draft, { text: "喝水" });
  assert.deepEqual(parse({ intent: "cancel" }), { intent: "cancel" });
});

test("structured chat uses one configured request and no provider-specific parameters", async () => {
  const context = { submittedAt: start, timeZone: "Asia/Shanghai", draft: null, note: null };
  let calls = 0;
  const provider = async () => ({ url: "https://models.example/v1/messages", key: "test-only", model: "configured" });
  const reply = await askClaude("十分钟后提醒我喝水", { provider, reminderContext: context, request: async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.model, "configured"); assert.equal(body.max_tokens, 160);
    assert.equal(body.thinking, undefined); assert.equal(body.output_config, undefined);
    assert.equal(body.messages.length, 1); assert.match(body.system, /hypotheticals, negations/);
    assert.equal(options.redirect, "error");
    return Response.json({ content: [{ type: "text", text: '{"intent":"create","text":"喝水","seconds":600}' }] });
  }});
  assert.equal(calls, 1); assert.equal(reply.dueAt, start + 600000);
  for (const data of [
    { content: [{ type: "text", text: "记住啦" }] },
    { stop_reason: "max_tokens", content: [{ type: "text", text: '{"intent":"cancel"}' }] },
    { content: [{ type: "tool_use", name: "execute", input: {} }] },
  ]) await assert.rejects(askClaude("hi", { provider, reminderContext: context, request: async () => Response.json(data) }), /noteInvalid/);
});

test("one note: replace requires confirmation; keep and stale actions protect original", async () => {
  const { reminders: r, create } = fixture();
  assert.equal((await create()).key, "noteSaved");
  const original = r.snapshot().note;
  const oldAction = { action: "cancel", id: original.id, revision: r.snapshot().revision };
  assert.equal((await create("吃饭")).view, "replace");
  assert.equal(r.snapshot().note.text, "喝水");
  assert.throws(() => r.action(oldAction), /noteChanged/);
  action(r, "keep", r.snapshot().proposal.id);
  assert.equal(r.snapshot().note.id, original.id);
  await create("吃饭"); action(r, "replace", r.snapshot().proposal.id);
  assert.equal(r.snapshot().note.text, "吃饭");
  assert.notEqual(r.snapshot().note.id, original.id);
  action(r, "cancel"); assert.equal(r.snapshot().note, null);
});

test("due delivery deduplicates, preserves hidden notes, dismiss differs from acknowledge", async () => {
  const { reminders: r, create, advance } = fixture();
  await create();
  assert.equal(r.delivery("bubble"), null);
  assert.throws(() => action(r, "ack"), /noteChanged/);
  advance(600000);
  assert.equal(r.delivery("defer"), null);
  assert.equal(r.delivery("notification").type, "notification");
  assert.equal(r.delivery("notification"), null);
  assert.equal(r.delivery("bubble").type, "bubble");
  assert.equal(r.delivery("bubble"), null);
  r.dismissDue(); r.resetPresentation();
  assert.equal(r.snapshot().note.due, true);
  assert.equal(r.delivery("bubble"), null);
  action(r, "ack"); assert.equal(r.snapshot().note, null);
});

test("restart delivers overdue once; cancel/replace suppress obsolete deadlines", async () => {
  const store = memory(); const { reminders: r, create, advance } = fixture(store);
  await create("first", 1000); await create("second", 10000);
  action(r, "replace", r.snapshot().proposal.id); advance(1000);
  assert.equal(r.delivery("bubble"), null);
  const restarted = createReminders({ store, now: () => start + 20000 });
  assert.equal(restarted.delivery("bubble").note.text, "second");
  assert.equal(restarted.delivery("bubble"), null);
  action(restarted, "cancel"); assert.equal(restarted.delivery("notification"), null);
});

test("late model replies cannot undo cancellation; overlapping submissions are rejected", async () => {
  const { reminders: r, create } = fixture(); await create();
  let resolve;
  const pending = r.submit(() => new Promise(done => { resolve = done; }));
  await assert.rejects(create(), /noteBusy/);
  action(r, "cancel");
  resolve({ intent: "create", text: "late", dueAt: start + 20000 });
  await assert.rejects(pending, /noteChanged/);
  assert.equal(r.snapshot().note, null);
});

test("draft clarification is temporary, closing does not cancel an already sent creation", async () => {
  const { reminders: r } = fixture();
  await r.submit(async () => ({ intent: "clarify", reply: "什么时候？", draft: { text: "水" } }));
  await r.submit(async context => { assert.equal(context.draft.text, "水"); return { intent: "chat", reply: "你好" }; });
  let resolve;
  const pending = r.submit(context => { assert.equal(context.draft, null); return new Promise(done => { resolve = done; }); });
  r.dismiss(); resolve({ intent: "create", text: "水", dueAt: start + 600000 });
  assert.equal((await pending).key, "noteSaved");
});

test("failed persistence never confirms creation, replacement, cancellation or acknowledgement", async () => {
  const backing = memory(); let fail = false;
  const store = { read: backing.read, write(value) { if (fail) throw new Error("noteStorageFailed"); backing.write(value); } };
  const { reminders: r, create, advance } = fixture(store);
  fail = true; await assert.rejects(create(), /noteStorageFailed/);
  assert.equal(r.snapshot().note, null);
  fail = false; await create(); const original = r.snapshot().note;
  await create("new"); fail = true;
  assert.throws(() => action(r, "replace", r.snapshot().proposal.id), /noteStorageFailed/);
  assert.equal(r.snapshot().note.id, original.id);
  assert.throws(() => action(r, "cancel"), /noteStorageFailed/);
  advance(600000); assert.throws(() => action(r, "ack"), /noteStorageFailed/);
  assert.equal(r.snapshot().note.id, original.id);
});

test("encrypted store survives reopen, rejects corruption and preserves memory on failed writes", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "bluepet-reminder-"));
  const key = randomBytes(32), iv = randomBytes(16);
  const secureStorage = {
    isEncryptionAvailable: () => true,
    encryptString(value) { const cipher = createCipheriv("aes-256-cbc", key, iv); return Buffer.concat([cipher.update(value), cipher.final()]); },
    decryptString(value) { const cipher = createDecipheriv("aes-256-cbc", key, iv); return Buffer.concat([cipher.update(value), cipher.final()]).toString(); },
  };
  try {
    const store = createReminderStore({ directory, secureStorage });
    const { create } = fixture(store); await create("private subject");
    const file = path.join(directory, "reminder-v1.enc");
    const encrypted = readFileSync(file);
    assert.equal(encrypted.includes(Buffer.from("private subject")), false);
    assert.equal(createReminderStore({ directory, secureStorage }).read().note.text, "private subject");
    secureStorage.isEncryptionAvailable = () => false;
    assert.throws(() => store.write(null), /noteStorageFailed/);
    assert.equal(store.read().note.text, "private subject");
    assert.deepEqual(readFileSync(file), encrypted);
    secureStorage.isEncryptionAvailable = () => true;
    writeFileSync(file, "corrupt");
    const broken = createReminderStore({ directory, secureStorage });
    assert.equal(broken.read().warning, "noteStorageFailed");
    await assert.rejects(fixture(broken).create(), /noteStorageFailed/);
    const repair = createReminders({ store: broken });
    action(repair, "reset", null); assert.equal(broken.read().warning, null);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
