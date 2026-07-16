import { Cache, environment, Icon, launchCommand, LaunchType, LocalStorage, MenuBarExtra } from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { asSwitchBotCliError, getCliErrorDescription, SwitchBotCliError } from "./lib/cli-errors";
import { formatMenuBarDeviceStatus, MenuBarDeviceStatus } from "./lib/menu-bar-status";
import { describeDevice, getCommandHistory, listDevices } from "./lib/switchbot-cli";
import { SwitchBotDevice } from "./lib/types";
import {
  getAcSettingsStorageKey,
  mergeStoredAcSettings,
  parseStoredAcSettings,
  restoreAcLastSentState,
} from "./state/ac-command-history";
import { restoreIrLastSentState } from "./state/ir-command-history";
import {
  MENU_BAR_CACHE_KEY,
  MenuBarSnapshot,
  parseMenuBarSnapshot,
  shouldRefreshMenuBar,
} from "./state/menu-bar-cache";
import { MENU_BAR_ENABLED_KEY, shouldShowMenuBar } from "./state/menu-bar-settings";

const MENU_BAR_DEVICE_KEY = "menu-bar-device-id";
const menuBarCache = new Cache({ namespace: "switchbot-menu-bar" });
const initialSnapshot = parseMenuBarSnapshot(menuBarCache.get(MENU_BAR_CACHE_KEY));

function saveSnapshot(snapshot: MenuBarSnapshot) {
  menuBarCache.set(MENU_BAR_CACHE_KEY, JSON.stringify(snapshot));
}

function getDeviceIcon(device?: SwitchBotDevice) {
  if (!device) return Icon.Switch;
  if (device.category === "ir" && device.type === "Air Conditioner") return Icon.Snowflake;
  if (device.category === "ir" && device.type === "TV") return Icon.Monitor;
  if (device.category === "ir" && device.type === "Light") return Icon.LightBulb;
  if (device.type === "Hub 2") return Icon.Temperature;
  if (device.type.includes("Lock")) return Icon.Lock;
  if (device.type.includes("Doorbell")) return Icon.Video;
  return device.category === "ir" ? Icon.Switch : Icon.House;
}

async function loadDeviceStatus(device: SwitchBotDevice): Promise<MenuBarDeviceStatus> {
  if (device.category === "physical") {
    const description = await describeDevice(device.deviceId);
    return formatMenuBarDeviceStatus(device, { liveStatus: description.capabilities?.liveStatus });
  }

  const history = await getCommandHistory();
  if (device.type === "Air Conditioner") {
    const storedSettings = parseStoredAcSettings(
      await LocalStorage.getItem<string>(getAcSettingsStorageKey(device.deviceId)),
    );
    const state = mergeStoredAcSettings(restoreAcLastSentState(history.entries, device.deviceId), storedSettings);
    return formatMenuBarDeviceStatus(device, { acState: state });
  }
  return formatMenuBarDeviceStatus(device, { irState: restoreIrLastSentState(history.entries, device.deviceId) });
}

