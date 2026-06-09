import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  APP_GATE_COOKIE,
  expectedGateToken,
  isAppGateConfigured,
} from "@/lib/auth/app-gate";

/**
 * Site-wide access-password gate. Runs before auth so an unverified visitor is
 * sent to /gate. The gate page, its API, and the auth callback are exempt so
 * the password form and magic-link callbacks keep working.
 */
async function enforceAppGate(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!isAppGateConfigured()) return null;
  const { pathname, search } = request.nextUrl;
  if (
    pathname === "/gate" ||
    pathname.startsWith("/api/gate") ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }
  const token = request.cookies.get(APP_GATE_COOKIE)?.value;
  if (token && token === (await expectedGateToken())) return null;

  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const gated = await enforceAppGate(request);
  if (gated) return gated;

  // Don't crash the whole site if Supabase env is missing or auth blips.
  // Without env vars we just pass requests through; the protected /app/* pages
  // do their own redirect-on-no-user check server-side.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }
  try {
    return await updateSession(request);
  } catch (err) {
    console.error("[middleware] updateSession failed:", err);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-.*|icons/.*|api/fal-webhook|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.webp$).*)",
  ],
};
