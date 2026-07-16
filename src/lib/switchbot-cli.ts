import { execFile } from "node:child_process";
import path from "node:path";
import { getPreferenceValues } from "@raycast/api";
import { parseCliEnvelope } from "./cli-response";
import { sanitizeTechnicalDetails, SwitchBotCliError } from "./cli-errors";
import {
  AcSettings,
  DeviceDescription,
  DeviceListData,
  DeviceMetadataRecord,
  HistoryData,
  IrRemoteCommand,
  SwitchBotDevice,
} from "./types";

const DEFAULT_CLI_PATH = "/opt/homebrew/bin/switchbot";
const CLI_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 1_024 * 1_024;

interface Preferences {
  cliPath: string;
}

interface ExecFileError extends Error {
  code?: string | number;
  signal?: NodeJS.Signals;
  killed?: boolean;
}

function getCliPath(): string {
  const preferences = getPreferenceValues<Preferences>();
  const cliPath = preferences.cliPath?.trim() || DEFAULT_CLI_PATH;
  if (!path.isAbsolute(cliPath)) {
    throw new SwitchBotCliError({
      kind: "configuration",
      message: "SwitchBot CLIには絶対パスを指定してください。",
      technicalDetails: `Configured path: ${cliPath}`,
    });
  }
  return cliPath;
}

export function runSwitchBotJson<T>(args: string[]): Promise<T> {
  const cliPath = getCliPath();
  const executablePath = [path.dirname(cliPath), "/opt/homebrew/bin", process.env.PATH]
    .filter((value): value is string => Boolean(value))
    .join(path.delimiter);

  return new Promise((resolve, reject) => {
    execFile(
      cliPath,
      args,
      {
        encoding: "utf8",
        timeout: CLI_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
        env: { ...process.env, NO_COLOR: "1", PATH: executablePath },
      },
      (error, stdout, stderr) => {
        const processError = error as ExecFileError | null;
        const diagnostics = sanitizeTechnicalDetails(
          [
            `command: ${path.basename(cliPath)} ${args.join(" ")}`,
            processError?.code !== undefined ? `exitCode: ${String(processError.code)}` : "",
            processError?.signal ? `signal: ${processError.signal}` : "",
            stderr ? `stderr: ${stderr}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );

        try {
          if (stdout.trim()) {
            const data = parseCliEnvelope<T>(stdout, diagnostics);
            if (!processError) {
              resolve(data);
              return;
            }
          }
        } catch (parseError) {
          reject(parseError);
          return;
        }

        if (processError?.killed || processError?.signal === "SIGTERM") {
          reject(
            new SwitchBotCliError({
              kind: "timeout",
              message: "SwitchBot CLIの実行がタイムアウトしました。",
              technicalDetails: diagnostics,
            }),
          );
          return;
        }

        reject(
          new SwitchBotCliError({
            kind: "process",
            message: processError?.message ?? "SwitchBot CLIを実行できませんでした。",
            technicalDetails: diagnostics,
          }),
        );
      },
    );
  });
}

function normalizeDevices(data: DeviceListData, metadata: DeviceMetadataRecord[]): SwitchBotDevice[] {
  const aliases = new Map(metadata.map((entry) => [entry.deviceId, entry.alias]));
  const physicalById = new Map(data.deviceList.map((device) => [device.deviceId, device]));

  const physical = data.deviceList.map<SwitchBotDevice>((device) => {
    const hub = device.hubDeviceId ? physicalById.get(device.hubDeviceId) : undefined;
    return {
      deviceId: device.deviceId,
      name: device.deviceName,
      type: device.deviceType,
      category: "physical",
      roomName: device.roomName?.trim() || undefined,
      hubDeviceId: device.hubDeviceId,
      hubName: hub?.deviceName,
      alias: aliases.get(device.deviceId),
      enableCloudService: device.enableCloudService,
      raw: device,
    };
  });

  const infrared = data.infraredRemoteList.map<SwitchBotDevice>((device) => {
    const hub = device.hubDeviceId ? physicalById.get(device.hubDeviceId) : undefined;
    return {
      deviceId: device.deviceId,
      name: device.deviceName,
      type: device.remoteType,
      category: "ir",
      roomName: hub?.roomName?.trim() || undefined,
      hubDeviceId: device.hubDeviceId,
      hubName: hub?.deviceName,
      alias: aliases.get(device.deviceId),
      raw: device,
    };
  });

  return [...physical, ...infrared].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export async function listDevices(): Promise<SwitchBotDevice[]> {
  const [devices, metadata] = await Promise.all([
    runSwitchBotJson<DeviceListData>(["--cache", "5m", "--json", "devices", "list"]),
    runSwitchBotJson<DeviceMetadataRecord[]>(["--json", "devices", "meta", "list"]),
  ]);
  return normalizeDevices(devices, metadata);
}

export function describeDevice(deviceId: string): Promise<DeviceDescription> {
  return runSwitchBotJson<DeviceDescription>(["--json", "devices", "describe", deviceId, "--live"]);
}

export function getCommandHistory(): Promise<HistoryData> {
  return runSwitchBotJson<HistoryData>(["--json", "history", "show", "--limit", "200"]);
}

export function sendIrRemoteCommand(deviceId: string, command: IrRemoteCommand, parameter?: string): Promise<unknown> {
  return runSwitchBotJson<unknown>([
    "--audit-log",
    "--json",
    "devices",
    "command",
    deviceId,
    command,
    ...(parameter === undefined ? [] : [parameter]),
  ]);
}

export function sendAcPower(deviceId: string, power: "on" | "off"): Promise<unknown> {
  return sendIrRemoteCommand(deviceId, power === "on" ? "turnOn" : "turnOff");
}

export function sendAcSettings(deviceId: string, settings: AcSettings): Promise<unknown> {
  return runSwitchBotJson<unknown>([
    "--audit-log",
    "--json",
    "devices",
    "expand",
    deviceId,
    "setAll",
    "--temp",
    String(settings.temperature),
    "--mode",
    settings.mode,
    "--fan",
    settings.fan,
    "--power",
    "on",
  ]);
}
