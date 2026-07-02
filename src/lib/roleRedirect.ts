/**
 * Role-based redirect mapping
 * Determines where users should be redirected after successful authentication based on their role
 */

export type UserRole = 'worker' | 'employer' | 'admin' | 'super_admin';

export function getRoleRedirectPath(role: UserRole | null): string {
  if (!role) {
    return '/';
  }

  switch (role) {
    case 'worker':
      return '/worker/dashboard';
    case 'employer':
      return '/employer/dashboard';
    case 'admin':
      return '/admin/dashboard';
    case 'super_admin':
      return '/super-admin/dashboard';
    default:
      return '/';
  }
}

export function isValidRole(role: unknown): role is UserRole {
  return (
    role === 'worker' ||
    role === 'employer' ||
    role === 'admin' ||
    role === 'super_admin'
  );
}
