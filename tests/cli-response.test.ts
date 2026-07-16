import assert from "node:assert/strict";
import test from "node:test";
import { SwitchBotCliError } from "../src/lib/cli-errors.ts";
import { parseCliEnvelope } from "../src/lib/cli-response.ts";

test("dataエンベロープを返す", () => {
  const data = parseCliEnvelope<{ ok: boolean }>(JSON.stringify({ schemaVersion: "1.2", data: { ok: true } }));
  assert.deepEqual(data, { ok: true });
});

test("トップレベルerrorをdataより先に処理する", () => {
  assert.throws(
    () =>
      parseCliEnvelope(
        JSON.stringify({
          schemaVersion: "1.2",
          data: { ok: true },
          error: { kind: "auth", message: "login required", hint: "run auth login" },
        }),
      ),
    (error: unknown) => error instanceof SwitchBotCliError && error.kind === "auth" && error.hint === "run auth login",
  );
});

test("JSON以外のstdoutを拒否する", () => {
  assert.throws(
    () => parseCliEnvelope("DEVICE ID | NAME"),
    (error: unknown) => error instanceof SwitchBotCliError && error.kind === "invalid-output",
  );
});
