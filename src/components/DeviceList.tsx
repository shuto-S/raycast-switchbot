import { Action, ActionPanel, Icon, Keyboard, List, LocalStorage } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { asSwitchBotCliError, getCliErrorDescription, SwitchBotCliError } from "../lib/cli-errors";
import { listDevices } from "../lib/switchbot-cli";
import { SwitchBotDevice } from "../lib/types";
import {
  LAST_OPENED_DEVICE_KEY,
  RECENTLY_OPENED_DEVICE_IDS_KEY,
  parseRecentlyOpenedDeviceIds,
  prioritizeRecentlyOpenedDevices,
  rememberRecentlyOpenedDevice,
} from "../state/device-order";
import AirConditionerActions from "./AirConditionerActions";
import DeviceDetail from "./DeviceDetail";

function isAirConditioner(device: SwitchBotDevice) {
  return device.category === "ir" && device.type === "Air Conditioner";
}

function getDeviceIcon(device: SwitchBotDevice) {
  if (isAirConditioner(device)) return Icon.Snowflake;
  if (device.category === "ir") return Icon.Switch;
  return Icon.House;
}

export default function DeviceList() {
  const [devices, setDevices] = useState<SwitchBotDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<SwitchBotCliError>();
  const recentDeviceIdsRef = useRef<string[]>([]);

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [listedDevices, storedRecentDeviceIds, lastOpenedDeviceId] = await Promise.all([
        listDevices(),
        LocalStorage.getItem<string>(RECENTLY_OPENED_DEVICE_IDS_KEY),
        LocalStorage.getItem<string>(LAST_OPENED_DEVICE_KEY),
      ]);
      const parsedRecentDeviceIds = parseRecentlyOpenedDeviceIds(storedRecentDeviceIds);
      const recentDeviceIds = lastOpenedDeviceId
        ? rememberRecentlyOpenedDevice(parsedRecentDeviceIds, lastOpenedDeviceId)
        : parsedRecentDeviceIds;
      recentDeviceIdsRef.current = recentDeviceIds;
      setDevices(prioritizeRecentlyOpenedDevices(listedDevices, recentDeviceIds));
      if (lastOpenedDeviceId && storedRecentDeviceIds === undefined) {
        void LocalStorage.setItem(RECENTLY_OPENED_DEVICE_IDS_KEY, JSON.stringify(recentDeviceIds));
      }
    } catch (loadError) {
      setDevices([]);
      setError(asSwitchBotCliError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const rememberOpenedDevice = useCallback((deviceId: string) => {
    const recentDeviceIds = rememberRecentlyOpenedDevice(recentDeviceIdsRef.current, deviceId);
    recentDeviceIdsRef.current = recentDeviceIds;
    setDevices((currentDevices) => prioritizeRecentlyOpenedDevices(currentDevices, recentDeviceIds));
    void LocalStorage.setItem(RECENTLY_OPENED_DEVICE_IDS_KEY, JSON.stringify(recentDeviceIds));
    void LocalStorage.setItem(LAST_OPENED_DEVICE_KEY, deviceId);
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="名前、種類、部屋、aliasで検索">
      {devices.map((device) => {
        const target = isAirConditioner(device) ? (
          <AirConditionerActions device={device} />
        ) : (
          <DeviceDetail device={device} />
        );
        const keywords = [device.name, device.type, device.roomName, device.alias].filter((value): value is string =>
          Boolean(value),
        );

        return (
          <List.Item
            key={device.deviceId}
            icon={getDeviceIcon(device)}
            title={device.name}
            subtitle={device.type}
            keywords={keywords}
            accessories={[
              { text: device.roomName ?? "部屋未設定" },
              { tag: device.category === "ir" ? "IR" : "Physical" },
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="デバイスを開く"
                  icon={Icon.ArrowRight}
                  target={target}
                  onPush={() => rememberOpenedDevice(device.deviceId)}
                />
                <Action.Push
                  title="デバイス詳細を表示"
                  icon={Icon.Info}
                  target={<DeviceDetail device={device} />}
                  onPush={() => rememberOpenedDevice(device.deviceId)}
                />
                <Action.CopyToClipboard title="デバイスIDをコピー" content={device.deviceId} />
                <Action
                  title="一覧を再取得"
                  icon={Icon.ArrowClockwise}
                  shortcut={Keyboard.Shortcut.Common.Refresh}
                  onAction={() => void loadDevices()}
                />
              </ActionPanel>
            }
          />
        );
      })}

      {!isLoading && devices.length === 0 ? (
        <List.EmptyView
          icon={error ? Icon.Warning : Icon.House}
          title={error ? "デバイスを取得できません" : "デバイスが見つかりません"}
          description={error ? getCliErrorDescription(error) : "SwitchBot CLIのデバイス一覧は空です。"}
          actions={
            <ActionPanel>
              <Action title="一覧を再取得" icon={Icon.ArrowClockwise} onAction={() => void loadDevices()} />
              {error ? <Action.CopyToClipboard title="エラー詳細をコピー" content={error.technicalDetails} /> : null}
            </ActionPanel>
          }
        />
      ) : null}
    </List>
  );
}
