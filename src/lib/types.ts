export type DeviceCategory = "physical" | "ir";

export interface SwitchBotDevice {
  deviceId: string;
  name: string;
  type: string;
  category: DeviceCategory;
  roomName?: string;
  hubDeviceId?: string;
  hubName?: string;
  alias?: string;
  enableCloudService?: boolean;
  raw: Record<string, unknown>;
}

export interface PhysicalDeviceRecord extends Record<string, unknown> {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  enableCloudService?: boolean;
  hubDeviceId?: string;
  roomName?: string;
}

export interface InfraredDeviceRecord extends Record<string, unknown> {
  deviceId: string;
  deviceName: string;
  remoteType: string;
  hubDeviceId?: string;
}

export interface DeviceListData {
  deviceList: PhysicalDeviceRecord[];
  infraredRemoteList: InfraredDeviceRecord[];
}

export interface DeviceMetadataRecord {
  deviceId: string;
  alias?: string;
  hidden?: boolean;
  notes?: string;
}

export interface DeviceDescription {
  device: Record<string, unknown>;
  controlType?: string;
  catalog?: {
    type?: string;
    category?: DeviceCategory;
    description?: string;
    role?: string;
    readOnly?: boolean;
    commands?: unknown[];
    statusFields?: string[];
  };
  capabilities?: {
    role?: string;
    readOnly?: boolean;
    commands?: unknown[];
    statusFields?: string[];
    liveStatus?: Record<string, unknown>;
  };
  source?: string;
}

export interface AuditEntry {
  t: string;
  kind?: string;
  deviceId: string;
  command: string;
  parameter?: unknown;
  commandType?: string;
  dryRun?: boolean;
  result: "ok" | "error" | "dry-run" | string;
  error?: string;
}

export interface HistoryData {
  file: string;
  total: number;
  entries: AuditEntry[];
}

export type IrRemoteCommand =
  | "turnOn"
  | "turnOff"
  | "brightnessUp"
  | "brightnessDown"
  | "volumeAdd"
  | "volumeSub"
  | "channelAdd"
  | "channelSub"
  | "SetChannel";

export type AcMode = "auto" | "cool" | "dry" | "fan" | "heat";
export type AcFan = "auto" | "low" | "mid" | "high";

export interface AcSettings {
  temperature: number;
  mode: AcMode;
  fan: AcFan;
}
