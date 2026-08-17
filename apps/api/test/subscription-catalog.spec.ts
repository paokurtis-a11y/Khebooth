import { SUBSCRIPTION_CATALOG, SUBSCRIPTION_PLANS } from '@khe/contracts';

describe('KHE Booth subscription catalog', () => {
  it('keeps one shared commercial definition for all supported plans', () => {
    expect(SUBSCRIPTION_CATALOG.map((plan) => plan.id)).toEqual(SUBSCRIPTION_PLANS);
    expect(new Set(SUBSCRIPTION_CATALOG.map((plan) => plan.id)).size).toBe(SUBSCRIPTION_CATALOG.length);
    expect(SUBSCRIPTION_CATALOG.find((plan) => plan.id === 'PRO')?.highlighted).toBe(true);
    expect(SUBSCRIPTION_CATALOG.find((plan) => plan.id === 'DISCOVERY')?.priceMonthlyChf).toBe(0);
    expect(SUBSCRIPTION_CATALOG.find((plan) => plan.id === 'ENTERPRISE')?.priceMonthlyChf).toBeNull();
    expect(SUBSCRIPTION_CATALOG.every((plan) => plan.features.length >= 4)).toBe(true);
  });
});
