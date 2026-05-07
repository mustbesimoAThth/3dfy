import Link from "next/link";
import { ArrowRight, Box, Cpu, Image as ImageIcon, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="container mx-auto flex min-h-screen flex-col px-4 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Box className="h-5 w-5" />
          </span>
          <span className="text-lg">3dfy</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <Link
              href="/app"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Open app
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> Powered by Tripo3D on fal.ai
        </span>
        <h1 className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
          Turn any image
          <br />
          into a 3D model.
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
          Drop a photo, pick a model, get a downloadable, AR-ready{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.glb</code>{" "}
          back in under a minute. Works offline as a PWA.
        </p>
        <Link
          href={user ? "/app" : "/login"}
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
            title="Two model tiers"
            body="Pick Tripo P1 for speed or H3.1 for HD textures and detailed geometry."
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
    <div className="rounded-2xl border border-border/60 bg-background/40 p-5 backdrop-blur">
      <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
