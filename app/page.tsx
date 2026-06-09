import Link from "next/link";
import { ArrowRight, Box, Cpu, Image as ImageIcon, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";

export const dynamic = "force-dynamic";

async function getCurrentUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    // Missing env vars or Supabase outage — degrade to signed-out state instead
    // of crashing the landing page.
    console.error("[landing] auth lookup failed:", err);
    return null;
  }
}

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <main className="container mx-auto flex min-h-screen flex-col px-4 py-10">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="3dfy — home"
          className="inline-flex items-center font-semibold"
        >
          <BrandMark size="md" priority />
        </Link>
        <nav className="flex min-w-0 max-w-[70%] flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          {user ? (
            <>
              <span
                className="max-w-[200px] truncate text-right text-xs text-muted-foreground sm:max-w-xs sm:text-sm"
                title={user.email ?? undefined}
              >
                {user.email}
              </span>
              <Link
                href="/app"
                className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Open app
              </Link>
            </>
          ) : (
            <Link
              href="/gate"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Enter app
            </Link>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <span className="eyebrow mb-6 inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" /> Engineered by Simone Leonelli
        </span>
        <h1 className="text-4xl tracking-tight sm:text-6xl">
          Turn any image
          <br />
          <em className="not-italic" style={{ fontStyle: "italic", color: "var(--accent-blue)" }}>
            into a 3D model.
          </em>
        </h1>
        <p className="lede mt-5 max-w-xl text-balance text-base sm:text-lg">
          Drop a photo, pick a model, get a downloadable, AR-ready{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs not-italic">.glb</code>{" "}
          back in under a minute. Works offline as a PWA.
        </p>
        <Link
          href={user ? "/app" : "/gate"}
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
        >
          Start generating
          <ArrowRight className="h-4 w-4" />
        </Link>

        <div className="mt-20 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
          <Feature
            icon={<ImageIcon className="h-5 w-5" />}
            title="Drop. Paste. Snap."
            body="Upload from disk, paste from clipboard, or use your phone camera."
          />
          <Feature
            icon={<Cpu className="h-5 w-5" />}
            title="Three ways to generate"
            body="Standard (default) for best balance, or a fast tier, or an advanced tier with HD textures and extra geometry options."
          />
          <Feature
            icon={<Box className="h-5 w-5" />}
            title="View it. Ship it."
            body="Inspect in-browser, jump to AR on iOS or Android, download the .glb."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
