import { NextResponse } from "next/server";
import {
  APP_GATE_COOKIE,
  expectedGateToken,
  isAppGateConfigured,
  isPasswordCorrect,
  sanitizeNext,
} from "@/lib/auth/app-gate";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = sanitizeNext(String(form.get("next") ?? "/"));

  // Gate disabled — let everyone through.
  if (!isAppGateConfigured()) {
    return NextResponse.redirect(new URL(next, origin), { status: 303 });
  }

  if (isPasswordCorrect(password)) {
    const res = NextResponse.redirect(new URL(next, origin), { status: 303 });
    res.cookies.set(APP_GATE_COOKIE, await expectedGateToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: THIRTY_DAYS,
    });
    return res;
  }

  const back = new URL("/gate", origin);
  back.searchParams.set("error", "1");
  if (next !== "/") back.searchParams.set("next", next);
  return NextResponse.redirect(back, { status: 303 });
}
