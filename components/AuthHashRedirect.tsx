"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Supabase sometimes returns auth errors in the hash (e.g. after magic link),
 * which never reaches the server. Forward to /gate so we can show a message.
 */
export function AuthHashRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const raw = window.location.hash?.replace(/^#/, "");
    if (!raw) return;

    const hashParams = new URLSearchParams(raw);
    const error = hashParams.get("error");
    const errorCode = hashParams.get("error_code");
    const errorDesc = hashParams.get("error_description");

    if (!error && !errorCode) return;

    const next = new URLSearchParams();
    if (error) next.set("error", error);
    if (errorCode) next.set("error_code", errorCode);
    if (errorDesc) next.set("error_description", errorDesc);

    window.history.replaceState(null, "", `${pathname}${window.location.search}`);

    router.replace(`/gate?${next.toString()}`);
  }, [router, pathname]);

  return null;
}
