export const KHE_PERMISSIONS = [
  'dashboard.view',
  'clients.view',
  'clients.manage',
  'clients.delete',
  'events.view',
  'events.manage',
  'events.delete',
  'studio.view',
  'studio.manage',
  'studio.delete',
  'marketing.view',
  'marketing.manage',
  'communications.manage',
  'site.manage',
  'billing.manage',
  'team.manage',
  'reports.export',
] as const;

export type KhePermission = (typeof KHE_PERMISSIONS)[number];
export type PermissionOverrides = Partial<Record<KhePermission, boolean>>;

const OWNER_DEFAULTS = Object.fromEntries(KHE_PERMISSIONS.map((permission) => [permission, true])) as Record<KhePermission, boolean>;

export const ROLE_PERMISSION_DEFAULTS: Record<string, Record<KhePermission, boolean>> = {
  OWNER: OWNER_DEFAULTS,
  ADMIN: {
    ...OWNER_DEFAULTS,
    'billing.manage': false,
    'team.manage': true,
  },
  OPERATOR: {
    ...Object.fromEntries(KHE_PERMISSIONS.map((permission) => [permission, false])) as Record<KhePermission, boolean>,
    'dashboard.view': true,
    'clients.view': true,
    'clients.manage': true,
    'events.view': true,
    'events.manage': true,
    'studio.view': true,
    'studio.manage': true,
    'marketing.view': true,
    'communications.manage': true,
    'reports.export': true,
  },
  SHARE_HOST: {
    ...Object.fromEntries(KHE_PERMISSIONS.map((permission) => [permission, false])) as Record<KhePermission, boolean>,
    'dashboard.view': true,
    'clients.view': true,
    'events.view': true,
    'studio.view': true,
  },
};

export function resolvedPermissions(role: string, overrides: unknown): Record<KhePermission, boolean> {
  const defaults = ROLE_PERMISSION_DEFAULTS[role] ?? ROLE_PERMISSION_DEFAULTS.OPERATOR;
  const parsed = overrides && typeof overrides === 'object' && !Array.isArray(overrides)
    ? overrides as Record<string, unknown>
    : {};
  const result = { ...defaults };
  for (const permission of KHE_PERMISSIONS) {
    if (typeof parsed[permission] === 'boolean') result[permission] = parsed[permission] as boolean;
  }
  if (role === 'OWNER') {
    for (const permission of KHE_PERMISSIONS) result[permission] = true;
  }
  return result;
}
