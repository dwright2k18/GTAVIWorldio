"use client";

import { useState, type FormEvent } from "react";
import { ArrowRightIcon } from "@/components/icons";

export function NewsletterSignup() {
  const [notice, setNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.currentTarget.reset();
    setNotice(
      "The GTA VI Brief is opening soon. Your email was not stored, and no message will be sent yet.",
    );
  }

  return (
    <section
      id="newsletter"
      className="scroll-mt-24 border-y border-white/10 bg-[radial-gradient(circle_at_15%_35%,rgba(244,114,182,0.2),transparent_28%),radial-gradient(circle_at_88%_50%,rgba(103,232,249,0.17),transparent_30%),#0d0b18] py-14 sm:py-18"
      aria-labelledby="newsletter-heading"
    >
      <div className="site-shell grid items-center gap-8 lg:grid-cols-[1fr_minmax(24rem,.8fr)] lg:gap-14">
        <div>
          <p className="eyebrow">One clear briefing</p>
          <h2
            id="newsletter-heading"
            className="mt-3 text-balance text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl"
          >
            GET THE GTA VI BRIEF
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
            Get the biggest GTA VI news, discoveries, trailers and updates without digging through the noise.
          </p>
        </div>

        <div className="rounded-3xl border border-white/15 bg-black/25 p-4 shadow-2xl shadow-pink-950/20 backdrop-blur sm:p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="brief-email" className="sr-only">
              Email address
            </label>
            <input
              id="brief-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="h-13 w-full rounded-full border border-white/12 bg-white/[0.065] px-5 text-base text-white placeholder:text-zinc-600 focus:border-cyan-300/50 focus:outline-none sm:min-w-0 sm:flex-1"
            />
            <button
              type="submit"
              className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#090813] transition-transform hover:-translate-y-0.5"
            >
              Join the brief
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-3 px-2 text-xs leading-5 text-zinc-500">
            No spam. Major GTA VI updates only. Unsubscribe anytime once delivery begins.
          </p>
          {notice && (
            <p className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] px-4 py-3 text-xs leading-5 text-cyan-100/80" role="status">
              {notice}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
