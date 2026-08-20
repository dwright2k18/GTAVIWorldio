export default function Home() {
  const sections = [
    {
      title: "Breaking news",
      description: "Official announcements and the stories shaping GTA VI.",
    },
    {
      title: "Trailer analysis",
      description: "Frame-by-frame details, locations, characters, and clues.",
    },
    {
      title: "Release tracker",
      description: "The latest confirmed dates, platforms, and launch updates.",
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#090813] text-white">
      <section className="relative isolate px-6 py-24 sm:px-10 sm:py-32 lg:px-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(252,70,151,0.24),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(40,204,235,0.18),transparent_30%)]" />
        <div className="mx-auto max-w-6xl">
          <p className="mb-6 text-sm font-semibold tracking-[0.28em] text-pink-300 uppercase">
            Vice City is calling
          </p>
          <h1 className="max-w-4xl text-6xl font-black tracking-[-0.06em] sm:text-8xl lg:text-9xl">
            GTA VI <span className="text-pink-400">World</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
            An independent destination for GTA VI news, official updates,
            trailer analysis, and everything happening on the road to launch.
          </p>
          <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-zinc-200 backdrop-blur">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
            Newsroom foundation ready for stories
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {sections.map((section, index) => (
            <article
              key={section.title}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-7"
            >
              <p className="text-xs font-bold tracking-[0.25em] text-cyan-300">
                0{index + 1}
              </p>
              <h2 className="mt-8 text-2xl font-bold">{section.title}</h2>
              <p className="mt-3 leading-7 text-zinc-400">
                {section.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-zinc-500">
        Independent fan publication. Not affiliated with Rockstar Games or
        Take-Two Interactive.
      </footer>
    </main>
  );
}
