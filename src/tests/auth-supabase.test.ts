import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { hasPermission } from "@/modules/organizations/roles";
import {
  resolveTaurusUserForSupabaseIdentity,
  toSupabaseIdentity,
  type SupabaseIdentity,
} from "@/modules/auth/supabase-user";
import { resolvePostAuthPath, sanitizeNextPath } from "@/modules/auth/post-auth";
import { isDevAuthAvailable, isSupabaseConfigured } from "@/lib/supabase/config";
import { DevCredentialsProvider } from "@/modules/auth/provider";

function identity(overrides: Partial<SupabaseIdentity> = {}): SupabaseIdentity {
  return {
    supabaseAuthUserId: "sb-user-1",
    email: "founder@example.com",
    fullName: "Jane Founder",
    avatarUrl: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// --- Supabase → Taurus user mapping ----------------------------------------

describe("resolveTaurusUserForSupabaseIdentity", () => {
  it("creates a Taurus user linked to the Supabase identity on first sign-in", async () => {
    const store = new InMemoryStore();
    const user = await resolveTaurusUserForSupabaseIdentity(store, identity());
    expect(user.email).toBe("founder@example.com");
    expect(user.fullName).toBe("Jane Founder");
    expect(user.supabaseAuthUserId).toBe("sb-user-1");
    // Persisted + resolvable by Supabase id.
    expect((await store.getUserBySupabaseAuthId("sb-user-1"))?.id).toBe(user.id);
  });

  it("is idempotent — the same identity resolves to the same Taurus user", async () => {
    const store = new InMemoryStore();
    const first = await resolveTaurusUserForSupabaseIdentity(store, identity());
    const second = await resolveTaurusUserForSupabaseIdentity(store, identity());
    expect(second.id).toBe(first.id);
  });

  it("links an existing (dev-auth) user with the same email to the Supabase identity", async () => {
    const store = new InMemoryStore();
    const existing = await store.createUser({ email: "founder@example.com", fullName: "Jane" });
    expect(existing.supabaseAuthUserId).toBeNull();

    const mapped = await resolveTaurusUserForSupabaseIdentity(store, identity());
    expect(mapped.id).toBe(existing.id); // no duplicate user
    expect(mapped.supabaseAuthUserId).toBe("sb-user-1");
  });

  it("does not re-point an email already linked to a different Supabase identity", async () => {
    const store = new InMemoryStore();
    await resolveTaurusUserForSupabaseIdentity(store, identity({ supabaseAuthUserId: "sb-first" }));
    const again = await resolveTaurusUserForSupabaseIdentity(
      store,
      identity({ supabaseAuthUserId: "sb-second" }),
    );
    expect(again.supabaseAuthUserId).toBe("sb-first");
  });

  it("requires a verified email", async () => {
    const store = new InMemoryStore();
    await expect(
      resolveTaurusUserForSupabaseIdentity(store, identity({ email: "" })),
    ).rejects.toThrow(/email/i);
  });
});

// --- Preserving organization membership + role checks -----------------------

describe("organization mapping is preserved", () => {
  it("maps a Supabase user, who then owns their organization with full permissions", async () => {
    const store = new InMemoryStore();
    const user = await resolveTaurusUserForSupabaseIdentity(store, identity());
    const { membership } = await createOrganizationForUser(store, user.id, { name: "Acme" });

    expect(membership.userId).toBe(user.id); // membership references internal Taurus id
    expect(membership.role).toBe("owner");
    expect(hasPermission(membership.role, "organization.manage")).toBe(true);

    const orgs = await store.listOrganizationsForUser(user.id);
    expect(orgs).toHaveLength(1);
  });

  it("keeps organizations isolated between two Supabase users", async () => {
    const store = new InMemoryStore();
    const a = await resolveTaurusUserForSupabaseIdentity(
      store,
      identity({ supabaseAuthUserId: "sb-a", email: "a@example.com" }),
    );
    const b = await resolveTaurusUserForSupabaseIdentity(
      store,
      identity({ supabaseAuthUserId: "sb-b", email: "b@example.com" }),
    );
    await createOrganizationForUser(store, a.id, { name: "A Co" });

    expect(await store.listOrganizationsForUser(a.id)).toHaveLength(1);
    expect(await store.listOrganizationsForUser(b.id)).toHaveLength(0); // no cross-user leakage
  });
});

// --- Post-auth routing ------------------------------------------------------

describe("post-auth routing", () => {
  it("sends a user with no organization to onboarding, and one with an org to the dashboard", async () => {
    const store = new InMemoryStore();
    const user = await resolveTaurusUserForSupabaseIdentity(store, identity());
    expect(await resolvePostAuthPath(user.id, null, store)).toBe("/onboarding");

    await createOrganizationForUser(store, user.id, { name: "Acme" });
    expect(await resolvePostAuthPath(user.id, null, store)).toBe("/dashboard");
  });

  it("honors a safe next path but rejects unsafe or auth-page targets", async () => {
    const store = new InMemoryStore();
    const user = await resolveTaurusUserForSupabaseIdentity(store, identity());
    await createOrganizationForUser(store, user.id, { name: "Acme" });

    expect(await resolvePostAuthPath(user.id, "/dashboard/employees", store)).toBe(
      "/dashboard/employees",
    );
    // Unsafe / auth targets fall back to the org-derived destination.
    expect(await resolvePostAuthPath(user.id, "https://evil.example", store)).toBe("/dashboard");
    expect(await resolvePostAuthPath(user.id, "//evil.example", store)).toBe("/dashboard");
    expect(await resolvePostAuthPath(user.id, "/login", store)).toBe("/dashboard");
  });

  it("sanitizeNextPath only accepts internal, non-auth relative paths", () => {
    expect(sanitizeNextPath("/dashboard/knowledge")).toBe("/dashboard/knowledge");
    expect(sanitizeNextPath("/onboarding")).toBe("/onboarding");
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath("https://evil.example")).toBeNull();
    expect(sanitizeNextPath("//evil.example")).toBeNull();
    expect(sanitizeNextPath("/auth/callback")).toBeNull();
    expect(sanitizeNextPath("/signup")).toBeNull();
  });
});

// --- Supabase identity extraction -------------------------------------------

describe("toSupabaseIdentity", () => {
  it("extracts name and avatar from provider metadata variants", () => {
    expect(
      toSupabaseIdentity({
        id: "sb-1",
        email: "x@example.com",
        user_metadata: { full_name: "Full Name", avatar_url: "http://img/a.png" },
      }),
    ).toMatchObject({
      supabaseAuthUserId: "sb-1",
      fullName: "Full Name",
      avatarUrl: "http://img/a.png",
    });

    // OAuth providers sometimes use name/picture instead.
    expect(
      toSupabaseIdentity({
        id: "sb-2",
        email: "y@example.com",
        user_metadata: { name: "Y Person", picture: "http://img/y.png" },
      }),
    ).toMatchObject({ fullName: "Y Person", avatarUrl: "http://img/y.png" });
  });

  it("returns null when there is no email to key on", () => {
    expect(toSupabaseIdentity({ id: "sb-3", email: null })).toBeNull();
  });
});

// --- Configuration + dev-auth gating ---------------------------------------

describe("auth configuration predicates", () => {
  it("detects Supabase configuration from env", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("disables dev auth in production unless explicitly allowed", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TAURUS_ALLOW_DEV_AUTH", "");
    expect(isDevAuthAvailable()).toBe(false);

    vi.stubEnv("TAURUS_ALLOW_DEV_AUTH", "true");
    expect(isDevAuthAvailable()).toBe(true);
  });

  it("allows dev auth outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TAURUS_ALLOW_DEV_AUTH", "");
    expect(isDevAuthAvailable()).toBe(true);
  });
});

describe("development auth provider gating", () => {
  it("refuses to run in production unless explicitly allowed", async () => {
    const store = new InMemoryStore();
    const provider = new DevCredentialsProvider();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TAURUS_ALLOW_DEV_AUTH", "");
    await expect(provider.signUp(store, "new@example.com")).rejects.toThrow(
      /disabled in production/i,
    );

    vi.stubEnv("TAURUS_ALLOW_DEV_AUTH", "true");
    const user = await provider.signUp(store, "new@example.com");
    expect(user.email).toBe("new@example.com");
  });
});
