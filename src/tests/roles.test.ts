import { describe, it, expect } from "vitest";
import { hasPermission, DEFAULT_MEMBER_ROLE, ROLES } from "@/modules/organizations/roles";

describe("roles and permissions", () => {
  it("defaults new members to the least-privileged role", () => {
    expect(DEFAULT_MEMBER_ROLE).toBe("viewer");
  });

  it("grants the owner every permission", () => {
    expect(hasPermission("owner", "organization.delete")).toBe(true);
    expect(hasPermission("owner", "billing.manage")).toBe(true);
    expect(hasPermission("owner", "member.manage_roles")).toBe(true);
  });

  it("restricts admin from organization deletion but allows billing (Prompt 011)", () => {
    expect(hasPermission("admin", "member.invite")).toBe(true);
    expect(hasPermission("admin", "audit.view")).toBe(true);
    expect(hasPermission("admin", "organization.delete")).toBe(false);
    // Billing management is owner/admin only (Prompt 011).
    expect(hasPermission("admin", "billing.view")).toBe(true);
    expect(hasPermission("admin", "billing.manage")).toBe(true);
    // A builder/viewer can view billing but never manage it.
    expect(hasPermission("builder", "billing.view")).toBe(true);
    expect(hasPermission("builder", "billing.manage")).toBe(false);
    expect(hasPermission("viewer", "billing.view")).toBe(true);
    expect(hasPermission("viewer", "billing.manage")).toBe(false);
  });

  it("lets a builder create employees but not invite members", () => {
    expect(hasPermission("builder", "employee.create")).toBe(true);
    expect(hasPermission("builder", "employee_dna.edit")).toBe(true);
    expect(hasPermission("builder", "member.invite")).toBe(false);
    expect(hasPermission("builder", "audit.view")).toBe(false);
  });

  it("limits a viewer to read/test and dashboard", () => {
    expect(hasPermission("viewer", "employee.view")).toBe(true);
    expect(hasPermission("viewer", "dashboard.view")).toBe(true);
    expect(hasPermission("viewer", "employee.create")).toBe(false);
    expect(hasPermission("viewer", "knowledge.manage")).toBe(false);
  });

  it("every role can view the dashboard", () => {
    for (const role of ROLES) {
      expect(hasPermission(role, "dashboard.view")).toBe(true);
    }
  });
});
