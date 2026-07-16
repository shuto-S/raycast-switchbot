import assert from "node:assert/strict";
import test from "node:test";
import type { SwitchBotDevice } from "../src/lib/types.ts";
import {
  parseRecentlyOpenedDeviceIds,
  prioritizeRecentlyOpenedDevices,
  rememberRecentlyOpenedDevice,
} from "../src/state/device-order.ts";

function device(deviceId: string): SwitchBotDevice {
  return {
    deviceId,
    name: deviceId,
    type: "Test",
    category: "physical",
    raw: {},
  };
}

test("最近開いた順に並べ、未使用デバイスは元の順序を維持する", () => {
  const devices = [device("a"), device("b"), device("c")];
  assert.deepEqual(
    prioritizeRecentlyOpenedDevices(devices, ["c", "a"]).map((item) => item.deviceId),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    devices.map((item) => item.deviceId),
    ["a", "b", "c"],
  );
});

test("デバイスを再度開くと履歴の先頭へ移動する", () => {
  assert.deepEqual(rememberRecentlyOpenedDevice(["c", "b", "a"], "b"), ["b", "c", "a"]);
  assert.deepEqual(rememberRecentlyOpenedDevice([], "a"), ["a"]);
});

test("保存した履歴を読み取り、不正な値を無視する", () => {
  assert.deepEqual(parseRecentlyOpenedDeviceIds('["c","a",1,null]'), ["c", "a"]);
  assert.deepEqual(parseRecentlyOpenedDeviceIds("invalid json"), []);
  assert.deepEqual(parseRecentlyOpenedDeviceIds('{"deviceId":"a"}'), []);
});

test("履歴なし・不明IDのみの場合は元の配列を返す", () => {
  const devices = [device("a"), device("b")];
  assert.equal(prioritizeRecentlyOpenedDevices(devices, []), devices);
  assert.equal(prioritizeRecentlyOpenedDevices(devices, ["missing"]), devices);
});
