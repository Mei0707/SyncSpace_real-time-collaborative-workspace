import { Wifi, WifiOff } from "lucide-react";
import { cn } from "../lib/cn";
import type { ConnectionStatus } from "../stores/useUiStore";

const copy: Record<ConnectionStatus, string> = {
  connected: "Synced",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

export function StatusPill({ status }: { status: ConnectionStatus }) {
  const isConnected = status === "connected";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium",
        isConnected
          ? "border-good/20 bg-good/8 text-good"
          : "border-warn/25 bg-warn/8 text-warn",
      )}
    >
      {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
      {copy[status]}
    </span>
  );
}
