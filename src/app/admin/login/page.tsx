import { Logo } from "@/components/logo";
import { getCurrentEditorAccess } from "@/lib/auth/dal";
import { redirect } from "next/navigation";

import { signIn } from "./actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const access = await getCurrentEditorAccess();

  if (access.status === "ACTIVE") {
    redirect(params.next?.startsWith("/admin") ? params.next : "/admin");
  }

  if (access.status === "INACTIVE") {
    redirect("/admin/access-denied");
  }

  return (
    <main className="min-h-screen bg-[#070b16] px-5 py-12 text-white">
      <div className="mx-auto max-w-md">
        <Logo />
        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            Protected newsroom
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Editor sign in</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Access is limited to invited GTAVIWorldio editors with an active newsroom role.
          </p>

          {params.error ? (
            <p className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              Sign-in was not accepted. Check your approved editor credentials.
            </p>
          ) : null}

          <form action={signIn} className="mt-7 space-y-5">
            <input name="next" type="hidden" value={params.next ?? "/admin"} />
            <label className="block text-sm font-bold">
              Email
              <input
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base outline-none transition focus:border-cyan-300"
                name="email"
                required
                type="email"
              />
            </label>
            <label className="block text-sm font-bold">
              Password
              <input
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base outline-none transition focus:border-cyan-300"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>
            <button
              className="min-h-12 w-full rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-200"
              type="submit"
            >
              Enter newsroom
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
