import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEntry } from "../src/lib/types.ts";
import { formatIrCommand, restoreIrLastSentState } from "../src/state/ir-command-history.ts";

const deviceId = "ir-device-id";

function entry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    t: "2026-07-16T08:00:00.000Z",
    deviceId,
    command: "turnOn",
    result: "ok",
    ...overrides,
  };
}

test("対象デバイスの最後に成功したIR操作を復元する", () => {
  const state = restoreIrLastSentState(
    [
      entry({ t: "2026-07-16T08:00:00.000Z", command: "turnOn", parameter: "default" }),
      entry({ t: "2026-07-16T09:00:00.000Z", command: "SetChannel", parameter: "15" }),
    ],
    deviceId,
  );

  assert.deepEqual(state, {
    command: "SetChannel",
    parameter: "15",
    lastSentAt: "2026-07-16T09:00:00.000Z",
  });
  assert.equal(formatIrCommand(state), "CH 15");
});

test("エラー、dry-run、別デバイス、未対応コマンドを無視する", () => {
  assert.deepEqual(
    restoreIrLastSentState(
      [
        entry({ command: "turnOff", result: "error" }),
        entry({ command: "volumeAdd", result: "dry-run", dryRun: true }),
        entry({ command: "brightnessUp", deviceId: "other-device" }),
        entry({ command: "setAll" }),
      ],
      deviceId,
    ),
    {},
  );
});

test("パラメータなしの操作は短い表示名へ変換する", () => {
  assert.equal(formatIrCommand({ command: "brightnessUp" }), "明るく");
  assert.equal(formatIrCommand({ command: "volumeSub" }), "音量−");
  assert.equal(formatIrCommand({}), "—");
});
