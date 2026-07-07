import { redirect } from "next/navigation";

/**
 * `/signin` alias (Sprint 012). The canonical sign-in route is `/login` (used by
 * the landing page and middleware); this alias forwards there, preserving any
 * `next`/`error` query so external links to /signin keep working.
 */
export default function SigninAliasPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const query = params.toString();
  redirect(query ? `/login?${query}` : "/login");
}
