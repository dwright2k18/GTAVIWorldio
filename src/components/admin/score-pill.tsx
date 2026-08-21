export function ScorePill({ label, score }: { label: string; score: number }) {
  const tone = score >= 80
    ? "border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-100"
    : score >= 60
      ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
      : score >= 35
        ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
        : "border-white/10 bg-white/[0.035] text-slate-300";
  return (
    <span className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-black ${tone}`}>
      {label} {score}
    </span>
  );
}
