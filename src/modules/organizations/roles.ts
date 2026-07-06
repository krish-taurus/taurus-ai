/**
 * Organization roles and permissions (Prompt 002).
 *
 * Roles come from the security model (02_technical/004_security_model.md):
 *   owner > admin > builder > viewer
 *
 * Permissions are least-privilege by default: a role only has what is explicitly
 * granted here. New members default to `viewer`; the creator of an organization
 * becomes `owner`.
 */

export const ROLES = ["owner", "admin", "builder", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Default role for a newly added member (least privilege). */
export const DEFAULT_MEMBER_ROLE: Role = "viewer";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Fine-grained permissions. Kept intentionally small for the foundation; later
 * prompts extend this as employee/knowledge/collaboration features land.
 */
export const PERMISSIONS = [
  "organization.manage",
  "organization.delete",
  "billing.manage",
  "member.invite",
  "member.manage_roles",
  "audit.view",
  "employee.create",
  "employee.manage",
  "employee_dna.edit",
  "knowledge.manage",
  "employee.test",
  "employee.view",
  "dashboard.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role → permission grants. Higher roles are supersets of lower ones, but we
 * list grants explicitly rather than relying on inheritance so the matrix is
 * auditable at a glance.
 */
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
  admin: new Set<Permission>([
    "member.invite",
    "audit.view",
    "employee.create",
    "employee.manage",
    "employee_dna.edit",
    "knowledge.manage",
    "employee.test",
    "employee.view",
    "dashboard.view",
  ]),
  builder: new Set<Permission>([
    "employee.create",
    "employee_dna.edit",
    "knowledge.manage",
    "employee.test",
    "employee.view",
    "dashboard.view",
  ]),
  viewer: new Set<Permission>(["employee.view", "employee.test", "dashboard.view"]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Human-friendly labels for the UI (Taurus terminology, non-technical). */
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  builder: "Builder",
  viewer: "Viewer",
};
