export const SUBSCRIPTION_PLANS = ['DISCOVERY', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = ['PROSPECT', 'PLAN_SELECTED', 'PAYMENT_PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = ['UNPAID', 'PENDING', 'PAID', 'OVERDUE', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlan;
  name: string;
  tagline: string;
  priceMonthlyChf: number | null;
  highlighted?: boolean;
  features: readonly string[];
  actionLabel: string;
}

/** Fallback commercial catalog. Production pages load the live catalog from the KHE Booth API. */
export const SUBSCRIPTION_CATALOG: readonly SubscriptionPlanDefinition[] = [
  {
    id: 'DISCOVERY',
    name: 'Découverte',
    tagline: 'Pour découvrir KHE Booth avant de passer à une exploitation connectée.',
    priceMonthlyChf: 0,
    features: ['1 événement actif', 'CAPTURE locale', 'Galerie locale', 'Studio créatif essentiel', 'Support standard'],
    actionLabel: 'Commencer gratuitement',
  },
  {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Pour les indépendants et petites prestations régulières.',
    priceMonthlyChf: 29,
    features: ['Tout Découverte', 'CAPTURE + SHARING', 'Synchronisation Cloud', 'QR invité sécurisé', 'Jusqu’à 5 événements actifs'],
    actionLabel: 'Choisir Starter',
  },
  {
    id: 'PRO',
    name: 'Pro',
    tagline: 'Pour les professionnels de l’événementiel qui veulent exploiter KHE Booth sans limites essentielles.',
    priceMonthlyChf: 59,
    highlighted: true,
    features: ['Tout Starter', 'Événements illimités', 'Studio créatif complet', 'Audio et rendus avancés', 'Branding avancé', 'Support prioritaire Pro'],
    actionLabel: 'Passer en Pro',
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    tagline: 'Pour les agences et équipes qui gèrent plusieurs clients et opérateurs.',
    priceMonthlyChf: 99,
    features: ['Tout Pro', 'Multi-utilisateurs', 'Gestion clients avancée', 'Marketing & Analytics', 'Tableaux de bord', 'Automatisations avancées'],
    actionLabel: 'Choisir Business',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Pour les réseaux, franchises, grandes agences et déploiements sur mesure.',
    priceMonthlyChf: null,
    features: ['Tout Business', 'Gestion multi-sites', 'SLA et support dédié', 'Intégrations personnalisées', 'Déploiement sur mesure', 'Accompagnement commercial'],
    actionLabel: 'Parler à KHE',
  },
] as const;

export function subscriptionPlanLabel(plan: SubscriptionPlan): string {
  return SUBSCRIPTION_CATALOG.find((item) => item.id === plan)?.name ?? plan;
}
