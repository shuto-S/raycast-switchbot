import { AC_FAN_LABELS, AC_MODE_LABELS, formatLastSentAt, type AcLastSentState } from "../state/ac-command-history.ts";
import { formatIrCommand, formatIrLastSentAt, type IrLastSentState } from "../state/ir-command-history.ts";
import type { SwitchBotDevice } from "./types.ts";

export interface MenuBarStatusItem {
  title: string;
  value: string;
}

export interface MenuBarDeviceStatus {
  title: string;
  items: MenuBarStatusItem[];
}

interface StatusOptions {
  liveStatus?: Record<string, unknown>;
  acState?: AcLastSentState;
  irState?: IrLastSentState;
}

const LIVE_STATUS_LABELS: Record<string, string> = {
  battery: "バッテリー",
  version: "ファームウェア",
  lockState: "ロック状態",
  doorState: "ドア状態",
  temperature: "温度",
  humidity: "湿度",
  lightLevel: "照度",
};

const LIVE_STATUS_ORDER = ["temperature", "humidity", "lightLevel", "battery", "lockState", "doorState", "version"];
const HIDDEN_LIVE_STATUS_KEYS = new Set(["deviceId", "deviceType", "hubDeviceId", "error"]);

function formatLiveStatusValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (key === "temperature" && typeof value === "number") return `${value}℃`;
  if ((key === "humidity" || key === "battery") && typeof value === "number") return `${value}%`;
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatLiveStatus(liveStatus?: Record<string, unknown>): MenuBarStatusItem[] {
  if (!liveStatus) return [];
  return Object.entries(liveStatus)
    .filter(([key, value]) => !HIDDEN_LIVE_STATUS_KEYS.has(key) && value !== undefined)
    .sort(([a], [b]) => {
      const aIndex = LIVE_STATUS_ORDER.indexOf(a);
      const bIndex = LIVE_STATUS_ORDER.indexOf(b);
      return (aIndex === -1 ? LIVE_STATUS_ORDER.length : aIndex) - (bIndex === -1 ? LIVE_STATUS_ORDER.length : bIndex);
    })
    .map(([key, value]) => ({ title: LIVE_STATUS_LABELS[key] ?? key, value: formatLiveStatusValue(key, value) }));
}

function formatAcStatus(device: SwitchBotDevice, state: AcLastSentState = {}): MenuBarDeviceStatus {
  const mode = state.mode ? AC_MODE_LABELS[state.mode] : undefined;
  const temperature = state.temperature === undefined ? undefined : `${state.temperature}℃`;
  const title =
    state.power === "off"
      ? "OFF"
      : [mode, temperature].filter(Boolean).join(" ") || (state.power === "on" ? "ON" : device.name);

  return {
    title,
    items: [
      { title: "電源", value: state.power?.toUpperCase() ?? "—" },
      { title: "設定温度", value: temperature ?? "—" },
      { title: "モード", value: mode ?? "—" },
      { title: "風量", value: state.fan ? AC_FAN_LABELS[state.fan] : "—" },
      { title: "送信日時", value: formatLastSentAt(state.lastSentAt) },
    ],
  };
}

function formatIrStatus(device: SwitchBotDevice, state: IrLastSentState = {}): MenuBarDeviceStatus {
  const command = formatIrCommand(state);
  return {
    title: command === "—" ? device.name : command,
    items: [
      { title: "操作", value: command },
      { title: "送信日時", value: formatIrLastSentAt(state.lastSentAt) },
    ],
  };
}

export function formatMenuBarDeviceStatus(
  device: SwitchBotDevice,
  { liveStatus, acState, irState }: StatusOptions = {},
): MenuBarDeviceStatus {
  if (device.category === "ir" && device.type === "Air Conditioner") return formatAcStatus(device, acState);
  if (device.category === "ir") return formatIrStatus(device, irState);

  const items = formatLiveStatus(liveStatus);
  if (device.type === "Hub 2") {
    const temperature = items.find((item) => item.title === "温度")?.value;
    const humidity = items.find((item) => item.title === "湿度")?.value;
    return {
      title: [temperature, humidity].filter(Boolean).join(" ") || device.name,
      items: items.length > 0 ? items : [{ title: "状態", value: "—" }],
    };
  }

  const battery = items.find((item) => item.title === "バッテリー")?.value;
  return {
    title: battery ?? device.name,
    items: items.length > 0 ? items : [{ title: "状態", value: "—" }],
  };
}
