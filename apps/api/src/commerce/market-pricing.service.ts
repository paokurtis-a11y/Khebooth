import { Injectable } from '@nestjs/common';

export const SUPPORTED_MARKET_CURRENCIES = ['CHF', 'EUR', 'GBP', 'USD', 'CAD', 'AUD'] as const;
export type MarketCurrency = (typeof SUPPORTED_MARKET_CURRENCIES)[number];
export type MarketRegion = 'SWITZERLAND' | 'EUROZONE' | 'AFRICA' | 'ASIA' | 'AMERICAS' | 'OTHER';

const EURO_COUNTRIES = new Set(['AT','BE','HR','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES']);
const AFRICA_COUNTRIES = new Set(['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW']);
const ASIA_COUNTRIES = new Set(['AF','AM','AZ','BH','BD','BT','BN','KH','CN','GE','HK','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MO','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE']);
const AMERICAS_COUNTRIES = new Set(['US','CA','MX','AR','BO','BR','CL','CO','EC','GY','PY','PE','SR','UY','VE','BZ','CR','SV','GT','HN','NI','PA','CU','DO','HT','JM','BS','BB','TT','AG','DM','GD','KN','LC','VC']);
const LOCALE_BY_COUNTRY: Record<string,string> = {
  CH:'fr-CH', LI:'de-LI', FR:'fr-FR', DE:'de-DE', AT:'de-AT', IT:'it-IT', ES:'es-ES', PT:'pt-PT',
  GB:'en-GB', US:'en-US', CA:'en-CA', AU:'en-AU', BE:'fr-BE', NL:'nl-NL', IE:'en-IE',
};

export type MarketContext = {
  country: string;
  region: MarketRegion;
  currency: MarketCurrency;
  locale: string;
  unitSystem: 'metric' | 'imperial';
  billingUnit: 'month';
};

@Injectable()
export class MarketPricingService {
  market(countryValue?: string | null, currencyOverride?: string | null): MarketContext {
    const country = String(countryValue || 'CH').trim().toUpperCase().slice(0,2) || 'CH';
    const requested = String(currencyOverride || '').trim().toUpperCase();
    const currency = SUPPORTED_MARKET_CURRENCIES.includes(requested as MarketCurrency)
      ? requested as MarketCurrency
      : this.currencyForCountry(country);
    return {
      country,
      region: this.regionForCountry(country),
      currency,
      locale: LOCALE_BY_COUNTRY[country] || this.localeForCurrency(currency),
      unitSystem: ['US','LR','MM'].includes(country) ? 'imperial' : 'metric',
      billingUnit: 'month',
    };
  }

  regionForCountry(country: string): MarketRegion {
    if (country === 'CH' || country === 'LI') return 'SWITZERLAND';
    if (EURO_COUNTRIES.has(country)) return 'EUROZONE';
    if (AFRICA_COUNTRIES.has(country)) return 'AFRICA';
    if (ASIA_COUNTRIES.has(country)) return 'ASIA';
    if (AMERICAS_COUNTRIES.has(country)) return 'AMERICAS';
    return 'OTHER';
  }

  localizedAmount(priceMonthlyChf: number | null, localizedPrices: unknown, currency: MarketCurrency): number | null {
    if (priceMonthlyChf === null) return null;
    if (currency === 'CHF') return priceMonthlyChf;
    if (localizedPrices && typeof localizedPrices === 'object' && !Array.isArray(localizedPrices)) {
      const raw = (localizedPrices as Record<string, unknown>)[currency];
      const amount = Number(raw);
      if (Number.isInteger(amount) && amount >= 0) return amount;
    }
    return priceMonthlyChf;
  }

  private currencyForCountry(country: string): MarketCurrency {
    if (country === 'CH' || country === 'LI') return 'CHF';
    if (EURO_COUNTRIES.has(country)) return 'EUR';
    if (country === 'GB') return 'GBP';
    if (country === 'US') return 'USD';
    if (country === 'CA') return 'CAD';
    if (country === 'AU') return 'AUD';
    return 'CHF';
  }

  private localeForCurrency(currency: MarketCurrency): string {
    if (currency === 'EUR') return 'fr-FR';
    if (currency === 'GBP') return 'en-GB';
    if (currency === 'USD') return 'en-US';
    if (currency === 'CAD') return 'en-CA';
    if (currency === 'AUD') return 'en-AU';
    return 'fr-CH';
  }
}
