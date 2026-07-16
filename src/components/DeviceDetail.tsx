import { Action, ActionPanel, Detail, Icon, Keyboard } from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { asSwitchBotCliError, SwitchBotCliError } from "../lib/cli-errors";
import { describeDevice } from "../lib/switchbot-cli";
import { DeviceDescription, SwitchBotDevice } from "../lib/types";

const STATUS_LABELS: Record<string, string> = {
  battery: "バッテリー",
  version: "ファームウェア",
  lockState: "ロック状態",
  doorState: "ドア状態",
  temperature: "温度",
  humidity: "湿度",
  lightLevel: "照度",
};

function formatStatusValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (key === "temperature" && typeof value === "number") return `${value}℃`;
  if (key === "humidity" && typeof value === "number") return `${value}%`;
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function DeviceDetail({ device }: { device: SwitchBotDevice }) {
  const [description, setDescription] = useState<DeviceDescription>();
  const [error, setError] = useState<SwitchBotCliError>();
  const [isLoading, setIsLoading] = useState(device.category === "physical");

  const loadDescription = useCallback(async () => {
    if (device.category === "ir") return;
    setIsLoading(true);
    setError(undefined);
    try {
      setDescription(await describeDevice(device.deviceId));
    } catch (loadError) {
      setError(asSwitchBotCliError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [device.category, device.deviceId]);

  useEffect(() => {
    void loadDescription();
  }, [loadDescription]);

  const liveStatus = description?.capabilities?.liveStatus;
  const liveStatusEntries = useMemo(
    () => Object.entries(liveStatus ?? {}).filter(([key]) => !["deviceId", "deviceType", "hubDeviceId"].includes(key)),
    [liveStatus],
  );

  const markdown = [
    `# ${device.name}`,
    description?.catalog?.description,
    error ? "状態と詳細を取得できませんでした。基本情報のみ表示しています。" : undefined,
    device.category === "ir" ? "> 赤外線デバイスの実機状態は取得できません。" : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="デバイス名" text={device.name} />
          <Detail.Metadata.Label title="種類" text={device.type} />
          <Detail.Metadata.Label title="部屋" text={device.roomName ?? "—"} />
          <Detail.Metadata.Label title="区分" text={device.category === "ir" ? "IR" : "Physical"} />
          {device.alias ? <Detail.Metadata.Label title="Alias" text={device.alias} /> : null}
          <Detail.Metadata.Separator />
          {device.category === "ir" ? (
            <>
              <Detail.Metadata.Label title="接続Hub" text={device.hubName ?? "—"} />
              <Detail.Metadata.Label title="制御方式" text="赤外線" />
              <Detail.Metadata.Label title="状態取得" text="非対応" />
            </>
          ) : (
            <>
              <Detail.Metadata.Label title="制御方式" text="SwitchBot CLI" />
              <Detail.Metadata.Label
                title="Cloudサービス"
                text={device.enableCloudService === false ? "無効" : "有効"}
              />
              <Detail.Metadata.Label
                title="状態取得"
                text={error ? "取得失敗" : liveStatusEntries.length > 0 ? "対応" : "取得値なし"}
              />
              {liveStatusEntries.map(([key, value]) => (
                <Detail.Metadata.Label
                  key={key}
                  title={STATUS_LABELS[key] ?? key}
                  text={formatStatusValue(key, value)}
                />
              ))}
            </>
          )}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="デバイスID" text={device.deviceId} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="デバイスIDをコピー" content={device.deviceId} />
          {device.category === "physical" ? (
            <Action
              title="状態と詳細を再取得"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={() => void loadDescription()}
            />
          ) : null}
          {error ? <Action.CopyToClipboard title="エラー詳細をコピー" content={error.technicalDetails} /> : null}
        </ActionPanel>
      }
    />
  );
}
