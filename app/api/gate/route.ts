import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";
import {
  isAppGateConfigured,
  isPasswordCorrect,
  sanitizeNext,
  sharedAccountEmail,
} from "@/lib/auth/app-gate";

export const runtime = "nodejs";

/**
 * Validates the shared access password and, on success, signs the visitor into
 * the shared Supabase account — setting the auth cookies on the redirect.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = sanitizeNext(String(form.get("next") ?? "/app"));

  if (!isAppGateConfigured()) {
    return NextResponse.redirect(new URL("/gate?error=config", origin), {
      status: 303,
    });
  }

  if (!isPasswordCorrect(password)) {
    const back = new URL("/gate", origin);
    back.searchParams.set("error", "1");
    if (next !== "/app") back.searchParams.set("next", next);
    return NextResponse.redirect(back, { status: 303 });
  }

  const cookieStore = await cookies();
  const res = NextResponse.redirect(new URL(next, origin), { status: 303 });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: sharedAccountEmail()!,
    password,
  });
  if (error) {
    // Password matched APP_ACCESS_PASSWORD but the shared Supabase account is
    // missing / unconfirmed / has a different password.
    return NextResponse.redirect(new URL("/gate?error=account", origin), {
      status: 303,
    });
  }

  return res;
}
