import { Action, ActionPanel, Icon, Keyboard, List, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { asSwitchBotCliError, getCliErrorDescription, SwitchBotCliError } from "../lib/cli-errors";
import { getCommandHistory, sendIrRemoteCommand } from "../lib/switchbot-cli";
import { updateToastForCliFailure } from "../lib/toasts";
import { IrRemoteCommand, SwitchBotDevice } from "../lib/types";
import {
  formatIrCommand,
  formatIrLastSentAt,
  IrLastSentState,
  restoreIrLastSentState,
} from "../state/ir-command-history";
import DeviceDetail from "./DeviceDetail";
import TelevisionChannelForm from "./TelevisionChannelForm";

interface RemoteOperation {
  command: IrRemoteCommand;
  title: string;
  icon: Icon;
  shortcut?: Keyboard.Shortcut;
}

const ALT_UP: Keyboard.Shortcut = {
  macOS: { modifiers: ["opt"], key: "arrowUp" },
  Windows: { modifiers: ["alt"], key: "arrowUp" },
};
const ALT_DOWN: Keyboard.Shortcut = {
  macOS: { modifiers: ["opt"], key: "arrowDown" },
  Windows: { modifiers: ["alt"], key: "arrowDown" },
};
const ALT_RIGHT: Keyboard.Shortcut = {
  macOS: { modifiers: ["opt"], key: "arrowRight" },
  Windows: { modifiers: ["alt"], key: "arrowRight" },
};
const ALT_LEFT: Keyboard.Shortcut = {
  macOS: { modifiers: ["opt"], key: "arrowLeft" },
  Windows: { modifiers: ["alt"], key: "arrowLeft" },
};

const LIGHT_OPERATIONS: RemoteOperation[] = [
  { command: "turnOn", title: "ON", icon: Icon.LightBulb },
  { command: "turnOff", title: "OFF", icon: Icon.LightBulbOff },
  { command: "brightnessUp", title: "明るく", icon: Icon.Sun, shortcut: ALT_UP },
  { command: "brightnessDown", title: "暗く", icon: Icon.Moon, shortcut: ALT_DOWN },
];

const TV_OPERATIONS: RemoteOperation[] = [
  { command: "turnOn", title: "ON", icon: Icon.Power },
  { command: "turnOff", title: "OFF", icon: Icon.Power },
  { command: "volumeAdd", title: "音量＋", icon: Icon.SpeakerUp, shortcut: ALT_UP },
  { command: "volumeSub", title: "音量−", icon: Icon.SpeakerDown, shortcut: ALT_DOWN },
  { command: "channelAdd", title: "CH＋", icon: Icon.ArrowRight, shortcut: ALT_RIGHT },
  { command: "channelSub", title: "CH−", icon: Icon.ArrowLeft, shortcut: ALT_LEFT },
];

export default function InfraredRemoteActions({ device }: { device: SwitchBotDevice }) {
  const isTelevision = device.type === "TV";
  const operations = isTelevision ? TV_OPERATIONS : LIGHT_OPERATIONS;
  const [lastSentState, setLastSentState] = useState<IrLastSentState>({});
  const [historyError, setHistoryError] = useState<SwitchBotCliError>();
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const executingRef = useRef(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setHistoryError(undefined);
    try {
      const history = await getCommandHistory();
      setLastSentState(restoreIrLastSentState(history.entries, device.deviceId));
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
    async (command: IrRemoteCommand, parameter?: string): Promise<boolean> => {
      if (executingRef.current) return false;
      executingRef.current = true;
      setIsExecuting(true);
      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "IR信号を送信中",
        message: device.name,
      });

      try {
        await sendIrRemoteCommand(device.deviceId, command, parameter);
        const state = { command, parameter, lastSentAt: new Date().toISOString() } satisfies IrLastSentState;
        setLastSentState(state);
        toast.style = Toast.Style.Success;
        toast.title = "IR信号を送信しました";
        toast.message = formatIrCommand(state);
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
    [device.deviceId, device.name, loadHistory],
  );

  const stateMarkdown = [
    `# ${device.name}`,
    `## ${formatIrCommand(lastSentState)}`,
    `**送信日時**  ${formatIrLastSentAt(lastSentState.lastSentAt)}`,
    historyError ? `⚠️ 監査ログを取得できません  \n${getCliErrorDescription(historyError)}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  const renderStateDetail = () => <List.Item.Detail markdown={stateMarkdown} />;

  const renderAuxiliaryActions = () => (
    <>
      <Action
        title="履歴を再取得"
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

  const renderActionPanel = (primaryOperation?: RemoteOperation) => {
    const orderedOperations = primaryOperation
      ? [primaryOperation, ...operations.filter((operation) => operation.command !== primaryOperation.command)]
      : operations;
    return (
      <ActionPanel>
        {orderedOperations.map((operation) => (
          <Action
            key={operation.command}
            title={operation.title}
            icon={operation.icon}
            shortcut={operation.shortcut}
            onAction={() => void runCommand(operation.command)}
          />
        ))}
        {isTelevision ? (
          <Action.Push
            title="CH指定"
            icon={Icon.Hashtag}
            target={<TelevisionChannelForm onSubmit={(channel) => runCommand("SetChannel", channel)} />}
          />
        ) : null}
        {renderAuxiliaryActions()}
      </ActionPanel>
    );
  };

  return (
    <List
      isLoading={isLoading || isExecuting}
      isShowingDetail
      navigationTitle={device.name}
      searchBarPlaceholder="操作を選択"
    >
      <List.Section title="操作">
        {operations.map((operation) => (
          <List.Item
            key={operation.command}
            icon={operation.icon}
            title={operation.title}
            detail={renderStateDetail()}
            actions={renderActionPanel(operation)}
          />
        ))}
        {isTelevision ? (
          <List.Item
            icon={Icon.Hashtag}
            title="CH指定"
            subtitle="1〜999"
            detail={renderStateDetail()}
            actions={
              <ActionPanel>
                <Action.Push
                  title="CH指定"
                  icon={Icon.Hashtag}
                  target={<TelevisionChannelForm onSubmit={(channel) => runCommand("SetChannel", channel)} />}
                />
                {operations.map((operation) => (
                  <Action
                    key={operation.command}
                    title={operation.title}
                    icon={operation.icon}
                    shortcut={operation.shortcut}
                    onAction={() => void runCommand(operation.command)}
                  />
                ))}
                {renderAuxiliaryActions()}
              </ActionPanel>
            }
          />
        ) : null}
      </List.Section>
    </List>
  );
}
