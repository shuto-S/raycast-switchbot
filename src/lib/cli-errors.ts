export interface CliEnvelopeError {
  kind?: string;
  errorClass?: string;
  subKind?: string;
  code?: string | number;
  message?: string;
  hint?: string;
}

export class SwitchBotCliError extends Error {
  readonly kind: string;
  readonly hint?: string;
  readonly technicalDetails: string;

  constructor(options: { message: string; kind?: string; hint?: string; technicalDetails?: string }) {
    super(options.message);
    this.name = "SwitchBotCliError";
    this.kind = options.kind ?? "unknown";
    this.hint = options.hint;
    this.technicalDetails = options.technicalDetails ?? options.message;
  }

  get isAuthError() {
    return this.kind === "auth";
  }
}

export function sanitizeTechnicalDetails(value: string): string {
  return value
    .replace(/((?:authorization|token|secret|cookie|password)\s*[=:]\s*)[^\s,;]+/gi, "$1****")
    .slice(0, 8_000);
}

export function asSwitchBotCliError(error: unknown): SwitchBotCliError {
  if (error instanceof SwitchBotCliError) return error;

  const message = error instanceof Error ? error.message : String(error);
  return new SwitchBotCliError({ message, technicalDetails: sanitizeTechnicalDetails(message) });
}

export function getCliErrorDescription(error: SwitchBotCliError): string {
  if (error.isAuthError) {
    return "ターミナルで switchbot auth login を実行してください。Raycastには認証情報を保存しません。";
  }
  if (error.kind === "network") return "SwitchBot APIへ接続できません。ネットワーク接続を確認してください。";
  if (error.kind === "quota") return "SwitchBot APIの利用上限に達しています。時間をおいて再実行してください。";
  if (error.kind === "timeout") return "SwitchBot CLIが15秒以内に応答しませんでした。";
  if (error.kind === "configuration") return error.message;
  return error.hint ?? "エラー詳細をコピーして、CLIの状態を確認してください。";
}
