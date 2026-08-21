export default function Loading() {
  return (
    <div className="site-shell min-h-[65vh] py-14" aria-busy="true" aria-label="Loading page">
      <div className="h-4 w-28 animate-pulse rounded-full bg-white/8" />
      <div className="mt-8 h-14 max-w-2xl animate-pulse rounded-2xl bg-white/8" />
      <div className="mt-4 h-6 max-w-xl animate-pulse rounded-xl bg-white/6" />
      <div className="mt-10 aspect-[16/7] animate-pulse rounded-3xl bg-white/6" />
    </div>
  );
}
