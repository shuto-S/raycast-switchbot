import { Action, ActionPanel, Detail, Icon, Keyboard } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { asSwitchBotCliError, getCliErrorDescription, SwitchBotCliError } from "../lib/cli-errors";
import { describeDevice } from "../lib/switchbot-cli";
import { DeviceDescription, SwitchBotDevice } from "../lib/types";

function numberValue(status: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = status?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(status: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = status?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function formatUpdatedAt(value?: Date): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

export default function Hub2Dashboard({ device }: { device: SwitchBotDevice }) {
  const [description, setDescription] = useState<DeviceDescription>();
  const [error, setError] = useState<SwitchBotCliError>();
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const [isLoading, setIsLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    setDescription(undefined);
    setUpdatedAt(undefined);
    try {
      const nextDescription = await describeDevice(device.deviceId);
      const liveError = nextDescription.capabilities?.liveStatus?.error;
      if (liveError) throw new Error(String(liveError));
      setDescription(nextDescription);
      setUpdatedAt(new Date());
    } catch (loadError) {
      setError(asSwitchBotCliError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [device.deviceId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const status = description?.capabilities?.liveStatus;
  const temperature = numberValue(status, "temperature");
  const humidity = numberValue(status, "humidity");
  const lightLevel = numberValue(status, "lightLevel");
  const version = stringValue(status, "version");
  const markdown = [
    `# ${device.name}`,
    temperature === undefined ? "## —" : `## ${temperature}℃`,
    [`湿度 **${humidity === undefined ? "—" : `${humidity}%`}**`, `照度 **${lightLevel ?? "—"}**`].join("  ·  "),
    error ? `⚠️ 現在値を取得できません  \n${getCliErrorDescription(error)}` : "> SwitchBot APIから取得した現在値",
  ].join("\n\n");

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={device.name}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="温度" text={temperature === undefined ? "—" : `${temperature}℃`} />
          <Detail.Metadata.Label title="湿度" text={humidity === undefined ? "—" : `${humidity}%`} />
          <Detail.Metadata.Label title="照度" text={lightLevel === undefined ? "—" : String(lightLevel)} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="取得日時" text={formatUpdatedAt(updatedAt)} />
          <Detail.Metadata.Label title="部屋" text={device.roomName ?? "—"} />
          <Detail.Metadata.Label title="ファームウェア" text={version ?? "—"} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="デバイスID" text={device.deviceId} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action
            title="現在値を再取得"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={() => void loadStatus()}
          />
          <Action.CopyToClipboard title="IDをコピー" content={device.deviceId} />
          {error ? <Action.CopyToClipboard title="エラー詳細をコピー" content={error.technicalDetails} /> : null}
        </ActionPanel>
      }
    />
  );
}
