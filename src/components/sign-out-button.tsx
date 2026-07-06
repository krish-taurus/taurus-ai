import { signOut } from "@/modules/auth/actions";

/**
 * Sign-out control (Prompt 002). Renders a form that posts to the signOut server
 * action, clearing the session and returning to /login.
 */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        Sign out
      </button>
    </form>
  );
}
