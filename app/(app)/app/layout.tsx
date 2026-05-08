import Link from "next/link";
import { redirect } from "next/navigation";
import { Box, LogOut } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export default async function AppLayout({
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
          <Link href="/app" className="flex shrink-0 items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Box className="h-4 w-4" />
            </span>
            <span>3dfy</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-sm sm:gap-3">
            <span
              className="min-w-0 truncate text-right text-muted-foreground"
              title={user.email ?? undefined}
            >
              {user.email ?? "Signed in"}
            </span>
            <SignOutButton>
              <LogOut className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1.5">Sign out</span>
            </SignOutButton>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
