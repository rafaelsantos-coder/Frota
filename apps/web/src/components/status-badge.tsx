import type { DeviceStatus } from "@frota/shared";

export function StatusBadge({ status }: { status: DeviceStatus }) {
  const className =
    status === "ONLINE"
      ? "badge badge-online"
      : status === "OFFLINE"
        ? "badge badge-offline"
        : "badge badge-unknown";
  return <span className={className}>{status}</span>;
}

export function AlertStatusBadge({ status }: { status: string }) {
  const className =
    status === "NEW"
      ? "badge badge-alert-new"
      : status === "REVIEWING"
        ? "badge badge-alert-review"
        : "badge badge-alert-resolved";
  const label =
    status === "NEW" ? "Novo" : status === "REVIEWING" ? "Em análise" : "Resolvido";
  return <span className={className}>{label}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const className =
    severity === "CRITICAL"
      ? "badge badge-critical"
      : severity === "HIGH"
        ? "badge badge-high"
        : "badge badge-medium";
  return <span className={className}>{severity}</span>;
}
