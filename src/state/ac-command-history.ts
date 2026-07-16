import type { AcFan, AcMode, AcSettings, AuditEntry } from "../lib/types.ts";

export interface AcLastSentState {
  power?: "on" | "off";
  temperature?: number;
  mode?: AcMode;
  fan?: AcFan;
  lastSentAt?: string;
}

const MODE_BY_WIRE_VALUE: Record<string, AcMode> = {
  "1": "auto",
  "2": "cool",
  "3": "dry",
  "4": "fan",
  "5": "heat",
  auto: "auto",
  cool: "cool",
  dry: "dry",
  fan: "fan",
  heat: "heat",
};

const FAN_BY_WIRE_VALUE: Record<string, AcFan> = {
  "1": "auto",
  "2": "low",
  "3": "mid",
  "4": "high",
  auto: "auto",
  low: "low",
  mid: "mid",
  high: "high",
};

export const AC_MODE_LABELS: Record<AcMode, string> = {
  auto: "自動",
  cool: "冷房",
  dry: "除湿",
  fan: "送風",
  heat: "暖房",
};

export const AC_FAN_LABELS: Record<AcFan, string> = {
  auto: "自動",
  low: "弱",
  mid: "中",
  high: "強",
};

export const DEFAULT_AC_SETTINGS: AcSettings = {
  temperature: 26,
  mode: "cool",
  fan: "auto",
};

export const AC_SETTINGS_STORAGE_KEY_PREFIX = "ac-last-settings:";

export function getAcSettingsStorageKey(deviceId: string): string {
  return `${AC_SETTINGS_STORAGE_KEY_PREFIX}${deviceId}`;
}

export function parseStoredAcSettings(value?: string): AcSettings | undefined {
  if (!value) return undefined;

  try {
    const settings = JSON.parse(value) as Partial<AcSettings>;
    if (!Number.isInteger(settings.temperature) || settings.temperature! < 16 || settings.temperature! > 30) {
      return undefined;
    }
    if (!settings.mode || !Object.hasOwn(AC_MODE_LABELS, settings.mode)) return undefined;
    if (!settings.fan || !Object.hasOwn(AC_FAN_LABELS, settings.fan)) return undefined;
    return settings as AcSettings;
  } catch {
    return undefined;
  }
}

export function mergeStoredAcSettings(state: AcLastSentState, settings?: AcSettings): AcLastSentState {
  if (!settings) return state;
  return {
    ...state,
    temperature: state.temperature ?? settings.temperature,
    mode: state.mode ?? settings.mode,
    fan: state.fan ?? settings.fan,
  };
}

function parseSetAllParameter(parameter: unknown): Omit<Required<AcLastSentState>, "lastSentAt"> | undefined {
  if (typeof parameter !== "string") return undefined;
  const [temperatureValue, modeValue, fanValue, powerValue] = parameter.split(",").map((value) => value.trim());
  const temperature = Number(temperatureValue);
  const mode = MODE_BY_WIRE_VALUE[modeValue?.toLowerCase()];
  const fan = FAN_BY_WIRE_VALUE[fanValue?.toLowerCase()];
  const power = powerValue?.toLowerCase();

  if (!Number.isInteger(temperature) || temperature < 16 || temperature > 30) return undefined;
  if (!mode || !fan || (power !== "on" && power !== "off")) return undefined;
  return { temperature, mode, fan, power };
}

export function restoreAcLastSentState(entries: AuditEntry[], deviceId: string): AcLastSentState {
  const state: AcLastSentState = {};
  const successfulEntries = entries
    .filter((entry) => entry.deviceId === deviceId && entry.result === "ok" && !entry.dryRun)
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

  for (const entry of successfulEntries) {
    if (entry.command === "setAll") {
      const settings = parseSetAllParameter(entry.parameter);
      if (!settings) continue;
      Object.assign(state, settings, { lastSentAt: entry.t });
    } else if (entry.command === "turnOn") {
      state.power = "on";
      state.lastSentAt = entry.t;
    } else if (entry.command === "turnOff") {
      state.power = "off";
      state.lastSentAt = entry.t;
    }
  }

  return state;
}

export function adjustAcLastSentTemperature(state: AcLastSentState, delta: -1 | 1): AcSettings | undefined {
  const temperature = state.temperature ?? DEFAULT_AC_SETTINGS.temperature;
  const mode = state.mode ?? DEFAULT_AC_SETTINGS.mode;
  const fan = state.fan ?? DEFAULT_AC_SETTINGS.fan;

  const adjustedTemperature = temperature + delta;
  if (adjustedTemperature < 16 || adjustedTemperature > 30) return undefined;
  return { temperature: adjustedTemperature, mode, fan };
}

export function formatLastSentAt(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
