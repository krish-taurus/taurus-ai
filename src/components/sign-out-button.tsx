import { signOut } from "@/modules/auth/actions";
import { buttonClasses } from "@/components/ui";

/**
 * Sign-out control (Prompt 002). Renders a form that posts to the signOut server
 * action, clearing the session and returning to /login.
 */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className={buttonClasses("ghost", "sm")}>
        Sign out
      </button>
    </form>
  );
}
