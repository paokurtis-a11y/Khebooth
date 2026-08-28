export const KHE_PLANS = ['DISCOVERY', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;

export type KhePlan = (typeof KHE_PLANS)[number];

const PLAN_RANK: Record<KhePlan, number> = {
  DISCOVERY: 0,
  STARTER: 1,
  PRO: 2,
  BUSINESS: 3,
  ENTERPRISE: 4,
};

export function normalizeKhePlan(value: string | null | undefined): KhePlan {
  const normalized = value?.trim().toUpperCase();
  return normalized && normalized in PLAN_RANK ? normalized as KhePlan : 'DISCOVERY';
}

export function planIncludes(value: string | null | undefined, minimum: KhePlan): boolean {
  return PLAN_RANK[normalizeKhePlan(value)] >= PLAN_RANK[minimum];
}

export function canRemoveKheBranding(
  plan: string | null | undefined,
  entitlements?: Record<string, boolean> | null,
): boolean {
  return entitlements?.REMOVE_KHE_BRANDING === true || planIncludes(plan, 'PRO');
}
