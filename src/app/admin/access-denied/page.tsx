import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { getCurrentEditorAccess } from "@/lib/auth/dal";

import { signOut } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminAccessDeniedPage() {
  const access = await getCurrentEditorAccess();

  if (access.status === "UNAUTHENTICATED") {
    redirect("/admin/login");
  }

  if (access.status === "ACTIVE") {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-[#070b16] px-5 py-12 text-white">
      <div className="mx-auto max-w-md">
        <Logo />
        <section className="mt-10 rounded-3xl border border-amber-300/25 bg-amber-300/[0.06] p-7 shadow-2xl shadow-black/30">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">
            Newsroom access unavailable
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Account inactive</h1>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            Your sign-in is valid, but this account does not have an active GTAVIWorldio
            newsroom profile. Ask a newsroom owner to review your access.
          </p>
          <form action={signOut} className="mt-7">
            <button
              className="min-h-12 w-full rounded-xl border border-white/20 px-5 py-3 font-black transition hover:border-cyan-300"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
