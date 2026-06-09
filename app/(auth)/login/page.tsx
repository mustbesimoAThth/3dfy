import Link from "next/link";
import { LoginForm } from "./login-form";
import { BrandMark } from "@/components/BrandMark";

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
      <Link
        href="/"
        aria-label="3dfy — home"
        className="mb-12 inline-flex items-center font-semibold"
      >
        <BrandMark size="md" priority />
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use a magic link or your email and password. Sign-in is limited to{" "}
        <span className="font-medium text-foreground">@harrythehirer.com.au</span>{" "}
        accounts.
      </p>
      <div className="mt-8">
        <LoginForm searchParamsPromise={searchParams} />
      </div>
    </main>
  );
}
