import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowMenuBar } from "../src/state/menu-bar-settings.ts";

test("手動起動では保存状態にかかわらず表示する", () => {
  assert.equal(shouldShowMenuBar(false, true), true);
});

test("バックグラウンド起動ではOFFを維持する", () => {
  assert.equal(shouldShowMenuBar(false, false), false);
  assert.equal(shouldShowMenuBar(true, false), true);
  assert.equal(shouldShowMenuBar(undefined, false), true);
});
