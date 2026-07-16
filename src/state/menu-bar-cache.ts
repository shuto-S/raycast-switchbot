import type { MenuBarDeviceStatus } from "../lib/menu-bar-status.ts";
import type { SwitchBotDevice } from "../lib/types.ts";

export const MENU_BAR_CACHE_KEY = "snapshot";

export interface MenuBarSnapshot {
  devices: SwitchBotDevice[];
  selectedDeviceId?: string;
  status?: MenuBarDeviceStatus;
  updatedAt: number;
}

export function parseMenuBarSnapshot(value?: string): MenuBarSnapshot | undefined {
  if (!value) return undefined;
  try {
    const snapshot = JSON.parse(value) as Partial<MenuBarSnapshot>;
    if (!Array.isArray(snapshot.devices) || typeof snapshot.updatedAt !== "number") return undefined;
    if (snapshot.selectedDeviceId !== undefined && typeof snapshot.selectedDeviceId !== "string") return undefined;
    if (snapshot.status !== undefined && typeof snapshot.status.title !== "string") return undefined;
    return snapshot as MenuBarSnapshot;
  } catch {
    return undefined;
  }
}

export function shouldRefreshMenuBar(hasCachedSnapshot: boolean, isBackgroundLaunch: boolean): boolean {
  return isBackgroundLaunch || !hasCachedSnapshot;
}
