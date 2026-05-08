import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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
