import Link from "next/link";
import { Box } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    sent?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>;
}) {
  return (
    <main className="container mx-auto flex min-h-screen max-w-md flex-col px-4 py-10">
      <Link href="/" className="mb-12 inline-flex items-center gap-2 font-semibold">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Box className="h-5 w-5" />
        </span>
        <span>3dfy</span>
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use a magic link or Google. We&apos;ll never email you anything else.
      </p>
      <div className="mt-8">
        <LoginForm searchParamsPromise={searchParams} />
      </div>
    </main>
  );
}
