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

/** Single commercial source used by both the public marketing page and the authenticated Clients portal. */
export const SUBSCRIPTION_CATALOG: readonly SubscriptionPlanDefinition[] = [
  { id: 'DISCOVERY', name: 'Découverte', tagline: 'Pour découvrir KHE Booth et préparer son premier événement.', priceMonthlyChf: 0, features: ['1 espace KHE Booth', 'Studio créatif essentiel', 'Galerie locale', 'Support standard'], actionLabel: 'Commencer gratuitement' },
  { id: 'STARTER', name: 'Starter', tagline: 'Pour les indépendants et petites prestations régulières.', priceMonthlyChf: 29, features: ['CAPTURE + SHARING', 'Synchronisation cloud', 'QR invité sécurisé', 'Jusqu’à 5 événements actifs', 'Support prioritaire'], actionLabel: 'Choisir Starter' },
  { id: 'PRO', name: 'Pro', tagline: 'Pour les professionnels de l’événementiel qui veulent accélérer.', priceMonthlyChf: 69, highlighted: true, features: ['Tout Starter', 'Événements illimités', 'Branding avancé', 'Studio créatif complet', 'Musique et rendus avancés', 'Support prioritaire Pro'], actionLabel: 'Passer en Pro' },
  { id: 'BUSINESS', name: 'Business', tagline: 'Pour les agences et équipes qui gèrent plusieurs clients et stations.', priceMonthlyChf: 149, features: ['Tout Pro', 'Multi-utilisateurs', 'Gestion clients avancée', 'Tableaux de bord', 'Priorité de synchronisation', 'Accompagnement KHE'], actionLabel: 'Choisir Business' },
  { id: 'ENTERPRISE', name: 'Enterprise', tagline: 'Pour les réseaux, franchises, grandes agences et déploiements sur mesure.', priceMonthlyChf: null, features: ['Tout Business', 'Déploiement sur mesure', 'Gestion multi-sites', 'SLA et support dédié', 'Intégrations personnalisées', 'Accompagnement commercial'], actionLabel: 'Parler à KHE' },
] as const;

export function subscriptionPlanLabel(plan: SubscriptionPlan): string {
  return SUBSCRIPTION_CATALOG.find((item) => item.id === plan)?.name ?? plan;
}
