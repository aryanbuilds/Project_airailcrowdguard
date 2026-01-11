import { AlertCircle, AlertTriangle, ShieldCheck } from "lucide-react";

export default function SeverityBadge({ severity }: { severity: string }) {
  const sev = severity.toUpperCase();
  
  if (sev === "HIGH") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/20">
        <AlertCircle className="h-3 w-3" />
        HIGH
      </span>
    );
  }
  
  if (sev === "MEDIUM") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
        <AlertTriangle className="h-3 w-3" />
        MEDIUM
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
      <ShieldCheck className="h-3 w-3" />
      LOW
    </span>
  );
}
