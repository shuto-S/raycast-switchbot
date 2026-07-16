import type { SwitchBotDevice } from "../lib/types.ts";

export const LAST_OPENED_DEVICE_KEY = "last-opened-device-id";
export const RECENTLY_OPENED_DEVICE_IDS_KEY = "recently-opened-device-ids";

export function parseRecentlyOpenedDeviceIds(value?: string): string[] {
  if (!value) return [];

  try {
    const deviceIds = JSON.parse(value) as unknown;
    if (!Array.isArray(deviceIds)) return [];
    return deviceIds.filter((deviceId): deviceId is string => typeof deviceId === "string" && deviceId.length > 0);
  } catch {
    return [];
  }
}

export function rememberRecentlyOpenedDevice(recentDeviceIds: string[], deviceId: string): string[] {
  return [deviceId, ...recentDeviceIds.filter((recentDeviceId) => recentDeviceId !== deviceId)];
}

export function prioritizeRecentlyOpenedDevices(
  devices: SwitchBotDevice[],
  recentDeviceIds: string[],
): SwitchBotDevice[] {
  if (recentDeviceIds.length === 0) return devices;

  const deviceById = new Map(devices.map((device) => [device.deviceId, device]));
  const seen = new Set<string>();
  const recentDevices = recentDeviceIds.flatMap((deviceId) => {
    const device = deviceById.get(deviceId);
    if (!device || seen.has(deviceId)) return [];
    seen.add(deviceId);
    return [device];
  });
  if (recentDevices.length === 0) return devices;
  return [...recentDevices, ...devices.filter((device) => !seen.has(device.deviceId))];
}
