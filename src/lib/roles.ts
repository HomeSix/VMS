// Single source of truth for all role names
export const ROLES = {
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
  STAFF: "staff",
  SECURITY: "security",
  PENDING: "pending",
  REJECTED: "rejected",
} as const;

// Roles that bypass page-level permission checks
const ELEVATED_ROLES: ReadonlySet<string> = new Set([
  ROLES.ADMIN,
  ROLES.SUPERADMIN,
]);

export function isElevated(role: string | null | undefined): boolean {
  return !!role && ELEVATED_ROLES.has(role);
}

// Roles that can perform admin actions (approve/reject bookings, etc.)
export function canPerformAdminActions(role: string | null | undefined): boolean {
  return isElevated(role);
}

// Roles that represent actual staff/teachers (not admin/superadmin/pending/rejected)
export function isStaffRole(role: string | null | undefined): boolean {
  return role === ROLES.STAFF;
}

export function isSecurityRole(role: string | null | undefined): boolean {
  return role === ROLES.SECURITY;
}