export default function SwitchBotMenuBar() {
  const [devices, setDevices] = useState<SwitchBotDevice[]>(initialSnapshot?.devices ?? []);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(initialSnapshot?.selectedDeviceId);
  const [status, setStatus] = useState<MenuBarDeviceStatus | undefined>(initialSnapshot?.status);
  const [error, setError] = useState<SwitchBotCliError>();
  const [isLoading, setIsLoading] = useState(
    environment.launchType === LaunchType.Background || initialSnapshot === undefined,
  );
  const [isEnabled, setIsEnabled] = useState(true);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId),
    [devices, selectedDeviceId],
  );

  const refreshStatus = useCallback(async (device: SwitchBotDevice, listedDevices: SwitchBotDevice[]) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const nextStatus = await loadDeviceStatus(device);
      setStatus(nextStatus);
      saveSnapshot({
        devices: listedDevices,
        selectedDeviceId: device.deviceId,
        status: nextStatus,
        updatedAt: Date.now(),
      });
    } catch (loadError) {
      setStatus((currentStatus) => currentStatus ?? formatMenuBarDeviceStatus(device));
      setError(asSwitchBotCliError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMenuBar = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const storedEnabled = await LocalStorage.getItem<boolean>(MENU_BAR_ENABLED_KEY);
      const isUserInitiated = environment.launchType === LaunchType.UserInitiated;
      if (!shouldShowMenuBar(storedEnabled, isUserInitiated)) {
        setIsEnabled(false);
        setIsLoading(false);
        return;
      }
      setIsEnabled(true);
      if (isUserInitiated && storedEnabled === false) await LocalStorage.setItem(MENU_BAR_ENABLED_KEY, true);
      if (!shouldRefreshMenuBar(initialSnapshot !== undefined, environment.launchType === LaunchType.Background)) {
        setIsLoading(false);
        return;
      }

      const [listedDevices, storedDeviceId] = await Promise.all([
        listDevices(),
        LocalStorage.getItem<string>(MENU_BAR_DEVICE_KEY),
      ]);
      const device =
        listedDevices.find((candidate) => candidate.deviceId === storedDeviceId) ??
        listedDevices.find((candidate) => candidate.type === "Hub 2") ??
        listedDevices[0];
      setDevices(listedDevices);
      setSelectedDeviceId(device?.deviceId);
      if (!device) {
        setStatus(undefined);
        saveSnapshot({ devices: listedDevices, updatedAt: Date.now() });
        setIsLoading(false);
        return;
      }
      if (device.deviceId !== storedDeviceId) await LocalStorage.setItem(MENU_BAR_DEVICE_KEY, device.deviceId);
      await refreshStatus(device, listedDevices);
    } catch (loadError) {
      setDevices([]);
      setStatus(undefined);
      setError(asSwitchBotCliError(loadError));
      setIsLoading(false);
    }
  }, [refreshStatus]);

  useEffect(() => {
    void loadMenuBar();
  }, [loadMenuBar]);

  const selectDevice = useCallback(
    async (device: SwitchBotDevice) => {
      const nextStatus = formatMenuBarDeviceStatus(device);
      setSelectedDeviceId(device.deviceId);
      setStatus(nextStatus);
      saveSnapshot({ devices, selectedDeviceId: device.deviceId, status: nextStatus, updatedAt: Date.now() });
      await LocalStorage.setItem(MENU_BAR_DEVICE_KEY, device.deviceId);
      await refreshStatus(device, devices);
    },
    [devices, refreshStatus],
  );

  const disableMenuBar = useCallback(async () => {
    await LocalStorage.setItem(MENU_BAR_ENABLED_KEY, false);
    setIsEnabled(false);
  }, []);

  if (!isEnabled) return null;

  return (
    <MenuBarExtra
      icon={error ? Icon.Warning : getDeviceIcon(selectedDevice)}
      title={status?.title ?? selectedDevice?.name ?? "SwitchBot"}
      tooltip={selectedDevice?.name ?? "SwitchBot"}
      isLoading={isLoading}
    >
      {selectedDevice && status ? (
        <MenuBarExtra.Section title={selectedDevice.name}>
          {status.items.map((item) => (
            <MenuBarExtra.Item key={item.title} title={item.title} subtitle={item.value} />
          ))}
        </MenuBarExtra.Section>
      ) : null}

      {error ? (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title="取得できません" subtitle={getCliErrorDescription(error)} />
        </MenuBarExtra.Section>
      ) : null}

      <MenuBarExtra.Section>
        <MenuBarExtra.Submenu title="表示デバイス" icon={Icon.Gear}>
          {devices.map((device) => (
            <MenuBarExtra.Item
              key={device.deviceId}
              icon={device.deviceId === selectedDeviceId ? Icon.Checkmark : getDeviceIcon(device)}
              title={device.name}
              subtitle={[device.type, device.roomName].filter(Boolean).join(" · ")}
              onAction={() => void selectDevice(device)}
            />
          ))}
        </MenuBarExtra.Submenu>
        {selectedDevice ? (
          <MenuBarExtra.Item
            title="再取得"
            icon={Icon.ArrowClockwise}
            onAction={() => void refreshStatus(selectedDevice, devices)}
          />
        ) : null}
        <MenuBarExtra.Item
          title="SwitchBotを開く"
          icon={Icon.AppWindow}
          onAction={() => void launchCommand({ name: "switchbot", type: LaunchType.UserInitiated })}
        />
        <MenuBarExtra.Item title="メニューバーをOFF" icon={Icon.EyeDisabled} onAction={() => void disableMenuBar()} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
