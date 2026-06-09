import { redirect } from "next/navigation";

/** Sign-in is now a single shared access password — send everyone to /gate. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(next ? `/gate?next=${encodeURIComponent(next)}` : "/gate");
}
