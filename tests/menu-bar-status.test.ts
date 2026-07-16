import assert from "node:assert/strict";
import test from "node:test";
import { formatMenuBarDeviceStatus } from "../src/lib/menu-bar-status.ts";
import type { SwitchBotDevice } from "../src/lib/types.ts";

function device(overrides: Partial<SwitchBotDevice>): SwitchBotDevice {
  return {
    deviceId: "device-id",
    name: "デバイス",
    type: "Hub 2",
    category: "physical",
    raw: {},
    ...overrides,
  };
}

test("Hub 2は温度と湿度を短く表示し、取得値を並べる", () => {
  const status = formatMenuBarDeviceStatus(device({ name: "リビング" }), {
    liveStatus: { temperature: 27.6, humidity: 52, lightLevel: 1, version: "V4.1" },
  });

  assert.equal(status.title, "27.6℃ 52%");
  assert.deepEqual(status.items, [
    { title: "温度", value: "27.6℃" },
    { title: "湿度", value: "52%" },
    { title: "照度", value: "1" },
    { title: "ファームウェア", value: "V4.1" },
  ]);
});

test("エアコンはOFFを優先しつつ前回設定をメニューへ残す", () => {
  const status = formatMenuBarDeviceStatus(
    device({ name: "エアコン", type: "Air Conditioner", category: "ir" }),
    {
      acState: {
        power: "off",
        temperature: 26,
        mode: "cool",
        fan: "auto",
        lastSentAt: "2026-07-16T08:42:00.000Z",
      },
    },
  );

  assert.equal(status.title, "OFF");
  assert.deepEqual(status.items.slice(0, 4), [
    { title: "電源", value: "OFF" },
    { title: "設定温度", value: "26℃" },
    { title: "モード", value: "冷房" },
    { title: "風量", value: "自動" },
  ]);
});

test("テレビは最後に送信した操作を表示する", () => {
  const status = formatMenuBarDeviceStatus(device({ name: "テレビ", type: "TV", category: "ir" }), {
    irState: { command: "SetChannel", parameter: "8", lastSentAt: "2026-07-16T08:42:00.000Z" },
  });

  assert.equal(status.title, "CH 8");
  assert.equal(status.items[0]?.value, "CH 8");
});

test("その他の物理デバイスはバッテリーを短く表示する", () => {
  const status = formatMenuBarDeviceStatus(device({ name: "ロック", type: "Smart Lock Pro" }), {
    liveStatus: { battery: 96, lockState: "locked" },
  });

  assert.equal(status.title, "96%");
  assert.deepEqual(status.items, [
    { title: "バッテリー", value: "96%" },
    { title: "ロック状態", value: "locked" },
  ]);
});
