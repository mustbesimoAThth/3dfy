import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutGrid, LogOut, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./app/sign-out-button";
import { BrandMark } from "@/components/BrandMark";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");

  return (
    <div className="min-h-screen pb-[max(env(safe-area-inset-bottom),16px)]">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link
            href="/app"
            aria-label="3dfy — studio"
            className="inline-flex shrink-0 items-center font-semibold"
          >
            <BrandMark size="sm" priority />
          </Link>
          <nav className="flex min-w-0 flex-1 items-center justify-end gap-2 text-sm sm:gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground sm:text-sm"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Studio</span>
            </Link>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground sm:text-sm"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Gallery</span>
            </Link>
            <span
              className="hidden min-w-0 truncate text-right text-muted-foreground md:inline"
              title={user.email ?? undefined}
            >
              {user.email ?? "Signed in"}
            </span>
            <SignOutButton>
              <LogOut className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1.5">Sign out</span>
            </SignOutButton>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
