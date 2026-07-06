/**
 * Placeholder auth guard (Prompt 001).
 *
 * Taurus AI denies access by default. Real session validation and organization
 * membership checks arrive in Prompt 002 (Database, Auth, and Tenancy). This
 * placeholder gives later code a single, well-named seam to plug real auth into,
 * and encodes the intended contract.
 *
 * SECURITY PRINCIPLES (from the constitution / coding standards):
 * - Validate session.
 * - Validate organization membership.
 * - Deny access by default.
 * - Never trust client-provided permission claims.
 */

export interface SessionUser {
  id: string;
  email: string;
  organizationId: string;
}

export interface AuthResult {
  authenticated: boolean;
  user: SessionUser | null;
  reason?: string;
}

/**
 * Placeholder session resolver. Returns an unauthenticated result until real
 * auth is wired up in Prompt 002. Kept intentionally simple and deny-by-default.
 */
export async function getSession(): Promise<AuthResult> {
  return {
    authenticated: false,
    user: null,
    reason: "Auth is not implemented until Prompt 002 (Database, Auth, and Tenancy).",
  };
}

/**
 * Guard intended to protect server routes/pages. In Prompt 001 it never grants
 * access; it exists so dashboard routes can adopt the guard now and get real
 * enforcement for free once Prompt 002 lands.
 */
export async function requireSession(): Promise<AuthResult> {
  const session = await getSession();
  // Deny by default. Later prompts throw/redirect on failure; for the
  // placeholder foundation we simply return the result for callers to inspect.
  return session;
}
