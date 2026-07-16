import { sanitizeTechnicalDetails, SwitchBotCliError } from "./cli-errors.ts";
import type { CliEnvelopeError } from "./cli-errors.ts";

interface CliEnvelope<T> {
  schemaVersion?: string;
  data?: T;
  error?: CliEnvelopeError;
}

export function parseCliEnvelope<T>(stdout: string, diagnostics = ""): T {
  const raw = stdout.trim();
  if (!raw) {
    throw new SwitchBotCliError({
      kind: "invalid-output",
      message: "SwitchBot CLIからJSONが返されませんでした。",
      technicalDetails: sanitizeTechnicalDetails(diagnostics || "stdout was empty"),
    });
  }

  let envelope: CliEnvelope<T>;
  try {
    envelope = JSON.parse(raw) as CliEnvelope<T>;
  } catch {
    throw new SwitchBotCliError({
      kind: "invalid-output",
      message: "SwitchBot CLIのJSON出力を解析できませんでした。",
      technicalDetails: sanitizeTechnicalDetails([diagnostics, raw].filter(Boolean).join("\n")),
    });
  }

  if (envelope.error) {
    const errorKind =
      envelope.error.kind === "auth" || envelope.error.errorClass === "auth"
        ? "auth"
        : (envelope.error.errorClass ?? envelope.error.kind ?? "unknown");
    throw new SwitchBotCliError({
      kind: errorKind,
      message: envelope.error.message ?? "SwitchBot CLIがエラーを返しました。",
      hint: envelope.error.hint,
      technicalDetails: sanitizeTechnicalDetails(
        JSON.stringify({ schemaVersion: envelope.schemaVersion, error: envelope.error }, null, 2),
      ),
    });
  }

  if (!("data" in envelope)) {
    throw new SwitchBotCliError({
      kind: "invalid-output",
      message: "SwitchBot CLIのJSONにdataがありません。",
      technicalDetails: sanitizeTechnicalDetails(raw),
    });
  }

  return envelope.data as T;
}
