import type { AuditEntry, IrRemoteCommand } from "../lib/types.ts";

export interface IrLastSentState {
  command?: IrRemoteCommand;
  parameter?: string;
  lastSentAt?: string;
}

const IR_REMOTE_COMMANDS = new Set<IrRemoteCommand>([
  "turnOn",
  "turnOff",
  "brightnessUp",
  "brightnessDown",
  "volumeAdd",
  "volumeSub",
  "channelAdd",
  "channelSub",
  "SetChannel",
]);

export const IR_COMMAND_LABELS: Record<IrRemoteCommand, string> = {
  turnOn: "ON",
  turnOff: "OFF",
  brightnessUp: "明るく",
  brightnessDown: "暗く",
  volumeAdd: "音量＋",
  volumeSub: "音量−",
  channelAdd: "CH＋",
  channelSub: "CH−",
  SetChannel: "CH指定",
};

function isIrRemoteCommand(command: string): command is IrRemoteCommand {
  return IR_REMOTE_COMMANDS.has(command as IrRemoteCommand);
}

export function restoreIrLastSentState(entries: AuditEntry[], deviceId: string): IrLastSentState {
  const entry = entries
    .filter(
      (candidate) =>
        candidate.deviceId === deviceId &&
        candidate.result === "ok" &&
        !candidate.dryRun &&
        isIrRemoteCommand(candidate.command),
    )
    .sort((a, b) => Date.parse(b.t) - Date.parse(a.t))[0];

  if (!entry || !isIrRemoteCommand(entry.command)) return {};
  return {
    command: entry.command,
    parameter:
      entry.parameter === undefined || entry.parameter === null || entry.parameter === "default"
        ? undefined
        : String(entry.parameter),
    lastSentAt: entry.t,
  };
}

export function formatIrCommand(state: IrLastSentState): string {
  if (!state.command) return "—";
  if (state.command === "SetChannel" && state.parameter) return `CH ${state.parameter}`;
  return IR_COMMAND_LABELS[state.command];
}

export function formatIrLastSentAt(value?: string): string {
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
