import test from "node:test";
import assert from "node:assert/strict";
import { createDesktopTestSelection } from "../scripts/desktop-test-selection.mjs";

test("desktop release selection keeps every check unless an explicit filter narrows it", () => {
  const all = createDesktopTestSelection({});
  assert.equal(all.suite, "release");
  assert.equal(all.matches("any check", ["pet"]), true);

  const filtered = createDesktopTestSelection({ BLUEPET_TEST_MATCH: "Eat Beans" });
  assert.equal(filtered.matches("Pet keyboard", ["focus", "pet"]), false);
  assert.equal(filtered.matches("Eat Beans starts", ["smoke", "beans"]), true);
});

test("desktop suites and feature tags compose without broadening the selection", () => {
  const selection = createDesktopTestSelection({
    BLUEPET_TEST_SUITE: "smoke",
    BLUEPET_TEST_TAGS: "settings, character",
  });
  assert.equal(selection.matches("settings smoke", ["smoke", "settings"]), true);
  assert.equal(selection.matches("pet smoke", ["smoke", "pet"]), false);
  assert.equal(selection.matches("settings release check", ["settings"]), false);
});

test("desktop selection rejects unknown suites", () => {
  assert.throws(
    () => createDesktopTestSelection({ BLUEPET_TEST_SUITE: "quick-ish" }),
    /Unsupported BLUEPET_TEST_SUITE/,
  );
});
