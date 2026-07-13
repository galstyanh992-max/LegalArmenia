export const ASSIGNABLE_APP_ROLES = ["admin", "lawyer", "client"] as const;

export type AssignableAppRole = (typeof ASSIGNABLE_APP_ROLES)[number];

export function isAssignableAppRole(
  value: unknown,
): value is AssignableAppRole {
  return typeof value === "string" &&
    ASSIGNABLE_APP_ROLES.some((role) => role === value);
}

export function requireAssignableAppRole(value: unknown): AssignableAppRole {
  if (!isAssignableAppRole(value)) {
    throw new Error("Unsupported role");
  }
  return value;
}
