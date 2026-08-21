import type { VerificationStatus } from "@/lib/types";

const statusStyles: Record<VerificationStatus, string> = {
  CONFIRMED: "border-emerald-300/25 bg-emerald-300/12 text-emerald-200",
  "CREDIBLE REPORT": "border-cyan-300/25 bg-cyan-300/12 text-cyan-200",
  RUMOR: "border-amber-300/25 bg-amber-300/12 text-amber-200",
  SPECULATION: "border-violet-300/25 bg-violet-300/12 text-violet-200",
  "ALLEGED LEAK": "border-rose-300/25 bg-rose-300/12 text-rose-200",
};

export function VerificationBadge({
  status,
  compact = false,
}: {
  status: VerificationStatus;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-black tracking-[0.11em] ${statusStyles[status]} ${
        compact ? "px-2 py-1 text-[0.56rem]" : "px-2.5 py-1.5 text-[0.62rem]"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
      {status}
    </span>
  );
}
