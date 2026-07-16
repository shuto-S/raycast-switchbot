import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEntry } from "../src/lib/types.ts";
import {
  adjustAcLastSentTemperature,
  getAcSettingsStorageKey,
  mergeStoredAcSettings,
  parseStoredAcSettings,
  restoreAcLastSentState,
} from "../src/state/ac-command-history.ts";

const deviceId = "air-conditioner-id";

function entry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    t: "2026-07-16T08:00:00.000Z",
    deviceId,
    command: "turnOn",
    result: "ok",
    ...overrides,
  };
}

test("成功履歴を古い順に適用し、ON/OFF後も前回設定を維持する", () => {
  const state = restoreAcLastSentState(
    [
      entry({ t: "2026-07-16T09:00:00.000Z", command: "turnOff" }),
      entry({
        t: "2026-07-16T08:00:00.000Z",
        command: "setAll",
        parameter: "26,2,1,on",
      }),
    ],
    deviceId,
  );

  assert.deepEqual(state, {
    power: "off",
    temperature: 26,
    mode: "cool",
    fan: "auto",
    lastSentAt: "2026-07-16T09:00:00.000Z",
  });
});

test("error、dry-run、別デバイスの履歴を無視する", () => {
  const state = restoreAcLastSentState(
    [
      entry({ command: "setAll", parameter: "25,5,4,on" }),
      entry({ command: "turnOff", result: "error" }),
      entry({ command: "turnOff", result: "dry-run", dryRun: true }),
      entry({ deviceId: "other-device", command: "turnOff" }),
    ],
    deviceId,
  );

  assert.deepEqual(state, {
    power: "on",
    temperature: 25,
    mode: "heat",
    fan: "high",
    lastSentAt: "2026-07-16T08:00:00.000Z",
  });
});

test("履歴がなければ不明状態を返す", () => {
  assert.deepEqual(restoreAcLastSentState([], deviceId), {});
});

test("最終送信のモードと風量を維持して温度を1℃変更する", () => {
  const state = { power: "off" as const, temperature: 26, mode: "cool" as const, fan: "auto" as const };

  assert.deepEqual(adjustAcLastSentTemperature(state, 1), {
    temperature: 27,
    mode: "cool",
    fan: "auto",
  });
  assert.deepEqual(adjustAcLastSentTemperature(state, -1), {
    temperature: 25,
    mode: "cool",
    fan: "auto",
  });
});

test("最終送信設定がなければ冷房26℃・風量自動を基準にする", () => {
  assert.deepEqual(adjustAcLastSentTemperature({}, 1), {
    temperature: 27,
    mode: "cool",
    fan: "auto",
  });
  assert.deepEqual(adjustAcLastSentTemperature({}, -1), {
    temperature: 25,
    mode: "cool",
    fan: "auto",
  });
});

test("16〜30℃の範囲外は変更しない", () => {
  assert.equal(
    adjustAcLastSentTemperature({ temperature: 30, mode: "cool", fan: "auto" }, 1),
    undefined,
  );
  assert.equal(
    adjustAcLastSentTemperature({ temperature: 16, mode: "heat", fan: "low" }, -1),
    undefined,
  );
});

test("保存した運転設定をデバイスごとに復元する", () => {
  const settings = parseStoredAcSettings('{"temperature":25,"mode":"dry","fan":"low"}');

  assert.equal(getAcSettingsStorageKey(deviceId), `ac-last-settings:${deviceId}`);
  assert.deepEqual(mergeStoredAcSettings({ power: "off" }, settings), {
    power: "off",
    temperature: 25,
    mode: "dry",
    fan: "low",
  });
});

test("監査ログの値を保存値より優先し、不正な保存値は無視する", () => {
  const storedSettings = parseStoredAcSettings('{"temperature":25,"mode":"dry","fan":"low"}');
  assert.deepEqual(
    mergeStoredAcSettings({ temperature: 27, mode: "cool", fan: "high" }, storedSettings),
    { temperature: 27, mode: "cool", fan: "high" },
  );
  assert.equal(parseStoredAcSettings('{"temperature":31,"mode":"cool","fan":"auto"}'), undefined);
  assert.equal(parseStoredAcSettings("invalid json"), undefined);
});
