import { Action, ActionPanel, Icon, Keyboard, List, LocalStorage, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { asSwitchBotCliError, getCliErrorDescription, SwitchBotCliError } from "../lib/cli-errors";
import { getCommandHistory, sendAcPower, sendAcSettings } from "../lib/switchbot-cli";
import { updateToastForCliFailure } from "../lib/toasts";
import { AcSettings, SwitchBotDevice } from "../lib/types";
import {
  AC_FAN_LABELS,
  AC_MODE_LABELS,
  DEFAULT_AC_SETTINGS,
  AcLastSentState,
  adjustAcLastSentTemperature,
  formatLastSentAt,
  getAcSettingsStorageKey,
  mergeStoredAcSettings,
  parseStoredAcSettings,
  restoreAcLastSentState,
} from "../state/ac-command-history";
import AirConditionerForm from "./AirConditionerForm";
import DeviceDetail from "./DeviceDetail";

export default function AirConditionerActions({ device }: { device: SwitchBotDevice }) {
  const [lastSentState, setLastSentState] = useState<AcLastSentState>({});
  const [historyError, setHistoryError] = useState<SwitchBotCliError>();
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const executingRef = useRef(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setHistoryError(undefined);
    try {
      const storedSettingsValue = await LocalStorage.getItem<string>(getAcSettingsStorageKey(device.deviceId)).catch(
        () => undefined,
      );
      const history = await getCommandHistory();
      const historyState = restoreAcLastSentState(history.entries, device.deviceId);
      const state = mergeStoredAcSettings(historyState, parseStoredAcSettings(storedSettingsValue));
      setLastSentState(state);

      if (historyState.temperature !== undefined && historyState.mode && historyState.fan) {
        void LocalStorage.setItem(
          getAcSettingsStorageKey(device.deviceId),
          JSON.stringify({
            temperature: historyState.temperature,
            mode: historyState.mode,
            fan: historyState.fan,
          } satisfies AcSettings),
        ).catch(() => undefined);
      }
    } catch (loadError) {
      setHistoryError(asSwitchBotCliError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [device.deviceId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const runCommand = useCallback(
    async (
      command: () => Promise<unknown>,
      successMessage: string,
      onSuccess?: () => Promise<void>,
    ): Promise<boolean> => {
      if (executingRef.current) return false;
      executingRef.current = true;
      setIsExecuting(true);
      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "IR信号を送信中",
        message: device.name,
      });

      try {
        await command();
        toast.style = Toast.Style.Success;
        toast.title = "IR信号を送信しました";
        toast.message = successMessage;
        await onSuccess?.().catch(() => undefined);
        await loadHistory();
        return true;
      } catch (commandError) {
        updateToastForCliFailure(toast, commandError);
        return false;
      } finally {
        executingRef.current = false;
        setIsExecuting(false);
      }
    },
    [device.name, loadHistory],
  );

  const runSettings = useCallback(
    (settings: AcSettings) =>
      runCommand(
        () => sendAcSettings(device.deviceId, settings),
        `${AC_MODE_LABELS[settings.mode]} ${settings.temperature}℃ / 風量 ${AC_FAN_LABELS[settings.fan]}`,
        async () => {
          setLastSentState((state) => ({
            ...state,
            power: "on",
            ...settings,
            lastSentAt: new Date().toISOString(),
          }));
          await LocalStorage.setItem(getAcSettingsStorageKey(device.deviceId), JSON.stringify(settings));
        },
      ),
    [device.deviceId, runCommand],
  );

  async function runPreviousSettings() {
    const { temperature, mode, fan } = lastSentState;
    if (temperature === undefined || !mode || !fan) {
      await showToast({
        style: Toast.Style.Failure,
        title: "前回の設定が見つかりません",
        message: "運転内容を設定して一度IR信号を送信してください。",
      });
      return;
    }
    await runSettings({ temperature, mode, fan });
  }

  async function adjustTemperature(delta: -1 | 1) {
    const settings = adjustAcLastSentTemperature(lastSentState, delta);
    if (!settings) {
      await showToast({
        style: Toast.Style.Failure,
        title: "温度範囲を超えます",
        message: "設定温度は16〜30℃です。",
      });
      return;
    }
    await runSettings(settings);
  }

  const temperature = lastSentState.temperature;
  const adjustmentBaseTemperature = temperature ?? DEFAULT_AC_SETTINGS.temperature;
  const hasPreviousSettings = temperature !== undefined && lastSentState.mode && lastSentState.fan;
  const stateMarkdown = [
    `# ${device.name}`,
    `## ${temperature === undefined ? "—" : `${temperature}℃`}`,
    [
      lastSentState.power ? `電源 ${lastSentState.power.toUpperCase()}` : "電源 不明",
      lastSentState.mode ? AC_MODE_LABELS[lastSentState.mode] : "モード —",
      lastSentState.fan ? `風量 ${AC_FAN_LABELS[lastSentState.fan]}` : "風量 —",
    ].join("  ·  "),
    `**送信日時**  ${formatLastSentAt(lastSentState.lastSentAt)}`,
    "> 最終送信値・実機未確認",
    historyError ? `⚠️ 監査ログを取得できません  \n${getCliErrorDescription(historyError)}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  const renderStateDetail = () => <List.Item.Detail markdown={stateMarkdown} />;
  const renderTemperatureAction = (delta: -1 | 1, withShortcut = true) => (
    <Action
      title={`1℃${delta === 1 ? "上げる" : "下げる"}`}
      icon={delta === 1 ? Icon.ArrowUp : Icon.ArrowDown}
      shortcut={
        withShortcut
          ? {
              macOS: { modifiers: ["opt"], key: delta === 1 ? "arrowUp" : "arrowDown" },
              Windows: { modifiers: ["alt"], key: delta === 1 ? "arrowUp" : "arrowDown" },
            }
          : undefined
      }
      onAction={() => void adjustTemperature(delta)}
    />
  );
  const auxiliaryActions = (
    <>
      <Action
        title="状態を再取得"
        icon={Icon.ArrowClockwise}
        shortcut={Keyboard.Shortcut.Common.Refresh}
        onAction={() => void loadHistory()}
      />
      <Action.Push title="デバイス情報" icon={Icon.Info} target={<DeviceDetail device={device} />} />
      <Action.CopyToClipboard title="IDをコピー" content={device.deviceId} />
      {historyError ? (
        <Action.CopyToClipboard title="履歴エラーの詳細をコピー" content={historyError.technicalDetails} />
      ) : null}
    </>
  );

  return (
    <List
      isLoading={isLoading || isExecuting}
      isShowingDetail
      navigationTitle={device.name}
      searchBarPlaceholder="操作を選択"
    >
      <List.Section title="操作" subtitle="右側は最終送信値・実機未確認">
        <List.Item
          icon={Icon.Power}
          title="ON"
          subtitle="IR信号を送信"
          detail={renderStateDetail()}
          actions={
            <ActionPanel>
              <Action
                title="ON"
                icon={Icon.Power}
                onAction={() => void runCommand(() => sendAcPower(device.deviceId, "on"), "ON信号")}
              />
              {renderTemperatureAction(1)}
              {renderTemperatureAction(-1)}
              {auxiliaryActions}
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Power}
          title="OFF"
          subtitle="IR信号を送信"
          detail={renderStateDetail()}
          actions={
            <ActionPanel>
              <Action
                title="OFF"
                icon={Icon.Power}
                onAction={() => void runCommand(() => sendAcPower(device.deviceId, "off"), "OFF信号")}
              />
              {renderTemperatureAction(1)}
              {renderTemperatureAction(-1)}
              {auxiliaryActions}
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.ArrowUp}
          title="1℃上げる"
          subtitle={`${adjustmentBaseTemperature}℃ → ${Math.min(30, adjustmentBaseTemperature + 1)}℃${temperature === undefined ? "（初期値）" : ""}`}
          detail={renderStateDetail()}
          actions={
            <ActionPanel>
              {renderTemperatureAction(1, false)}
              {renderTemperatureAction(-1)}
              {auxiliaryActions}
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.ArrowDown}
          title="1℃下げる"
          subtitle={`${adjustmentBaseTemperature}℃ → ${Math.max(16, adjustmentBaseTemperature - 1)}℃${temperature === undefined ? "（初期値）" : ""}`}
          detail={renderStateDetail()}
          actions={
            <ActionPanel>
              {renderTemperatureAction(-1, false)}
              {renderTemperatureAction(1)}
              {auxiliaryActions}
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Snowflake}
          title="運転設定"
          subtitle="モード、温度、風量を選択"
          detail={renderStateDetail()}
          actions={
            <ActionPanel>
              <Action.Push
                title="運転設定"
                icon={Icon.Snowflake}
                target={<AirConditionerForm onSubmit={runSettings} />}
              />
              {renderTemperatureAction(1)}
              {renderTemperatureAction(-1)}
              {auxiliaryActions}
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.ArrowClockwise}
          title="前回設定で運転"
          subtitle={
            hasPreviousSettings
              ? `${AC_MODE_LABELS[lastSentState.mode!]} ${temperature}℃ / 風量 ${AC_FAN_LABELS[lastSentState.fan!]}`
              : "前回設定なし"
          }
          detail={renderStateDetail()}
          actions={
            <ActionPanel>
              <Action title="前回設定で運転" icon={Icon.ArrowClockwise} onAction={() => void runPreviousSettings()} />
              {renderTemperatureAction(1)}
              {renderTemperatureAction(-1)}
              {auxiliaryActions}
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="情報">
        <List.Item
          icon={Icon.Info}
          title="デバイス情報"
          detail={renderStateDetail()}
          actions={
            <ActionPanel>
              <Action.Push title="デバイス情報" icon={Icon.Info} target={<DeviceDetail device={device} />} />
              {renderTemperatureAction(1)}
              {renderTemperatureAction(-1)}
              {auxiliaryActions}
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
