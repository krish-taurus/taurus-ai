/**
 * Current user resolution (Prompt 002) — server only.
 *
 * Reads the signed session cookie, verifies it, and loads the user from the data
 * store. Returns null when there is no valid session.
 */

import { cookies } from "next/headers";
import { getStore } from "@/lib/db/store";
import type { User } from "@/lib/db/types";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/security/session";

export async function getCurrentUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return getStore().getUserById(payload.uid);
}
