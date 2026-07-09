export const INTERNAL_AUTH_DOMAIN = 'app.internal';

/**
 * Canonical application roles. The live DB stores user_roles.role as a plain
 * text column (the legacy pp_role Postgres enum was dropped during the
 * unified-corpus migration), so this union is the app-side source of truth.
 * Narrow at runtime via 
arrowAppRole before treating a DB string as a role.
 */
export type AppRole = 'admin' | 'lawyer' | 'client' | 'auditor';

const APP_ROLES: readonly AppRole[] = ['admin', 'lawyer', 'client', 'auditor'];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value);
}

export function narrowAppRole(value: string | null | undefined): AppRole | null {
  if (value && isAppRole(value)) return value;
  return null;
}

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

export function toInternalEmail(username: string): string {
  return `${normalizeUsername(username)}@${INTERNAL_AUTH_DOMAIN}`;
}

export function getLoginEmailCandidates(rawUsername: string): string[] {
  const trimmedUsername = rawUsername.trim().replace(/^@+/, '');
  const normalizedUsername = normalizeUsername(rawUsername);
  const candidates = [
    `${normalizedUsername}@${INTERNAL_AUTH_DOMAIN}`,
    `${trimmedUsername}@${INTERNAL_AUTH_DOMAIN}`,
  ].filter(Boolean);

  return [...new Set(candidates)];
}

export function getSignInCandidates(rawIdentifier: string): string[] {
  const trimmed = rawIdentifier.trim();
  if (!trimmed) return [];

  if (trimmed.includes('@')) {
    return [...new Set([trimmed, trimmed.toLowerCase()])];
  }

  return getLoginEmailCandidates(trimmed);
}

export function getAuthRedirectPath(requiredRole?: AppRole): string {
  return requiredRole === 'admin' ? '/admin/login' : '/login';
}
