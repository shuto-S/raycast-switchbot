import { Clipboard, Toast } from "@raycast/api";
import { asSwitchBotCliError, getCliErrorDescription, SwitchBotCliError } from "./cli-errors";

export function updateToastForCliFailure(toast: Toast, error: unknown): SwitchBotCliError {
  const cliError = asSwitchBotCliError(error);
  toast.style = Toast.Style.Failure;
  toast.title = cliError.isAuthError ? "SwitchBot CLIの認証が必要です" : "SwitchBot CLIの実行に失敗しました";
  toast.message = getCliErrorDescription(cliError);
  toast.primaryAction = cliError.isAuthError
    ? {
        title: "認証コマンドをコピー",
        onAction: () => void Clipboard.copy("switchbot auth login"),
      }
    : {
        title: "エラー詳細をコピー",
        onAction: () => void Clipboard.copy(cliError.technicalDetails),
      };
  if (cliError.isAuthError) {
    toast.secondaryAction = {
      title: "エラー詳細をコピー",
      onAction: () => void Clipboard.copy(cliError.technicalDetails),
    };
  }
  return cliError;
}
