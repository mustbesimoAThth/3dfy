"use client";

import { useRouter } from "next/navigation";
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/client";

export function SignOutButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (isSupabaseBrowserConfigured()) {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
        }
        router.replace("/");
        router.refresh();
      }}
      className="inline-flex items-center rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-accent"
    >
      {children}
    </button>
  );
}
