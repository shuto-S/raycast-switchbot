import assert from "node:assert/strict";
import test from "node:test";
import { parseMenuBarSnapshot, shouldRefreshMenuBar } from "../src/state/menu-bar-cache.ts";

test("保存したメニューバースナップショットを復元する", () => {
  const value = JSON.stringify({
    devices: [{ deviceId: "hub", name: "Hub 2", type: "Hub 2", category: "physical", raw: {} }],
    selectedDeviceId: "hub",
    status: { title: "27.6℃ 52%", items: [{ title: "温度", value: "27.6℃" }] },
    updatedAt: 1_752_672_000_000,
  });

  const snapshot = parseMenuBarSnapshot(value);
  assert.equal(snapshot?.selectedDeviceId, "hub");
  assert.equal(snapshot?.status?.title, "27.6℃ 52%");
});

test("壊れたスナップショットは使用しない", () => {
  assert.equal(parseMenuBarSnapshot("invalid"), undefined);
  assert.equal(parseMenuBarSnapshot(JSON.stringify({ devices: "invalid", updatedAt: Date.now() })), undefined);
});

test("クリック起動はキャッシュを使い、バックグラウンドだけ更新する", () => {
  assert.equal(shouldRefreshMenuBar(true, false), false);
  assert.equal(shouldRefreshMenuBar(true, true), true);
  assert.equal(shouldRefreshMenuBar(false, false), true);
});
